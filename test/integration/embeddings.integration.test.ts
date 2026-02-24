import { VoyageEmbeddings } from '@langchain/community/embeddings/voyage';

jest.setTimeout(30000);

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;

const describeIf = VOYAGE_API_KEY ? describe : describe.skip;

describeIf('EmbeddingsVoyageAi Integration', () => {
	it('should embed single text with voyage-3.5 and return 1024-dimension vector', async () => {
		const embeddings = new VoyageEmbeddings({
			apiKey: VOYAGE_API_KEY!,
			modelName: 'voyage-3.5',
		});

		const result = await embeddings.embedQuery('Hello world');

		expect(Array.isArray(result)).toBe(true);
		expect(result.length).toBe(1024);
		expect(typeof result[0]).toBe('number');
	});

	it('should embed batch of documents', async () => {
		const embeddings = new VoyageEmbeddings({
			apiKey: VOYAGE_API_KEY!,
			modelName: 'voyage-3.5',
		});

		const result = await embeddings.embedDocuments([
			'First document',
			'Second document',
			'Third document',
		]);

		expect(result.length).toBe(3);
		result.forEach((vec) => {
			expect(vec.length).toBe(1024);
			expect(typeof vec[0]).toBe('number');
		});
	});

	it('should respect outputDimension: 256', async () => {
		const embeddings = new VoyageEmbeddings({
			apiKey: VOYAGE_API_KEY!,
			modelName: 'voyage-3.5',
			outputDimension: 256,
		});

		const result = await embeddings.embedQuery('Test query');

		expect(result.length).toBe(256);
	});

	it('should handle inputType query', async () => {
		const embeddings = new VoyageEmbeddings({
			apiKey: VOYAGE_API_KEY!,
			modelName: 'voyage-3.5',
			inputType: 'query',
		});

		const result = await embeddings.embedQuery('search query');

		expect(Array.isArray(result)).toBe(true);
		expect(result.length).toBe(1024);
	});

	it('should handle inputType document', async () => {
		const embeddings = new VoyageEmbeddings({
			apiKey: VOYAGE_API_KEY!,
			modelName: 'voyage-3.5',
			inputType: 'document',
		});

		const result = await embeddings.embedDocuments(['a document']);

		expect(result.length).toBe(1);
		expect(result[0].length).toBe(1024);
	});

	it('should return meaningful error for invalid API key', async () => {
		const embeddings = new VoyageEmbeddings({
			apiKey: 'invalid-key',
			modelName: 'voyage-3.5',
		});

		await expect(embeddings.embedQuery('test')).rejects.toThrow();
	});
});
