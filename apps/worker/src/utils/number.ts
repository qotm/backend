import { Prisma } from '@qotm/db/client';
import type { RawValue } from '#app/types.js';

export class NumberUtil {
	static parse(rawValue: RawValue): number | null {
		if (rawValue === null || rawValue === undefined) return null;
		if (typeof rawValue === 'number') return rawValue;
		if (rawValue.trim() === '') return null;
		const value = Number(rawValue.replace(/,/g, '').trim());
		return Number.isFinite(value) ? value : null;
	}

	static toNumber(rawValue: RawValue) {
		if (rawValue === null || rawValue === undefined) return 0;
		if (typeof rawValue === 'number') return rawValue;
		if (rawValue.trim() === '') return 0;
		const value = Number(rawValue.replace(/,/g, '').trim());
		return Number.isFinite(value) ? value : 0;
	}

	static toDecimal(rawValue: RawValue | Prisma.Decimal) {
		if (rawValue instanceof Prisma.Decimal) return rawValue;
		return new Prisma.Decimal(NumberUtil.toNumber(rawValue));
	}

	static firstPositive(
		...values: (RawValue | Prisma.Decimal)[]
	): Prisma.Decimal | undefined {
		for (const value of values) {
			const d = NumberUtil.toDecimal(value);
			if (d.gt(0)) return d;
		}
		return undefined;
	}

	static maxDecimal(...vals: (Prisma.Decimal | undefined)[]): Prisma.Decimal {
		return vals
			.filter((v): v is Prisma.Decimal => !!v)
			.reduce((a, b) => (b.gt(a) ? b : a));
	}

	static minDecimal(...vals: (Prisma.Decimal | undefined)[]): Prisma.Decimal {
		return vals
			.filter((v): v is Prisma.Decimal => !!v)
			.reduce((a, b) => (b.lt(a) ? b : a));
	}
}
