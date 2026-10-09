import { BadRequestException } from '@nestjs/common';
import type { PrismaService } from '../services';
import type { PrismaModelName } from '../types';

/**
 * Database-backed checks for request values. A schema validates shape without
 * a database handle, so these run in the service that uses the value. Matching
 * is case-insensitive, and failures are 400s in the same `Validation: …` form
 * the validation pipe produces.
 */

const matches = (
	db: PrismaService,
	model: PrismaModelName,
	field: string,
	value: string
): Promise<boolean> =>
	(db.x[model] as any).exists({
		[field]: { equals: value, mode: 'insensitive' }
	});

/** Reject `value` unless some `model` row has it in `field`. Skips empties. */
export async function ensureExists(
	db: PrismaService,
	model: PrismaModelName,
	field: string,
	value: string | null | undefined
) {
	if (!value) return;
	if (!(await matches(db, model, field, value))) {
		throw new BadRequestException(
			`Validation: ${field} '${value}' does not exist`
		);
	}
}

/** Reject `values` unless every one exists in `model`.`field`. */
export async function ensureEachExists(
	db: PrismaService,
	model: PrismaModelName,
	field: string,
	values: readonly string[] | null | undefined
) {
	for (const value of values ?? []) {
		if (!(await matches(db, model, field, value))) {
			throw new BadRequestException(
				`Validation: ${field} element with id '${value}' does not exist`
			);
		}
	}
}

/** Reject `value` if a `model` row already has it in `field`. */
export async function ensureUnique(
	db: PrismaService,
	model: PrismaModelName,
	field: string,
	value: string | null | undefined
) {
	if (!value) return;
	if (await matches(db, model, field, value)) {
		throw new BadRequestException(
			`Validation: ${field} '${value}' already exists`
		);
	}
}
