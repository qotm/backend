import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { LoggerModule } from './modules';
// The queue module itself is generic; here it is only needed to register the
// `mail` queue, so it rides on the mail feature.
import { QueueModule } from './modules';
import {
	GeneratorService,
	CustomConfigService,
	PrismaService,
	CustomAuthService
} from './services';
import { CacheService } from './services';
import { MailService } from './services';
import { RedisThrottlerStorage } from './services';
import { HealthController } from './controllers';
import { MailProcessor } from './processors';
import { PrismaHealthIndicator } from './misc';
import Config from './services/config.service';

/**
 * Global infrastructure module. Everything listed in `exports` is injectable
 * anywhere without importing this module — extend that array when you add a
 * shared provider, or the rest of the app will not see it.
 */
@Global()
@Module({
	imports: [
		ConfigModule.forRoot({
			load: [Config.getVariables],
			validationSchema: Config.schema
		}),
		LoggerModule,
		TerminusModule,
		QueueModule.register('mail')
	],
	controllers: [HealthController],
	providers: [
		ConfigService,
		CustomConfigService,
		GeneratorService,
		PrismaService,
		CustomAuthService,
		CacheService,
		MailService,
		MailProcessor,
		RedisThrottlerStorage,
		PrismaHealthIndicator
	],
	exports: [
		CustomConfigService,
		GeneratorService,
		PrismaService,
		CustomAuthService,
		CacheService,
		MailService,
		RedisThrottlerStorage
	]
})
export class CommonModule {}
