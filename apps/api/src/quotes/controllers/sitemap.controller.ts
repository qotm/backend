import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { Op, Returns } from 'common/decorators';
import { SitemapService } from '../services';
import { SitemapEntity } from '../entity';

/** Public: what the web server's sitemap lists. */
@ApiTags('Quotes')
@AllowAnonymous()
@Controller({ path: 'sitemap', version: '1' })
export class SitemapController {
	constructor(private service: SitemapService) {}

	@Get()
	@Op(
		'sitemap',
		'/v1/sitemap',
		'Every indexable quote, author and topic, with when it last changed'
	)
	@Header('Cache-Control', 'public, max-age=600')
	@Returns(SitemapEntity)
	sitemap() {
		return this.service.sitemap();
	}
}
