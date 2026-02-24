import { VoyageAIClient } from 'voyageai';

jest.setTimeout(30000);

const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;

const describeIf = VOYAGE_API_KEY ? describe : describe.skip;

// Use a reliable, publicly accessible test image
const TEST_IMAGE_URL = 'https://www.google.com/images/branding/googlelogo/2x/googlelogo_color_272x92dp.png';

describeIf('EmbeddingsVoyageAiMultimodal Integration', () => {
	let client: VoyageAIClient;

	beforeAll(() => {
		client = new VoyageAIClient({ apiKey: VOYAGE_API_KEY! });
	});

	it('should embed text-only content with voyage-multimodal-3', async () => {
		const response = await client.multimodalEmbed({
			inputs: [
				{
					content: [{ type: 'text', text: 'Hello world' }],
				},
			],
			model: 'voyage-multimodal-3',
		});

		expect(response.data).toBeDefined();
		expect(response.data!.length).toBe(1);
		expect(response.data![0].embedding).toBeDefined();
		expect(response.data![0].embedding!.length).toBeGreaterThan(0);
	});

	it('should embed image URL', async () => {
		const response = await client.multimodalEmbed({
			inputs: [
				{
					content: [
						{
							type: 'image_url',
							imageUrl: TEST_IMAGE_URL,
						},
					],
				},
			],
			model: 'voyage-multimodal-3',
		});

		expect(response.data).toBeDefined();
		expect(response.data!.length).toBe(1);
		expect(response.data![0].embedding).toBeDefined();
	});

	it('should embed text + image URL combination', async () => {
		const response = await client.multimodalEmbed({
			inputs: [
				{
					content: [
						{ type: 'text', text: 'A test image' },
						{
							type: 'image_url',
							imageUrl: TEST_IMAGE_URL,
						},
					],
				},
			],
			model: 'voyage-multimodal-3',
		});

		expect(response.data).toBeDefined();
		expect(response.data!.length).toBe(1);
		expect(response.data![0].embedding).toBeDefined();
	});

	it('should return error for invalid image URL', async () => {
		await expect(
			client.multimodalEmbed({
				inputs: [
					{
						content: [
							{
								type: 'image_url',
								imageUrl: 'https://invalid.nonexistent.url/image.png',
							},
						],
					},
				],
				model: 'voyage-multimodal-3',
			}),
		).rejects.toThrow();
	});
});
