import { timingSafeEqual } from 'node:crypto';

/**
 * The client IP, as the proxies in front of the API saw it.
 *
 * Each trusted proxy appends the address it got the request from to
 * `x-forwarded-for` (nginx's `$proxy_add_x_forwarded_for`), so the client is
 * `hops` entries from the right. Anything further left was sent by the
 * client itself and is never trusted: a made-up first entry would otherwise
 * buy a fresh rate-limit bucket on every request. A chain shorter than
 * `hops` did not come through every proxy, so the socket address is used,
 * as it is with `hops` 0 (no proxy).
 */
export const getClientIp = (
	req: Record<string, any>,
	headerNames: string[],
	hops = 1
): string => {
	const headers = (req.headers ?? {}) as Record<string, string | string[]>;

	if (hops > 0) {
		for (const name of headerNames) {
			const raw = headers[name];
			const chain = (Array.isArray(raw) ? raw.join(',') : (raw ?? ''))
				.split(',')
				.map((ip) => ip.trim())
				.filter(Boolean);
			if (chain.length >= hops) return chain[chain.length - hops];
		}
	}

	return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
};

/** The header the web server's own requests carry (its `INTERNAL_API_KEY`). */
export const INTERNAL_KEY_HEADER = 'x-qotm-server';

/**
 * Whether a request carries the internal key: the web server, which fetches
 * page data, og:images, sitemaps and feeds for every visitor from one
 * address, and so must not share one rate-limit bucket. Compared in constant
 * time; never true while no key is set.
 */
export const isInternalRequest = (
	req: Record<string, any>,
	key: string
): boolean => {
	const sent = (req.headers ?? {})[INTERNAL_KEY_HEADER];
	if (!key || typeof sent !== 'string') return false;
	const a = Buffer.from(sent);
	const b = Buffer.from(key);
	return a.length === b.length && timingSafeEqual(a, b);
};
