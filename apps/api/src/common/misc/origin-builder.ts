/**
 * Builds a list of origins for CORS configuration from a list of entries.
 * A bare hostname (`shop.example.com`) generates https origins for it and its
 * app, auth and admin subdomains. An entry with a scheme
 * (`http://localhost:3001`) is taken as one origin, as written: that is how
 * frontends on other local ports are allowed.
 *
 * @remarks This is mainly for development purposes
 * For frontend developers on the team who cannot run a standalone
 * backend server, they can use a central backend dev server with
 * their individual frontend subdomains.
 */
export class OriginBuilder {
	private static instance: OriginBuilder;

	private readonly protocol = 'https://';
	private readonly subdomains = ['auth', 'app', 'admin'];

	private constructor() {}

	static getInstance(): OriginBuilder {
		return (this.instance ??= new OriginBuilder());
	}

	static build(hostnames?: string | string[]): string[] {
		return OriginBuilder.getInstance().fromHosts(hostnames);
	}

	/**
	 * Origins for a single hostname: the main domain plus each subdomain.
	 */
	fromHost(hostname: string): string[] {
		if (hostname.includes('://')) return [hostname.replace(/\/+$/, '')];
		return [
			`${this.protocol}${hostname}`,
			...this.subdomains.map((sub) => `${this.protocol}${sub}.${hostname}`)
		];
	}

	/**
	 * Origins for many hostnames, given either an array or a
	 * comma-separated string.
	 */
	fromHosts(hostnames?: string | string[]) {
		return this.parseList(hostnames).flatMap((hostname) =>
			this.fromHost(hostname)
		);
	}

	private parseList(hostnames?: string | string[]) {
		if (Array.isArray(hostnames)) return hostnames;
		return (
			hostnames
				?.split(',')
				.map((hostname) => hostname.trim())
				.filter(Boolean) || []
		);
	}
}
