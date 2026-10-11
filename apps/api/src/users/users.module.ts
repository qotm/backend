import { Module } from '@nestjs/common';
import {
	CurrentUserController,
	MeController,
	UsersController
} from './controllers';
import { CurrentUserService, MeService, UsersService } from './services';

@Module({
	imports: [],
	controllers: [CurrentUserController, UsersController, MeController],
	providers: [CurrentUserService, UsersService, MeService]
})
export class UsersModule {}
