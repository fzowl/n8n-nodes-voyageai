/* eslint-disable @typescript-eslint/unbound-method */

import type { MockProxy } from 'jest-mock-extended';
import { mock } from 'jest-mock-extended';
import type { ISupplyDataFunctions, INodeExecutionData, Logger } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { EmbeddingsVoyageAiContextualized } from '../../nodes/EmbeddingsVoyageAiContextualized/EmbeddingsVoyageAiContextualized.node';

// Mock VoyageAI SDK - define functions that can be referenced
const mockContextualizedEmbed = jest.fn();
const mockTokenize = jest.fn();

jest.mock('voyageai', () => {
	return {
		VoyageAIClient: jest.fn().mockImplementation(() => ({
			contextualizedEmbed: mockContextualizedEmbed,
			tokenize: mockTokenize,
		})),
	};
});

jest.mock('@utils/logWrapper', () => ({
	logWrapper: jest.fn().mockImplementation((obj) => obj),
}));

// Import after mocking
import { VoyageAIClient } from 'voyageai';
const mockVoyageAIClient = VoyageAIClient as jest.MockedClass<typeof VoyageAIClient>;

describe('EmbeddingsVoyageAiContextualized', () => {
	let node: EmbeddingsVoyageAiContextualized;
	let mockContext: MockProxy<ISupplyDataFunctions>;
	let mockLogger: MockProxy<Logger>;

	beforeEach(() => {
		node = new EmbeddingsVoyageAiContextualized();
		mockLogger = mock<Logger>();
		mockContext = mock<ISupplyDataFunctions>({
			logger: mockLogger,
		});

		// Reset mocks
		mockContextualizedEmbed.mockReset();
		mockTokenize.mockReset();
		// Default: every text is 10 tokens
		mockTokenize.mockImplementation(async (texts: string[]) =>
			texts.map(() => ({ tokens: [], ids: new Array(10).fill(0) })),
		);
		mockVoyageAIClient.mockClear();

		// Default mock implementations
		mockContext.getCredentials.mockResolvedValue({
			apiKey: 'test-api-key',
			url: 'https://api.voyageai.com/v1',
		});

		mockContext.getNodeParameter.mockImplementation((parameterName: string) => {
			if (parameterName === 'modelName') return 'voyage-context-3';
			if (parameterName === 'documentIdField') return 'documentId';
			if (parameterName === 'textField') return 'text';
			if (parameterName === 'options') return {};
			return undefined;
		});
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	describe('Node Configuration', () => {
		it('should have correct node metadata', () => {
			expect(node.description.displayName).toBe('Embeddings Voyage AI by MongoDB Contextualized');
			expect(node.description.name).toBe('embeddingsVoyageAiContextualized');
			expect(node.description.version).toBe(1);
		});

		it('should require voyageAiApi credentials', () => {
			const credentials = node.description.credentials;
			expect(credentials).toHaveLength(1);
			expect(credentials?.[0].name).toBe('voyageAiApi');
			expect(credentials?.[0].required).toBe(true);
		});

		it('should offer both contextualized models with voyage-context-3 as default', () => {
			const model = node.description.properties.find((p) => p.name === 'modelName');
			expect(model?.default).toBe('voyage-context-3');
			expect((model?.options as Array<{ value: string }>).map((o) => o.value)).toEqual([
				'voyage-context-4',
				'voyage-context-3',
			]);
		});

		it('should not offer an input type option, document mode is fixed by auto-chunking', () => {
			const options = node.description.properties.find((p) => p.name === 'options');
			const names = (options?.options as Array<{ name: string }>).map((o) => o.name);
			expect(names).not.toContain('inputType');
		});

		it('should have required parameters', () => {
			const properties = node.description.properties;
			const documentIdField = properties.find((p) => p.name === 'documentIdField');
			const textField = properties.find((p) => p.name === 'textField');

			expect(documentIdField).toBeDefined();
			expect(documentIdField?.required).toBe(true);
			expect(documentIdField?.default).toBe('documentId');

			expect(textField).toBeDefined();
			expect(textField?.required).toBe(true);
			expect(textField?.default).toBe('text');
		});
	});

	// Server-chunked response in the shape the SDK returns
	const chunkedResult = (docs: Array<Array<{ text: string; embedding: number[] }>>) => ({
		results: docs.map((chunks, index) => ({
			index,
			embeddings: chunks.map((c) => c.embedding),
			chunkTexts: chunks.map((c) => c.text),
		})),
		totalTokens: 0,
	});

	const setParams = (options: Record<string, unknown> = {}, modelName = 'voyage-context-3') => {
		mockContext.getNodeParameter.mockImplementation((parameterName: string) => {
			if (parameterName === 'modelName') return modelName;
			if (parameterName === 'documentIdField') return 'documentId';
			if (parameterName === 'textField') return 'text';
			if (parameterName === 'options') return options;
			return undefined;
		});
	};

	describe('document mode (auto-chunking)', () => {
		it('should send whole documents as a flat list with auto-chunking enabled', async () => {
			mockContext.getInputData.mockReturnValue([
				{ json: { documentId: 'a', text: 'document A' } },
				{ json: { documentId: 'b', text: 'document B' } },
			]);
			mockContextualizedEmbed.mockResolvedValue(
				chunkedResult([
					[{ text: 'document A', embedding: [1] }],
					[{ text: 'document B', embedding: [2] }],
				]),
			);

			await node.supplyData.call(mockContext, 0);

			expect(mockContextualizedEmbed).toHaveBeenCalledTimes(1);
			expect(mockContextualizedEmbed).toHaveBeenCalledWith({
				inputs: ['document A', 'document B'],
				model: 'voyage-context-3',
				inputType: 'document',
				enableAutoChunking: true,
				chunkSize: 32000,
				outputDimension: undefined,
				outputDtype: undefined,
			});
		});

		it('should use the selected model, outputDimension and outputDtype', async () => {
			setParams({ outputDimension: 512, outputDtype: 'int8' }, 'voyage-context-4');
			mockContext.getInputData.mockReturnValue([{ json: { documentId: 'a', text: 'doc' } }]);
			mockContextualizedEmbed.mockResolvedValue(chunkedResult([[{ text: 'doc', embedding: [1] }]]));

			await node.supplyData.call(mockContext, 0);

			expect(mockContextualizedEmbed).toHaveBeenCalledWith(
				expect.objectContaining({
					model: 'voyage-context-4',
					outputDimension: 512,
					outputDtype: 'int8',
				}),
			);
		});

		it('should treat outputDimension 0 as unset', async () => {
			setParams({ outputDimension: 0 });
			mockContext.getInputData.mockReturnValue([{ json: { documentId: 'a', text: 'doc' } }]);
			mockContextualizedEmbed.mockResolvedValue(chunkedResult([[{ text: 'doc', embedding: [1] }]]));

			await node.supplyData.call(mockContext, 0);

			expect(mockContextualizedEmbed).toHaveBeenCalledWith(
				expect.objectContaining({ outputDimension: undefined }),
			);
		});

		it('should use the default URL when the credential has none', async () => {
			mockContext.getCredentials.mockResolvedValue({ apiKey: 'test-api-key' });
			mockContext.getInputData.mockReturnValue([{ json: { documentId: 'a', text: 'doc' } }]);
			mockContextualizedEmbed.mockResolvedValue(chunkedResult([[{ text: 'doc', embedding: [1] }]]));

			await node.supplyData.call(mockContext, 0);

			expect(mockVoyageAIClient).toHaveBeenCalledWith({
				apiKey: 'test-api-key',
				environment: 'https://api.voyageai.com/v1',
			});
		});

		it('should split requests by the 120K token limit and keep document order', async () => {
			mockTokenize.mockImplementation(async (texts: string[]) =>
				texts.map(() => ({ tokens: [], ids: new Array(70_000).fill(0) })),
			);
			mockContext.getInputData.mockReturnValue([
				{ json: { documentId: 'a', text: 'A' } },
				{ json: { documentId: 'b', text: 'B' } },
				{ json: { documentId: 'c', text: 'C' } },
			]);
			mockContextualizedEmbed.mockImplementation(async ({ inputs }: { inputs: string[] }) =>
				chunkedResult(inputs.map((text, i) => [{ text, embedding: [text.charCodeAt(0), i] }])),
			);

			const result = await node.supplyData.call(mockContext, 0);

			expect(mockContextualizedEmbed.mock.calls.map((c) => c[0].inputs)).toEqual([
				['A'],
				['B'],
				['C'],
			]);
			expect(await (result.response as any).embedDocuments(['A', 'B', 'C'])).toEqual([
				[65, 0],
				[66, 0],
				[67, 0],
			]);
		});

		it('should split requests at 1000 documents', async () => {
			mockContext.getInputData.mockReturnValue(
				Array.from({ length: 1001 }, (_, i) => ({ json: { documentId: `d${i}`, text: `t${i}` } })),
			);
			mockContextualizedEmbed.mockImplementation(async ({ inputs }: { inputs: string[] }) =>
				chunkedResult(inputs.map((text) => [{ text, embedding: [1] }])),
			);

			await node.supplyData.call(mockContext, 0);

			expect(mockContextualizedEmbed.mock.calls.map((c) => c[0].inputs.length)).toEqual([1000, 1]);
		});
	});

	describe('Validation', () => {
		it('should throw when the document ID is missing', async () => {
			mockContext.getInputData.mockReturnValue([{ json: { text: 'doc' } }]);

			await expect(node.supplyData.call(mockContext, 0)).rejects.toThrow(
				'Missing document ID in field: documentId',
			);
		});

		it('should throw when the document ID is null', async () => {
			mockContext.getInputData.mockReturnValue([{ json: { documentId: null, text: 'doc' } }]);

			await expect(node.supplyData.call(mockContext, 0)).rejects.toThrow(
				'Missing document ID in field: documentId',
			);
		});

		it('should throw when the text is missing', async () => {
			mockContext.getInputData.mockReturnValue([{ json: { documentId: 'a' } }]);

			await expect(node.supplyData.call(mockContext, 0)).rejects.toThrow(
				'Missing text in field: text',
			);
		});

		it('should reject a pre-chunked list in the text field', async () => {
			mockContext.getInputData.mockReturnValue([
				{ json: { documentId: 'a', text: ['chunk 1', 'chunk 2'] } },
			]);

			await expect(node.supplyData.call(mockContext, 0)).rejects.toThrow(NodeOperationError);
			await expect(node.supplyData.call(mockContext, 0)).rejects.toThrow(
				'must hold the whole document as a string',
			);
			expect(mockContextualizedEmbed).not.toHaveBeenCalled();
		});

		it('should reject the same document ID sent as several chunk items', async () => {
			mockContext.getInputData.mockReturnValue([
				{ json: { documentId: 'a', text: 'chunk 1' } },
				{ json: { documentId: 'a', text: 'chunk 2' } },
			]);

			await expect(node.supplyData.call(mockContext, 0)).rejects.toThrow('Duplicate document ID a');
			expect(mockContextualizedEmbed).not.toHaveBeenCalled();
		});
	});

	describe('Error handling', () => {
		it('should wrap API errors and surface the Voyage detail', async () => {
			mockContext.getInputData.mockReturnValue([{ json: { documentId: 'a', text: 'doc' } }]);
			mockContextualizedEmbed.mockRejectedValue(
				Object.assign(new Error('Status code: 400'), {
					statusCode: 400,
					body: { detail: 'Model voyage-nope is not supported.' },
				}),
			);

			await expect(node.supplyData.call(mockContext, 0)).rejects.toThrow(
				'Voyage AI by MongoDB API error: Model voyage-nope is not supported. (status 400)',
			);
		});

		it('should throw when the API returns no chunk texts', async () => {
			mockContext.getInputData.mockReturnValue([{ json: { documentId: 'a', text: 'doc' } }]);
			mockContextualizedEmbed.mockResolvedValue({
				results: [{ index: 0, embeddings: [[1]], chunkTexts: undefined }],
				totalTokens: 0,
			});

			await expect(node.supplyData.call(mockContext, 0)).rejects.toThrow(
				'did not return the text of every chunk',
			);
		});

		it('should throw when the API returns fewer documents than sent', async () => {
			mockContext.getInputData.mockReturnValue([
				{ json: { documentId: 'a', text: 'A' } },
				{ json: { documentId: 'b', text: 'B' } },
			]);
			mockContextualizedEmbed.mockResolvedValue(chunkedResult([[{ text: 'A', embedding: [1] }]]));

			await expect(node.supplyData.call(mockContext, 0)).rejects.toThrow(
				'Expected 2 documents but received 1',
			);
		});
	});

	describe('embedDocuments (cache)', () => {
		let embeddings: any;

		beforeEach(async () => {
			mockContext.getInputData.mockReturnValue([
				{ json: { documentId: 'a', text: 'long document' } },
				{ json: { documentId: 'b', text: 'short' } },
			]);
			mockContextualizedEmbed.mockResolvedValue(
				chunkedResult([
					[
						{ text: 'long ', embedding: [0.1, 0.2] },
						{ text: 'document', embedding: [0.3, 0.4] },
					],
					[{ text: 'short', embedding: [0.5, 0.6] }],
				]),
			);

			embeddings = (await node.supplyData.call(mockContext, 0)).response;
		});

		it('should return one embedding per chunk, in document order', async () => {
			expect(await embeddings.embedDocuments(['short', 'long document'])).toEqual([
				[0.5, 0.6],
				[0.1, 0.2],
				[0.3, 0.4],
			]);
		});

		it('should return the chunk texts the API produced', async () => {
			expect(await embeddings.embedDocumentChunks(['long document'])).toEqual([
				{ text: 'long ', embedding: [0.1, 0.2] },
				{ text: 'document', embedding: [0.3, 0.4] },
			]);
		});

		it('should throw when the document is not in the cache', async () => {
			await expect(embeddings.embedDocuments(['nonexistent'])).rejects.toThrow(
				'Document not found in pre-computed cache',
			);
		});

		it('should throw when nothing was pre-computed', async () => {
			embeddings.chunksByDocument = null;

			await expect(embeddings.embedDocuments(['short'])).rejects.toThrow(
				'Embeddings not pre-computed',
			);
		});
	});

	describe('embedQuery', () => {
		let embeddings: any;

		beforeEach(async () => {
			mockContext.getInputData.mockReturnValue([{ json: { documentId: 'a', text: 'doc' } }]);
			mockContextualizedEmbed.mockResolvedValueOnce(
				chunkedResult([[{ text: 'doc', embedding: [1] }]]),
			);

			embeddings = (await node.supplyData.call(mockContext, 0)).response;
			mockContextualizedEmbed.mockReset();
		});

		it('should send the query as a single-chunk document without auto-chunking', async () => {
			mockContextualizedEmbed.mockResolvedValueOnce({
				results: [{ index: 0, embeddings: [[0.7, 0.8, 0.9]] }],
				totalTokens: 0,
			});

			expect(await embeddings.embedQuery('search query')).toEqual([0.7, 0.8, 0.9]);
			expect(mockContextualizedEmbed).toHaveBeenCalledWith({
				inputs: [['search query']],
				model: 'voyage-context-3',
				inputType: 'query',
				outputDimension: undefined,
				outputDtype: undefined,
			});
		});

		it('should throw when the API returns no embedding', async () => {
			mockContextualizedEmbed.mockResolvedValueOnce({ results: [], totalTokens: 0 });

			await expect(embeddings.embedQuery('empty')).rejects.toThrow(NodeOperationError);
		});

		it('should wrap API errors in NodeOperationError', async () => {
			mockContextualizedEmbed.mockRejectedValueOnce(new Error('connection timeout'));

			await expect(embeddings.embedQuery('test')).rejects.toThrow(
				'Voyage AI by MongoDB API error: connection timeout',
			);
		});
	});
});
