import { Module } from '@nestjs/common';
import { QuotesModule } from 'quotes/quotes.module';
import {
	CurrentUserController,
	MeController,
	ProfilesController,
	UsersController
} from './controllers';
import {
	CurrentUserService,
	MeService,
	ProfilesService,
	UsersService
} from './services';

@Module({
	imports: [QuotesModule],
	controllers: [
		CurrentUserController,
		UsersController,
		MeController,
		ProfilesController
	],
	providers: [CurrentUserService, UsersService, MeService, ProfilesService]
})
export class UsersModule {}
