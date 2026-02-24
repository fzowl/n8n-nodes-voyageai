/* eslint-disable @typescript-eslint/unbound-method */

import type { MockProxy } from 'jest-mock-extended';
import { mock } from 'jest-mock-extended';
import type { ISupplyDataFunctions, INodeExecutionData, Logger } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

import { EmbeddingsVoyageAiContextualized } from '../../nodes/EmbeddingsVoyageAiContextualized/EmbeddingsVoyageAiContextualized.node';

// Mock VoyageAI SDK - define functions that can be referenced
const mockContextualizedEmbed = jest.fn();
const mockEmbed = jest.fn();

jest.mock('voyageai', () => {
	return {
		VoyageAIClient: jest.fn().mockImplementation(() => ({
			contextualizedEmbed: mockContextualizedEmbed,
			embed: mockEmbed,
		})),
	};
});

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
		mockEmbed.mockReset();
		mockVoyageAIClient.mockClear();

		// Default mock implementations
		mockContext.getCredentials.mockResolvedValue({
			apiKey: 'test-api-key',
			url: 'https://api.voyageai.com/v1',
		});

		mockContext.getNodeParameter.mockImplementation((parameterName: string) => {
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
			expect(node.description.displayName).toBe('Embeddings VoyageAI Contextualized');
			expect(node.description.name).toBe('embeddingsVoyageAiContextualized');
			expect(node.description.version).toBe(1);
		});

		it('should require voyageAiApi credentials', () => {
			const credentials = node.description.credentials;
			expect(credentials).toHaveLength(1);
			expect(credentials?.[0].name).toBe('voyageAiApi');
			expect(credentials?.[0].required).toBe(true);
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

	describe('supplyData', () => {
		it('should create embeddings instance with correct configuration', async () => {
			const mockItems: INodeExecutionData[] = [
				{ json: { documentId: 'doc1', text: 'chunk 1' } },
				{ json: { documentId: 'doc1', text: 'chunk 2' } },
			];

			mockContext.getInputData.mockReturnValue(mockItems);

			mockContextualizedEmbed.mockResolvedValue({
				data: [[{ embedding: [0.1, 0.2, 0.3] }, { embedding: [0.4, 0.5, 0.6] }]],
			});

			const result = await node.supplyData.call(mockContext, 0);

			expect(result.response).toBeDefined();
			expect(mockContext.getCredentials).toHaveBeenCalledWith('voyageAiApi');
			expect(mockContext.getNodeParameter).toHaveBeenCalledWith('documentIdField', 0);
			expect(mockContext.getNodeParameter).toHaveBeenCalledWith('textField', 0);
		});

		it('should use default URL when not provided in credentials', async () => {
			mockContext.getCredentials.mockResolvedValue({
				apiKey: 'test-api-key',
			});

			const mockItems: INodeExecutionData[] = [{ json: { documentId: 'doc1', text: 'chunk 1' } }];

			mockContext.getInputData.mockReturnValue(mockItems);

			mockContextualizedEmbed.mockResolvedValue({
				data: [[{ embedding: [0.1, 0.2, 0.3] }]],
			});

			await node.supplyData.call(mockContext, 0);

			expect(mockVoyageAIClient).toHaveBeenCalledWith({
				apiKey: 'test-api-key',
				environment: 'https://api.voyageai.com/v1',
			});
		});

		it('should handle inputType option', async () => {
			mockContext.getNodeParameter.mockImplementation((parameterName: string) => {
				if (parameterName === 'documentIdField') return 'documentId';
				if (parameterName === 'textField') return 'text';
				if (parameterName === 'options') return { inputType: 'document' };
				return undefined;
			});

			const mockItems: INodeExecutionData[] = [{ json: { documentId: 'doc1', text: 'chunk 1' } }];

			mockContext.getInputData.mockReturnValue(mockItems);

			mockContextualizedEmbed.mockResolvedValue({
				data: [[{ embedding: [0.1, 0.2, 0.3] }]],
			});

			await node.supplyData.call(mockContext, 0);

			expect(mockContextualizedEmbed).toHaveBeenCalledWith({
				inputs: [['chunk 1']],
				model: 'voyage-context-3',
				inputType: 'document',
				outputDimension: undefined,
				outputDtype: undefined,
			});
		});

		it('should convert empty string inputType to undefined', async () => {
			mockContext.getNodeParameter.mockImplementation((parameterName: string) => {
				if (parameterName === 'documentIdField') return 'documentId';
				if (parameterName === 'textField') return 'text';
				if (parameterName === 'options') return { inputType: '' };
				return undefined;
			});

			const mockItems: INodeExecutionData[] = [{ json: { documentId: 'doc1', text: 'chunk 1' } }];

			mockContext.getInputData.mockReturnValue(mockItems);

			mockContextualizedEmbed.mockResolvedValue({
				data: [[{ embedding: [0.1, 0.2, 0.3] }]],
			});

			await node.supplyData.call(mockContext, 0);

			expect(mockContextualizedEmbed).toHaveBeenCalledWith({
				inputs: [['chunk 1']],
				model: 'voyage-context-3',
				inputType: undefined,
				outputDimension: undefined,
				outputDtype: undefined,
			});
		});
	});

	describe('Auto-Grouping Logic', () => {
		it('should group chunks by document ID', async () => {
			const mockItems: INodeExecutionData[] = [
				{ json: { documentId: 'doc1', text: 'chunk 1' } },
				{ json: { documentId: 'doc1', text: 'chunk 2' } },
				{ json: { documentId: 'doc2', text: 'chunk 3' } },
			];

			mockContext.getInputData.mockReturnValue(mockItems);

			mockContextualizedEmbed.mockResolvedValue({
				data: [
					[{ embedding: [0.1, 0.2, 0.3] }, { embedding: [0.4, 0.5, 0.6] }],
					[{ embedding: [0.7, 0.8, 0.9] }],
				],
			});

			await node.supplyData.call(mockContext, 0);

			expect(mockContextualizedEmbed).toHaveBeenCalledWith(
				expect.objectContaining({
					inputs: [['chunk 1', 'chunk 2'], ['chunk 3']],
				}),
			);
		});

		it('should handle single document with multiple chunks', async () => {
			const mockItems: INodeExecutionData[] = [
				{ json: { documentId: 'doc1', text: 'chunk 1' } },
				{ json: { documentId: 'doc1', text: 'chunk 2' } },
				{ json: { documentId: 'doc1', text: 'chunk 3' } },
			];

			mockContext.getInputData.mockReturnValue(mockItems);

			mockContextualizedEmbed.mockResolvedValue({
				data: [
					[
						{ embedding: [0.1, 0.2, 0.3] },
						{ embedding: [0.4, 0.5, 0.6] },
						{ embedding: [0.7, 0.8, 0.9] },
					],
				],
			});

			await node.supplyData.call(mockContext, 0);

			expect(mockContextualizedEmbed).toHaveBeenCalledWith(
				expect.objectContaining({
					inputs: [['chunk 1', 'chunk 2', 'chunk 3']],
				}),
			);
		});
	});

	describe('Validation', () => {
		it('should throw NodeOperationError when document ID is missing', async () => {
			const mockItems: INodeExecutionData[] = [
				{ json: { text: 'chunk 1' } },
			];

			mockContext.getInputData.mockReturnValue(mockItems);

			await expect(node.supplyData.call(mockContext, 0)).rejects.toThrow(NodeOperationError);
			await expect(node.supplyData.call(mockContext, 0)).rejects.toThrow(
				'Missing document ID in field: documentId',
			);
		});

		it('should throw NodeOperationError when text field is missing', async () => {
			const mockItems: INodeExecutionData[] = [
				{ json: { documentId: 'doc1' } },
			];

			mockContext.getInputData.mockReturnValue(mockItems);

			await expect(node.supplyData.call(mockContext, 0)).rejects.toThrow(NodeOperationError);
			await expect(node.supplyData.call(mockContext, 0)).rejects.toThrow(
				'Missing text in field: text',
			);
		});

		it('should throw NodeOperationError when exceeding 1000 document groups', async () => {
			const mockItems: INodeExecutionData[] = Array.from({ length: 1001 }, (_, i) => ({
				json: { documentId: `doc${i}`, text: `chunk ${i}` },
			}));

			mockContext.getInputData.mockReturnValue(mockItems);

			await expect(node.supplyData.call(mockContext, 0)).rejects.toThrow(NodeOperationError);
			await expect(node.supplyData.call(mockContext, 0)).rejects.toThrow(
				'Maximum 1,000 document groups exceeded',
			);
		});

		it('should throw NodeOperationError when exceeding 16000 total chunks', async () => {
			const mockItems: INodeExecutionData[] = Array.from({ length: 16001 }, (_, i) => ({
				json: { documentId: 'doc1', text: `chunk ${i}` },
			}));

			mockContext.getInputData.mockReturnValue(mockItems);

			await expect(node.supplyData.call(mockContext, 0)).rejects.toThrow(NodeOperationError);
			await expect(node.supplyData.call(mockContext, 0)).rejects.toThrow(
				'Maximum 16,000 chunks exceeded',
			);
		});
	});

	describe('Error Handling', () => {
		it('should throw NodeOperationError when API returns no data', async () => {
			const mockItems: INodeExecutionData[] = [{ json: { documentId: 'doc1', text: 'chunk 1' } }];

			mockContext.getInputData.mockReturnValue(mockItems);

			mockContextualizedEmbed.mockResolvedValue({
				data: null,
			});

			await expect(node.supplyData.call(mockContext, 0)).rejects.toThrow(NodeOperationError);
		});

		it('should throw NodeOperationError when API call fails', async () => {
			const mockItems: INodeExecutionData[] = [{ json: { documentId: 'doc1', text: 'chunk 1' } }];

			mockContext.getInputData.mockReturnValue(mockItems);

			(mockContextualizedEmbed as jest.Mock).mockRejectedValue(new Error('API connection failed'));

			await expect(node.supplyData.call(mockContext, 0)).rejects.toThrow(NodeOperationError);
		});
	});

	describe('Model Fixed to voyage-context-3', () => {
		it('should always use voyage-context-3 model', async () => {
			const mockItems: INodeExecutionData[] = [{ json: { documentId: 'doc1', text: 'chunk 1' } }];

			mockContext.getInputData.mockReturnValue(mockItems);

			mockContextualizedEmbed.mockResolvedValue({
				data: [[{ embedding: [0.1, 0.2, 0.3] }]],
			});

			await node.supplyData.call(mockContext, 0);

			expect(mockContextualizedEmbed).toHaveBeenCalledWith(
				expect.objectContaining({
					model: 'voyage-context-3',
				}),
			);
		});
	});
});
