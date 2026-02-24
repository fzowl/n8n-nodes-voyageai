import type { Document } from '@langchain/core/documents';
import { Embeddings } from '@langchain/core/embeddings';
import { BaseDocumentCompressor } from '@langchain/core/retrievers/document_compressors';
import type {
	AiEvent,
	IDataObject,
	IExecuteFunctions,
	ISupplyDataFunctions,
	NodeConnectionType,
} from 'n8n-workflow';
import { NodeOperationError, NodeConnectionTypes, parseErrorMetadata, deepCopy } from 'n8n-workflow';

function logAiEvent(
	executeFunctions: IExecuteFunctions | ISupplyDataFunctions,
	event: AiEvent,
	data?: IDataObject,
) {
	try {
		executeFunctions.logAiEvent(event, data ? JSON.stringify(data) : undefined);
	} catch (error) {
		executeFunctions.logger.debug(`Error logging AI event: ${event}`);
	}
}

export async function callMethodAsync<T>(
	this: T,
	parameters: {
		executeFunctions: IExecuteFunctions | ISupplyDataFunctions;
		connectionType: NodeConnectionType;
		currentNodeRunIndex: number;
		method: (...args: any[]) => Promise<unknown>;
		arguments: unknown[];
	},
): Promise<unknown> {
	try {
		return await parameters.method.call(this, ...parameters.arguments);
	} catch (e) {
		const connectedNode = parameters.executeFunctions.getNode();

		const error = new NodeOperationError(connectedNode, e as Error, {
			functionality: 'configuration-node',
		});

		const metadata = parseErrorMetadata(error);
		parameters.executeFunctions.addOutputData(
			parameters.connectionType,
			parameters.currentNodeRunIndex,
			error,
			metadata,
		);

		if (error.message) {
			if (!error.description) {
				error.description = error.message;
			}
			throw error;
		}

		throw new NodeOperationError(
			connectedNode,
			`Error on node "${connectedNode.name}" which is connected via input "${parameters.connectionType}"`,
			{ functionality: 'configuration-node' },
		);
	}
}

export function logWrapper<T extends Embeddings | BaseDocumentCompressor>(
	originalInstance: T,
	executeFunctions: IExecuteFunctions | ISupplyDataFunctions,
): T {
	return new Proxy(originalInstance, {
		get: (target, prop) => {
			let connectionType: NodeConnectionType | undefined;

			// ========== Embeddings ==========
			if (originalInstance instanceof Embeddings) {
				if (prop === 'embedDocuments' && 'embedDocuments' in target) {
					return async (documents: string[]): Promise<number[][]> => {
						connectionType = NodeConnectionTypes.AiEmbedding;
						const { index } = executeFunctions.addInputData(connectionType, [
							[{ json: { documents } }],
						]);

						const response = (await callMethodAsync.call(target, {
							executeFunctions,
							connectionType,
							currentNodeRunIndex: index,
							method: target[prop],
							arguments: [documents],
						})) as number[][];

						logAiEvent(executeFunctions, 'ai-document-embedded');
						executeFunctions.addOutputData(connectionType, index, [[{ json: { response } }]]);
						return response;
					};
				}

				if (prop === 'embedQuery' && 'embedQuery' in target) {
					return async (query: string): Promise<number[]> => {
						connectionType = NodeConnectionTypes.AiEmbedding;
						const { index } = executeFunctions.addInputData(connectionType, [
							[{ json: { query } }],
						]);

						const response = (await callMethodAsync.call(target, {
							executeFunctions,
							connectionType,
							currentNodeRunIndex: index,
							method: target[prop],
							arguments: [query],
						})) as number[];
						logAiEvent(executeFunctions, 'ai-query-embedded');
						executeFunctions.addOutputData(connectionType, index, [[{ json: { response } }]]);
						return response;
					};
				}
			}

			// ========== Rerankers ==========
			if (originalInstance instanceof BaseDocumentCompressor) {
				if (prop === 'compressDocuments' && 'compressDocuments' in target) {
					return async (documents: Document[], query: string): Promise<Document[]> => {
						connectionType = NodeConnectionTypes.AiReranker;
						const { index } = executeFunctions.addInputData(connectionType, [
							[{ json: { query, documents } }],
						]);

						const response = (await callMethodAsync.call(target, {
							executeFunctions,
							connectionType,
							currentNodeRunIndex: index,
							method: target[prop],
							arguments: [deepCopy(documents), query],
						})) as Document[];

						logAiEvent(executeFunctions, 'ai-document-reranked', { query });
						executeFunctions.addOutputData(connectionType, index, [[{ json: { response } }]]);
						return response;
					};
				}
			}

			return (target as any)[prop];
		},
	});
}
