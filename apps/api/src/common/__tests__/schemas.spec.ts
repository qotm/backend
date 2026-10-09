import { z } from 'zod';
import { Prisma } from '@qotm/db/client';
import {
	dateOnly,
	dateTime,
	decimal,
	email,
	mustMatch,
	search,
	sortKeys
} from 'common/schemas';
import { CommonFilters, DateFilters } from 'common/dto';

const messages = (result: { error?: z.ZodError }) =>
	result.error?.issues.map((issue) => issue.message) ?? [];

describe('schema fields', () => {
	describe('dateTime', () => {
		it('serializes a Date as an ISO date-time string', () => {
			const at = new Date('2026-01-02T03:04:05.678Z');
			expect(dateTime().parse(at)).toBe('2026-01-02T03:04:05.678Z');
		});

		it('rejects anything but a Date', () => {
			expect(dateTime().safeParse('2026-01-02').success).toBe(false);
		});
	});

	describe('dateOnly', () => {
		it('serializes a Date as YYYY-MM-DD', () => {
			expect(dateOnly().parse(new Date('2026-03-04T23:00:00.000Z'))).toBe(
				'2026-03-04'
			);
		});
	});

	describe('decimal', () => {
		it('serializes a Prisma.Decimal as a number, rounded to 4 places', () => {
			expect(decimal().parse(new Prisma.Decimal('12.345678'))).toBe(12.3457);
		});

		it('accepts a numeric string', () => {
			expect(decimal().parse('3.5')).toBe(3.5);
		});
	});

	describe('email', () => {
		it('lower-cases a valid address', () => {
			expect(email().parse('Ada@Example.COM')).toBe('ada@example.com');
		});

		it('rejects an invalid address', () => {
			expect(email().safeParse('not-an-email').success).toBe(false);
		});
	});

	describe('search', () => {
		const schema = z.object({ search: search() });

		it('trims a search of three or more characters', () => {
			expect(schema.parse({ search: '  kamil ' })).toEqual({ search: 'kamil' });
		});

		it('treats a blank search as absent', () => {
			expect(schema.parse({ search: '' })).toEqual({ search: undefined });
		});

		it('rejects a search shorter than three characters', () => {
			expect(schema.safeParse({ search: 'ab' }).success).toBe(false);
		});
	});

	describe('sortKeys', () => {
		const sort = sortKeys(['name', 'createdAt']);

		it('accepts allowed keys, with or without a descending prefix', () => {
			expect(sort.parse('name,-createdAt')).toBe('name,-createdAt');
		});

		it('is optional', () => {
			expect(sort.parse(undefined)).toBeUndefined();
		});

		it('rejects an unknown key and lists the allowed ones', () => {
			const result = sort.safeParse('name,email');
			expect(messages(result)).toEqual([
				'Sort key must be one of the following: name, createdAt'
			]);
		});
	});

	describe('mustMatch', () => {
		const schema = z
			.object({ password: z.string(), confirmPassword: z.string() })
			.superRefine(mustMatch('password', 'confirmPassword'));

		it('passes when the fields match', () => {
			expect(
				schema.safeParse({ password: 'a', confirmPassword: 'a' }).success
			).toBe(true);
		});

		it('reports a mismatch on the confirming field', () => {
			const result = schema.safeParse({ password: 'a', confirmPassword: 'b' });
			expect(result.error?.issues[0].path).toEqual(['confirmPassword']);
			expect(messages(result)).toEqual(['confirmPassword must match password']);
		});
	});
});

describe('filter schemas', () => {
	describe('CommonFilters', () => {
		it('coerces page and limit from query-string text', () => {
			expect(CommonFilters.parse({ page: '2', limit: '10' })).toEqual({
				page: 2,
				limit: 10
			});
		});

		it.each(['0', '-1', '1.5', 'abc'])('rejects page=%s', (page) => {
			expect(CommonFilters.safeParse({ page }).success).toBe(false);
		});

		it('drops unknown query parameters', () => {
			expect(CommonFilters.parse({ page: '1', debug: 'true' })).toEqual({
				page: 1
			});
		});
	});

	describe('DateFilters', () => {
		it('accepts a date or an ISO date-time', () => {
			expect(
				DateFilters.parse({ from: '2026-01-01', to: '2026-12-31T23:59:59Z' })
			).toEqual({ from: '2026-01-01', to: '2026-12-31T23:59:59Z' });
		});

		it('rejects anything else', () => {
			expect(DateFilters.safeParse({ from: 'yesterday' }).success).toBe(false);
		});
	});
});
