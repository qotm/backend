import { Prisma } from '@qotm/db/client';

/**
 * Takes a number or string as input and creates a
 * new Prisma Decimal instance with that value.
 * This function is useful for working with decimal
 * values in a Prisma context.
 */
export const dcml = (n: number | string) => new Prisma.Decimal(n);

/**
 * Builds an array of allowed origins for CORS based on the provided hostname.
 * It includes the main domain and subdomains for app, auth, and admin.
 *
 * @param hostname - The base hostname to build origins from.
 * @returns An array of allowed origins for CORS.
 */
export const buildOrigins = (hostname: string) => {
	const protocol = 'https://';
	const subdomains = ['auth', 'app', 'admin'];
	const mainDomain = protocol + hostname;
	return [
		mainDomain,
		...subdomains.map((subdomain) => `${protocol}${subdomain}.${hostname}`)
	];
};
