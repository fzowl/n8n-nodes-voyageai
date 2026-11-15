import { getVoyageErrorMessage } from '@utils/voyageError';

describe('getVoyageErrorMessage', () => {
	it('should return the detail of a Voyage error body with the status', () => {
		const error = Object.assign(new Error('Status code: 400\nBody: {...}'), {
			statusCode: 400,
			body: { detail: 'Model x is not supported.' },
		});

		expect(getVoyageErrorMessage(error)).toBe('Model x is not supported. (status 400)');
	});

	it('should return the detail without a status when none is present', () => {
		expect(getVoyageErrorMessage({ body: { detail: 'bad input' } })).toBe('bad input');
	});

	it('should stringify a structured detail such as a validation error list', () => {
		const error = {
			statusCode: 422,
			body: { detail: [{ loc: ['body', 'input'], msg: 'required' }] },
		};

		expect(getVoyageErrorMessage(error)).toBe(
			'[{"loc":["body","input"],"msg":"required"}] (status 422)',
		);
	});

	it('should fall back to the error message when the body has no detail', () => {
		const error = Object.assign(new Error('Status code: 500'), { statusCode: 500, body: {} });

		expect(getVoyageErrorMessage(error)).toBe('Status code: 500');
	});

	it('should handle non-error values', () => {
		expect(getVoyageErrorMessage('boom')).toBe('boom');
	});
});
