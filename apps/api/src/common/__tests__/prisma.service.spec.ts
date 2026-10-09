import { TestBed } from '@suites/unit';
import { PrismaService } from 'common/services';

describe('PrismaService', () => {
	let service: PrismaService;

	beforeAll(async () => {
		const { unit } = await TestBed.solitary(PrismaService).compile();
		service = unit;
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});
});
