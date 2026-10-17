import { TestBed, type Mocked } from '@suites/unit';
import { ShareImagesService } from 'share/services';
import { OriginalityEvents } from '../services';

describe('OriginalityEvents', () => {
	let events: OriginalityEvents;
	let share: Mocked<ShareImagesService>;

	beforeEach(async () => {
		const { unit, unitRef } =
			await TestBed.solitary(OriginalityEvents).compile();
		events = unit;
		share = unitRef.get(ShareImagesService);
	});

	it('queues the share images of an original the check published', async () => {
		await events.completed({
			returnvalue: { outcome: 'published', publicId: 'q_5k0q2j' }
		});
		expect(share.rerender).toHaveBeenCalledWith('q_5k0q2j');
	});

	it('leaves held and skipped checks, and the nightly re-check, alone', async () => {
		for (const returnvalue of [
			{ outcome: 'held', matches: [] },
			{ outcome: 'skipped', reason: 'quote is PUBLISHED' },
			{ checked: 12, flagged: 0 },
			null
		]) {
			await events.completed({ returnvalue });
		}
		expect(share.rerender).not.toHaveBeenCalled();
	});
});
