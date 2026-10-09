import { TestBed } from '@suites/unit';
import type { Mock } from 'vitest';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { MailService } from 'common/services';
import {
	MailJob,
	ActivationData,
	ActivationTwoFaData,
	WelcomeData,
	ForgotPasswordData,
	SetPasswordData
} from 'common/types';

describe('MailService', () => {
	let service: MailService;
	// Only `add` is exercised; Mocked<Queue> is too deep a type for tsc.
	let queue: { add: Mock<Queue['add']> };

	beforeAll(async () => {
		const { unit, unitRef } = await TestBed.solitary(MailService).compile();
		service = unit;
		queue = unitRef.get(getQueueToken('mail'));
	});

	beforeEach(() => {
		queue.add.mockReset();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	it('should enqueue activation email', async () => {
		const data = {} as ActivationData;
		await service.activation(data);
		expect(queue.add).toHaveBeenCalledWith(MailJob.Activation, data);
	});

	it('should enqueue activation twofa email', async () => {
		const data = {} as ActivationTwoFaData;
		await service.activationTwofa(data);
		expect(queue.add).toHaveBeenCalledWith(MailJob.ActivationTwofa, data);
	});

	it('should enqueue welcome email', async () => {
		const data = {} as WelcomeData;
		await service.welcome(data);
		expect(queue.add).toHaveBeenCalledWith(MailJob.Welcome, data);
	});

	it('should enqueue forgot password email', async () => {
		const data = {} as ForgotPasswordData;
		await service.forgotPassword(data);
		expect(queue.add).toHaveBeenCalledWith(MailJob.ForgotPassword, data);
	});

	it('should enqueue reset password email', async () => {
		const data = 'reset-token';
		await service.resetPassword(data);
		expect(queue.add).toHaveBeenCalledWith(MailJob.ResetPassword, data);
	});

	it('should enqueue password changed email', async () => {
		const data = 'user-id';
		await service.passwordChanged(data);
		expect(queue.add).toHaveBeenCalledWith(MailJob.PasswordChanged, data);
	});

	it('should enqueue set password email', async () => {
		const data = {} as SetPasswordData;
		await service.setPassword(data);
		expect(queue.add).toHaveBeenCalledWith(MailJob.SetPassword, data);
	});
});
