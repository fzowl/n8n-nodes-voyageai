import { NodeConnectionTypes } from 'n8n-workflow';
import { getConnectionHintNoticeField } from '@utils/sharedFields';

describe('getConnectionHintNoticeField', () => {
	it('should generate notice for single connection type', () => {
		const result = getConnectionHintNoticeField([NodeConnectionTypes.AiVectorStore]);

		expect(result.name).toBe('notice');
		expect(result.type).toBe('notice');
		expect(result.displayName).toContain('This node must be connected to');
		expect(result.displayName).toContain('vector store');
		expect(result.displayName).toContain('Insert one');
	});

	it('should generate notice for multiple connection types', () => {
		const result = getConnectionHintNoticeField([
			NodeConnectionTypes.AiVectorStore,
			NodeConnectionTypes.AiDocument,
		]);

		expect(result.displayName).toContain('This node needs to be connected to');
	});

	it('should use correct article for vowel-starting words', () => {
		const result = getConnectionHintNoticeField([NodeConnectionTypes.AiAgent]);

		expect(result.displayName).toContain('an');
	});

	it('should use correct article for consonant-starting words', () => {
		const result = getConnectionHintNoticeField([NodeConnectionTypes.AiVectorStore]);

		// "Vector Store" starts with V → "a"
		expect(result.displayName).toContain('a vector store');
	});

	it('should have containerClass in typeOptions', () => {
		const result = getConnectionHintNoticeField([NodeConnectionTypes.AiVectorStore]);

		expect(result.typeOptions).toEqual({
			containerClass: 'ndv-connection-hint-notice',
		});
	});

	it('should generate data-action attributes', () => {
		const result = getConnectionHintNoticeField([NodeConnectionTypes.AiVectorStore]);

		expect(result.displayName).toContain('data-action');
		expect(result.displayName).toContain('openSelectiveNodeCreator');
	});
});
