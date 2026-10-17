import { render } from '@react-email/render';
import { TestBed } from '@suites/unit';
import type { Mock } from 'vitest';
import { getQueueToken } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { MailService } from 'common/services';
import { MailJob, type ReviewFinishedData } from 'common/types';
// The real template (the `@emails` alias points tests at the mocks).
import ReviewFinished, { REVIEW_COPY } from '../../../emails/review-finished';

const data: ReviewFinishedData = {
	to: 'ada@example.com',
	handle: 'ada',
	outcome: 'NEEDS_EVIDENCE',
	quote: {
		id: 'q_8f2k1c',
		text: 'Simplicity is prerequisite for reliability.',
		author: 'Edsger W. Dijkstra',
		original: false
	},
	note: '<script>alert("x")</script> & see EWD 498',
	url: 'https://qotm.site/q/8f2k1c'
};

describe('the review-finished email', () => {
	it('escapes the reviewer’s note and the quote', async () => {
		const html = await render(
			ReviewFinished({
				...data,
				quote: { ...data.quote, text: '<b>bold</b> claim' },
				host: 'https://qotm.site',
				site: 'https://qotm.site',
				appName: 'qotm',
				footerText: '',
				subject: REVIEW_COPY.NEEDS_EVIDENCE.subject,
				preview: ''
			})
		);
		expect(html).not.toContain('<script>');
		expect(html).toContain('&lt;script&gt;');
		expect(html).toContain('&amp; see EWD 498');
		expect(html).not.toContain('<b>bold</b>');
		// Evidence is added from the member's quotes in review.
		expect(html).toContain('https://qotm.site/my-quotes?tab=review');
		expect(html).toContain(REVIEW_COPY.NEEDS_EVIDENCE.body);
	});

	const email = (over: Partial<ReviewFinishedData>) =>
		render(
			ReviewFinished({
				...data,
				note: null,
				...over,
				host: '',
				appName: 'qotm',
				footerText: '',
				site: 'https://qotm.site',
				subject: '',
				preview: ''
			})
		);

	it('links to the quote and credits its author apart from the contributor', async () => {
		const html = await email({ outcome: 'VERIFY' });
		expect(html).toContain('href="https://qotm.site/q/8f2k1c"');
		expect(html).toContain('— Edsger W. Dijkstra');
		expect(html).toContain('✓ Verified · Review finished');
		expect(html).toContain('cid:qotm-logo');
	});

	it('credits an original to its member and shows the sync command when curated', async () => {
		const html = await email({
			outcome: 'CURATE',
			quote: { ...data.quote, author: null, original: true }
		});
		expect(html).toContain('Declared original by @ada');
		expect(html).toContain('qotm sync');
		expect(html).not.toContain('Edsger');
	});

	it('has a subject for every outcome, in sentence case without exclamation marks', () => {
		for (const { subject, body } of Object.values(REVIEW_COPY)) {
			expect(subject).toMatch(/^[A-Z][^!]*[a-z]$/);
			expect(body).not.toContain('!');
		}
	});

	it('is queued with attempts and backoff, and failures kept 30 days', async () => {
		const { unit, unitRef } = await TestBed.solitary(MailService).compile();
		const queue: { add: Mock<Queue['add']> } = unitRef.get(
			getQueueToken('mail')
		);
		await unit.reviewFinished(data);
		expect(queue.add).toHaveBeenCalledWith(MailJob.ReviewFinished, data, {
			attempts: 3,
			backoff: { type: 'exponential', delay: 30_000 },
			removeOnFail: { age: 30 * 24 * 60 * 60 }
		});
	});
});
