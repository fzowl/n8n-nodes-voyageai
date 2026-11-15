import { VoyageAIClient } from 'voyageai';
import { Embeddings } from '@langchain/core/embeddings';
import {
	NodeConnectionTypes,
	type INodeType,
	type INodeTypeDescription,
	type ISupplyDataFunctions,
	type SupplyData,
} from 'n8n-workflow';

import { logWrapper } from '../../utils/logWrapper';
import { getConnectionHintNoticeField } from '../../utils/sharedFields';
import { getProxyAgent } from '../../utils/httpProxyAgent';
import {
	getTokenBudget,
	countTokensForTexts,
	packBatches,
	MAX_INPUTS_PER_REQUEST,
} from '../../utils/tokenBudget';
import { getVoyageErrorMessage } from '../../utils/voyageError';

/**
 * Custom embeddings class that wraps the Voyage AI by MongoDB SDK directly.
 * Supports all voyage-4 and legacy models with full parameter control.
 */
class VoyageAIEmbeddings extends Embeddings {
	private client: VoyageAIClient;
	private model: string;
	private batchSize: number;
	private inputType?: 'query' | 'document';
	private outputDimension?: number;
	private outputDtype?: string;
	private truncation?: boolean;
	private encodingFormat?: string;

	constructor(fields: {
		apiKey: string;
		baseURL?: string;
		model: string;
		batchSize?: number;
		inputType?: 'query' | 'document';
		outputDimension?: number;
		outputDtype?: string;
		truncation?: boolean;
		encodingFormat?: string;
	}) {
		super({});

		this.model = fields.model;
		this.batchSize = fields.batchSize ?? MAX_INPUTS_PER_REQUEST;
		this.inputType = fields.inputType;
		this.outputDimension = fields.outputDimension;
		this.outputDtype = fields.outputDtype;
		this.truncation = fields.truncation;
		this.encodingFormat = fields.encodingFormat;

		const clientOptions: ConstructorParameters<typeof VoyageAIClient>[0] = {
			apiKey: fields.apiKey,
		};

		if (fields.baseURL) {
			clientOptions.environment = fields.baseURL;
		}

		const proxyAgent = getProxyAgent(fields.baseURL || 'https://api.voyageai.com/v1');
		if (proxyAgent) {
			clientOptions.fetch = ((url: string | URL | Request, init?: RequestInit) => {
				return fetch(url, { ...init, dispatcher: proxyAgent } as any);
			}) as typeof fetch;
		}

		this.client = new VoyageAIClient(clientOptions);
	}

	private buildEmbedParams(input: string | string[], inputType?: 'query' | 'document') {
		const params: any = {
			input,
			model: this.model,
		};

		if (inputType ?? this.inputType) {
			params.inputType = inputType ?? this.inputType;
		}
		if (this.outputDimension) {
			params.outputDimension = this.outputDimension;
		}
		if (this.outputDtype && this.outputDtype !== 'float') {
			params.outputDtype = this.outputDtype;
		}
		if (this.truncation !== undefined) {
			params.truncation = this.truncation;
		}
		if (this.encodingFormat && this.encodingFormat !== 'float') {
			params.encodingFormat = this.encodingFormat;
		}

		return params;
	}

	private async embed(input: string | string[], inputType?: 'query' | 'document') {
		try {
			return await this.client.embed(this.buildEmbedParams(input, inputType));
		} catch (error) {
			throw new Error(`Voyage AI by MongoDB API error: ${getVoyageErrorMessage(error)}`);
		}
	}

	async embedDocuments(texts: string[]): Promise<number[][]> {
		const allEmbeddings: number[][] = [];
		const tokenBudget = getTokenBudget(this.model);

		// Replace empty strings with a space to avoid API errors
		const sanitized = texts.map((t) => (t === '' ? ' ' : t));

		// Exact token counts from the SDK tokenizer
		const tokenCounts = await countTokensForTexts(this.client, sanitized, this.model);

		// Greedy packing: fill a batch until the batch size, the 1000 input limit
		// or the model's request token budget is reached. Order is preserved.
		const maxItems = Math.min(this.batchSize, MAX_INPUTS_PER_REQUEST);
		for (const indices of packBatches(tokenCounts, tokenBudget, maxItems)) {
			const response = await this.embed(indices.map((index) => sanitized[index]));

			if (response.data) {
				for (const item of response.data) {
					if (item.embedding) {
						allEmbeddings.push(item.embedding);
					}
				}
			}
		}

		return allEmbeddings;
	}

	async embedQuery(text: string): Promise<number[]> {
		const response = await this.embed(text, 'query');

		if (response.data && response.data.length > 0 && response.data[0].embedding) {
			return response.data[0].embedding;
		}

		return [];
	}
}

const MODELS_SUPPORTING_DIMENSIONS = [
	'voyage-4-large',
	'voyage-4',
	'voyage-4-lite',
	'voyage-4-nano',
	'voyage-code-4',
	'voyage-3.5',
	'voyage-3.5-lite',
	'voyage-3-large',
	'voyage-code-3',
];

export class EmbeddingsVoyageAi implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Embeddings Voyage AI by MongoDB',
		name: 'embeddingsVoyageAi',
		icon: 'file:voyageAi.svg',
		group: ['transform'],
		version: 1,
		description: "Use Voyage AI by MongoDB's Embeddings models",
		defaults: {
			name: 'Embeddings Voyage AI by MongoDB',
		},
		requestDefaults: {
			ignoreHttpStatusErrors: true,
			baseURL: '={{ $credentials.url }}',
		},
		credentials: [
			{
				name: 'voyageAiApi',
				required: true,
			},
		],
		codex: {
			categories: ['AI'],
			subcategories: {
				AI: ['Embeddings'],
			},
			resources: {
				primaryDocumentation: [
					{
						url: 'https://docs.voyageai.com/docs/embeddings',
					},
				],
			},
		},

		inputs: [],

		outputs: [NodeConnectionTypes.AiEmbedding],
		outputNames: ['Embeddings'],
		properties: [
			getConnectionHintNoticeField([NodeConnectionTypes.AiVectorStore]),
			{
				displayName:
					'Each model uses different dimensional density for embeddings. Ensure you use the same dimensionality for your vector store. The default model uses 1024-dimensional embeddings.',
				name: 'notice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Model',
				name: 'modelName',
				type: 'options',
				description:
					'The model which will generate the embeddings. <a href="https://docs.voyageai.com/docs/embeddings" target="_blank">Learn more</a>.',
				default: 'voyage-4',
				options: [
					{
						name: 'Voyage-4-Large (Best Quality)',
						value: 'voyage-4-large',
						description: 'Flagship model, best general-purpose and multilingual quality',
					},
					{
						name: 'Voyage-4 (General Purpose)',
						value: 'voyage-4',
						description: 'General-purpose model, strong quality',
					},
					{
						name: 'Voyage-4-Lite (Fast & Affordable)',
						value: 'voyage-4-lite',
						description: 'Optimized for latency and cost',
					},
					{
						name: 'Voyage-4-Nano (Open Weight)',
						value: 'voyage-4-nano',
						description: 'Open-weight model, smallest and fastest',
					},
					{
						name: 'Voyage-Code-4 (Code)',
						value: 'voyage-code-4',
						description: 'Optimized for code retrieval and coding agent use cases',
					},
					{
						name: 'Voyage-Code-3 (Code)',
						value: 'voyage-code-3',
						description: 'Optimized for code retrieval',
					},
					{
						name: 'Voyage-Finance-2 (Finance)',
						value: 'voyage-finance-2',
						description: 'Optimized for finance domain',
					},
					{
						name: 'Voyage-Law-2 (Legal)',
						value: 'voyage-law-2',
						description: 'Optimized for legal domain',
					},
					{
						name: 'Voyage-Multilingual-2 (Multilingual)',
						value: 'voyage-multilingual-2',
						description: 'Optimized for multilingual content',
					},
					{
						name: 'Voyage-3.5 (Legacy)',
						value: 'voyage-3.5',
						description: 'Previous generation general-purpose',
					},
					{
						name: 'Voyage-3.5-Lite (Legacy)',
						value: 'voyage-3.5-lite',
						description: 'Previous generation lite',
					},
					{
						name: 'Voyage-3-Large (Legacy)',
						value: 'voyage-3-large',
						description: 'Previous generation large',
					},
				],
			},
			{
				displayName: 'Output Dimension',
				name: 'outputDimension',
				type: 'options',
				default: 0,
				description:
					'The number of dimensions for the output embeddings. Only supported by voyage-4*, voyage-code-4, voyage-3.5*, voyage-3-large, and voyage-code-3.',
				displayOptions: {
					show: {
						modelName: MODELS_SUPPORTING_DIMENSIONS,
					},
				},
				options: [
					{
						name: 'Default (1024)',
						value: 0,
					},
					{
						name: '256',
						value: 256,
					},
					{
						name: '512',
						value: 512,
					},
					{
						name: '1024',
						value: 1024,
					},
					{
						name: '2048',
						value: 2048,
					},
				],
			},
			{
				displayName: 'Output Data Type',
				name: 'outputDtype',
				type: 'options',
				default: 'float',
				description: 'Quantization reduces storage and improves latency.',
				displayOptions: {
					show: {
						modelName: MODELS_SUPPORTING_DIMENSIONS,
					},
				},
				options: [
					{
						name: 'Float (Full Precision)',
						value: 'float',
					},
					{
						name: 'Int8',
						value: 'int8',
					},
					{
						name: 'Uint8',
						value: 'uint8',
					},
					{
						name: 'Binary',
						value: 'binary',
					},
					{
						name: 'Ubinary',
						value: 'ubinary',
					},
				],
			},
			{
				displayName: 'Options',
				name: 'options',
				placeholder: 'Add Option',
				description: 'Additional options to add',
				type: 'collection',
				default: {},
				options: [
					{
						displayName: 'Batch Size',
						name: 'batchSize',
						type: 'number',
						default: 1000,
						typeOptions: { minValue: 1, maxValue: 1000 },
						description:
							"Maximum number of documents to send in each request (max 1000). Requests are also split by the model's token limit, counted with the SDK tokenizer.",
					},
					{
						displayName: 'Input Type',
						name: 'inputType',
						type: 'options',
						default: '',
						description:
							'Type of input for optimized embeddings. Embeddings with and without input_type are compatible.',
						options: [
							{
								name: 'None',
								value: '',
								description: 'No optimization',
							},
							{
								name: 'Query',
								value: 'query',
								description: 'Optimize for search queries',
							},
							{
								name: 'Document',
								value: 'document',
								description: 'Optimize for documents to be searched',
							},
						],
					},
					{
						displayName: 'Truncate',
						name: 'truncation',
						type: 'boolean',
						default: true,
						description:
							'Whether to truncate input texts that exceed the maximum context length. If false, an error will be raised for oversized inputs.',
					},
					{
						displayName: 'Encoding Format',
						name: 'encodingFormat',
						type: 'options',
						default: 'float',
						description: 'The format to return the embeddings in',
						options: [
							{
								name: 'Float',
								value: 'float',
								description: 'Standard floating-point numbers',
							},
							{
								name: 'Base64',
								value: 'base64',
								description: 'Base64-encoded binary format',
							},
						],
					},
				],
			},
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		this.logger.debug('Supply data for embeddings Voyage AI by MongoDB');

		const modelName = this.getNodeParameter('modelName', itemIndex, 'voyage-4') as string;
		const credentials = await this.getCredentials<{ apiKey: string; url?: string }>('voyageAiApi');

		const outputDimensionRaw = this.getNodeParameter('outputDimension', itemIndex, 0) as number;
		const outputDtypeRaw = this.getNodeParameter('outputDtype', itemIndex, 'float') as string;

		const options = this.getNodeParameter('options', itemIndex, {}) as {
			batchSize?: number;
			inputType?: string;
			truncation?: boolean;
			encodingFormat?: 'float' | 'base64';
		};

		// Get base URL from credentials (defaults to https://api.voyageai.com/v1)
		const baseURL = credentials.url || 'https://api.voyageai.com/v1';

		// Convert empty string to undefined for inputType
		const inputType =
			options.inputType && options.inputType !== ''
				? (options.inputType as 'query' | 'document')
				: undefined;

		// Convert 0 to undefined for outputDimension (0 means "use default")
		const outputDimension =
			outputDimensionRaw && outputDimensionRaw !== 0 ? outputDimensionRaw : undefined;

		const embeddings = new VoyageAIEmbeddings({
			apiKey: credentials.apiKey,
			baseURL,
			model: modelName,
			batchSize: options.batchSize,
			inputType,
			outputDimension,
			outputDtype: outputDtypeRaw,
			truncation: options.truncation,
			encodingFormat: options.encodingFormat,
		});

		return {
			response: logWrapper(embeddings, this),
		};
	}
}
