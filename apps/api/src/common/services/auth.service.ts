import { Injectable } from '@nestjs/common';
import { AuthService } from '@thallesp/nestjs-better-auth';
import { BetterAuth } from 'lib/auth';

@Injectable()
export class CustomAuthService {
	constructor(private readonly auth: AuthService<BetterAuth>) {}

	get api() {
		return this.auth.api;
	}

	get instance() {
		return this.auth;
	}
}
