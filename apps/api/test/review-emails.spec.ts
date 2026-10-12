import type { Mock } from 'vitest';
import { AppFactory } from '@test/factory/app';
import { TEST_ADMIN, TEST_USER } from '@test/factory/constants';
import { MailService } from 'common/services';
import { CURATION_CHECKLIST } from 'review/decisions';
import type { QuoteStatus, QuoteType } from '@qotm/db/enums';

/** Review-finished emails, with the mail queue mocked. */
describe('Review emails', () => {
	let app: AppFactory;
	let admin: string;
	let memberId: string;
	let adminId: string;
	let send: Mock;

	let n = 0;
	async function quote(
		status: QuoteStatus,
		type: QuoteType = 'CANONICAL',
		contributorId = memberId
	) {
		const author = await app.db.author.upsert({
			where: { slug: 'dijkstra' },
			update: {},
			create: { slug: 'dijkstra', name: 'Edsger W. Dijkstra' }
		});
		return app.db.quote.create({
			data: {
				publicId: `q_re${String(++n).padStart(4, '0')}`,
				text: `Reviewed quote ${n}`,
				type,
				status,
				authorId: type === 'CANONICAL' ? author.id : null,
				contributorId
			}
		});
	}

	beforeAll(async () => {
		app = await AppFactory.init();
		await app.refresh();
		admin = (await app.signIn(TEST_ADMIN.email, TEST_ADMIN.password)).cookie!;
		memberId = (
			await app.db.user.findUniqueOrThrow({ where: { email: TEST_USER.email } })
		).id;
		adminId = (
			await app.db.user.findUniqueOrThrow({
				where: { email: TEST_ADMIN.email }
			})
		).id;
		send = app.instance.get(MailService).reviewFinished as unknown as Mock;
	});

	beforeEach(() => {
		send.mockReset();
	});

	afterAll(async () => {
		await app.close();
	});

	const verify = (id: string, body: object) =>
		app.request
			.post(`/v1/admin/quotes/${id}/verification`)
			.set('Cookie', admin)
			.send(body);

	it('emails the contributor the outcome and the reviewer’s note', async () => {
		const q = await quote('SUBMITTED');
		const res = await verify(q.publicId, {
			decision: 'needs_evidence',
			note: 'Which edition? <b>Page</b> please.'
		});
		expect(res.status).toBe(200);
		expect(send).toHaveBeenCalledTimes(1);
		expect(send).toHaveBeenCalledWith({
			to: TEST_USER.email,
			handle: 'test_user',
			outcome: 'NEEDS_EVIDENCE',
			quote: {
				id: q.publicId,
				text: q.text,
				author: 'Edsger W. Dijkstra',
				original: false
			},
			note: 'Which edition? <b>Page</b> please.',
			url: `${app.config.app.frontendHost}/q/${q.publicId.slice(2)}`
		});
	});

	it('covers moderation and curation decisions too', async () => {
		const original = await quote('ORIGINALITY_CHECK', 'ORIGINAL');
		await app.request
			.post(`/v1/admin/submissions/${original.publicId}/decision`)
			.set('Cookie', admin)
			.send({ decision: 'publish' });
		const verified = await quote('VERIFIED');
		const checklist = Object.fromEntries(
			Object.keys(CURATION_CHECKLIST).map((k) => [k, true])
		);
		await app.request
			.post(`/v1/admin/quotes/${verified.publicId}/curation`)
			.set('Cookie', admin)
			.send({ decision: 'curate', checklist });
		expect(send.mock.calls.map(([d]) => d.outcome)).toEqual([
			'PUBLISH',
			'CURATE'
		]);
		expect(send.mock.calls[0][0].note).toBeNull();
	});

	it('respects the member’s choice to turn review emails off', async () => {
		await app.db.user.update({
			where: { id: memberId },
			data: { emailOnReview: false }
		});
		const q = await quote('SUBMITTED');
		expect((await verify(q.publicId, { decision: 'verify' })).status).toBe(200);
		expect(send).not.toHaveBeenCalled();
		await app.db.user.update({
			where: { id: memberId },
			data: { emailOnReview: true }
		});
	});

	it('never emails reviewers about their own quote, or a former member', async () => {
		const own = await quote('SUBMITTED', 'CANONICAL', adminId);
		await verify(own.publicId, { decision: 'verify' });
		const orphan = await quote('SUBMITTED');
		await app.db.quote.update({
			where: { id: orphan.id },
			data: { contributorId: null }
		});
		await verify(orphan.publicId, { decision: 'verify' });
		expect(send).not.toHaveBeenCalled();
	});

	it('keeps the decision when the email cannot be queued', async () => {
		send.mockRejectedValueOnce(new Error('redis down'));
		const q = await quote('SUBMITTED');
		const res = await verify(q.publicId, { decision: 'verify' });
		expect(res.status).toBe(200);
		expect(
			(await app.db.quote.findUniqueOrThrow({ where: { id: q.id } })).status
		).toBe('VERIFIED');
	});
});
