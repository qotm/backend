import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import {
	ApiMovedPermanentlyResponse,
	ApiNotFoundResponse,
	ApiParam,
	ApiTags
} from '@nestjs/swagger';
import {
	OptionalAuth,
	Session,
	type UserSession
} from '@thallesp/nestjs-better-auth';
import type { Response } from 'express';
import { z } from 'zod';
import { Op, Returns } from 'common/decorators';
import {
	ContributionStatsEntity,
	PaginatedContributionEntity,
	ProfileEntity,
	ProfileFavoritesEntity
} from '../entity';
import { ProfilesService, type ProfileLookup } from '../services';

const ContributionsQuery = z.object({
	page: z.coerce.number().int().min(1).default(1),
	limit: z.coerce.number().int().min(1).max(50).default(20)
});
type ContributionsQuery = z.output<typeof ContributionsQuery>;

/**
 * Public profiles: /@handle and its tabs. Never the email or anything
 * private. An old handle answers 301 to the same path under the current one,
 * so old links keep working.
 */
@ApiTags('Profiles')
@OptionalAuth()
@Controller({ path: 'users', version: '1' })
export class ProfilesController {
	constructor(private service: ProfilesService) {}

	/** The profile's user id, or a redirect sent for an old handle (then null). */
	private async resolve(handle: string, res: Response, suffix = '') {
		const found: ProfileLookup = await this.service.lookup(handle);
		if (found.kind === 'moved') {
			res.redirect(301, `/v1/users/${found.handle}${suffix}`);
			return null;
		}
		return found.userId;
	}

	@Get(':handle')
	@Op('users/:handle', '/v1/users/:handle', 'A member’s public profile')
	@ApiParam({ name: 'handle', type: String })
	@Returns(ProfileEntity)
	@ApiMovedPermanentlyResponse({
		description: 'An old handle: Location is the current profile'
	})
	@ApiNotFoundResponse()
	async profile(
		@Param('handle') handle: string,
		@Res({ passthrough: true }) res: Response
	) {
		const userId = await this.resolve(handle, res);
		return userId ? this.service.profile(userId) : undefined;
	}

	@Get(':handle/contributions')
	@Op(
		'users/:handle/contributions',
		'/v1/users/:handle/contributions',
		'A member’s public contributions, newest first'
	)
	@ApiParam({ name: 'handle', type: String })
	@Returns(PaginatedContributionEntity)
	@ApiNotFoundResponse()
	async contributions(
		@Param('handle') handle: string,
		@Query({ schema: ContributionsQuery }) query: ContributionsQuery,
		@Res({ passthrough: true }) res: Response
	) {
		const userId = await this.resolve(handle, res, '/contributions');
		return userId
			? this.service.contributions(userId, query.page, query.limit)
			: undefined;
	}

	@Get(':handle/stats')
	@Op(
		'users/:handle/stats',
		'/v1/users/:handle/stats',
		'Submitted, verified, curated and corrections accepted'
	)
	@ApiParam({ name: 'handle', type: String })
	@Returns(ContributionStatsEntity)
	@ApiNotFoundResponse()
	async stats(
		@Param('handle') handle: string,
		@Res({ passthrough: true }) res: Response
	) {
		const userId = await this.resolve(handle, res, '/stats');
		return userId ? this.service.stats(userId) : undefined;
	}

	@Get(':handle/favorites')
	@Op(
		'users/:handle/favorites',
		'/v1/users/:handle/favorites',
		'A member’s favorites, if they made them public'
	)
	@ApiParam({ name: 'handle', type: String })
	@Returns(ProfileFavoritesEntity)
	@ApiNotFoundResponse({
		description: 'No such member, or their favorites are private'
	})
	async favorites(
		@Param('handle') handle: string,
		@Res({ passthrough: true }) res: Response,
		@Session() session?: UserSession | null
	) {
		const userId = await this.resolve(handle, res, '/favorites');
		return userId
			? this.service.favorites(userId, session?.user.id)
			: undefined;
	}
}
