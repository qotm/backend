import { OriginBuilder } from 'common/misc/origin-builder';

describe('OriginBuilder', () => {
	it('expands a bare hostname into https origins for it and its subdomains', () => {
		expect(OriginBuilder.build('example.com')).toEqual([
			'https://example.com',
			'https://auth.example.com',
			'https://app.example.com',
			'https://admin.example.com'
		]);
	});

	it('takes an entry with a scheme as one origin, as written', () => {
		expect(
			OriginBuilder.build('http://localhost:3001, http://localhost:3002/')
		).toEqual(['http://localhost:3001', 'http://localhost:3002']);
	});

	it('is empty for an empty list', () => {
		expect(OriginBuilder.build('')).toEqual([]);
		expect(OriginBuilder.build(undefined)).toEqual([]);
	});
});
