import { ProxyAgent } from 'undici';

import { getProxyAgent } from '@utils/httpProxyAgent';

// We need to mock proxy-from-env to control what proxy URL is returned
jest.mock('proxy-from-env', () => ({
	getProxyForUrl: jest.fn(),
}));

import proxyFromEnv from 'proxy-from-env';

describe('getProxyAgent', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('should return undefined when no proxy env vars set', () => {
		(proxyFromEnv.getProxyForUrl as jest.Mock).mockReturnValue('');

		const result = getProxyAgent('https://api.voyageai.com');

		expect(result).toBeUndefined();
	});

	it('should return ProxyAgent when proxy URL is configured', () => {
		(proxyFromEnv.getProxyForUrl as jest.Mock).mockReturnValue('http://proxy.example.com:8080');

		const result = getProxyAgent('https://api.voyageai.com');

		expect(result).toBeInstanceOf(ProxyAgent);
	});

	it('should use dummy URL when target URL is not provided', () => {
		(proxyFromEnv.getProxyForUrl as jest.Mock).mockReturnValue('');

		getProxyAgent();

		expect(proxyFromEnv.getProxyForUrl).toHaveBeenCalledWith('https://example.nonexistent/');
	});

	it('should pass target URL to proxy-from-env', () => {
		(proxyFromEnv.getProxyForUrl as jest.Mock).mockReturnValue('');

		getProxyAgent('https://custom.api.com/v1');

		expect(proxyFromEnv.getProxyForUrl).toHaveBeenCalledWith('https://custom.api.com/v1');
	});
});
