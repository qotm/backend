/**
 * The email's design tokens: qotm_kit's "Paper" theme (the web app's
 * theme.css), in the one form every mail client reads, inline styles. Ink on
 * warm paper, a white card, 1px hairlines and one muted clay; no second hue.
 * The designs are the `qotm_mail` Paper file and the canvas's Emails page.
 */
export const color = {
	paper: '#f4f2ed',
	surface: '#ffffff',
	ink: '#141210',
	/** stone-600: secondary text, 4.8:1 on paper. */
	muted: '#6e6a64',
	/** stone-400: comments on ink only (7.4:1 there). */
	faint: '#a7a29a',
	hairline: '#dad7d0',
	inkRule: '#2a2724',
	/** Text on the wash. */
	clay700: '#8a3d24',
	/** Eyebrows and links on paper or white. */
	clay600: '#a24a2c',
	/** The prompt on ink. */
	clay400: '#c67457',
	/** The one tinted panel: a reviewer's note. */
	clay100: '#eedbd0'
} as const;

/** The kit's three faces, each over a system stack for clients without web fonts. */
export const font = {
	display: "'Space Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif",
	sans: "Inter, -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif",
	mono: "'JetBrains Mono', ui-monospace, Menlo, Consolas, 'Courier New', monospace"
} as const;

export const FONTS_URL =
	'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600&family=Inter:wght@400;500&family=JetBrains+Mono:wght@400&display=swap';

export const radius = {
	control: '8px',
	field: '12px',
	card: '14px',
	terminal: '16px'
} as const;

/** The column, and the card's padding at that width. */
export const layout = {
	width: 600,
	cardPadding: '44px 48px 40px'
} as const;

/** The kit's text styles, as the emails set them. */
export const text = {
	eyebrow: {
		fontFamily: font.mono,
		fontSize: '12px',
		lineHeight: '18px',
		letterSpacing: '0.14em',
		textTransform: 'uppercase',
		color: color.clay600,
		margin: 0
	},
	heading: {
		fontFamily: font.display,
		fontSize: '32px',
		lineHeight: '38px',
		fontWeight: 600,
		letterSpacing: '-0.01em',
		color: color.ink,
		margin: 0
	},
	lede: {
		fontFamily: font.sans,
		fontSize: '17px',
		lineHeight: '27px',
		color: color.muted,
		margin: 0
	},
	body: {
		fontFamily: font.sans,
		fontSize: '15px',
		lineHeight: '23px',
		color: color.muted,
		margin: 0
	},
	quote: {
		fontFamily: font.display,
		fontSize: '24px',
		lineHeight: '32px',
		fontWeight: 600,
		letterSpacing: '-0.01em',
		color: color.ink,
		margin: 0
	},
	meta: {
		fontFamily: font.mono,
		fontSize: '13px',
		lineHeight: '20px',
		color: color.muted,
		margin: 0
	},
	label: {
		fontFamily: font.mono,
		fontSize: '12px',
		lineHeight: '18px',
		letterSpacing: '0.14em',
		textTransform: 'uppercase',
		color: color.muted,
		margin: 0
	}
} as const;
