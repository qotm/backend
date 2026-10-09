import { z } from 'zod';
import { Prisma } from '@qotm/db/client';

/**
 * Reusable Zod fields. Request schemas validate and coerce what arrives;
 * response schemas are codecs that turn what a service returns (Date, Decimal)
 * into what goes over the wire, and OpenAPI documents the wire side.
 */

/** `Date` → ISO 8601 date-time string. */
export const dateTime = () =>
	z.codec(z.date(), z.iso.datetime(), {
		decode: (date) => date.toISOString(),
		encode: (iso) => new Date(iso)
	});

/** `Date` → `YYYY-MM-DD`. */
export const dateOnly = () =>
	z.codec(z.date(), z.iso.date(), {
		decode: (date) => date.toISOString().slice(0, 10),
		encode: (iso) => new Date(iso)
	});

/** `Prisma.Decimal` (or a numeric string) → number, rounded to 4 places. */
export const decimal = () =>
	z.codec(z.union([z.instanceof(Prisma.Decimal), z.string()]), z.number(), {
		decode: (value) => new Prisma.Decimal(value).toDecimalPlaces(4).toNumber(),
		encode: (value) => new Prisma.Decimal(value)
	});

/** An email address, stored and compared in lower case. */
export const email = () => z.email().toLowerCase();

/**
 * Free-text search: at least three characters, with a blank value (a cleared
 * search box sends `?search=`) treated as absent rather than rejected.
 */
export const search = () =>
	z
		.union([z.string().trim().min(3), z.literal('')])
		.transform((value) => value || undefined)
		.optional();

/**
 * A comma-separated sort spec over `keys`, each optionally prefixed with `-`
 * for descending, e.g. `name,-createdAt`.
 */
export const sortKeys = (keys: readonly string[]) =>
	z
		.string()
		.refine(
			(value) =>
				value.split(',').every((key) => keys.includes(key.replace(/^-/, ''))),
			{ message: `Sort key must be one of the following: ${keys.join(', ')}` }
		)
		.meta({ example: keys.join(',') })
		.optional();

/** A file part in a multipart/form-data body (documentation only). */
export const binary = () => z.string().meta({ format: 'binary' });

/**
 * Require two fields of an object schema to be equal, e.g. a password and its
 * confirmation. The issue is reported on `confirm`.
 */
export const mustMatch =
	<T extends Record<string, unknown>>(field: keyof T, confirm: keyof T) =>
	(value: T, ctx: z.RefinementCtx) => {
		if (value[field] !== value[confirm]) {
			ctx.addIssue({
				code: 'custom',
				path: [confirm as string],
				message: `${String(confirm)} must match ${String(field)}`
			});
		}
	};
