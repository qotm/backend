import { getClientIp, isInternalRequest } from 'common/utils';

const req = (xff?: string, ip = '172.18.0.2') => ({
	headers: xff === undefined ? {} : { 'x-forwarded-for': xff },
	ip
});
const HEADERS = ['x-forwarded-for'];

describe('getClientIp', () => {
	it('takes the address the proxy appended, not what the client sent', () => {
		expect(getClientIp(req('203.0.113.7'), HEADERS)).toBe('203.0.113.7');
		expect(getClientIp(req('1.2.3.4, 203.0.113.7'), HEADERS)).toBe(
			'203.0.113.7'
		);
		expect(getClientIp(req('6.6.6.6,1.2.3.4 , 203.0.113.7'), HEADERS)).toBe(
			'203.0.113.7'
		);
	});

	it('counts proxies from the right', () => {
		expect(getClientIp(req('1.2.3.4, 203.0.113.7, 10.0.0.5'), HEADERS, 2)).toBe(
			'203.0.113.7'
		);
	});

	it('falls back to the socket for a short chain, no header, or no proxy', () => {
		expect(getClientIp(req('203.0.113.7'), HEADERS, 2)).toBe('172.18.0.2');
		expect(getClientIp(req(), HEADERS)).toBe('172.18.0.2');
		expect(getClientIp(req(' , '), HEADERS)).toBe('172.18.0.2');
		expect(getClientIp(req('203.0.113.7'), HEADERS, 0)).toBe('172.18.0.2');
	});
});

describe('isInternalRequest', () => {
	const key = 'k'.repeat(64);
	const sent = (value?: string) => ({
		headers: value === undefined ? {} : { 'x-qotm-server': value }
	});

	it('is true only for the exact key', () => {
		expect(isInternalRequest(sent(key), key)).toBe(true);
		expect(isInternalRequest(sent(`${key}x`), key)).toBe(false);
		expect(isInternalRequest(sent('k'.repeat(63) + 'j'), key)).toBe(false);
		expect(isInternalRequest(sent(), key)).toBe(false);
	});

	it('exempts nothing while no key is set', () => {
		expect(isInternalRequest(sent(''), '')).toBe(false);
		expect(isInternalRequest(sent('anything'), '')).toBe(false);
	});
});
