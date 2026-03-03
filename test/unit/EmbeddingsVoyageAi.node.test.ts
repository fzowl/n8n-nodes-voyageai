import { VoyageAIClient } from 'voyageai';
import { mock } from 'jest-mock-extended';
import type { ISupplyDataFunctions } from 'n8n-workflow';

import { logWrapper } from '@utils/logWrapper';
import { getProxyAgent } from '@utils/httpProxyAgent';
import { getTokenBudget } from '@utils/tokenBudget';

import { EmbeddingsVoyageAi } from '../../nodes/EmbeddingsVoyageAi/EmbeddingsVoyageAi.node';

// Mock the VoyageAIClient
jest.mock('voyageai', () => ({
	VoyageAIClient: jest.fn(),
}));

// Mock the logWrapper utility
jest.mock('@utils/logWrapper', () => ({
	logWrapper: jest.fn().mockImplementation((obj) => ({ logWrapped: obj })),
}));

// Mock the getProxyAgent utility
jest.mock('@utils/httpProxyAgent', () => ({
	getProxyAgent: jest.fn().mockReturnValue(undefined),
}));

describe('EmbeddingsVoyageAi', () => {
	let embeddingsVoyageAi: EmbeddingsVoyageAi;
	let mockSupplyDataFunctions: ISupplyDataFunctions;
	let mockVoyageAIClient: jest.Mocked<VoyageAIClient>;

	beforeEach(() => {
		embeddingsVoyageAi = new EmbeddingsVoyageAi();

		// Reset the mocks
		jest.clearAllMocks();

		// Create a mock VoyageAIClient instance
		mockVoyageAIClient = {
			embed: jest.fn(),
			tokenize: jest.fn().mockImplementation((texts: string[]) =>
				Promise.resolve(texts.map((t) => {
					// Simulate tokenizer: split on whitespace to produce tokens/ids
					const tokens = t.split(/\s+/).filter(Boolean);
					return { tokens, ids: tokens.map((_, i) => i) };
				})),
			),
		} as unknown as jest.Mocked<VoyageAIClient>;

		// Make the VoyageAIClient constructor return our mock instance
		(VoyageAIClient as unknown as jest.Mock).mockImplementation(() => mockVoyageAIClient);

		// Create mock supply data functions
		mockSupplyDataFunctions = mock<ISupplyDataFunctions>({
			logger: {
				debug: jest.fn(),
				error: jest.fn(),
				info: jest.fn(),
				warn: jest.fn(),
			},
		});

		// Mock specific methods with proper jest functions
		mockSupplyDataFunctions.getNodeParameter = jest.fn();
		mockSupplyDataFunctions.getCredentials = jest.fn();
	});

	describe('Node Configuration', () => {
		it('should have correct metadata', () => {
			expect(embeddingsVoyageAi.description.displayName).toBe('Embeddings VoyageAI');
			expect(embeddingsVoyageAi.description.name).toBe('embeddingsVoyageAi');
			expect(embeddingsVoyageAi.description.credentials?.[0].name).toBe('voyageAiApi');
		});

		it('should have model parameter with voyage-4 as default', () => {
			const modelParam = embeddingsVoyageAi.description.properties.find(
				(p) => p.name === 'modelName',
			);
			expect(modelParam).toBeDefined();
			expect(modelParam?.type).toBe('options');
			expect(modelParam?.default).toBe('voyage-4');
		});

		it('should include voyage-4 model family', () => {
			const modelParam = embeddingsVoyageAi.description.properties.find(
				(p) => p.name === 'modelName',
			);
			const options = (modelParam as any)?.options || [];
			const modelValues = options.map((o: any) => o.value);

			expect(modelValues).toContain('voyage-4-large');
			expect(modelValues).toContain('voyage-4');
			expect(modelValues).toContain('voyage-4-lite');
			expect(modelValues).toContain('voyage-4-nano');
		});

		it('should include legacy models', () => {
			const modelParam = embeddingsVoyageAi.description.properties.find(
				(p) => p.name === 'modelName',
			);
			const options = (modelParam as any)?.options || [];
			const modelValues = options.map((o: any) => o.value);

			expect(modelValues).toContain('voyage-3.5');
			expect(modelValues).toContain('voyage-3.5-lite');
			expect(modelValues).toContain('voyage-3-large');
			expect(modelValues).toContain('voyage-code-3');
			expect(modelValues).toContain('voyage-finance-2');
			expect(modelValues).toContain('voyage-law-2');
			expect(modelValues).toContain('voyage-multilingual-2');
		});

		it('should have options parameter', () => {
			const optionsParam = embeddingsVoyageAi.description.properties.find(
				(p) => p.name === 'options',
			);
			expect(optionsParam).toBeDefined();
			expect(optionsParam?.type).toBe('collection');
		});

		it('should have outputDimension as top-level parameter with displayOptions', () => {
			const dimParam = embeddingsVoyageAi.description.properties.find(
				(p) => p.name === 'outputDimension',
			);
			expect(dimParam).toBeDefined();
			expect(dimParam?.type).toBe('options');
			expect(dimParam?.displayOptions).toBeDefined();
			expect(dimParam?.displayOptions?.show?.modelName).toBeDefined();
		});

		it('should have outputDtype as top-level parameter with all 5 options', () => {
			const dtypeParam = embeddingsVoyageAi.description.properties.find(
				(p) => p.name === 'outputDtype',
			);
			expect(dtypeParam).toBeDefined();
			expect(dtypeParam?.type).toBe('options');
			const options = (dtypeParam as any)?.options || [];
			const values = options.map((o: any) => o.value);
			expect(values).toEqual(['float', 'int8', 'uint8', 'binary', 'ubinary']);
		});
	});

	describe('supplyData', () => {
		it('should create VoyageAIClient with default model and return wrapped instance', async () => {
			const mockCredentials = { apiKey: 'test-api-key', url: 'https://api.voyageai.com/v1' };
			(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('voyage-4') // modelName
				.mockReturnValueOnce(0) // outputDimension
				.mockReturnValueOnce('float') // outputDtype
				.mockReturnValueOnce({}); // options
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(mockCredentials);

			const result = await embeddingsVoyageAi.supplyData.call(mockSupplyDataFunctions, 0);

			expect(mockSupplyDataFunctions.getNodeParameter).toHaveBeenCalledWith(
				'modelName',
				0,
				'voyage-4',
			);
			expect(mockSupplyDataFunctions.getNodeParameter).toHaveBeenCalledWith('options', 0, {});
			expect(mockSupplyDataFunctions.getCredentials).toHaveBeenCalledWith('voyageAiApi');
			expect(logWrapper).toHaveBeenCalled();
			expect(result.response).toBeDefined();
		});

		it('should create VoyageAIClient with custom model', async () => {
			const mockCredentials = { apiKey: 'custom-api-key' };
			(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('voyage-code-3') // modelName
				.mockReturnValueOnce(0) // outputDimension
				.mockReturnValueOnce('float') // outputDtype
				.mockReturnValueOnce({}); // options
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(mockCredentials);

			await embeddingsVoyageAi.supplyData.call(mockSupplyDataFunctions, 0);

			expect(mockSupplyDataFunctions.getNodeParameter).toHaveBeenCalledWith(
				'modelName',
				0,
				'voyage-4',
			);
		});

		it('should handle all model options correctly', async () => {
			const models = [
				'voyage-4-large',
				'voyage-4',
				'voyage-4-lite',
				'voyage-4-nano',
				'voyage-3.5',
				'voyage-3.5-lite',
				'voyage-3-large',
				'voyage-code-3',
				'voyage-finance-2',
				'voyage-law-2',
				'voyage-multilingual-2',
			];

			for (const model of models) {
				jest.clearAllMocks();

				const mockCredentials = { apiKey: 'test-api-key' };
				(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
					.mockReturnValueOnce(model)
					.mockReturnValueOnce(0) // outputDimension
					.mockReturnValueOnce('float') // outputDtype
					.mockReturnValueOnce({});
				(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(mockCredentials);

				await embeddingsVoyageAi.supplyData.call(mockSupplyDataFunctions, 0);

				expect(mockSupplyDataFunctions.getCredentials).toHaveBeenCalled();
			}
		});

		it('should handle different item indices', async () => {
			const mockCredentials = { apiKey: 'test-api-key' };
			(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('voyage-4')
				.mockReturnValueOnce(0) // outputDimension
				.mockReturnValueOnce('float') // outputDtype
				.mockReturnValueOnce({});
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(mockCredentials);

			await embeddingsVoyageAi.supplyData.call(mockSupplyDataFunctions, 2);

			expect(mockSupplyDataFunctions.getNodeParameter).toHaveBeenCalledWith(
				'modelName',
				2,
				'voyage-4',
			);
			expect(mockSupplyDataFunctions.getNodeParameter).toHaveBeenCalledWith('options', 2, {});
		});

		it('should throw error when credentials are missing', async () => {
			(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('voyage-4')
				.mockReturnValueOnce(0) // outputDimension
				.mockReturnValueOnce('float') // outputDtype
				.mockReturnValueOnce({});
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockRejectedValue(
				new Error('Missing credentials'),
			);

			await expect(embeddingsVoyageAi.supplyData.call(mockSupplyDataFunctions, 0)).rejects.toThrow(
				'Missing credentials',
			);
		});

		it('should use default baseURL when not provided in credentials', async () => {
			const mockCredentials = { apiKey: 'test-api-key' };
			(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('voyage-4')
				.mockReturnValueOnce(0) // outputDimension
				.mockReturnValueOnce('float') // outputDtype
				.mockReturnValueOnce({});
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(mockCredentials);

			await embeddingsVoyageAi.supplyData.call(mockSupplyDataFunctions, 0);

			expect(getProxyAgent).toHaveBeenCalledWith('https://api.voyageai.com/v1');
		});
	});

	describe('Options Handling', () => {
		it('should handle batchSize option', async () => {
			const mockCredentials = { apiKey: 'test-api-key' };
			const options = { batchSize: 256 };

			(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('voyage-4')
				.mockReturnValueOnce(0) // outputDimension
				.mockReturnValueOnce('float') // outputDtype
				.mockReturnValueOnce(options);
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(mockCredentials);

			await embeddingsVoyageAi.supplyData.call(mockSupplyDataFunctions, 0);

			expect(mockSupplyDataFunctions.getNodeParameter).toHaveBeenCalledWith('options', 0, {});
		});

		it('should handle inputType option with query value', async () => {
			const mockCredentials = { apiKey: 'test-api-key' };
			const options = { inputType: 'query' };

			(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('voyage-4')
				.mockReturnValueOnce(0) // outputDimension
				.mockReturnValueOnce('float') // outputDtype
				.mockReturnValueOnce(options);
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(mockCredentials);

			await embeddingsVoyageAi.supplyData.call(mockSupplyDataFunctions, 0);

			expect(mockSupplyDataFunctions.getNodeParameter).toHaveBeenCalledWith('options', 0, {});
		});

		it('should handle inputType option with document value', async () => {
			const mockCredentials = { apiKey: 'test-api-key' };
			const options = { inputType: 'document' };

			(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('voyage-4')
				.mockReturnValueOnce(0) // outputDimension
				.mockReturnValueOnce('float') // outputDtype
				.mockReturnValueOnce(options);
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(mockCredentials);

			await embeddingsVoyageAi.supplyData.call(mockSupplyDataFunctions, 0);

			expect(mockSupplyDataFunctions.getNodeParameter).toHaveBeenCalledWith('options', 0, {});
		});

		it('should convert empty string inputType to undefined', async () => {
			const mockCredentials = { apiKey: 'test-api-key' };
			const options = { inputType: '' };

			(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('voyage-4')
				.mockReturnValueOnce(0) // outputDimension
				.mockReturnValueOnce('float') // outputDtype
				.mockReturnValueOnce(options);
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(mockCredentials);

			await embeddingsVoyageAi.supplyData.call(mockSupplyDataFunctions, 0);

			expect(mockSupplyDataFunctions.getNodeParameter).toHaveBeenCalledWith('options', 0, {});
		});

		it('should handle outputDimension parameter', async () => {
			const mockCredentials = { apiKey: 'test-api-key' };

			(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('voyage-4')
				.mockReturnValueOnce(512) // outputDimension
				.mockReturnValueOnce('float') // outputDtype
				.mockReturnValueOnce({});
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(mockCredentials);

			await embeddingsVoyageAi.supplyData.call(mockSupplyDataFunctions, 0);

			expect(mockSupplyDataFunctions.getNodeParameter).toHaveBeenCalledWith(
				'outputDimension',
				0,
				0,
			);
		});

		it('should convert 0 outputDimension to undefined (use default)', async () => {
			const mockCredentials = { apiKey: 'test-api-key' };

			(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('voyage-4')
				.mockReturnValueOnce(0) // outputDimension
				.mockReturnValueOnce('float') // outputDtype
				.mockReturnValueOnce({});
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(mockCredentials);

			await embeddingsVoyageAi.supplyData.call(mockSupplyDataFunctions, 0);

			expect(mockSupplyDataFunctions.getNodeParameter).toHaveBeenCalledWith(
				'outputDimension',
				0,
				0,
			);
		});

		it('should handle truncation option', async () => {
			const mockCredentials = { apiKey: 'test-api-key' };
			const options = { truncation: false };

			(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('voyage-4')
				.mockReturnValueOnce(0) // outputDimension
				.mockReturnValueOnce('float') // outputDtype
				.mockReturnValueOnce(options);
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(mockCredentials);

			await embeddingsVoyageAi.supplyData.call(mockSupplyDataFunctions, 0);

			expect(mockSupplyDataFunctions.getNodeParameter).toHaveBeenCalledWith('options', 0, {});
		});

		it('should handle encodingFormat option with base64', async () => {
			const mockCredentials = { apiKey: 'test-api-key' };
			const options = { encodingFormat: 'base64' as const };

			(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('voyage-4')
				.mockReturnValueOnce(0) // outputDimension
				.mockReturnValueOnce('float') // outputDtype
				.mockReturnValueOnce(options);
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(mockCredentials);

			await embeddingsVoyageAi.supplyData.call(mockSupplyDataFunctions, 0);

			expect(mockSupplyDataFunctions.getNodeParameter).toHaveBeenCalledWith('options', 0, {});
		});

		it('should handle outputDtype parameter with all values', async () => {
			const dtypes = ['float', 'int8', 'uint8', 'binary', 'ubinary'];

			for (const dtype of dtypes) {
				jest.clearAllMocks();

				const mockCredentials = { apiKey: 'test-api-key' };
				(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
					.mockReturnValueOnce('voyage-4')
					.mockReturnValueOnce(0) // outputDimension
					.mockReturnValueOnce(dtype) // outputDtype
					.mockReturnValueOnce({});
				(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(mockCredentials);

				await embeddingsVoyageAi.supplyData.call(mockSupplyDataFunctions, 0);

				expect(mockSupplyDataFunctions.getNodeParameter).toHaveBeenCalledWith(
					'outputDtype',
					0,
					'float',
				);
			}
		});

		it('should handle multiple options together', async () => {
			const mockCredentials = { apiKey: 'test-api-key' };
			const options = {
				batchSize: 128,
				inputType: 'document',
				truncation: true,
				encodingFormat: 'float' as const,
			};

			(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('voyage-4')
				.mockReturnValueOnce(256) // outputDimension
				.mockReturnValueOnce('int8') // outputDtype
				.mockReturnValueOnce(options);
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(mockCredentials);

			await embeddingsVoyageAi.supplyData.call(mockSupplyDataFunctions, 0);

			expect(mockSupplyDataFunctions.getNodeParameter).toHaveBeenCalledWith('options', 0, {});
		});
	});

	describe('Proxy Support', () => {
		it('should call getProxyAgent with correct baseURL', async () => {
			const mockCredentials = { apiKey: 'test-api-key', url: 'https://custom-api.com/v1' };

			(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('voyage-4')
				.mockReturnValueOnce(0) // outputDimension
				.mockReturnValueOnce('float') // outputDtype
				.mockReturnValueOnce({});
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(mockCredentials);

			await embeddingsVoyageAi.supplyData.call(mockSupplyDataFunctions, 0);

			expect(getProxyAgent).toHaveBeenCalledWith('https://custom-api.com/v1');
		});

		it('should handle proxy agent when configured', async () => {
			const mockProxyAgent = { proxy: 'http://proxy.example.com:8080' };
			(getProxyAgent as jest.Mock).mockReturnValue(mockProxyAgent);

			const mockCredentials = { apiKey: 'test-api-key' };
			(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('voyage-4')
				.mockReturnValueOnce(0) // outputDimension
				.mockReturnValueOnce('float') // outputDtype
				.mockReturnValueOnce({});
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(mockCredentials);

			await embeddingsVoyageAi.supplyData.call(mockSupplyDataFunctions, 0);

			expect(getProxyAgent).toHaveBeenCalled();
		});
	});

	describe('Logging', () => {
		it('should call logger.debug', async () => {
			const mockCredentials = { apiKey: 'test-api-key' };
			(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('voyage-4')
				.mockReturnValueOnce(0) // outputDimension
				.mockReturnValueOnce('float') // outputDtype
				.mockReturnValueOnce({});
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(mockCredentials);

			await embeddingsVoyageAi.supplyData.call(mockSupplyDataFunctions, 0);

			expect(mockSupplyDataFunctions.logger.debug).toHaveBeenCalledWith(
				'Supply data for embeddings VoyageAI',
			);
		});

		it('should wrap embeddings instance with logWrapper', async () => {
			const mockCredentials = { apiKey: 'test-api-key' };
			(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('voyage-4')
				.mockReturnValueOnce(0) // outputDimension
				.mockReturnValueOnce('float') // outputDtype
				.mockReturnValueOnce({});
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(mockCredentials);

			await embeddingsVoyageAi.supplyData.call(mockSupplyDataFunctions, 0);

			expect(logWrapper).toHaveBeenCalledWith(expect.anything(), mockSupplyDataFunctions);
		});
	});

	describe('Token-Aware Batching', () => {
		let embeddings: any;

		beforeEach(async () => {
			const mockCredentials = { apiKey: 'test-api-key' };
			(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('voyage-4') // modelName
				.mockReturnValueOnce(0) // outputDimension
				.mockReturnValueOnce('float') // outputDtype
				.mockReturnValueOnce({ batchSize: 3 }); // options with small batchSize
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(mockCredentials);

			const result = await embeddingsVoyageAi.supplyData.call(mockSupplyDataFunctions, 0);
			// logWrapper returns { logWrapped: obj }, extract the actual embeddings instance
			embeddings = (result.response as any).logWrapped;
		});

		it('should split batches when batchSize count is exceeded', async () => {
			mockVoyageAIClient.embed
				.mockResolvedValueOnce({
					data: [
						{ embedding: [1, 2] },
						{ embedding: [3, 4] },
						{ embedding: [5, 6] },
					],
				} as any)
				.mockResolvedValueOnce({
					data: [{ embedding: [7, 8] }],
				} as any);

			const result = await embeddings.embedDocuments(['a', 'b', 'c', 'd']);

			expect(mockVoyageAIClient.embed).toHaveBeenCalledTimes(2);
			expect(result).toEqual([
				[1, 2],
				[3, 4],
				[5, 6],
				[7, 8],
			]);
		});

		it('should split batches when token budget is exceeded', async () => {
			// voyage-4 has 320,000 token budget
			// Mock tokenize to return large token counts
			mockVoyageAIClient.tokenize = jest.fn().mockResolvedValue([
				{ tokens: [], ids: Array.from({ length: 320_000 }, (_, i) => i) }, // exactly at budget
				{ tokens: [], ids: [1] }, // small text
			]);

			mockVoyageAIClient.embed
				.mockResolvedValueOnce({
					data: [{ embedding: [1, 2] }],
				} as any)
				.mockResolvedValueOnce({
					data: [{ embedding: [3, 4] }],
				} as any);

			const result = await embeddings.embedDocuments(['big-text', 'small']);

			// First text fills the budget, so second gets its own batch
			expect(mockVoyageAIClient.embed).toHaveBeenCalledTimes(2);
			expect(result).toEqual([
				[1, 2],
				[3, 4],
			]);
		});

		it('should always include at least one text per batch (prevents infinite loop)', async () => {
			// Mock tokenize to return a count exceeding any budget
			mockVoyageAIClient.tokenize = jest.fn().mockResolvedValue([
				{ tokens: [], ids: Array.from({ length: 1_000_000 }, (_, i) => i) },
			]);

			mockVoyageAIClient.embed.mockResolvedValueOnce({
				data: [{ embedding: [1, 2] }],
			} as any);

			const result = await embeddings.embedDocuments(['oversized-text']);

			expect(mockVoyageAIClient.embed).toHaveBeenCalledTimes(1);
			expect(result).toEqual([[1, 2]]);
		});

		it('should propagate tokenize errors', async () => {
			mockVoyageAIClient.tokenize = jest.fn().mockRejectedValue(new Error('tokenizer failed'));

			await expect(embeddings.embedDocuments(['hello', 'world'])).rejects.toThrow(
				'tokenizer failed',
			);
		});

		it('should replace empty strings with a space', async () => {
			mockVoyageAIClient.embed.mockResolvedValueOnce({
				data: [
					{ embedding: [1, 2] },
					{ embedding: [3, 4] },
				],
			} as any);

			await embeddings.embedDocuments(['', 'hello']);

			const callArgs = mockVoyageAIClient.embed.mock.calls[0][0];
			expect(callArgs.input).toEqual([' ', 'hello']);
		});

		it('should respect both batchSize and token budget', async () => {
			// With batchSize=3 and voyage-4 token budget=320k
			// 3 small texts should fit in one batch
			mockVoyageAIClient.embed.mockResolvedValueOnce({
				data: [
					{ embedding: [1] },
					{ embedding: [2] },
					{ embedding: [3] },
				],
			} as any);

			const result = await embeddings.embedDocuments(['a', 'b', 'c']);

			expect(mockVoyageAIClient.embed).toHaveBeenCalledTimes(1);
			expect(result).toEqual([[1], [2], [3]]);
		});

		it('should call tokenize with sanitized texts and model', async () => {
			mockVoyageAIClient.embed.mockResolvedValueOnce({
				data: [
					{ embedding: [1] },
					{ embedding: [2] },
				],
			} as any);

			await embeddings.embedDocuments(['', 'hello']);

			// Empty string is sanitized to ' ' before tokenize is called
			expect(mockVoyageAIClient.tokenize).toHaveBeenCalledWith([' ', 'hello'], 'voyage-4');
		});

		it('should pack multiple texts into one batch when within token budget', async () => {
			// Mock tokenize: each text is 100k tokens, budget is 320k, so 3 fit in one batch
			mockVoyageAIClient.tokenize = jest.fn().mockResolvedValue([
				{ tokens: [], ids: Array.from({ length: 100_000 }, (_, i) => i) },
				{ tokens: [], ids: Array.from({ length: 100_000 }, (_, i) => i) },
				{ tokens: [], ids: Array.from({ length: 100_000 }, (_, i) => i) },
			]);

			mockVoyageAIClient.embed.mockResolvedValueOnce({
				data: [
					{ embedding: [1] },
					{ embedding: [2] },
					{ embedding: [3] },
				],
			} as any);

			const result = await embeddings.embedDocuments(['text1', 'text2', 'text3']);

			expect(mockVoyageAIClient.embed).toHaveBeenCalledTimes(1);
			expect(result).toEqual([[1], [2], [3]]);
		});

		it('should split into multiple batches at exact token boundary', async () => {
			// 3 texts: 200k + 200k + 100k tokens, budget=320k, batchSize=3
			// Batch 1: text1 (200k) + text2 would be 400k > 320k → only text1
			// Batch 2: text2 (200k) + text3 (100k) = 300k ≤ 320k → text2+text3
			mockVoyageAIClient.tokenize = jest.fn().mockResolvedValue([
				{ tokens: [], ids: Array.from({ length: 200_000 }, (_, i) => i) },
				{ tokens: [], ids: Array.from({ length: 200_000 }, (_, i) => i) },
				{ tokens: [], ids: Array.from({ length: 100_000 }, (_, i) => i) },
			]);

			mockVoyageAIClient.embed
				.mockResolvedValueOnce({
					data: [{ embedding: [1] }],
				} as any)
				.mockResolvedValueOnce({
					data: [{ embedding: [2] }, { embedding: [3] }],
				} as any);

			const result = await embeddings.embedDocuments(['big1', 'big2', 'small']);

			expect(mockVoyageAIClient.embed).toHaveBeenCalledTimes(2);
			// First batch: only big1
			expect(mockVoyageAIClient.embed.mock.calls[0][0].input).toEqual(['big1']);
			// Second batch: big2 + small
			expect(mockVoyageAIClient.embed.mock.calls[1][0].input).toEqual(['big2', 'small']);
			expect(result).toEqual([[1], [2], [3]]);
		});

		it('should handle empty input array', async () => {
			const result = await embeddings.embedDocuments([]);

			expect(mockVoyageAIClient.embed).not.toHaveBeenCalled();
			expect(result).toEqual([]);
		});

		it('should call tokenize only once for all texts', async () => {
			mockVoyageAIClient.embed
				.mockResolvedValueOnce({
					data: [{ embedding: [1] }, { embedding: [2] }, { embedding: [3] }],
				} as any);

			await embeddings.embedDocuments(['a', 'b', 'c']);

			// tokenize is called once upfront, not per-batch
			expect(mockVoyageAIClient.tokenize).toHaveBeenCalledTimes(1);
		});
	});

	describe('voyage-4-nano Model', () => {
		it('should have voyage-4-nano as a model option', () => {
			const modelParam = embeddingsVoyageAi.description.properties.find(
				(p) => p.name === 'modelName',
			);
			const options = (modelParam as any)?.options || [];
			const nanoOption = options.find((o: any) => o.value === 'voyage-4-nano');

			expect(nanoOption).toBeDefined();
			expect(nanoOption.name).toBe('Voyage-4-Nano (Open Weight)');
			expect(nanoOption.description).toContain('Open-weight');
		});

		it('should create client with voyage-4-nano model', async () => {
			const mockCredentials = { apiKey: 'test-api-key' };
			(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('voyage-4-nano') // modelName
				.mockReturnValueOnce(0) // outputDimension
				.mockReturnValueOnce('float') // outputDtype
				.mockReturnValueOnce({}); // options
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(mockCredentials);

			const result = await embeddingsVoyageAi.supplyData.call(mockSupplyDataFunctions, 0);

			expect(result.response).toBeDefined();
			expect(VoyageAIClient).toHaveBeenCalled();
		});

		it('should support outputDimension with voyage-4-nano', () => {
			const dimParam = embeddingsVoyageAi.description.properties.find(
				(p) => p.name === 'outputDimension',
			);
			const supportedModels = dimParam?.displayOptions?.show?.modelName as string[];

			expect(supportedModels).toContain('voyage-4-nano');
		});

		it('should support outputDtype with voyage-4-nano', () => {
			const dtypeParam = embeddingsVoyageAi.description.properties.find(
				(p) => p.name === 'outputDtype',
			);
			const supportedModels = dtypeParam?.displayOptions?.show?.modelName as string[];

			expect(supportedModels).toContain('voyage-4-nano');
		});

		it('should use correct token budget for voyage-4-nano', () => {
			expect(getTokenBudget('voyage-4-nano')).toBe(320_000);
		});

		it('should handle token-aware batching for voyage-4-nano', async () => {
			const mockCredentials = { apiKey: 'test-api-key' };
			(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('voyage-4-nano') // modelName
				.mockReturnValueOnce(512) // outputDimension
				.mockReturnValueOnce('int8') // outputDtype
				.mockReturnValueOnce({ batchSize: 2 }); // options
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(mockCredentials);

			const result = await embeddingsVoyageAi.supplyData.call(mockSupplyDataFunctions, 0);
			const instance = (result.response as any).logWrapped;

			mockVoyageAIClient.embed
				.mockResolvedValueOnce({
					data: [{ embedding: [1] }, { embedding: [2] }],
				} as any)
				.mockResolvedValueOnce({
					data: [{ embedding: [3] }],
				} as any);

			const embedResult = await instance.embedDocuments(['hello', 'world', 'test']);

			expect(mockVoyageAIClient.embed).toHaveBeenCalledTimes(2);
			expect(embedResult).toEqual([[1], [2], [3]]);
		});
	});
});
