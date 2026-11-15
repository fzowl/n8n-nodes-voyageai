import { VoyageAIClient } from 'voyageai';
import { Embeddings } from '@langchain/core/embeddings';
import {
	NodeConnectionTypes,
	NodeOperationError,
	type INodeType,
	type INodeTypeDescription,
	type ISupplyDataFunctions,
	type SupplyData,
	type INodeExecutionData,
} from 'n8n-workflow';

import { logWrapper } from '../../utils/logWrapper';
import { getConnectionHintNoticeField } from '../../utils/sharedFields';
import {
	CONTEXTUALIZED_TOKEN_LIMIT,
	MAX_INPUTS_PER_REQUEST,
	countTokensForTexts,
	packBatches,
} from '../../utils/tokenBudget';
import { getVoyageErrorMessage } from '../../utils/voyageError';

/** Target chunk size (in tokens) sent with every auto-chunked request. */
const CHUNK_SIZE = 32_000;

interface DocumentChunk {
	text: string;
	embedding: number[];
}

/**
 * Custom embeddings class that wraps the Voyage AI by MongoDB contextualized embeddings API.
 * Each input item is one whole document. The API chunks every document on the server
 * (`enable_auto_chunking`), so the document text goes in as a flat list of strings.
 * Embeddings are pre-computed once per node run and served from a cache.
 */
class VoyageAIContextualizedEmbeddings extends Embeddings {
	private client: VoyageAIClient;
	private model: string;
	private outputDimension?: number;
	private outputDtype?: 'float' | 'int8' | 'uint8' | 'binary' | 'ubinary';
	private executeFunctions: ISupplyDataFunctions;
	private documentIdField: string;
	private textField: string;
	private node: ReturnType<ISupplyDataFunctions['getNode']>;

	// Cache of pre-computed chunks, keyed by the full document text
	private chunksByDocument: Map<string, DocumentChunk[]> | null = null;

	constructor(fields: {
		apiKey: string;
		baseURL?: string;
		model: string;
		outputDimension?: number;
		outputDtype?: 'float' | 'int8' | 'uint8' | 'binary' | 'ubinary';
		executeFunctions: ISupplyDataFunctions;
		documentIdField: string;
		textField: string;
		node: ReturnType<ISupplyDataFunctions['getNode']>;
	}) {
		super({});

		this.model = fields.model;
		this.outputDimension = fields.outputDimension;
		this.outputDtype = fields.outputDtype;
		this.executeFunctions = fields.executeFunctions;
		this.documentIdField = fields.documentIdField;
		this.textField = fields.textField;
		this.node = fields.node;

		this.client = new VoyageAIClient({
			apiKey: fields.apiKey,
			environment: fields.baseURL,
		});
	}

	/**
	 * Pre-compute embeddings for all input items.
	 * Every item is one whole document; requests are split by the per-request token and
	 * input limits and the API chunks each document.
	 */
	async precomputeEmbeddings(items: INodeExecutionData[]): Promise<void> {
		const documents: string[] = [];
		const seenIds = new Set<string>();

		for (const item of items) {
			const docId = item.json[this.documentIdField];
			const text = item.json[this.textField];

			if (docId === undefined || docId === null) {
				throw new NodeOperationError(
					this.node,
					`Missing document ID in field: ${this.documentIdField}`,
				);
			}
			if (!text) {
				throw new NodeOperationError(this.node, `Missing text in field: ${this.textField}`);
			}
			if (typeof text !== 'string') {
				throw new NodeOperationError(
					this.node,
					`Field ${this.textField} must hold the whole document as a string; pre-chunked lists are not supported because the API chunks each document itself`,
				);
			}

			const docIdStr = String(docId);
			if (seenIds.has(docIdStr)) {
				throw new NodeOperationError(
					this.node,
					`Duplicate document ID ${docIdStr}: send each document once, as a single item with its whole text`,
				);
			}
			seenIds.add(docIdStr);
			documents.push(text);
		}

		try {
			const tokenCounts = await countTokensForTexts(this.client, documents, this.model);
			const batches = packBatches(tokenCounts, CONTEXTUALIZED_TOKEN_LIMIT, MAX_INPUTS_PER_REQUEST);

			const chunksByDocument = new Map<string, DocumentChunk[]>();
			let totalChunks = 0;

			for (const indices of batches) {
				const batchDocuments = indices.map((index) => documents[index]);

				const response = await this.client.contextualizedEmbed({
					inputs: batchDocuments,
					model: this.model,
					inputType: 'document',
					enableAutoChunking: true,
					chunkSize: CHUNK_SIZE,
					outputDimension: this.outputDimension,
					outputDtype: this.outputDtype,
				});

				if (response.results.length !== batchDocuments.length) {
					throw new NodeOperationError(
						this.node,
						`Expected ${batchDocuments.length} documents but received ${response.results.length}`,
					);
				}

				for (const result of response.results) {
					const chunkTexts = result.chunkTexts;
					if (!chunkTexts || chunkTexts.length !== result.embeddings.length) {
						throw new NodeOperationError(
							this.node,
							'The API did not return the text of every chunk for auto-chunked documents',
						);
					}
					chunksByDocument.set(
						batchDocuments[result.index],
						result.embeddings.map((embedding, i) => ({ text: chunkTexts[i], embedding })),
					);
					totalChunks += result.embeddings.length;
				}
			}

			this.chunksByDocument = chunksByDocument;

			this.executeFunctions.logger.debug(
				`Voyage AI by MongoDB contextualized embeddings: ${totalChunks} chunks from ${documents.length} documents in ${batches.length} requests`,
			);
		} catch (error) {
			if (error instanceof NodeOperationError) {
				throw error;
			}
			throw new NodeOperationError(
				this.node,
				`Voyage AI by MongoDB API error: ${getVoyageErrorMessage(error)}`,
			);
		}
	}

	/**
	 * Returns the chunks (text and embedding) the API produced for each document, in document order.
	 */
	async embedDocumentChunks(documents: string[]): Promise<DocumentChunk[]> {
		if (!this.chunksByDocument) {
			throw new NodeOperationError(
				this.node,
				'Embeddings not pre-computed. This should not happen in normal operation.',
			);
		}

		const chunks: DocumentChunk[] = [];
		for (const doc of documents) {
			const documentChunks = this.chunksByDocument.get(doc);
			if (!documentChunks) {
				throw new NodeOperationError(
					this.node,
					`Document not found in pre-computed cache: ${doc.slice(0, 80)}${doc.length > 80 ? '...' : ''}`,
				);
			}
			chunks.push(...documentChunks);
		}

		return chunks;
	}

	/**
	 * Returns one embedding per chunk. A document longer than one chunk yields several
	 * embeddings, so the result can be longer than the input list.
	 */
	async embedDocuments(documents: string[]): Promise<number[][]> {
		const chunks = await this.embedDocumentChunks(documents);
		return chunks.map((chunk) => chunk.embedding);
	}

	async embedQuery(query: string): Promise<number[]> {
		try {
			// Query mode does not use auto-chunking: one query as a single-chunk document
			const response = await this.client.contextualizedEmbed({
				inputs: [[query]],
				model: this.model,
				inputType: 'query',
				outputDimension: this.outputDimension,
				outputDtype: this.outputDtype,
			});

			const embedding = response.results[0]?.embeddings[0];
			if (!embedding || embedding.length === 0) {
				throw new NodeOperationError(
					this.node,
					'No embedding data returned from Voyage AI by MongoDB API',
				);
			}

			return embedding;
		} catch (error) {
			if (error instanceof NodeOperationError) {
				throw error;
			}
			throw new NodeOperationError(
				this.node,
				`Voyage AI by MongoDB API error: ${getVoyageErrorMessage(error)}`,
			);
		}
	}
}

export class EmbeddingsVoyageAiContextualized implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Embeddings Voyage AI by MongoDB Contextualized',
		name: 'embeddingsVoyageAiContextualized',
		icon: 'file:voyageAi.svg',
		group: ['transform'],
		version: 1,
		description:
			'Generate contextual embeddings for whole documents using Voyage AI by MongoDB. Each document is chunked by the API, and every chunk is embedded with the context of the whole document',
		defaults: {
			name: 'Embeddings Voyage AI by MongoDB Contextualized',
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
						url: 'https://docs.voyageai.com/docs/contextualized-chunk-embeddings',
					},
				],
			},
		},

		inputs: [NodeConnectionTypes.Main],

		outputs: [NodeConnectionTypes.AiEmbedding],
		outputNames: ['Embeddings'],
		properties: [
			getConnectionHintNoticeField([NodeConnectionTypes.AiVectorStore]),
			{
				displayName:
					'Each input item is one whole document. The API splits every document into chunks and embeds each chunk with the context of the whole document; only a document longer than 32,000 tokens produces several chunks. Do not send pre-chunked text or split the documents with a text splitter.',
				name: 'notice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Model',
				name: 'modelName',
				type: 'options',
				description:
					'The contextualized embeddings model. Vectors of different models are not compatible. <a href="https://docs.voyageai.com/docs/contextualized-chunk-embeddings" target="_blank">Learn more</a>.',
				default: 'voyage-context-3',
				options: [
					{
						name: 'Voyage-Context-4',
						value: 'voyage-context-4',
						description:
							'Contextualized chunk embeddings optimized for general-purpose and multilingual retrieval quality',
					},
					{
						name: 'Voyage-Context-3',
						value: 'voyage-context-3',
						description: 'Previous generation of contextualized chunk embeddings',
					},
				],
			},
			{
				displayName: 'Document ID Field',
				name: 'documentIdField',
				type: 'string',
				default: 'documentId',
				required: true,
				description: 'The field name containing the document identifier. Each ID must appear once.',
				placeholder: 'documentId',
			},
			{
				displayName: 'Text Field',
				name: 'textField',
				type: 'string',
				default: 'text',
				required: true,
				description: 'The field name containing the whole document text to embed',
				placeholder: 'text',
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
						displayName: 'Output Dimension',
						name: 'outputDimension',
						type: 'options',
						default: 0,
						description: 'The number of dimensions for the output embeddings. Default is 1024.',
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
						description:
							'The data type for embeddings. Quantization options reduce storage and improve latency.',
						options: [
							{
								name: 'Binary',
								value: 'binary',
							},
							{
								name: 'Float (Full Precision)',
								value: 'float',
							},
							{
								name: 'Int8 (8-Bit Integer)',
								value: 'int8',
							},
							{
								name: 'Ubinary (Unsigned Binary)',
								value: 'ubinary',
							},
							{
								name: 'Uint8 (Unsigned 8-Bit Integer)',
								value: 'uint8',
							},
						],
					},
				],
			},
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		this.logger.debug('Supply data for Voyage AI by MongoDB contextualized embeddings');

		const credentials = await this.getCredentials<{ apiKey: string; url?: string }>('voyageAiApi');

		const modelName = this.getNodeParameter('modelName', itemIndex, 'voyage-context-3') as string;
		const documentIdField = this.getNodeParameter('documentIdField', 0) as string;
		const textField = this.getNodeParameter('textField', 0) as string;

		const options = this.getNodeParameter('options', itemIndex, {}) as {
			outputDimension?: number;
			outputDtype?: 'float' | 'int8' | 'uint8' | 'binary' | 'ubinary';
		};

		const baseURL = credentials.url || 'https://api.voyageai.com/v1';

		const outputDimension =
			options.outputDimension && options.outputDimension !== 0
				? options.outputDimension
				: undefined;

		const embeddings = new VoyageAIContextualizedEmbeddings({
			apiKey: credentials.apiKey,
			baseURL,
			model: modelName,
			outputDimension,
			outputDtype: options.outputDtype,
			executeFunctions: this,
			documentIdField,
			textField,
			node: this.getNode(),
		});

		const items = this.getInputData();
		await embeddings.precomputeEmbeddings(items);

		return {
			response: logWrapper(embeddings, this),
		};
	}
}
