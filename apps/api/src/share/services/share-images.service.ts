import { setTimeout as sleep } from 'node:timers/promises';
import {
	Injectable,
	NotFoundException,
	type OnApplicationBootstrap
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { Prisma } from '@qotm/db/client';
import {
	CacheService,
	CustomConfigService,
	LoggerService,
	PrismaService
} from 'common/services';
import { S3Service } from 'media/services';
import { PUBLIC_ID_PATTERN } from 'quotes/public-id';
import {
	CURATED_STATUSES,
	IN_FEEDS,
	NOT_PUBLIC,
	isPublic
} from 'quotes/visibility';
import { lifespanLine } from 'taxonomy/services';
import {
	SHARE_VARIANTS,
	type PageCard,
	type PageKind,
	type ShareVariant,
	pageKey,
	pageRevision,
	shareCardOf,
	shareKey,
	shareRevision
} from '../cards';
import {
	AHEAD,
	NOW,
	ShareImageJobs,
	type RenderShareImage,
	type Urgency
} from '../jobs';

/** Rendered images never change under their key; remember them for a month. */
const READY_TTL = 30 * 86_400;
/** How long an og:image request waits for a render before it gets the fallback. */
export const OG_WAIT_MS = 8_000;
const OG_POLL_MS = 400;
/** A page card's quote: short enough to sit under the title. */
const FEATURE_MAX = 140;

export type ShareImage =
	| { ready: true; key: string; revision: string }
	| { ready: false; revision: string };

/** An og:image: the render, or (after OG_WAIT_MS) the site card or the bundled one (`key: null`). */
export type OgImage =
	| { key: string; fallback: false; revision: string }
	| { key: string | null; fallback: true };

export type OgTarget =
	| { kind: 'quote'; id: string; variant?: ShareVariant }
	| { kind: 'author' | 'topic'; slug: string }
	| { kind: 'site' };

const BACKFILL_LOCK = 'share:backfill:lock';

export const SITE_CARD: PageCard = {
	kind: 'site',
	path: '/',
	eyebrow: 'qotm',
	title: 'A thought between commands.',
	line: 'One considered programming quote in your terminal, every source checked.',
	quote: null
};

/**
 * Share images and og:images (BUILD-PLAN §5, §6). Each is rendered once per
 * revision of what it shows (the worker, QOT-51) and served from S3 under
 * a key that carries the revision, so it can be cached for a year. Quotes
 * have the quote and terminal cards; authors, topics and the site have a
 * page card. Public quotes only: nothing private or unchecked is ever drawn.
 */
@Injectable()
export class ShareImagesService implements OnApplicationBootstrap {
	constructor(
		private db: PrismaService,
		private s3: S3Service,
		private cache: CacheService,
		private jobs: ShareImageJobs,
		private config: CustomConfigService,
		private logger: LoggerService
	) {}

	/** Outside tests, check every image at boot: after an import or a template bump, they are drawn ahead. */
	onApplicationBootstrap() {
		if (this.config.app.env === 'test') return;
		void this.scheduledBackfill();
	}

	/**
	 * Hourly, and at boot: the safety net behind the renders queued as cards
	 * change (a decision, a correction, an original's check, an edit to an
	 * author or a member), for whatever those missed: an event during a
	 * restart, a new feature quote on an author's or topic's card. One
	 * replica at a time; a run checks Redis flags first, so a run with
	 * nothing to draw is cheap.
	 */
	@Cron('30 * * * *', { name: 'og-backfill', timeZone: 'UTC' })
	async scheduledBackfill() {
		if ((await this.cache.incr(BACKFILL_LOCK, 3600)) > 1) return;
		try {
			const counts = await this.backfill();
			this.logger.info(counts, 'og:image backfill queued');
		} catch (error) {
			this.logger.warn({ error }, 'og:image backfill failed');
		} finally {
			await this.cache.delete(BACKFILL_LOCK);
		}
	}

	/** The Share dialog's image: the render, or a queued render and a placeholder. */
	async image(publicId: string, variant: ShareVariant): Promise<ShareImage> {
		const job = await this.locate(publicId, variant);
		return this.ensure(job, NOW);
	}

	/**
	 * An og:image. Unfurlers keep the first image they get for days, so this
	 * never answers with the placeholder: it waits up to OG_WAIT_MS for the
	 * render, then falls back to the site card, then to the bundled one
	 * (`key: null`).
	 */
	async og(target: OgTarget, waitMs = OG_WAIT_MS): Promise<OgImage> {
		const job = await this.target(target);
		const image = await this.ensure(job, NOW);
		if (image.ready)
			return { key: image.key, fallback: false, revision: image.revision };
		if (await this.waitFor(job.key, waitMs)) {
			return { key: job.key, fallback: false, revision: image.revision };
		}
		const site = await this.target({ kind: 'site' });
		if (site.key !== job.key && (await this.rendered(site.key))) {
			return { key: site.key, fallback: true };
		}
		if (site.key !== job.key) await this.jobs.render(site, NOW);
		return { key: null, fallback: true };
	}

	/**
	 * A rendered image's bytes, read with the API's own credentials: the
	 * routes send them rather than a redirect, so they work whether or not
	 * the bucket is publicly readable.
	 */
	png(key: string) {
		return this.s3.getFileBuffer(key);
	}

	/**
	 * After a decision or a correction: queues the quote's images (and its
	 * author's card) so they are ready before anyone asks. Never fails the
	 * decision that called it.
	 */
	async rerender(publicId: string) {
		try {
			for (const variant of SHARE_VARIANTS) {
				await this.ensure(await this.locate(publicId, variant), AHEAD);
			}
		} catch (error) {
			if (error instanceof NotFoundException) return; // not public
			this.logger.warn({ error, publicId }, 'Could not queue share images');
		}
	}

	/**
	 * After an edit that changes many cards at once (an author renamed, a
	 * member's new handle, a deleted account's originals): queues the new
	 * images of every public quote `where` picks, in one batch. Their keys are
	 * new, so none is looked for first. Never fails the edit.
	 */
	async rerenderMany(where: Prisma.QuoteWhereInput) {
		try {
			const quotes = await this.db.quote.findMany({
				where: { AND: [where, { status: { notIn: [...NOT_PUBLIC] } }] },
				include: QUOTE_CARD
			});
			await this.jobs.renderAll(
				quotes.flatMap((quote) =>
					SHARE_VARIANTS.map((variant) => quoteJob(quote, variant))
				)
			);
		} catch (error) {
			this.logger.warn({ error }, 'Could not queue share images');
		}
	}

	/** After an author or topic edit: its page card. Never fails the edit. */
	async rerenderPage(kind: 'author' | 'topic', slug: string) {
		try {
			await this.ensure(await this.target({ kind, slug }), AHEAD);
		} catch (error) {
			this.logger.warn({ error, kind, slug }, 'Could not queue a page card');
		}
	}

	/**
	 * Queues every image not rendered yet: each public quote's cards (the
	 * quote card and the terminal card), every author and topic with a quote
	 * in the feeds, and the site card. Behind any render someone waits for.
	 */
	async backfill() {
		const counts = { checked: 0, queued: 0 };
		const queue = async (job: RenderShareImage) => {
			counts.checked++;
			if (!(await this.rendered(job.key))) {
				await this.jobs.render(job, AHEAD);
				counts.queued++;
			}
		};
		await queue(await this.target({ kind: 'site' }));
		for (let cursor: string | undefined; ;) {
			const page = await this.db.quote.findMany({
				where: { status: { notIn: [...NOT_PUBLIC] } },
				include: QUOTE_CARD,
				orderBy: { id: 'asc' },
				take: 500,
				...(cursor ? { cursor: { id: cursor }, skip: 1 } : {})
			});
			for (const quote of page) {
				for (const variant of SHARE_VARIANTS) {
					await queue(quoteJob(quote, variant));
				}
			}
			if (page.length < 500) break;
			cursor = page[page.length - 1].id;
		}
		const authors = await this.db.author.findMany({
			where: { quotes: { some: IN_FEEDS } },
			select: { slug: true }
		});
		for (const a of authors)
			await queue(await this.target({ kind: 'author', slug: a.slug }));
		const topics = await this.db.topic.findMany({ select: { slug: true } });
		for (const t of topics)
			await queue(await this.target({ kind: 'topic', slug: t.slug }));
		return counts;
	}

	private async ensure(
		job: RenderShareImage,
		urgency: Urgency
	): Promise<ShareImage> {
		const revision = job.key.slice(
			job.key.lastIndexOf('-') + 1,
			-'.png'.length
		);
		if (await this.rendered(job.key)) {
			return { ready: true, key: job.key, revision };
		}
		await this.jobs.render(job, urgency);
		return { ready: false, revision };
	}

	private async waitFor(key: string, ms: number) {
		for (const until = Date.now() + ms; Date.now() < until;) {
			await sleep(OG_POLL_MS);
			if (await this.rendered(key)) return true;
		}
		return false;
	}

	private target(target: OgTarget): Promise<RenderShareImage> {
		switch (target.kind) {
			case 'quote':
				return this.locate(target.id, target.variant ?? 'quote');
			case 'site':
				return Promise.resolve(pageJob(SITE_CARD));
			default:
				return this.pageCard(target.kind, target.slug).then(pageJob);
		}
	}

	private async locate(
		publicId: string,
		variant: ShareVariant
	): Promise<RenderShareImage> {
		const quote = PUBLIC_ID_PATTERN.test(publicId)
			? await this.db.quote.findUnique({
					where: { publicId },
					include: QUOTE_CARD
				})
			: null;
		if (!quote || !isPublic(quote.status)) {
			throw new NotFoundException('Quote not found');
		}
		return quoteJob(quote, variant);
	}

	/** An author's or topic's card: its name, its line and its shortest curated quote. */
	private async pageCard(
		kind: Exclude<PageKind, 'site'>,
		slug: string
	): Promise<PageCard> {
		if (kind === 'author') {
			const author = await this.db.author.findUnique({ where: { slug } });
			if (!author) throw new NotFoundException('Author not found');
			const line = lifespanLine(author);
			return {
				kind,
				path: `/authors/${author.slug}`,
				eyebrow: 'Author',
				title: author.name,
				line: line === '—' ? null : line,
				quote: await this.feature({ authorId: author.id })
			};
		}
		const topic = await this.db.topic.findUnique({ where: { slug } });
		if (!topic) throw new NotFoundException('Topic not found');
		return {
			kind,
			path: `/topics/${topic.slug}`,
			eyebrow: 'Topic',
			title: `${topic.name[0].toUpperCase()}${topic.name.slice(1)}`,
			line: topic.description,
			quote: await this.feature({ topics: { some: { topicId: topic.id } } })
		};
	}

	/** The shortest curated quote that fits (else any in the feeds); stable as the feeds grow. */
	private async feature(where: Prisma.QuoteWhereInput) {
		for (const status of [{ in: [...CURATED_STATUSES] }, undefined]) {
			const rows = await this.db.quote.findMany({
				where: { ...IN_FEEDS, ...where, ...(status ? { status } : {}) },
				include: QUOTE_CARD,
				orderBy: { publishedAt: 'asc' },
				take: 100
			});
			const pick = rows
				.filter((r) => r.text.length <= FEATURE_MAX)
				.sort(
					(a, b) =>
						a.text.length - b.text.length ||
						a.publicId.localeCompare(b.publicId)
				)[0];
			if (pick) return { text: pick.text, author: shareCardOf(pick).author };
		}
		return null;
	}

	private async rendered(key: string) {
		const flag = `share:ready:${key}`;
		if (await this.cache.fetch(flag)) return true;
		if (!(await this.s3.exists(key))) return false;
		await this.cache.store(flag, '1', READY_TTL);
		return true;
	}
}

const QUOTE_CARD = {
	author: { select: { name: true } },
	contributor: { select: { handle: true } }
} satisfies Prisma.QuoteInclude;

const quoteJob = (
	quote: Prisma.QuoteGetPayload<{ include: typeof QUOTE_CARD }>,
	variant: ShareVariant
): RenderShareImage => {
	const card = shareCardOf(quote);
	const revision = shareRevision(card, variant);
	return { key: shareKey(quote.publicId, variant, revision), variant, card };
};

const pageJob = (card: PageCard): RenderShareImage => ({
	key: pageKey(card, pageRevision(card)),
	variant: 'page',
	card
});
