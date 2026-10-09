import { Module } from '@nestjs/common';
import { CurrentUserController, UsersController } from './controllers';
import { CurrentUserService, UsersService } from './services';

@Module({
	imports: [],
	controllers: [CurrentUserController, UsersController],
	providers: [CurrentUserService, UsersService]
})
export class UsersModule {}
