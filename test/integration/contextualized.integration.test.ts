import { VoyageAIClient } from 'voyageai';

jest.setTimeout(30000);

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;

const describeIf = VOYAGE_API_KEY ? describe : describe.skip;

describeIf('EmbeddingsVoyageAiContextualized Integration', () => {
	let client: VoyageAIClient;

	beforeAll(() => {
		client = new VoyageAIClient({ apiKey: VOYAGE_API_KEY! });
	});

	describe.each(['voyage-context-3', 'voyage-context-4'])('%s', (model) => {
		it('should auto-chunk whole documents and return the chunk texts', async () => {
			const documents = ['First document. It has two sentences.', 'Second document about cats.'];

			const response = await client.contextualizedEmbed({
				inputs: documents,
				model,
				inputType: 'document',
				enableAutoChunking: true,
				chunkSize: 32_000,
			});

			expect(response.results).toHaveLength(2);
			response.results.forEach((result, i) => {
				expect(result.index).toBe(i);
				expect(result.embeddings.length).toBeGreaterThan(0);
				expect(result.embeddings[0]).toHaveLength(1024);
				expect(result.chunkTexts).toHaveLength(result.embeddings.length);
			});
		});

		it('should embed a query as a single-chunk document, without auto-chunking', async () => {
			const response = await client.contextualizedEmbed({
				inputs: [['a search query']],
				model,
				inputType: 'query',
			});

			expect(response.results).toHaveLength(1);
			expect(response.results[0].embeddings).toHaveLength(1);
			expect(response.results[0].embeddings[0]).toHaveLength(1024);
		});

		it('should respect outputDimension: 256', async () => {
			const response = await client.contextualizedEmbed({
				inputs: [['a search query']],
				model,
				inputType: 'query',
				outputDimension: 256,
			});

			expect(response.results[0].embeddings[0]).toHaveLength(256);
		});
	});

	it('should reject a pre-chunked document with auto-chunking enabled', async () => {
		await expect(
			client.contextualizedEmbed({
				inputs: [['chunk one', 'chunk two']],
				model: 'voyage-context-4',
				inputType: 'document',
				enableAutoChunking: true,
				chunkSize: 32_000,
			}),
		).rejects.toThrow('auto-chunking expects one string per document');
	});

	it('should reject auto-chunking for queries', async () => {
		await expect(
			client.contextualizedEmbed({
				inputs: ['a search query'],
				model: 'voyage-context-4',
				inputType: 'query',
				enableAutoChunking: true,
				chunkSize: 32_000,
			}),
		).rejects.toThrow("requires inputType: 'document'");
	});

	it('should return the Voyage detail for an unknown model', async () => {
		await expect(
			client.contextualizedEmbed({
				inputs: [['x']],
				model: 'voyage-context-nope',
				inputType: 'query',
			}),
		).rejects.toMatchObject({
			statusCode: 400,
			body: { detail: expect.stringContaining('not supported') },
		});
	});
});
