/**
 * Token budget utilities for VoyageAI embedding models.
 * Used to implement token-aware batching similar to the Python SDK's `_batched_encode`.
 */

import type { VoyageAIClient } from 'voyageai';

/** Total token limits per model (from VoyageAI docs). */
export const VOYAGE_TOTAL_TOKEN_LIMITS: Record<string, number> = {
	'voyage-4-large': 115_000,
	'voyage-4': 320_000,
	'voyage-4-lite': 1_000_000,
	'voyage-4-nano': 320_000,
	'voyage-3.5': 320_000,
	'voyage-3.5-lite': 1_000_000,
	'voyage-3-large': 120_000,
	'voyage-code-3': 120_000,
	'voyage-finance-2': 120_000,
	'voyage-multilingual-2': 120_000,
	'voyage-law-2': 120_000,
};

export const DEFAULT_TOKEN_LIMIT = 120_000;

/** Returns the total token budget for a given model. */
export function getTokenBudget(model: string): number {
	return VOYAGE_TOTAL_TOKEN_LIMITS[model] ?? DEFAULT_TOKEN_LIMIT;
}

/**
 * Get exact token counts for texts using the SDK's local tokenizer.
 */
export async function countTokensForTexts(
	client: VoyageAIClient,
	texts: string[],
	model: string,
): Promise<number[]> {
	const results = await client.tokenize(texts, model);
	return results.map((r) => r.ids.length);
}
