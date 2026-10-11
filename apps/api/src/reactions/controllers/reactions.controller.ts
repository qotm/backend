import {
	Body,
	Controller,
	Delete,
	Get,
	HttpCode,
	Param,
	Post,
	Put,
	Query
} from '@nestjs/common';
import {
	ApiBadRequestResponse,
	ApiConflictResponse,
	ApiNotFoundResponse,
	ApiTags
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { IdParam, Op, Returns } from 'common/decorators';
import { FavoritesQuery, FavoritesSyncChanges } from '../dto';
import {
	FavoritesSyncEntity,
	PaginatedFavoriteEntity,
	ReactionEntity
} from '../entity';
import { ReactionsService } from '../services';
import type { ReactionKind } from '../reactions';

/** Toggles are cheap but should not be scriptable at volume. */
const TOGGLES = { default: { limit: 60, ttl: 60_000 } };

/** Like, favorite and recommend (ActionBar). Signed-in members only. */
@ApiTags('Reactions')
@Throttle(TOGGLES)
@Controller({ path: 'quotes', version: '1' })
export class ReactionsController {
	constructor(private service: ReactionsService) {}

	private toggle(
		session: UserSession,
		id: string,
		kind: ReactionKind,
		on: boolean
	) {
		return this.service.toggle(session.user.id, id, kind, on);
	}

	@Post(':id/like')
	@HttpCode(200)
	@Op('quotes/:id/like', '/v1/quotes/:id/like', 'Like a quote')
	@IdParam()
	@Returns(ReactionEntity)
	@ApiNotFoundResponse()
	like(@Param('id') id: string, @Session() session: UserSession) {
		return this.toggle(session, id, 'like', true);
	}

	@Delete(':id/like')
	@Op('quotes/:id/like/delete', '/v1/quotes/:id/like', 'Remove a like')
	@IdParam()
	@Returns(ReactionEntity)
	@ApiNotFoundResponse()
	unlike(@Param('id') id: string, @Session() session: UserSession) {
		return this.toggle(session, id, 'like', false);
	}

	@Post(':id/favorite')
	@HttpCode(200)
	@Op(
		'quotes/:id/favorite',
		'/v1/quotes/:id/favorite',
		'Save a quote to favorites'
	)
	@IdParam()
	@Returns(ReactionEntity)
	@ApiNotFoundResponse()
	favorite(@Param('id') id: string, @Session() session: UserSession) {
		return this.toggle(session, id, 'favorite', true);
	}

	@Delete(':id/favorite')
	@Op(
		'quotes/:id/favorite/delete',
		'/v1/quotes/:id/favorite',
		'Remove from favorites (the toast’s undo)'
	)
	@IdParam()
	@Returns(ReactionEntity)
	@ApiNotFoundResponse()
	unfavorite(@Param('id') id: string, @Session() session: UserSession) {
		return this.toggle(session, id, 'favorite', false);
	}

	@Post(':id/recommendation')
	@HttpCode(200)
	@Op(
		'quotes/:id/recommendation',
		'/v1/quotes/:id/recommendation',
		'Recommend a community original for curation'
	)
	@IdParam()
	@Returns(ReactionEntity)
	@ApiNotFoundResponse()
	@ApiBadRequestResponse({
		description: 'Only community originals can be recommended'
	})
	@ApiConflictResponse({ description: 'Already in curation or curated' })
	recommend(@Param('id') id: string, @Session() session: UserSession) {
		return this.toggle(session, id, 'recommend', true);
	}

	@Delete(':id/recommendation')
	@Op(
		'quotes/:id/recommendation/delete',
		'/v1/quotes/:id/recommendation',
		'Withdraw a recommendation'
	)
	@IdParam()
	@Returns(ReactionEntity)
	@ApiNotFoundResponse()
	unrecommend(@Param('id') id: string, @Session() session: UserSession) {
		return this.toggle(session, id, 'recommend', false);
	}
}

/** The member's favorites: the Favorites screen and the CLI's sync. */
@ApiTags('Reactions')
@Controller({ path: 'me/favorites', version: '1' })
export class FavoritesController {
	constructor(private service: ReactionsService) {}

	@Get()
	@Op(
		'me/favorites',
		'/v1/me/favorites',
		'My favorites: filter, sort (recent, author, likes), page'
	)
	@Returns(PaginatedFavoriteEntity)
	list(
		@Query({ schema: FavoritesQuery }) query: FavoritesQuery,
		@Session() { user }: UserSession
	) {
		return this.service.favorites(user.id, query);
	}

	@Get('sync')
	@Op(
		'me/favorites/sync',
		'/v1/me/favorites/sync',
		'All my favorites, for the CLI (qotm favorites)'
	)
	@Returns(FavoritesSyncEntity)
	syncState(@Session() { user }: UserSession) {
		return this.service.syncState(user.id);
	}

	@Put('sync')
	@Op(
		'me/favorites/sync/update',
		'/v1/me/favorites/sync',
		'Apply the CLI’s offline adds and removes; returns the merged set'
	)
	@Returns(FavoritesSyncEntity)
	sync(
		@Body({ schema: FavoritesSyncChanges }) body: FavoritesSyncChanges,
		@Session() { user }: UserSession
	) {
		return this.service.sync(user.id, body);
	}
}
