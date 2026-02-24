import { Embeddings } from '@langchain/core/embeddings';
import { BaseDocumentCompressor } from '@langchain/core/retrievers/document_compressors';
import { mock } from 'jest-mock-extended';
import type { ISupplyDataFunctions } from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';

import { logWrapper, callMethodAsync } from '@utils/logWrapper';

// Create a concrete Embeddings subclass for testing
class TestEmbeddings extends Embeddings {
	async embedDocuments(documents: string[]): Promise<number[][]> {
		return documents.map(() => [0.1, 0.2, 0.3]);
	}
	async embedQuery(_query: string): Promise<number[]> {
		return [0.1, 0.2, 0.3];
	}
}

// Create a concrete BaseDocumentCompressor subclass for testing
class TestCompressor extends BaseDocumentCompressor {
	async compressDocuments(documents: any[], _query: string) {
		return documents;
	}
}

describe('logWrapper', () => {
	let mockExecuteFunctions: ISupplyDataFunctions;

	beforeEach(() => {
		mockExecuteFunctions = mock<ISupplyDataFunctions>({
			logger: {
				debug: jest.fn(),
				error: jest.fn(),
				info: jest.fn(),
				warn: jest.fn(),
			},
		});

		mockExecuteFunctions.addInputData = jest.fn().mockReturnValue({ index: 0 });
		mockExecuteFunctions.addOutputData = jest.fn();
		mockExecuteFunctions.logAiEvent = jest.fn();
		mockExecuteFunctions.getNode = jest.fn().mockReturnValue({ name: 'TestNode' });
	});

	describe('Embeddings proxy', () => {
		it('should intercept embedDocuments calls', async () => {
			const embeddings = new TestEmbeddings({});
			const wrapped = logWrapper(embeddings, mockExecuteFunctions);

			const result = await wrapped.embedDocuments(['doc1', 'doc2']);

			expect(result).toEqual([
				[0.1, 0.2, 0.3],
				[0.1, 0.2, 0.3],
			]);
			expect(mockExecuteFunctions.addInputData).toHaveBeenCalledWith(
				NodeConnectionTypes.AiEmbedding,
				[[{ json: { documents: ['doc1', 'doc2'] } }]],
			);
			expect(mockExecuteFunctions.addOutputData).toHaveBeenCalledWith(
				NodeConnectionTypes.AiEmbedding,
				0,
				[[{ json: { response: expect.any(Array) } }]],
			);
			expect(mockExecuteFunctions.logAiEvent).toHaveBeenCalledWith(
				'ai-document-embedded',
				undefined,
			);
		});

		it('should intercept embedQuery calls', async () => {
			const embeddings = new TestEmbeddings({});
			const wrapped = logWrapper(embeddings, mockExecuteFunctions);

			const result = await wrapped.embedQuery('test query');

			expect(result).toEqual([0.1, 0.2, 0.3]);
			expect(mockExecuteFunctions.addInputData).toHaveBeenCalledWith(
				NodeConnectionTypes.AiEmbedding,
				[[{ json: { query: 'test query' } }]],
			);
			expect(mockExecuteFunctions.logAiEvent).toHaveBeenCalledWith(
				'ai-query-embedded',
				undefined,
			);
		});

		it('should pass through non-intercepted properties', async () => {
			const embeddings = new TestEmbeddings({});
			const wrapped = logWrapper(embeddings, mockExecuteFunctions);

			// Access a non-proxied property
			expect(wrapped.caller).toBeDefined();
		});
	});

	describe('BaseDocumentCompressor proxy', () => {
		it('should intercept compressDocuments calls', async () => {
			const compressor = new TestCompressor();
			const wrapped = logWrapper(compressor, mockExecuteFunctions);

			const docs = [{ pageContent: 'test', metadata: {} }];
			const result = await wrapped.compressDocuments(docs, 'query');

			expect(result).toEqual(docs);
			expect(mockExecuteFunctions.addInputData).toHaveBeenCalledWith(
				NodeConnectionTypes.AiReranker,
				[[{ json: { query: 'query', documents: docs } }]],
			);
			expect(mockExecuteFunctions.addOutputData).toHaveBeenCalledWith(
				NodeConnectionTypes.AiReranker,
				0,
				[[{ json: { response: docs } }]],
			);
		});
	});

	describe('logAiEvent graceful degradation', () => {
		it('should not throw when logAiEvent fails', async () => {
			mockExecuteFunctions.logAiEvent = jest.fn().mockImplementation(() => {
				throw new Error('logging failed');
			});

			const embeddings = new TestEmbeddings({});
			const wrapped = logWrapper(embeddings, mockExecuteFunctions);

			// Should not throw
			const result = await wrapped.embedQuery('test');
			expect(result).toEqual([0.1, 0.2, 0.3]);
		});
	});
});

describe('callMethodAsync', () => {
	let mockExecuteFunctions: ISupplyDataFunctions;

	beforeEach(() => {
		mockExecuteFunctions = mock<ISupplyDataFunctions>({
			logger: {
				debug: jest.fn(),
				error: jest.fn(),
				info: jest.fn(),
				warn: jest.fn(),
			},
		});

		mockExecuteFunctions.addOutputData = jest.fn();
		mockExecuteFunctions.getNode = jest.fn().mockReturnValue({ name: 'TestNode' });
	});

	it('should call the method and return result', async () => {
		const method = jest.fn().mockResolvedValue('result');

		const result = await callMethodAsync.call({}, {
			executeFunctions: mockExecuteFunctions,
			connectionType: NodeConnectionTypes.AiEmbedding,
			currentNodeRunIndex: 0,
			method,
			arguments: ['arg1'],
		});

		expect(result).toBe('result');
		expect(method).toHaveBeenCalledWith('arg1');
	});

	it('should wrap errors in NodeOperationError', async () => {
		const method = jest.fn().mockRejectedValue(new Error('test error'));

		await expect(
			callMethodAsync.call({}, {
				executeFunctions: mockExecuteFunctions,
				connectionType: NodeConnectionTypes.AiEmbedding,
				currentNodeRunIndex: 0,
				method,
				arguments: [],
			}),
		).rejects.toThrow(NodeOperationError);

		expect(mockExecuteFunctions.addOutputData).toHaveBeenCalled();
	});
});
