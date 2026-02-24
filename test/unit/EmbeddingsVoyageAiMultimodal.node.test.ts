import { VoyageAIClient } from 'voyageai';
import { mock } from 'jest-mock-extended';
import type { ISupplyDataFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { logWrapper } from '@utils/logWrapper';

import { EmbeddingsVoyageAiMultimodal } from '../../nodes/EmbeddingsVoyageAiMultimodal/EmbeddingsVoyageAiMultimodal.node';

// Mock the VoyageAIClient
jest.mock('voyageai', () => ({
	VoyageAIClient: jest.fn(),
}));

// Mock the logWrapper utility
jest.mock('@utils/logWrapper', () => ({
	logWrapper: jest.fn().mockImplementation((obj) => ({ logWrapped: obj })),
}));

describe('EmbeddingsVoyageAiMultimodal', () => {
	let embeddingsNode: EmbeddingsVoyageAiMultimodal;
	let mockSupplyDataFunctions: ISupplyDataFunctions;
	let mockVoyageAIClient: jest.Mocked<VoyageAIClient>;

	beforeEach(() => {
		embeddingsNode = new EmbeddingsVoyageAiMultimodal();

		// Reset the mocks
		jest.clearAllMocks();

		// Create a mock VoyageAIClient instance
		mockVoyageAIClient = {
			multimodalEmbed: jest.fn(),
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
		mockSupplyDataFunctions.getInputData = jest.fn();
		mockSupplyDataFunctions.helpers = {
			getBinaryDataBuffer: jest.fn(),
		} as any;
	});

	describe('Node Configuration', () => {
		it('should have correct metadata', () => {
			expect(embeddingsNode.description.displayName).toBe('Embeddings VoyageAI Multimodal');
			expect(embeddingsNode.description.name).toBe('embeddingsVoyageAiMultimodal');
			expect(embeddingsNode.description.credentials?.[0].name).toBe('voyageAiApi');
			expect(embeddingsNode.description.version).toBe(1);
		});

		it('should have model parameter with voyage-multimodal-3.5 as default', () => {
			const modelParam = embeddingsNode.description.properties.find(
				(p) => p.name === 'modelName',
			);
			expect(modelParam).toBeDefined();
			expect(modelParam?.type).toBe('options');
			expect(modelParam?.default).toBe('voyage-multimodal-3.5');
		});

		it('should include voyage-multimodal-3.5 model option', () => {
			const modelParam = embeddingsNode.description.properties.find(
				(p) => p.name === 'modelName',
			);
			const options = (modelParam as any)?.options || [];
			const modelValues = options.map((o: any) => o.value);
			expect(modelValues).toContain('voyage-multimodal-3.5');
			expect(modelValues).toContain('voyage-multimodal-3');
		});

		it('should have contentType parameter', () => {
			const contentTypeParam = embeddingsNode.description.properties.find(
				(p) => p.name === 'contentType',
			);
			expect(contentTypeParam).toBeDefined();
			expect(contentTypeParam?.type).toBe('options');
			expect(contentTypeParam?.default).toBe('text');
			expect(contentTypeParam?.required).toBe(true);
		});

		it('should have textInput parameter', () => {
			const textInputParam = embeddingsNode.description.properties.find(
				(p) => p.name === 'textInput',
			);
			expect(textInputParam).toBeDefined();
			expect(textInputParam?.type).toBe('string');
		});

		it('should have imageUrl parameter', () => {
			const imageUrlParam = embeddingsNode.description.properties.find(
				(p) => p.name === 'imageUrl',
			);
			expect(imageUrlParam).toBeDefined();
			expect(imageUrlParam?.type).toBe('string');
		});

		it('should have binaryDataKey parameter', () => {
			const binaryDataKeyParam = embeddingsNode.description.properties.find(
				(p) => p.name === 'binaryDataKey',
			);
			expect(binaryDataKeyParam).toBeDefined();
			expect(binaryDataKeyParam?.type).toBe('string');
			expect(binaryDataKeyParam?.default).toBe('data');
		});

		it('should have options parameter with inputType and truncation', () => {
			const optionsParam = embeddingsNode.description.properties.find((p) => p.name === 'options');
			expect(optionsParam).toBeDefined();
			expect(optionsParam?.type).toBe('collection');

			const options = (optionsParam as any)?.options || [];
			const inputTypeOption = options.find((o: any) => o.name === 'inputType');
			const truncationOption = options.find((o: any) => o.name === 'truncation');

			expect(inputTypeOption).toBeDefined();
			expect(truncationOption).toBeDefined();
			expect(truncationOption?.default).toBe(true);
		});

		it('should have correct content type options', () => {
			const contentTypeParam = embeddingsNode.description.properties.find(
				(p) => p.name === 'contentType',
			);
			const options = (contentTypeParam as any)?.options || [];

			expect(options.length).toBe(5);
			expect(options.map((o: any) => o.value)).toEqual([
				'binary',
				'imageUrl',
				'textAndBinary',
				'textAndImageUrl',
				'text',
			]);
		});
	});

	describe('supplyData - Text Only Mode', () => {
		it('should create embeddings instance for text-only content and pre-compute embeddings', async () => {
			const mockCredentials = { apiKey: 'test-api-key', url: 'https://api.voyageai.com/v1' };
			const mockInputData: INodeExecutionData[] = [
				{
					json: {},
				},
			];

			(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('voyage-multimodal-3') // modelName
				.mockReturnValueOnce({}) // options
				.mockReturnValueOnce('text') // contentType
				.mockReturnValueOnce('Test text input'); // textInput
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(mockCredentials);
			(mockSupplyDataFunctions.getInputData as jest.Mock).mockReturnValue(mockInputData);

			// Mock API response
			mockVoyageAIClient.multimodalEmbed.mockResolvedValue({
				data: [
					{
						embedding: new Array(1024).fill(0.1),
						index: 0,
					},
				],
				model: 'voyage-multimodal-3',
				usage: { total_tokens: 10 },
			} as any);

			const result = await embeddingsNode.supplyData.call(mockSupplyDataFunctions, 0);

			expect(mockSupplyDataFunctions.getCredentials).toHaveBeenCalledWith('voyageAiApi');
			expect(mockSupplyDataFunctions.getInputData).toHaveBeenCalled();
			expect(mockVoyageAIClient.multimodalEmbed).toHaveBeenCalledWith({
				inputs: [
					{
						content: [
							{
								type: 'text',
								text: 'Test text input',
							},
						],
					},
				],
				model: 'voyage-multimodal-3',
				inputType: undefined,
				truncation: true,
			});
			expect(logWrapper).toHaveBeenCalled();
			expect(result.response).toBeDefined();
		});

		it('should throw error when text input is empty for text-only mode', async () => {
			const mockCredentials = { apiKey: 'test-api-key' };
			const mockInputData: INodeExecutionData[] = [{ json: {} }];

			(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('voyage-multimodal-3') // modelName
				.mockReturnValueOnce({}) // options
				.mockReturnValueOnce('text') // contentType
				.mockReturnValueOnce(''); // textInput (empty)
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(mockCredentials);
			(mockSupplyDataFunctions.getInputData as jest.Mock).mockReturnValue(mockInputData);

			await expect(embeddingsNode.supplyData.call(mockSupplyDataFunctions, 0)).rejects.toThrow(
				NodeOperationError,
			);
		});
	});

	describe('supplyData - Text + Image URL Mode', () => {
		it('should handle text and image URL combination', async () => {
			const mockCredentials = { apiKey: 'test-api-key' };
			const mockInputData: INodeExecutionData[] = [{ json: {} }];

			(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('voyage-multimodal-3') // modelName
				.mockReturnValueOnce({}) // options
				.mockReturnValueOnce('textAndImageUrl') // contentType
				.mockReturnValueOnce('Test text')
				.mockReturnValueOnce('https://example.com/image.jpg');
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(mockCredentials);
			(mockSupplyDataFunctions.getInputData as jest.Mock).mockReturnValue(mockInputData);

			mockVoyageAIClient.multimodalEmbed.mockResolvedValue({
				data: [{ embedding: new Array(1024).fill(0.1), index: 0 }],
				model: 'voyage-multimodal-3',
				usage: { total_tokens: 10 },
			} as any);

			await embeddingsNode.supplyData.call(mockSupplyDataFunctions, 0);

			expect(mockVoyageAIClient.multimodalEmbed).toHaveBeenCalledWith({
				inputs: [
					{
						content: [
							{ type: 'text', text: 'Test text' },
							{ type: 'image_url', imageUrl: 'https://example.com/image.jpg' },
						],
					},
				],
				model: 'voyage-multimodal-3',
				inputType: undefined,
				truncation: true,
			});
		});

		it('should throw error when image URL is missing', async () => {
			const mockCredentials = { apiKey: 'test-api-key' };
			const mockInputData: INodeExecutionData[] = [{ json: {} }];

			(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('voyage-multimodal-3') // modelName
				.mockReturnValueOnce({}) // options
				.mockReturnValueOnce('textAndImageUrl') // contentType
				.mockReturnValueOnce('Test text')
				.mockReturnValueOnce(''); // empty imageUrl
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(mockCredentials);
			(mockSupplyDataFunctions.getInputData as jest.Mock).mockReturnValue(mockInputData);

			await expect(embeddingsNode.supplyData.call(mockSupplyDataFunctions, 0)).rejects.toThrow(
				NodeOperationError,
			);
		});
	});

	describe('supplyData - Image URL Only Mode', () => {
		it('should handle image URL only', async () => {
			const mockCredentials = { apiKey: 'test-api-key' };
			const mockInputData: INodeExecutionData[] = [{ json: {} }];

			(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('voyage-multimodal-3') // modelName
				.mockReturnValueOnce({}) // options
				.mockReturnValueOnce('imageUrl') // contentType
				.mockReturnValueOnce('https://example.com/image.jpg');
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(mockCredentials);
			(mockSupplyDataFunctions.getInputData as jest.Mock).mockReturnValue(mockInputData);

			mockVoyageAIClient.multimodalEmbed.mockResolvedValue({
				data: [{ embedding: new Array(1024).fill(0.1), index: 0 }],
				model: 'voyage-multimodal-3',
				usage: { total_tokens: 10 },
			} as any);

			await embeddingsNode.supplyData.call(mockSupplyDataFunctions, 0);

			expect(mockVoyageAIClient.multimodalEmbed).toHaveBeenCalledWith({
				inputs: [
					{
						content: [{ type: 'image_url', imageUrl: 'https://example.com/image.jpg' }],
					},
				],
				model: 'voyage-multimodal-3',
				inputType: undefined,
				truncation: true,
			});
		});
	});

	describe('supplyData - Binary Image Mode', () => {
		it('should handle binary image data', async () => {
			const mockCredentials = { apiKey: 'test-api-key' };
			const mockBinaryData = {
				mimeType: 'image/png',
				fileSize: '1024',
				data: '',
			};
			const mockInputData: INodeExecutionData[] = [
				{
					json: {},
					binary: {
						data: mockBinaryData,
					},
				},
			];

			(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('voyage-multimodal-3') // modelName
				.mockReturnValueOnce({}) // options
				.mockReturnValueOnce('binary') // contentType
				.mockReturnValueOnce('data'); // binaryDataKey
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(mockCredentials);
			(mockSupplyDataFunctions.getInputData as jest.Mock).mockReturnValue(mockInputData);
			(mockSupplyDataFunctions.helpers.getBinaryDataBuffer as jest.Mock).mockResolvedValue(
				Buffer.from('fake-image-data'),
			);

			mockVoyageAIClient.multimodalEmbed.mockResolvedValue({
				data: [{ embedding: new Array(1024).fill(0.1), index: 0 }],
				model: 'voyage-multimodal-3',
				usage: { total_tokens: 10 },
			} as any);

			await embeddingsNode.supplyData.call(mockSupplyDataFunctions, 0);

			expect(mockSupplyDataFunctions.helpers.getBinaryDataBuffer).toHaveBeenCalledWith(0, 'data');
			expect(mockVoyageAIClient.multimodalEmbed).toHaveBeenCalledWith(
				expect.objectContaining({
					inputs: [
						{
							content: [
								expect.objectContaining({
									type: 'image_base64',
									imageBase64: expect.stringContaining('data:image/png;base64,'),
								}),
							],
						},
					],
					model: 'voyage-multimodal-3',
				}),
			);
		});

		it('should throw error when binary data is missing', async () => {
			const mockCredentials = { apiKey: 'test-api-key' };
			const mockInputData: INodeExecutionData[] = [
				{
					json: {},
					binary: {},
				},
			];

			(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('voyage-multimodal-3') // modelName
				.mockReturnValueOnce({}) // options
				.mockReturnValueOnce('binary') // contentType
				.mockReturnValueOnce('data'); // binaryDataKey
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(mockCredentials);
			(mockSupplyDataFunctions.getInputData as jest.Mock).mockReturnValue(mockInputData);

			await expect(embeddingsNode.supplyData.call(mockSupplyDataFunctions, 0)).rejects.toThrow(
				NodeOperationError,
			);
		});

		it('should throw error for invalid MIME type', async () => {
			const mockCredentials = { apiKey: 'test-api-key' };
			const mockBinaryData = {
				mimeType: 'application/pdf',
				fileSize: '1024',
				data: '',
			};
			const mockInputData: INodeExecutionData[] = [
				{
					json: {},
					binary: {
						data: mockBinaryData,
					},
				},
			];

			(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('voyage-multimodal-3') // modelName
				.mockReturnValueOnce({}) // options
				.mockReturnValueOnce('binary') // contentType
				.mockReturnValueOnce('data'); // binaryDataKey
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(mockCredentials);
			(mockSupplyDataFunctions.getInputData as jest.Mock).mockReturnValue(mockInputData);
			(mockSupplyDataFunctions.helpers.getBinaryDataBuffer as jest.Mock).mockResolvedValue(
				Buffer.from('fake-pdf-data'),
			);

			await expect(embeddingsNode.supplyData.call(mockSupplyDataFunctions, 0)).rejects.toThrow(
				NodeOperationError,
			);
		});

		it('should throw error when image exceeds size limit', async () => {
			const mockCredentials = { apiKey: 'test-api-key' };
			const mockBinaryData = {
				mimeType: 'image/png',
				fileSize: String(21 * 1024 * 1024),
				data: '',
			};
			const mockInputData: INodeExecutionData[] = [
				{
					json: {},
					binary: {
						data: mockBinaryData,
					},
				},
			];

			(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('voyage-multimodal-3') // modelName
				.mockReturnValueOnce({}) // options
				.mockReturnValueOnce('binary') // contentType
				.mockReturnValueOnce('data'); // binaryDataKey
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(mockCredentials);
			(mockSupplyDataFunctions.getInputData as jest.Mock).mockReturnValue(mockInputData);

			await expect(embeddingsNode.supplyData.call(mockSupplyDataFunctions, 0)).rejects.toThrow(
				NodeOperationError,
			);
		});
	});

	describe('Error Handling', () => {
		it('should wrap API errors in NodeOperationError', async () => {
			const mockCredentials = { apiKey: 'test-api-key' };
			const mockInputData: INodeExecutionData[] = [{ json: {} }];

			(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('voyage-multimodal-3') // modelName
				.mockReturnValueOnce({}) // options
				.mockReturnValueOnce('text') // contentType
				.mockReturnValueOnce('Test text');
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(mockCredentials);
			(mockSupplyDataFunctions.getInputData as jest.Mock).mockReturnValue(mockInputData);

			mockVoyageAIClient.multimodalEmbed.mockRejectedValue(new Error('API Error'));

			await expect(embeddingsNode.supplyData.call(mockSupplyDataFunctions, 0)).rejects.toThrow(
				NodeOperationError,
			);
		});

		it('should throw NodeOperationError when no embeddings returned', async () => {
			const mockCredentials = { apiKey: 'test-api-key' };
			const mockInputData: INodeExecutionData[] = [{ json: {} }];

			(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('voyage-multimodal-3') // modelName
				.mockReturnValueOnce({}) // options
				.mockReturnValueOnce('text') // contentType
				.mockReturnValueOnce('Test text');
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(mockCredentials);
			(mockSupplyDataFunctions.getInputData as jest.Mock).mockReturnValue(mockInputData);

			mockVoyageAIClient.multimodalEmbed.mockResolvedValue({
				data: [],
				model: 'voyage-multimodal-3',
				usage: { total_tokens: 10 },
			} as any);

			await expect(embeddingsNode.supplyData.call(mockSupplyDataFunctions, 0)).rejects.toThrow(
				NodeOperationError,
			);
		});
	});

	describe('Logging', () => {
		it('should wrap embeddings instance with logWrapper', async () => {
			const mockCredentials = { apiKey: 'test-api-key' };
			const mockInputData: INodeExecutionData[] = [{ json: {} }];

			(mockSupplyDataFunctions.getNodeParameter as jest.Mock)
				.mockReturnValueOnce('voyage-multimodal-3') // modelName
				.mockReturnValueOnce({}) // options
				.mockReturnValueOnce('text') // contentType
				.mockReturnValueOnce('Test text');
			(mockSupplyDataFunctions.getCredentials as jest.Mock).mockResolvedValue(mockCredentials);
			(mockSupplyDataFunctions.getInputData as jest.Mock).mockReturnValue(mockInputData);

			mockVoyageAIClient.multimodalEmbed.mockResolvedValue({
				data: [{ embedding: new Array(1024).fill(0.1), index: 0 }],
				model: 'voyage-multimodal-3',
				usage: { total_tokens: 10 },
			} as any);

			await embeddingsNode.supplyData.call(mockSupplyDataFunctions, 0);

			expect(logWrapper).toHaveBeenCalledWith(expect.anything(), mockSupplyDataFunctions);
		});
	});
});
