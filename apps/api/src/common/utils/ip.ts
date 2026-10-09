/**
 * Resolve the client IP from proxy headers, falling back to the socket address.
 *
 * Behind a reverse proxy every request carries the proxy's socket address, so
 * rate-limit buckets keyed on it would be shared by all clients. `x-forwarded-for`
 * is a comma-separated chain (`client, proxy1, proxy2`) — the client is first.
 */
export const getClientIp = (
	req: Record<string, any>,
	headerNames: string[]
): string => {
	const headers = (req.headers ?? {}) as Record<string, string | string[]>;

	for (const name of headerNames) {
		const raw = headers[name];
		const value = Array.isArray(raw) ? raw[0] : raw;
		const first = value?.split(',')[0]?.trim();
		if (first) return first;
	}

	return req.ip ?? req.socket?.remoteAddress ?? 'unknown';
};
