import { VoyageAIClient } from 'voyageai';

jest.setTimeout(30000);

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;

const describeIf = VOYAGE_API_KEY ? describe : describe.skip;

describeIf('RerankerVoyageAi Integration', () => {
	let client: VoyageAIClient;

	beforeAll(() => {
		client = new VoyageAIClient({ apiKey: VOYAGE_API_KEY! });
	});

	it('should rerank 5 documents with a query', async () => {
		const response = await client.rerank({
			query: 'What is machine learning?',
			documents: [
				'Machine learning is a subset of artificial intelligence',
				'The weather is nice today',
				'Deep learning uses neural networks',
				'I like pizza',
				'Natural language processing is a branch of AI',
			],
			model: 'rerank-2.5',
			topK: 3,
		});

		expect(response.data).toBeDefined();
		expect(response.data!.length).toBe(3);
	});

	it('should return relevance scores in descending order', async () => {
		const response = await client.rerank({
			query: 'What is machine learning?',
			documents: [
				'Machine learning is a subset of artificial intelligence',
				'The weather is nice today',
				'Deep learning uses neural networks',
			],
			model: 'rerank-2.5',
		});

		const scores = response.data!.map((r) => r.relevanceScore!);
		for (let i = 1; i < scores.length; i++) {
			expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
		}
	});

	it('should respect topK parameter', async () => {
		const response = await client.rerank({
			query: 'AI',
			documents: ['doc1', 'doc2', 'doc3', 'doc4', 'doc5'],
			model: 'rerank-2.5',
			topK: 2,
		});

		expect(response.data!.length).toBe(2);
	});

	it('should work with rerank-2.5-lite model', async () => {
		const response = await client.rerank({
			query: 'test',
			documents: ['document one', 'document two'],
			model: 'rerank-2.5-lite',
		});

		expect(response.data).toBeDefined();
		expect(response.data!.length).toBe(2);
	});
});
