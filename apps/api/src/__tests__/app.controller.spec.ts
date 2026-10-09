import { TestBed } from '@suites/unit';
import { SWAGGER_OPTIONS } from 'common/constants';
import { AppController } from 'app.controller';

describe('AppController', () => {
	let controller: AppController;

	beforeAll(async () => {
		const { unit } = await TestBed.solitary(AppController).compile();
		controller = unit;
	});

	it('should be defined', () => {
		expect(controller).toBeDefined();
	});

	it('should return an object with title and description properties', () => {
		const result = controller.index();
		expect(result).toHaveProperty('title');
		expect(result).toHaveProperty('description');
	});

	it('should use the SWAGGER_OPTIONS constant to retrieve the title and description', () => {
		const result = controller.index();
		const { info } = SWAGGER_OPTIONS;
		expect(result.title).toBe(info.title);
		expect(result.description).toBe(info.description);
	});
});
