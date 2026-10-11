import { Controller, Get, Param, Query, Res } from '@nestjs/common';
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
import { PLACEHOLDER_PNG } from '../placeholder';
import { ShareImagesService } from '../services';

const VariantQuery = z.object({
	variant: z.enum(SHARE_VARIANTS).default('quote')
});

/** The redirect may change when the quote is corrected; the image never does. */
const REDIRECT_CACHE = 'public, max-age=300';

const PNG = {
	content: { 'image/png': { schema: { type: 'string', format: 'binary' } } }
};

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
		description: 'The og:image of /q/:id: the quote card at 1200×630.'
	})
	@IdParam()
	@ApiFoundResponse({ description: 'The rendered image' })
	@ApiOkResponse({ description: 'A placeholder; a render is queued', ...PNG })
	@ApiNotFoundResponse({ description: 'Unknown, private or not public' })
	og(@Param('id') id: string, @Res() res: Response) {
		return this.send(res, id, 'quote');
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
