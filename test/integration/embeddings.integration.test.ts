import { VoyageAIClient } from 'voyageai';

jest.setTimeout(30000);

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;

const describeIf = VOYAGE_API_KEY ? describe : describe.skip;

describeIf('EmbeddingsVoyageAi Integration', () => {
	let client: VoyageAIClient;

	beforeAll(() => {
		client = new VoyageAIClient({ apiKey: VOYAGE_API_KEY! });
	});

	it('should embed single text with voyage-3.5 and return 1024-dimension vector', async () => {
		const response = await client.embed({
			input: 'Hello world',
			model: 'voyage-3.5',
		});

		expect(response.data).toBeDefined();
		expect(response.data!.length).toBe(1);
		expect(response.data![0].embedding).toBeDefined();
		expect(response.data![0].embedding!.length).toBe(1024);
		expect(typeof response.data![0].embedding![0]).toBe('number');
	});

	it('should embed batch of documents', async () => {
		const response = await client.embed({
			input: ['First document', 'Second document', 'Third document'],
			model: 'voyage-3.5',
		});

		expect(response.data).toBeDefined();
		expect(response.data!.length).toBe(3);
		response.data!.forEach((item) => {
			expect(item.embedding!.length).toBe(1024);
			expect(typeof item.embedding![0]).toBe('number');
		});
	});

	it('should respect outputDimension: 256', async () => {
		const response = await client.embed({
			input: 'Test query',
			model: 'voyage-3.5',
			outputDimension: 256,
		});

		expect(response.data).toBeDefined();
		expect(response.data![0].embedding!.length).toBe(256);
	});

	it('should handle inputType query', async () => {
		const response = await client.embed({
			input: 'search query',
			model: 'voyage-3.5',
			inputType: 'query',
		});

		expect(response.data).toBeDefined();
		expect(response.data![0].embedding).toBeDefined();
		expect(response.data![0].embedding!.length).toBe(1024);
	});

	it('should handle inputType document', async () => {
		const response = await client.embed({
			input: ['a document'],
			model: 'voyage-3.5',
			inputType: 'document',
		});

		expect(response.data).toBeDefined();
		expect(response.data!.length).toBe(1);
		expect(response.data![0].embedding!.length).toBe(1024);
	});

	it('should return meaningful error for invalid API key', async () => {
		const badClient = new VoyageAIClient({ apiKey: 'invalid-key' });

		await expect(
			badClient.embed({
				input: 'test',
				model: 'voyage-3.5',
			}),
		).rejects.toThrow();
	});
});
