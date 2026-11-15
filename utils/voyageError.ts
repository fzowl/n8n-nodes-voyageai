/**
 * Extracts the message from a Voyage AI by MongoDB API error.
 * The API returns error bodies shaped as `{"detail": "<text>"}` (validation errors carry a
 * list); the SDK exposes the parsed body on `error.body` and the HTTP status on `error.statusCode`.
 */
export function getVoyageErrorMessage(error: unknown): string {
	const err = error as { message?: string; statusCode?: number; body?: unknown } | undefined;
	const body = err?.body;

	if (body && typeof body === 'object' && (body as { detail?: unknown }).detail !== undefined) {
		const detail = (body as { detail: unknown }).detail;
		const text = typeof detail === 'string' ? detail : JSON.stringify(detail);
		const status = err?.statusCode !== undefined ? ` (status ${err.statusCode})` : '';
		return `${text}${status}`;
	}

	return err?.message ?? String(error);
}
