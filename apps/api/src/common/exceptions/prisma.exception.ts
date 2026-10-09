import {
	ArgumentsHost,
	Catch,
	HttpStatus,
	BadRequestException
} from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Response } from 'express';
import { Prisma } from '@qotm/db/client';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaClientKnownRequestExceptionFilter extends BaseExceptionFilter {
	catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
		const ctx = host.switchToHttp();
		const response = ctx.getResponse<Response>();

		switch (exception.code) {
			case 'P2002':
				response.status(HttpStatus.CONFLICT).json({
					statusCode: HttpStatus.CONFLICT,
					message: 'A record already exists with the same unique fields'
				});
				break;
			case 'P2001':
			case 'P2015':
			case 'P2016':
			case 'P2025':
				response.status(HttpStatus.NOT_FOUND).json({
					statusCode: HttpStatus.NOT_FOUND,
					message: exception.message.replace(/\n/g, '')
				});
				break;
			default:
				// console.log({ exception, host });
				// default 500 error code
				super.catch(exception, host);
				break;
		}
	}
}

@Catch(Prisma.PrismaClientValidationError)
export class PrismaClientValidationExceptionFilter extends BaseExceptionFilter {
	catch(exception: Prisma.PrismaClientValidationError, host: ArgumentsHost) {
		const ctx = host.switchToHttp();
		const response = ctx.getResponse<Response>();

		// console.log({ exception, host });

		const badRequestException = new BadRequestException('Validation error');

		response.status(badRequestException.getStatus()).json({
			statusCode: badRequestException.getStatus(),
			message: badRequestException.message
		});
	}
}
