import { EventEmitter } from 'node:events';
import type { Worker } from 'bullmq';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	HEARTBEAT_EVERY_MS,
	HEARTBEAT_KEY,
	startHeartbeat,
	type Heartbeat
} from './heartbeat.js';

const set = vi.fn().mockResolvedValue('OK');
const fakeWorker = (name: string) =>
	Object.assign(new EventEmitter(), {
		name,
		backend: { client: Promise.resolve({ set }) }
	});
const asWorkers = (fakes: EventEmitter[]) => fakes as unknown as Worker[];

const lastBeat = () =>
	JSON.parse(set.mock.calls.at(-1)![1] as string) as Heartbeat;

describe('startHeartbeat', () => {
	afterEach(() => {
		vi.useRealTimers();
		set.mockClear();
	});

	it('beats at once and then every interval, with a TTL', async () => {
		vi.useFakeTimers();
		let clock = 1_000;
		const beat = startHeartbeat(
			asWorkers([fakeWorker('matching')]),
			() => clock
		);
		await vi.advanceTimersByTimeAsync(0);
		expect(set).toHaveBeenCalledWith(HEARTBEAT_KEY, expect.any(String), {
			EX: 60
		});
		expect(lastBeat()).toEqual({
			at: 1_000,
			startedAt: 1_000,
			queues: { matching: { lastFinishedAt: null } }
		});

		clock = 2_000;
		await vi.advanceTimersByTimeAsync(HEARTBEAT_EVERY_MS);
		expect(set).toHaveBeenCalledTimes(2);
		expect(lastBeat().at).toBe(2_000);
		beat.stop();
		await vi.advanceTimersByTimeAsync(HEARTBEAT_EVERY_MS * 2);
		expect(set).toHaveBeenCalledTimes(2);
	});

	it('notes when each queue last finished a job, done or failed', async () => {
		vi.useFakeTimers();
		let clock = 1_000;
		const matching = fakeWorker('matching');
		const exports = fakeWorker('exports');
		const beat = startHeartbeat(asWorkers([matching, exports]), () => clock);
		clock = 5_000;
		matching.emit('completed');
		clock = 7_000;
		exports.emit('failed');
		await vi.advanceTimersByTimeAsync(HEARTBEAT_EVERY_MS);
		expect(lastBeat().queues).toEqual({
			matching: { lastFinishedAt: 5_000 },
			exports: { lastFinishedAt: 7_000 }
		});
		beat.stop();
	});
});
