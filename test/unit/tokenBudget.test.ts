import {
	VOYAGE_TOTAL_TOKEN_LIMITS,
	DEFAULT_TOKEN_LIMIT,
	getTokenBudget,
	countTokensForTexts,
} from '@utils/tokenBudget';

describe('tokenBudget', () => {
	describe('getTokenBudget', () => {
		it('should return correct budget for known models', () => {
			expect(getTokenBudget('voyage-4-large')).toBe(115_000);
			expect(getTokenBudget('voyage-4')).toBe(320_000);
			expect(getTokenBudget('voyage-4-lite')).toBe(1_000_000);
			expect(getTokenBudget('voyage-4-nano')).toBe(320_000);
			expect(getTokenBudget('voyage-3.5')).toBe(320_000);
			expect(getTokenBudget('voyage-3.5-lite')).toBe(1_000_000);
			expect(getTokenBudget('voyage-3-large')).toBe(120_000);
			expect(getTokenBudget('voyage-code-3')).toBe(120_000);
			expect(getTokenBudget('voyage-finance-2')).toBe(120_000);
			expect(getTokenBudget('voyage-multilingual-2')).toBe(120_000);
			expect(getTokenBudget('voyage-law-2')).toBe(120_000);
		});

		it('should return default budget for unknown models', () => {
			expect(getTokenBudget('unknown-model')).toBe(DEFAULT_TOKEN_LIMIT);
			expect(getTokenBudget('')).toBe(DEFAULT_TOKEN_LIMIT);
		});

		it('should have all models listed in VOYAGE_TOTAL_TOKEN_LIMITS', () => {
			expect(Object.keys(VOYAGE_TOTAL_TOKEN_LIMITS).length).toBe(11);
		});
	});

	describe('countTokensForTexts', () => {
		it('should return ids.length per text from tokenize', async () => {
			const mockClient = {
				tokenize: jest.fn().mockResolvedValue([
					{ tokens: ['hello', 'world'], ids: [1, 2] },
					{ tokens: ['foo'], ids: [3] },
				]),
			} as any;

			const result = await countTokensForTexts(mockClient, ['hello world', 'foo'], 'voyage-4');

			expect(mockClient.tokenize).toHaveBeenCalledWith(['hello world', 'foo'], 'voyage-4');
			expect(result).toEqual([2, 1]);
		});

		it('should propagate errors from tokenize', async () => {
			const mockClient = {
				tokenize: jest.fn().mockRejectedValue(new Error('tokenizer unavailable')),
			} as any;

			await expect(
				countTokensForTexts(mockClient, ['hello'], 'voyage-4'),
			).rejects.toThrow('tokenizer unavailable');
		});

		it('should return empty array for empty input', async () => {
			const mockClient = {
				tokenize: jest.fn().mockResolvedValue([]),
			} as any;

			const result = await countTokensForTexts(mockClient, [], 'voyage-4');

			expect(result).toEqual([]);
		});

		it('should pass model parameter to tokenize', async () => {
			const mockClient = {
				tokenize: jest.fn().mockResolvedValue([
					{ tokens: ['a'], ids: [1] },
				]),
			} as any;

			await countTokensForTexts(mockClient, ['a'], 'voyage-4-large');

			expect(mockClient.tokenize).toHaveBeenCalledWith(['a'], 'voyage-4-large');
		});
	});
});
