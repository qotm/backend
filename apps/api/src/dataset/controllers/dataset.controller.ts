import { Controller, Get, Headers, Req, Res } from '@nestjs/common';
import { ApiHeader, ApiNotFoundResponse, ApiTags } from '@nestjs/swagger';
import {
	OptionalAuth,
	Session,
	type UserSession
} from '@thallesp/nestjs-better-auth';
import type { Request, Response } from 'express';
import { Op, Returns } from 'common/decorators';
import { DATASET_HEADER } from 'devices/dto';
import { CurrentReleaseEntity, ManifestEntity } from '../entity';
import { DatasetService } from '../services';

/** Short: publishing a release must reach every install within a minute. */
const MANIFEST_CACHE = 'public, max-age=60';

@ApiTags('Dataset')
@OptionalAuth()
@Controller({ version: '1' })
export class DatasetController {
	constructor(private service: DatasetService) {}

	@Get('dataset/manifest')
	@Op(
		'dataset/manifest',
		'/v1/dataset/manifest',
		'The current dataset release, for `qotm sync` (ETag / If-None-Match)'
	)
	@ApiHeader({
		name: DATASET_HEADER,
		required: false,
		description:
			'The version the CLI holds (`v2026.09.1`); with a bearer, recorded on its terminal'
	})
	@Returns(ManifestEntity)
	@ApiNotFoundResponse({ description: 'No release has been published yet' })
	async manifest(
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response,
		@Headers(DATASET_HEADER) held: string | undefined,
		@Session() session?: UserSession | null
	) {
		void this.service.recordSync(session?.session.id, held);
		const manifest = await this.service.manifest();
		const etag = `"${manifest.version}-${manifest.sha256}"`;
		res.setHeader('ETag', etag);
		res.setHeader('Cache-Control', MANIFEST_CACHE);
		if (req.headers['if-none-match'] === etag) {
			res.status(304);
			return undefined;
		}
		return manifest;
	}

	@Get('dataset/download')
	@Op(
		'dataset/download',
		'/v1/dataset/download',
		'Redirects to the current qotm.sqlite on the releases host'
	)
	@ApiNotFoundResponse({ description: 'No release has been published yet' })
	async download(@Res() res: Response) {
		res.redirect(302, await this.service.downloadUrl());
	}

	@Get('releases/current')
	@Op(
		'releases/current',
		'/v1/releases/current',
		'The current release, for the Curated page'
	)
	@Returns(CurrentReleaseEntity)
	@ApiNotFoundResponse({ description: 'No release has been published yet' })
	current() {
		return this.service.currentRelease();
	}
}
