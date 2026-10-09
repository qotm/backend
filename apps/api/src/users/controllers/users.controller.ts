import { Controller, Get, Param, Query } from '@nestjs/common';
import {
	ApiBadRequestResponse,
	ApiNotFoundResponse,
	ApiTags
} from '@nestjs/swagger';
import { Session, UserSession } from '@thallesp/nestjs-better-auth';
import { IdParam, Op, Returns } from 'common/decorators';
import { UserPermissions } from '../decorators';
import { UsersService } from '../services';
import { UserEntity, PaginatedUserEntity } from '../entity';
import { UserFilters } from '../dto';

@ApiTags('Users')
@Controller({ path: 'users', version: '1' })
export class UsersController {
	constructor(private service: UsersService) {}

	@Get()
	@Op('users', '/v1/users', 'Get all users')
	@Returns(PaginatedUserEntity)
	@UserPermissions('list')
	findAll(
		@Query({ schema: UserFilters }) filters: UserFilters,
		@Session() { user }: UserSession
	) {
		return this.service.paginate(user, filters);
	}

	@Get(':id')
	@Op('users/:id', '/v1/users/:id', 'Get user by ID')
	@IdParam()
	@ApiBadRequestResponse()
	@Returns(UserEntity)
	@ApiNotFoundResponse({ description: 'User not found' })
	@UserPermissions('get')
	async findOne(@Param('id') id: string, @Session() { user }: UserSession) {
		return this.service.getUserById(user, id);
	}
}
