import { render } from '@react-email/render';
// The real template (the `@emails` alias points tests at the mocks).
import MagicLink from '../../../emails/magic-link';

describe('the magic-link email', () => {
	const url =
		'https://api.qotm.site/auth/magic-link/verify?token=abc&callbackURL=https%3A%2F%2Fqotm.site';
	const html = render(
		MagicLink({
			url,
			expiresInMinutes: 10,
			host: '',
			appName: 'qotm',
			footerText: '',
			site: 'https://qotm.site',
			subject: 'Your qotm sign-in link',
			preview: ''
		})
	);

	it('carries the link as the button and spelled out, with its expiry', () => {
		const href = `href="${url.replace(/&/g, '&amp;')}"`;
		expect(html.split(href)).toHaveLength(3);
		expect(html).toContain('expires in 10 minutes');
	});

	it('shows the logo by content id and the site in the footer, without exclamation marks', () => {
		expect(html).toContain('src="cid:qotm-logo"');
		expect(html).toContain('qotm.site · Sent because');
		expect(html.split('<body')[1].replace(/<[^>]+>/g, '')).not.toContain('!');
	});
});
