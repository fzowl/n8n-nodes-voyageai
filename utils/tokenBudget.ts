/**
 * Token budget utilities for Voyage AI by MongoDB embedding models.
 * Used to implement token-aware batching similar to the Python SDK's `_batched_encode`.
 */

import type { VoyageAIClient } from 'voyageai';

/**
 * Total token limits per request, per model (from the Voyage AI docs).
 * `null` means the docs list no per-request token ceiling for the model.
 */
export const VOYAGE_TOTAL_TOKEN_LIMITS: Record<string, number | null> = {
	'voyage-4-large': 120_000,
	'voyage-4': 320_000,
	'voyage-4-lite': 1_000_000,
	'voyage-4-nano': 320_000,
	'voyage-code-4': null,
	'voyage-3.5': 320_000,
	'voyage-3.5-lite': 1_000_000,
	'voyage-3-large': 120_000,
	'voyage-code-3': 120_000,
	'voyage-finance-2': 120_000,
	'voyage-multilingual-2': 120_000,
	'voyage-law-2': 120_000,
};

export const DEFAULT_TOKEN_LIMIT = 120_000;

/** Maximum number of inputs in one embeddings request. */
export const MAX_INPUTS_PER_REQUEST = 1000;

/**
 * Total token limit per contextualized embeddings request
 * (applies to voyage-context-3 and voyage-context-4).
 */
export const CONTEXTUALIZED_TOKEN_LIMIT = 120_000;

/**
 * Returns the total token budget for a given model.
 * Models without a documented ceiling return `Infinity`, so only the input count limits a batch.
 * A model that is not listed uses the conservative `DEFAULT_TOKEN_LIMIT`.
 */
export function getTokenBudget(model: string): number {
	if (!Object.prototype.hasOwnProperty.call(VOYAGE_TOTAL_TOKEN_LIMITS, model)) {
		return DEFAULT_TOKEN_LIMIT;
	}
	return VOYAGE_TOTAL_TOKEN_LIMITS[model] ?? Infinity;
}

/**
 * Greedily split items into consecutive batches, keeping the original order.
 * A batch ends when it holds `maxItems` items or adding the next item would exceed `maxTokens`.
 * Every batch holds at least one item, so a single oversized item is sent alone and the
 * API reports the error.
 *
 * @returns Index groups into `tokenCounts`, in input order.
 */
export function packBatches(
	tokenCounts: number[],
	maxTokens: number,
	maxItems: number,
): number[][] {
	if (!Number.isInteger(maxItems) || maxItems < 1) {
		throw new Error(`maxItems must be a positive integer, got ${maxItems}`);
	}

	const batches: number[][] = [];
	let current: number[] = [];
	let currentTokens = 0;

	tokenCounts.forEach((tokens, index) => {
		if (current.length > 0 && (current.length >= maxItems || currentTokens + tokens > maxTokens)) {
			batches.push(current);
			current = [];
			currentTokens = 0;
		}
		current.push(index);
		currentTokens += tokens;
	});

	if (current.length > 0) {
		batches.push(current);
	}

	return batches;
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
