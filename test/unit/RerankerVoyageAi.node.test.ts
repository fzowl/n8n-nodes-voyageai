import { mock } from 'jest-mock-extended';
import type { ISupplyDataFunctions } from 'n8n-workflow';
import { VoyageAIClient } from 'voyageai';

import { logWrapper } from '@utils/logWrapper';
import { getProxyAgent } from '@utils/httpProxyAgent';

import { RerankerVoyageAi } from '../../nodes/RerankerVoyageAi/RerankerVoyageAi.node';

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

describe('RerankerVoyageAi', () => {
	let rerankerVoyageAi: RerankerVoyageAi;
	let mockSupplyDataFunctions: ISupplyDataFunctions;
	let mockVoyageClient: jest.Mocked<VoyageAIClient>;

	beforeEach(() => {
		rerankerVoyageAi = new RerankerVoyageAi();

		// Reset the mocks
		jest.clearAllMocks();

		// Create a mock VoyageAIClient instance
		mockVoyageClient = {
			rerank: jest.fn(),
		} as unknown as jest.Mocked<VoyageAIClient>;

		// Make the VoyageAIClient constructor return our mock instance
		(VoyageAIClient as jest.MockedClass<typeof VoyageAIClient>).mockImplementation(
			() => mockVoyageClient,
		);

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
			expect(rerankerVoyageAi.description.displayName).toBe('Reranker VoyageAI');
			expect(rerankerVoyageAi.description.name).toBe('rerankerVoyageAi');
			expect(rerankerVoyageAi.description.credentials?.[0].name).toBe('voyageAiApi');
		});

		it('should have model parameter', () => {
			const modelParam = rerankerVoyageAi.description.properties.find(
				(p) => p.name === 'modelName',
			);
			expect(modelParam).toBeDefined();
			expect(modelParam?.type).toBe('options');
			expect(modelParam?.default).toBe('rerank-2.5');
		});

		it('should have topK parameter', () => {
			const topKParam = rerankerVoyageAi.description.properties.find((p) => p.name === 'topK');
			expect(topKParam).toBeDefined();
			expect(topKParam?.type).toBe('number');
			expect(topKParam?.default).toBe(3);
		});
	});

	describe('supplyData', () => {
		it('should create VoyageReranker with default model and return wrapped instance', async () => {
			const mockCredentials = { apiKey: 'test-api-key', url: 'https://api.voyageai.com/v1' };
			(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('rerank-2.5') // modelName
				.mockReturnValueOnce(3) // topK
				.mockReturnValueOnce({}); // options
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(mockCredentials);

			const result = await rerankerVoyageAi.supplyData.call(mockSupplyDataFunctions, 0);

			expect(mockSupplyDataFunctions.getNodeParameter).toHaveBeenCalledWith(
				'modelName',
				0,
				'rerank-2.5',
			);
			expect(mockSupplyDataFunctions.getNodeParameter).toHaveBeenCalledWith('topK', 0, 3);
			expect(mockSupplyDataFunctions.getNodeParameter).toHaveBeenCalledWith('options', 0, {});
			expect(mockSupplyDataFunctions.getCredentials).toHaveBeenCalledWith('voyageAiApi');
			expect(VoyageAIClient).toHaveBeenCalledWith(
				expect.objectContaining({
					apiKey: 'test-api-key',
					environment: 'https://api.voyageai.com/v1',
				}),
			);
			expect(logWrapper).toHaveBeenCalled();
			expect(result.response).toBeDefined();
		});

		it('should throw error when credentials are missing', async () => {
			(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('rerank-2.5')
				.mockReturnValueOnce(3)
				.mockReturnValueOnce({});
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockRejectedValue(
				new Error('Missing credentials'),
			);

			await expect(rerankerVoyageAi.supplyData.call(mockSupplyDataFunctions, 0)).rejects.toThrow(
				'Missing credentials',
			);
		});

		it('should use default baseURL when not provided in credentials', async () => {
			const mockCredentials = { apiKey: 'test-api-key' };
			(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('rerank-2.5')
				.mockReturnValueOnce(3)
				.mockReturnValueOnce({});
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(mockCredentials);

			await rerankerVoyageAi.supplyData.call(mockSupplyDataFunctions, 0);

			expect(VoyageAIClient).toHaveBeenCalledWith(
				expect.objectContaining({
					environment: 'https://api.voyageai.com/v1',
				}),
			);
		});
	});

	describe('Proxy Support', () => {
		it('should call getProxyAgent when proxy is configured', async () => {
			const mockCredentials = { apiKey: 'test-api-key', url: 'https://custom-api.com/v1' };
			(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('rerank-2.5')
				.mockReturnValueOnce(3)
				.mockReturnValueOnce({});
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(mockCredentials);

			await rerankerVoyageAi.supplyData.call(mockSupplyDataFunctions, 0);

			expect(getProxyAgent).toHaveBeenCalledWith('https://custom-api.com/v1');
		});

		it('should handle proxy agent configuration', async () => {
			const mockProxyAgent = { proxy: 'http://proxy.example.com:8080' };
			(getProxyAgent as jest.Mock).mockReturnValue(mockProxyAgent);

			const mockCredentials = { apiKey: 'test-api-key' };
			(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('rerank-2.5')
				.mockReturnValueOnce(3)
				.mockReturnValueOnce({});
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(mockCredentials);

			await rerankerVoyageAi.supplyData.call(mockSupplyDataFunctions, 0);

			expect(VoyageAIClient).toHaveBeenCalledWith(
				expect.objectContaining({
					apiKey: 'test-api-key',
					fetch: expect.any(Function),
				}),
			);
		});

		it('should not add fetch override when proxy agent is not configured', async () => {
			(getProxyAgent as jest.Mock).mockReturnValue(undefined);

			const mockCredentials = { apiKey: 'test-api-key' };
			(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('rerank-2.5')
				.mockReturnValueOnce(3)
				.mockReturnValueOnce({});
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(mockCredentials);

			await rerankerVoyageAi.supplyData.call(mockSupplyDataFunctions, 0);

			expect(VoyageAIClient).toHaveBeenCalledWith(
				expect.not.objectContaining({
					fetch: expect.any(Function),
				}),
			);
		});
	});

	describe('Logging', () => {
		it('should call logger.debug', async () => {
			const mockCredentials = { apiKey: 'test-api-key' };
			(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('rerank-2.5')
				.mockReturnValueOnce(3)
				.mockReturnValueOnce({});
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(mockCredentials);

			await rerankerVoyageAi.supplyData.call(mockSupplyDataFunctions, 0);

			expect(mockSupplyDataFunctions.logger.debug).toHaveBeenCalledWith(
				'Supply data for reranker VoyageAI',
			);
		});

		it('should wrap reranker instance with logWrapper', async () => {
			const mockCredentials = { apiKey: 'test-api-key' };
			(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('rerank-2.5')
				.mockReturnValueOnce(3)
				.mockReturnValueOnce({});
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(mockCredentials);

			await rerankerVoyageAi.supplyData.call(mockSupplyDataFunctions, 0);

			expect(logWrapper).toHaveBeenCalledWith(expect.anything(), mockSupplyDataFunctions);
		});
	});

	describe('compressDocuments', () => {
		let reranker: any;

		beforeEach(async () => {
			const mockCredentials = { apiKey: 'test-api-key' };
			(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('rerank-2.5')
				.mockReturnValueOnce(3)
				.mockReturnValueOnce({});
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(mockCredentials);

			const result = await rerankerVoyageAi.supplyData.call(mockSupplyDataFunctions, 0);
			reranker = (result.response as any).logWrapped;
		});

		it('should rerank documents by relevance score', async () => {
			mockVoyageClient.rerank.mockResolvedValueOnce({
				data: [
					{ index: 1, relevanceScore: 0.95 },
					{ index: 0, relevanceScore: 0.7 },
				],
			} as any);

			const documents = [
				{ pageContent: 'Less relevant doc', metadata: { source: 'a' } },
				{ pageContent: 'Very relevant doc', metadata: { source: 'b' } },
			];

			const result = await reranker.compressDocuments(documents, 'test query');

			expect(result).toHaveLength(2);
			expect(result[0].pageContent).toBe('Very relevant doc');
			expect(result[0].metadata.relevanceScore).toBe(0.95);
			expect(result[0].metadata.source).toBe('b');
			expect(result[1].pageContent).toBe('Less relevant doc');
			expect(result[1].metadata.relevanceScore).toBe(0.7);
		});

		it('should pass correct parameters to VoyageAI rerank API', async () => {
			mockVoyageClient.rerank.mockResolvedValueOnce({
				data: [{ index: 0, relevanceScore: 0.9 }],
			} as any);

			const documents = [{ pageContent: 'doc content', metadata: {} }];

			await reranker.compressDocuments(documents, 'search query');

			expect(mockVoyageClient.rerank).toHaveBeenCalledWith({
				query: 'search query',
				documents: ['doc content'],
				model: 'rerank-2.5',
				topK: 3,
				returnDocuments: false,
				truncation: true,
			});
		});

		it('should return empty array when API returns no data', async () => {
			mockVoyageClient.rerank.mockResolvedValueOnce({
				data: null,
			} as any);

			const documents = [{ pageContent: 'doc', metadata: {} }];

			const result = await reranker.compressDocuments(documents, 'query');

			expect(result).toEqual([]);
		});

		it('should return empty array when API returns empty data', async () => {
			mockVoyageClient.rerank.mockResolvedValueOnce({
				data: [],
			} as any);

			const documents = [{ pageContent: 'doc', metadata: {} }];

			const result = await reranker.compressDocuments(documents, 'query');

			expect(result).toEqual([]);
		});

		it('should preserve document id field', async () => {
			mockVoyageClient.rerank.mockResolvedValueOnce({
				data: [{ index: 0, relevanceScore: 0.8 }],
			} as any);

			const documents = [
				{ pageContent: 'doc', metadata: {}, id: 'doc-123' },
			];

			const result = await reranker.compressDocuments(documents, 'query');

			expect(result[0].id).toBe('doc-123');
		});

		it('should skip results with undefined index', async () => {
			mockVoyageClient.rerank.mockResolvedValueOnce({
				data: [
					{ index: 0, relevanceScore: 0.9 },
					{ relevanceScore: 0.5 },
				],
			} as any);

			const documents = [
				{ pageContent: 'doc1', metadata: {} },
				{ pageContent: 'doc2', metadata: {} },
			];

			const result = await reranker.compressDocuments(documents, 'query');

			expect(result).toHaveLength(1);
			expect(result[0].pageContent).toBe('doc1');
		});

		it('should handle truncation option set to false', async () => {
			jest.clearAllMocks();

			(VoyageAIClient as jest.MockedClass<typeof VoyageAIClient>).mockImplementation(
				() => mockVoyageClient,
			);

			const mockCredentials = { apiKey: 'test-api-key' };
			(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('rerank-2.5')
				.mockReturnValueOnce(5)
				.mockReturnValueOnce({ truncation: false });
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(mockCredentials);

			const result = await rerankerVoyageAi.supplyData.call(mockSupplyDataFunctions, 0);
			const instance = (result.response as any).logWrapped;

			mockVoyageClient.rerank.mockResolvedValueOnce({
				data: [{ index: 0, relevanceScore: 0.9 }],
			} as any);

			await instance.compressDocuments([{ pageContent: 'doc', metadata: {} }], 'q');

			expect(mockVoyageClient.rerank).toHaveBeenCalledWith(
				expect.objectContaining({
					truncation: false,
					topK: 5,
				}),
			);
		});
	});
});
