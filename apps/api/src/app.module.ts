import { randomInt } from 'crypto';
import { Logger, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { HttpModule } from '@nestjs/axios';
import { ScheduleModule } from '@nestjs/schedule';
import { MailerModule } from '@nestjs-modules/mailer';
import { BullModule } from '@nestjs/bullmq';
import { BullMQOtel } from 'bullmq-otel';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule, AuthGuard } from '@thallesp/nestjs-better-auth';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import {
	admin,
	bearer,
	deviceAuthorization,
	magicLink,
	openAPI
} from 'better-auth/plugins';
import { BullBoardModule } from '@bull-board/nestjs';
import { ExpressAdapter } from '@bull-board/express';
import { CustomConfigService, PrismaService } from 'common/services';
import { MailService } from 'common/services';
import {
	CacheService,
	RedisThrottlerStorage,
	createAuthRateLimitStorage
} from 'common/services';
import { getClientIp } from 'common/utils';
import { CommonModule } from 'common/common.module';
import { UsersModule } from 'users/users.module';
import { MediaModule } from 'media/media.module';
import { QuotesModule } from 'quotes/quotes.module';
import { SubmissionsModule } from 'submissions/submissions.module';
import { AdminReviewModule } from 'admin/review/admin-review.module';
import { ReportsModule } from 'reports/reports.module';
import { DevicesModule } from 'devices/devices.module';
import { ReactionsModule } from 'reactions/reactions.module';
import { TaxonomyModule } from 'taxonomy/taxonomy.module';
import { SearchModule } from 'search/search.module';
import { AdminTaxonomyModule } from 'admin/taxonomy/admin-taxonomy.module';
import { AdminAuditModule } from 'admin/audit/admin-audit.module';
import { ReleasesModule } from 'releases/releases.module';
import { AdminReleasesModule } from 'admin/releases/admin-releases.module';
import { AppController } from 'app.controller';
import { DEFAULT_ROLE, ac, roles } from 'lib/access';
import { AUTH_RATE_LIMIT_RULES } from 'lib/rate-limit';
import { handleAuthOptions } from 'lib/handle';
import {
	MAGIC_LINK_RATE_LIMIT,
	MAGIC_LINK_TTL_SECONDS,
	deviceAuthorizationOptions,
	socialProviders
} from 'lib/sign-in';
import { EMAIL_LIMIT, emailLimitKey, signInGuard } from 'lib/sign-in-guard';
import { OriginBuilder } from 'common/misc';

@Module({
	imports: [
		CommonModule,
		AuthModule.forRootAsync({
			inject: [PrismaService, CustomConfigService, MailService, CacheService],
			useFactory: (
				db: PrismaService,
				config: CustomConfigService,
				mail: MailService,
				cache: CacheService
			) => ({
				auth: betterAuth({
					appName: config.app.name,
					secret: config.betterAuth.secret,
					baseURL: config.betterAuth.url,
					basePath: '/auth',
					database: prismaAdapter(db, {
						provider: 'postgresql'
					}),
					// better-auth's limiter only guards `/auth/*` — every other route
					// is covered by ThrottlerGuard below.
					rateLimit: {
						// better-auth defaults to production-only; follow RATE_LIMIT_ENABLED
						// instead, so dev is limited too and tests can opt out (and back in).
						enabled: config.rateLimit.enabled,
						window: config.rateLimit.authWindow,
						max: config.rateLimit.authMax,
						customRules: AUTH_RATE_LIMIT_RULES,
						customStorage: createAuthRateLimitStorage(cache)
					},
					advanced: {
						ipAddress: {
							// Without this, `getIp` behind a proxy resolves every request
							// to the proxy's address — and if it resolves nothing at all,
							// better-auth skips rate limiting entirely with a warning.
							ipAddressHeaders: config.rateLimit.ipHeaders
						},
						// With BETTER_AUTH_COOKIE_DOMAIN set (`.example.com`), the session
						// cookie is shared across subdomains so one login covers every
						// frontend. Empty, it belongs to the API's own host: right for
						// localhost and for a single-origin frontend. A browser drops a
						// cookie whose domain doesn't cover the host that set it.
						cookiePrefix: config.betterAuth.cookiePrefix,
						crossSubDomainCookies: {
							enabled: Boolean(config.betterAuth.cookieDomain),
							domain: config.betterAuth.cookieDomain || undefined
						},
						database: {
							joins: true
						}
					},
					user: {
						additionalFields: {
							// Example of an extra session-borne field. `input: false` is
							// load-bearing on anything the client must not be able to set
							// for itself — without it, a signup payload could grant it.
							onboardingCompletedAt: {
								type: 'date',
								required: false,
								input: false
							},
							...handleAuthOptions(db).fields
						}
					},
					databaseHooks: handleAuthOptions(db).databaseHooks,
					socialProviders: socialProviders(config.betterAuth.url, config.oauth),
					// Disposable addresses and per-email flooding (QOT-7). The per-email
					// count follows RATE_LIMIT_ENABLED like every other limit.
					hooks: {
						before: signInGuard(
							config.rateLimit.enabled
								? (email) =>
										cache.incr(emailLimitKey(email), EMAIL_LIMIT.windowSeconds)
								: undefined
						)
					},
					// No passwords in qotm; only the test environment turns them on.
					emailAndPassword: {
						enabled: config.betterAuth.passwordEnabled,
						requireEmailVerification: true,
						sendResetPassword: async ({ user, url, token }) => {
							mail.forgotPassword({
								to: user.email,
								token,
								url
							});
						},
						onPasswordReset: async ({ user }) => {
							mail.resetPassword(user.email);
						}
					},
					emailVerification: {
						sendOnSignUp: true,
						sendVerificationEmail: async ({ user, url, token }) => {
							mail.activation({
								to: user.email,
								token,
								firstName: user.name.split(' ')[0],
								url
							});
						},
						afterEmailVerification: async ({ email, name }) => {
							mail.welcome({
								to: email,
								firstName: name,
								supportEmail: config.smtp.supportEmail,
								clientLoginPage: config.app.frontendHost
							});
						}
					},
					plugins: [
						admin({
							defaultRole: DEFAULT_ROLE,
							ac,
							roles
						}),
						// Sign-in and sign-up in one: an unknown email gets an account.
						magicLink({
							expiresIn: MAGIC_LINK_TTL_SECONDS,
							rateLimit: MAGIC_LINK_RATE_LIMIT,
							sendMagicLink: async ({ email, url }) => {
								mail.magicLink({
									to: email,
									url,
									expiresInMinutes: MAGIC_LINK_TTL_SECONDS / 60
								});
								// No mailbox needed to sign in locally.
								if (config.app.env === 'development') {
									new Logger('MagicLink').log(
										`magic link for ${email}: ${url}`
									);
								}
							}
						}),
						// `qotm login`: the device flow, and its session token as a bearer.
						deviceAuthorization(
							deviceAuthorizationOptions(config.app.frontendHost, randomInt)
						),
						bearer(),
						openAPI()
					],
					trustedOrigins: [
						config.app.frontendHost,
						...OriginBuilder.build(config.app.miscCorsOrigins)
					]
				}),
				middleware: (req, _, next) => {
					req.url = req.originalUrl;
					req.baseUrl = '';
					next();
				}
			})
		}),
		MailerModule.forRootAsync({
			imports: [],
			inject: [CustomConfigService],
			useFactory: async (config: CustomConfigService) => ({
				defaults: {
					from: config.smtp.from
				},
				transport: {
					host: config.smtp.host,
					port: config.smtp.port,
					secure: config.smtp.secure,
					auth: {
						user: config.smtp.user,
						pass: config.smtp.password
					}
				}
			})
		}),
		HttpModule.registerAsync({ useFactory: () => ({ timeout: 5000 }) }),
		BullModule.forRootAsync({
			inject: [CustomConfigService],
			useFactory: async (config: CustomConfigService) => ({
				connection: {
					host: config.redis.host,
					port: config.redis.port,
					username: config.redis.username,
					password: config.redis.password
				},
				defaultJobOptions: {
					removeOnComplete: true
				},
				// Job spans for producers and workers; a no-op unless the
				// OpenTelemetry SDK is running (see src/instrumentation.ts).
				telemetry: new BullMQOtel({
					tracerName: 'qotm-api',
					meterName: 'qotm-api',
					enableMetrics: true
				})
			})
		}),
		BullBoardModule.forRoot({
			route: '/dashboard',
			adapter: ExpressAdapter
		}),
		ThrottlerModule.forRootAsync({
			inject: [CustomConfigService, RedisThrottlerStorage],
			useFactory: (
				config: CustomConfigService,
				storage: RedisThrottlerStorage
			) => ({
				throttlers: [
					{
						name: 'default',
						ttl: config.rateLimit.ttl,
						limit: config.rateLimit.limit
					}
				],
				storage,
				getTracker: (req) => getClientIp(req, config.rateLimit.ipHeaders),
				skipIf: () => !config.rateLimit.enabled
			})
		}),
		ScheduleModule.forRoot(),
		UsersModule,
		MediaModule,
		QuotesModule,
		SubmissionsModule,
		AdminReviewModule,
		ReportsModule,
		DevicesModule,
		ReactionsModule,
		TaxonomyModule,
		SearchModule,
		AdminTaxonomyModule,
		AdminAuditModule,
		ReleasesModule,
		AdminReleasesModule
	],
	controllers: [AppController],
	providers: [
		// Order matters: Nest runs global guards in registration order, so floods
		// are rejected before AuthGuard does a session lookup and hits the DB.
		{
			provide: APP_GUARD,
			useClass: ThrottlerGuard
		},
		{
			provide: APP_GUARD,
			useClass: AuthGuard
		}
	]
})
export class AppModule {}
