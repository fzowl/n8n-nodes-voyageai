import proxyFromEnv from 'proxy-from-env';
import { ProxyAgent } from 'undici';

/**
 * Returns a ProxyAgent or undefined based on the environment variables and target URL.
 * When target URL is not provided, NO_PROXY environment variable is not respected.
 */
export function getProxyAgent(targetUrl?: string) {
	const proxyUrl = proxyFromEnv.getProxyForUrl(targetUrl ?? 'https://example.nonexistent/');

	if (!proxyUrl) {
		return undefined;
	}

	return new ProxyAgent(proxyUrl);
}
