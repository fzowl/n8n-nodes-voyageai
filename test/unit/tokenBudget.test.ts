import {
	VOYAGE_TOTAL_TOKEN_LIMITS,
	DEFAULT_TOKEN_LIMIT,
	packBatches,
	getTokenBudget,
	countTokensForTexts,
} from '@utils/tokenBudget';

describe('tokenBudget', () => {
	describe('getTokenBudget', () => {
		it('should return correct budget for known models', () => {
			expect(getTokenBudget('voyage-4-large')).toBe(120_000);
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

		it('should not invent a token ceiling for voyage-code-4 (none documented)', () => {
			expect(getTokenBudget('voyage-code-4')).toBe(Infinity);
		});

		it('should use the conservative default budget for unknown models', () => {
			expect(getTokenBudget('unknown-model')).toBe(DEFAULT_TOKEN_LIMIT);
			expect(getTokenBudget('')).toBe(DEFAULT_TOKEN_LIMIT);
			expect(getTokenBudget('toString')).toBe(DEFAULT_TOKEN_LIMIT);
		});

		it('should have all models listed in VOYAGE_TOTAL_TOKEN_LIMITS', () => {
			expect(Object.keys(VOYAGE_TOTAL_TOKEN_LIMITS).length).toBe(12);
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

	describe('packBatches', () => {
		it('should keep the original order and cover every index exactly once', () => {
			const batches = packBatches([60, 60, 60, 60, 60], 100, 1000);

			expect(batches).toEqual([[0], [1], [2], [3], [4]]);
			expect(batches.flat()).toEqual([0, 1, 2, 3, 4]);
		});

		it('should pack up to the token limit inclusive', () => {
			expect(packBatches([50, 50, 1], 100, 1000)).toEqual([[0, 1], [2]]);
		});

		it('should start a new batch at the item count limit', () => {
			expect(packBatches([1, 1, 1, 1, 1], 1000, 2)).toEqual([[0, 1], [2, 3], [4]]);
		});

		it('should send a single oversized item alone', () => {
			expect(packBatches([5, 500, 5], 100, 1000)).toEqual([[0], [1], [2]]);
		});

		it('should return no batches for no items', () => {
			expect(packBatches([], 100, 10)).toEqual([]);
		});

		it('should ignore the token limit when it is Infinity', () => {
			expect(packBatches([1e9, 1e9], Infinity, 1000)).toEqual([[0, 1]]);
		});

		it('should reject an invalid item count limit', () => {
			expect(() => packBatches([1], 100, 0)).toThrow('maxItems must be a positive integer');
		});
	});
});
