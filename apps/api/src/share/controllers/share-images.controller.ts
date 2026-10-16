import {
	applyDecorators,
	Controller,
	Get,
	Param,
	Query,
	Res
} from '@nestjs/common';
import {
	ApiNotFoundResponse,
	ApiOkResponse,
	ApiOperation,
	ApiQuery,
	ApiTags
} from '@nestjs/swagger';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import type { Response } from 'express';
import { z } from 'zod';
import { IdParam } from 'common/decorators';
import { SHARE_VARIANTS, type ShareVariant } from '../cards';
import { FALLBACK_PNG } from '../fallback';
import { PLACEHOLDER_PNG } from '../placeholder';
import { ShareImagesService, type OgTarget } from '../services';

const VariantQuery = z.object({
	variant: z.enum(SHARE_VARIANTS).default('quote')
});

/** What these URLs serve changes when the quote is corrected (a new revision). */
const IMAGE_CACHE = 'public, max-age=300';

const PNG = {
	content: { 'image/png': { schema: { type: 'string', format: 'binary' } } }
};

/** How an og:image route answers; `X-Og-Image` says which it was (the web server's proxy reads it). */
const OgResponses = () =>
	applyDecorators(
		ApiOkResponse({
			description:
				'The rendered image (X-Og-Image: render), or (X-Og-Image: fallback) the site card or the bundled brand card while this one renders',
			...PNG
		}),
		ApiNotFoundResponse({ description: 'Unknown, private or not public' })
	);

/**
 * Answers an og:image route. Unfurlers keep the first image they fetch, so
 * this waits for the render (ShareImagesService.og) and never sends the
 * placeholder; a fallback is marked no-store so a later fetch gets the card.
 */
export async function sendOg(
	service: ShareImagesService,
	res: Response,
	target: OgTarget
) {
	const image = await service.og(target);
	const png = image.key ? await service.png(image.key) : FALLBACK_PNG;
	res.setHeader('X-Og-Image', image.fallback ? 'fallback' : 'render');
	res.setHeader('Cache-Control', image.fallback ? 'no-store' : IMAGE_CACHE);
	if (!image.fallback) res.setHeader('ETag', `"${image.revision}"`);
	res.type('png').send(png);
}

/** Public: the Share dialog's image and each quote page's og:image. */
@ApiTags('Share')
@AllowAnonymous()
@Controller({ path: 'quotes', version: '1' })
export class ShareImagesController {
	constructor(private service: ShareImagesService) {}

	@Get(':id/share-image')
	@ApiOperation({
		operationId: 'quotes/:id/share-image',
		summary: '/v1/quotes/:id/share-image',
		description:
			'The ShareCard as a 1200×630 PNG: the rendered image, or a placeholder (no-store, Retry-After) while it renders.'
	})
	@IdParam()
	@ApiQuery({ name: 'variant', enum: SHARE_VARIANTS, required: false })
	@ApiOkResponse({
		description:
			'The rendered image, or a placeholder while a render is queued',
		...PNG
	})
	@ApiNotFoundResponse({ description: 'Unknown, private or not public' })
	shareImage(
		@Param('id') id: string,
		@Query({ schema: VariantQuery }) query: z.output<typeof VariantQuery>,
		@Res() res: Response
	) {
		return this.send(res, id, query.variant);
	}

	@Get(':id/og.png')
	@ApiOperation({
		operationId: 'quotes/:id/og.png',
		summary: '/v1/quotes/:id/og.png',
		description:
			'The og:image of /q/:id: the quote card (or, with variant=terminal, the terminal card) at 1200×630. Waits up to 8s for a render, then falls back to the site card.'
	})
	@IdParam()
	@ApiQuery({ name: 'variant', enum: SHARE_VARIANTS, required: false })
	@OgResponses()
	og(
		@Param('id') id: string,
		@Query({ schema: VariantQuery }) query: z.output<typeof VariantQuery>,
		@Res() res: Response
	) {
		return sendOg(this.service, res, {
			kind: 'quote',
			id,
			variant: query.variant
		});
	}

	private async send(res: Response, id: string, variant: ShareVariant) {
		const image = await this.service.image(id, variant);
		if (image.ready) {
			res.setHeader('Cache-Control', IMAGE_CACHE);
			res.setHeader('ETag', `"${image.revision}"`);
			res.type('png').send(await this.service.png(image.key));
			return;
		}
		res.setHeader('Cache-Control', 'no-store');
		res.setHeader('Retry-After', '5');
		res.type('png').send(PLACEHOLDER_PNG);
	}
}

/** Public: the og:images of the author and topic pages and of the site's other pages. */
@ApiTags('Share')
@AllowAnonymous()
@Controller({ version: '1' })
export class OgImagesController {
	constructor(private service: ShareImagesService) {}

	@Get('authors/:slug/og.png')
	@ApiOperation({
		operationId: 'authors/:slug/og.png',
		summary: '/v1/authors/:slug/og.png',
		description:
			"The og:image of /authors/:slug: the author's card at 1200×630."
	})
	@OgResponses()
	author(@Param('slug') slug: string, @Res() res: Response) {
		return sendOg(this.service, res, {
			kind: 'author',
			slug: slug.slice(0, 80)
		});
	}

	@Get('topics/:slug/og.png')
	@ApiOperation({
		operationId: 'topics/:slug/og.png',
		summary: '/v1/topics/:slug/og.png',
		description: "The og:image of /topics/:slug: the topic's card at 1200×630."
	})
	@OgResponses()
	topic(@Param('slug') slug: string, @Res() res: Response) {
		return sendOg(this.service, res, {
			kind: 'topic',
			slug: slug.slice(0, 60)
		});
	}

	@Get('og.png')
	@ApiOperation({
		operationId: 'og.png',
		summary: '/v1/og.png',
		description:
			'The og:image of the home page, the feeds and profiles: the site card at 1200×630.'
	})
	@OgResponses()
	site(@Res() res: Response) {
		return sendOg(this.service, res, { kind: 'site' });
	}
}
