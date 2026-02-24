import { VoyageAIClient } from 'voyageai';

jest.setTimeout(30000);

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;

const describeIf = VOYAGE_API_KEY ? describe : describe.skip;

describeIf('EmbeddingsVoyageAiContextualized Integration', () => {
	let client: VoyageAIClient;

	beforeAll(() => {
		client = new VoyageAIClient({ apiKey: VOYAGE_API_KEY! });
	});

	it('should embed single document with multiple chunks', async () => {
		const response = await client.contextualizedEmbed({
			inputs: [['chunk one of document', 'chunk two of document', 'chunk three of document']],
			model: 'voyage-context-3',
		});

		expect(response.data).toBeDefined();
		expect(response.data!.length).toBe(1);
		// Each document group is an object with a nested `data` array of embeddings
		const docGroup = response.data![0] as any;
		if (docGroup.data) {
			expect(docGroup.data.length).toBe(3);
			expect(docGroup.data[0]).toHaveProperty('embedding');
		} else if (Array.isArray(docGroup)) {
			expect(docGroup.length).toBe(3);
		}
	});

	it('should embed multiple documents with multiple chunks each', async () => {
		const response = await client.contextualizedEmbed({
			inputs: [
				['doc1 chunk1', 'doc1 chunk2'],
				['doc2 chunk1', 'doc2 chunk2', 'doc2 chunk3'],
			],
			model: 'voyage-context-3',
		});

		expect(response.data).toBeDefined();
		expect(response.data!.length).toBe(2);
	});

	it('should embed query using standard embed API with compatible model', async () => {
		// voyage-context-3 is only for contextualizedEmbed, use voyage-3.5 for standard embed
		const response = await client.embed({
			input: 'a search query',
			model: 'voyage-3.5',
			inputType: 'query',
		});

		expect(response.data).toBeDefined();
		expect(response.data!.length).toBe(1);
		expect(response.data![0].embedding).toBeDefined();
	});
});
