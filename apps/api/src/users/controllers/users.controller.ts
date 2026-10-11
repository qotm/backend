import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import {
	ApiBadRequestResponse,
	ApiConflictResponse,
	ApiNotFoundResponse,
	ApiTags
} from '@nestjs/swagger';
import { Session, UserSession } from '@thallesp/nestjs-better-auth';
import { IdParam, Op, Returns } from 'common/decorators';
import { UserPermissions } from '../decorators';
import { UsersService } from '../services';
import { UserEntity, PaginatedUserEntity } from '../entity';
import { SetRole, UserFilters } from '../dto';

@ApiTags('Admin · Users')
@Controller({ path: 'admin/users', version: '1' })
export class UsersController {
	constructor(private service: UsersService) {}

	@Get()
	@Op('admin/users', '/v1/admin/users', 'Get all users')
	@Returns(PaginatedUserEntity)
	@UserPermissions('list')
	findAll(
		@Query({ schema: UserFilters }) filters: UserFilters,
		@Session() { user }: UserSession
	) {
		return this.service.paginate(user, filters);
	}

	@Get(':id')
	@Op('admin/users/:id', '/v1/admin/users/:id', 'Get user by ID')
	@IdParam()
	@ApiBadRequestResponse()
	@Returns(UserEntity)
	@ApiNotFoundResponse({ description: 'User not found' })
	@UserPermissions('get')
	async findOne(@Param('id') id: string, @Session() { user }: UserSession) {
		return this.service.getUserById(user, id);
	}

	@Patch(':id/role')
	@Op(
		'admin/users/:id/role',
		'/v1/admin/users/:id/role',
		'Assign a role (audited as "member → moderator")'
	)
	@IdParam()
	@Returns(UserEntity)
	@ApiNotFoundResponse({ description: 'User not found' })
	@ApiConflictResponse({
		description: 'The superuser’s role, or demoting the last admin'
	})
	@UserPermissions('set-role')
	setRole(
		@Param('id') id: string,
		@Body({ schema: SetRole }) body: SetRole,
		@Session() { user }: UserSession
	) {
		return this.service.setRole(user, id, body.role);
	}
}
