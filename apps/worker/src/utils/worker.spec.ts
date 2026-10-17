import { EventEmitter } from 'node:events';
import type { Worker } from 'bullmq';
import { afterEach, describe, expect, it, vi } from 'vitest';
import logger from '#app/logger.js';
import { logFailures } from './worker.js';

const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined);

const fakeWorker = () =>
	logFailures(
		Object.assign(new EventEmitter(), {
			name: 'share-images'
		}) as unknown as Worker
	) as unknown as EventEmitter;
const job = (attemptsMade: number, attempts?: number) => ({
	id: 'render-1',
	name: 'render-share-image',
	attemptsMade,
	opts: attempts ? { attempts } : {}
});

describe('logFailures', () => {
	afterEach(() => {
		error.mockClear();
		warn.mockClear();
	});

	it('warns on an attempt that will be retried', () => {
		const err = new Error('Chromium crashed');
		fakeWorker().emit('failed', job(1, 3), err);
		expect(warn).toHaveBeenCalledWith(
			expect.objectContaining({
				queue: 'share-images',
				jobId: 'render-1',
				attempt: 1,
				attempts: 3,
				err
			}),
			'Job attempt failed; it will be retried'
		);
		expect(error).not.toHaveBeenCalled();
	});

	it('logs an error on the last attempt, and on a job with no retries', () => {
		const worker = fakeWorker();
		worker.emit('failed', job(3, 3), new Error('again'));
		worker.emit('failed', job(1), new Error('once'));
		expect(error).toHaveBeenCalledTimes(2);
		expect(error).toHaveBeenLastCalledWith(
			expect.objectContaining({
				jobName: 'render-share-image',
				attempt: 1,
				attempts: 1
			}),
			'Job failed'
		);
		expect(warn).not.toHaveBeenCalled();
	});

	it("logs the worker's own errors", () => {
		const err = new Error('ECONNREFUSED');
		fakeWorker().emit('error', err);
		expect(error).toHaveBeenCalledWith(
			{ queue: 'share-images', err },
			'Worker error'
		);
	});
});
