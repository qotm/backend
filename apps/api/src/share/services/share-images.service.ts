import { Injectable, NotFoundException } from '@nestjs/common';
import { CacheService, LoggerService, PrismaService } from 'common/services';
import { S3Service } from 'media/services';
import { PUBLIC_ID_PATTERN } from 'quotes/public-id';
import { isPublic } from 'quotes/visibility';
import {
	SHARE_VARIANTS,
	type ShareVariant,
	shareCardOf,
	shareKey,
	shareRevision
} from '../cards';
import { ShareImageJobs } from '../jobs';

/** Rendered images never change under their key; remember them for a month. */
const READY_TTL = 30 * 86_400;

export type ShareImage =
	| { ready: true; url: string; revision: string }
	| { ready: false; revision: string };

/**
 * Share images and og:images (BUILD-PLAN §5, §6). Each is rendered once per
 * revision of what it shows (the worker, QOT-51) and served from S3 under
 * a key that carries the revision, so it can be cached for a year; until
 * then the caller gets a placeholder and a render is queued. Public quotes
 * only: nothing private or unchecked is ever drawn.
 */
@Injectable()
export class ShareImagesService {
	constructor(
		private db: PrismaService,
		private s3: S3Service,
		private cache: CacheService,
		private jobs: ShareImageJobs,
		private logger: LoggerService
	) {}

	async image(publicId: string, variant: ShareVariant): Promise<ShareImage> {
		const { key, revision, card } = await this.locate(publicId, variant);
		if (await this.rendered(key)) {
			return { ready: true, url: this.s3.getUrl(key), revision };
		}
		await this.jobs.render({ key, variant, card });
		return { ready: false, revision };
	}

	/**
	 * After a correction: queues the images of the new revision, so they are
	 * ready before anyone asks. Never fails the correction that called it.
	 */
	async rerender(publicId: string) {
		try {
			for (const variant of SHARE_VARIANTS) {
				const { key, card } = await this.locate(publicId, variant);
				if (!(await this.rendered(key))) {
					await this.jobs.render({ key, variant, card });
				}
			}
		} catch (error) {
			if (error instanceof NotFoundException) return; // not public
			this.logger.warn({ error, publicId }, 'Could not queue share images');
		}
	}

	private async locate(publicId: string, variant: ShareVariant) {
		const quote = PUBLIC_ID_PATTERN.test(publicId)
			? await this.db.quote.findUnique({
					where: { publicId },
					include: {
						author: { select: { name: true } },
						contributor: { select: { handle: true } }
					}
				})
			: null;
		if (!quote || !isPublic(quote.status)) {
			throw new NotFoundException('Quote not found');
		}
		const card = shareCardOf(quote);
		const revision = shareRevision(card, variant);
		return { key: shareKey(publicId, variant, revision), revision, card };
	}

	private async rendered(key: string) {
		const flag = `share:ready:${key}`;
		if (await this.cache.fetch(flag)) return true;
		if (!(await this.s3.exists(key))) return false;
		await this.cache.store(flag, '1', READY_TTL);
		return true;
	}
}
