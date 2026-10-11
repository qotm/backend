import {
	ConflictException,
	Injectable,
	NotFoundException
} from '@nestjs/common';
import { S3Service } from 'media/services';
import type { ExportStatusEntity } from './exports.entity';
import { ExportJobs, type ExportQuotesJob } from './jobs';

/** What the worker's export returns (`apps/worker/src/workers/exports`). */
interface ExportResult {
	key: string;
	rows: number;
	bytes: number;
}

/**
 * CSV exports for the admin who asked for them (QOT-52): their status, and
 * the file once the worker has written it. Anyone else gets a 404.
 */
@Injectable()
export class ExportsService {
	constructor(
		private jobs: ExportJobs,
		private s3: S3Service
	) {}

	async status(id: string, userId: string): Promise<ExportStatusEntity> {
		const job = await this.find(id, userId);
		const state = await job.getState();
		const result = job.returnvalue as ExportResult | null;
		return {
			id,
			state:
				state === 'completed'
					? 'ready'
					: state === 'failed'
						? 'failed'
						: state === 'active'
							? 'running'
							: 'waiting',
			rows: result?.rows ?? null,
			bytes: result?.bytes ?? null,
			error: job.failedReason || null,
			requestedAt: new Date(job.timestamp)
		};
	}

	/** The CSV, once ready. */
	async file(id: string, userId: string) {
		const job = await this.find(id, userId);
		const result = job.returnvalue as ExportResult | null;
		if ((await job.getState()) !== 'completed' || !result) {
			throw new ConflictException('The export is not ready yet');
		}
		return {
			body: await this.s3.getFileBuffer(result.key),
			name: `qotm-quotes-${new Date(job.timestamp).toISOString().slice(0, 10)}.csv`
		};
	}

	private async find(id: string, userId: string) {
		const job = id.startsWith('export-') ? await this.jobs.find(id) : null;
		const data = job?.data as ExportQuotesJob | undefined;
		if (!job || data?.requestedBy?.id !== userId) {
			throw new NotFoundException('Export not found');
		}
		return job;
	}
}
