import {
	applyDecorators,
	Controller,
	Get,
	Param,
	Query,
	Res
} from '@nestjs/common';
import {
	ApiFoundResponse,
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

/** The redirect may change when the quote is corrected; the image never does. */
const REDIRECT_CACHE = 'public, max-age=300';

const PNG = {
	content: { 'image/png': { schema: { type: 'string', format: 'binary' } } }
};

/** How an og:image route answers; `X-Og-Image` says which it was (the web server's proxy reads it). */
const OgResponses = () =>
	applyDecorators(
		ApiFoundResponse({
			description:
				'The rendered image, or (X-Og-Image: fallback) the site card while this one renders'
		}),
		ApiOkResponse({
			description:
				'X-Og-Image: fallback: the bundled brand card, while the render is still queued',
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
	res.setHeader('X-Og-Image', image.fallback ? 'fallback' : 'render');
	res.setHeader('Cache-Control', image.fallback ? 'no-store' : REDIRECT_CACHE);
	if (!image.fallback) res.setHeader('ETag', `"${image.revision}"`);
	if (image.url) {
		res.redirect(302, image.url);
		return;
	}
	res.type('png').send(FALLBACK_PNG);
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
			'The ShareCard as a 1200×630 PNG: a redirect to the rendered image (cached for a year under its revision), or a placeholder while it renders.'
	})
	@IdParam()
	@ApiQuery({ name: 'variant', enum: SHARE_VARIANTS, required: false })
	@ApiFoundResponse({ description: 'The rendered image' })
	@ApiOkResponse({ description: 'A placeholder; a render is queued', ...PNG })
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
			'The og:image of /q/:id: the quote card at 1200×630. Waits up to 8s for a render, then falls back to the site card.'
	})
	@IdParam()
	@OgResponses()
	og(@Param('id') id: string, @Res() res: Response) {
		return sendOg(this.service, res, { kind: 'quote', id });
	}

	private async send(res: Response, id: string, variant: ShareVariant) {
		const image = await this.service.image(id, variant);
		if (image.ready) {
			res.setHeader('Cache-Control', REDIRECT_CACHE);
			res.setHeader('ETag', `"${image.revision}"`);
			res.redirect(302, image.url);
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
