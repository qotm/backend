/*
 * Runs in the page: renders qotm_kit's ShareCard full size and steps the
 * quote's font size down until the credit clears the footer (quote card) or
 * the last prompt clears the bottom edge (terminal card). Resolves to the
 * final size, or null if even `min` does not fit.
 */
window.renderShareCard = async function (variant, card, height, min) {
	const root = ReactDOM.createRoot(document.getElementById('root'));
	ReactDOM.flushSync(() =>
		root.render(
			React.createElement(QotmKit.ShareCard, {
				quote: card.text,
				author: card.author,
				id: card.id,
				variant,
				width: 1200
			})
		)
	);
	await document.fonts.ready;
	await Promise.all(
		[...document.images].map((img) => img.decode().catch(() => {}))
	);

	const quote = document.querySelector('.qk-share__quote');
	const bottom = (selector) =>
		[...document.querySelectorAll(selector)].reduce(
			(max, el) => Math.max(max, el.getBoundingClientRect().bottom),
			0
		);
	const fits = () =>
		variant === 'quote'
			? bottom('.qk-share__by') <=
				document.querySelector('.qk-share__foot').getBoundingClientRect().top -
					24
			: bottom('.qk-share__cmd') <= height - 24;

	let size = parseFloat(getComputedStyle(quote).fontSize);
	while (!fits() && size > min) {
		size -= 2;
		quote.style.fontSize = size + 'px';
	}
	return fits() ? size : null;
};

/*
 * Renders a page card (an author's, a topic's or the site's og:image) in the
 * quote card's frame: paper, clay edge, the kit's footer and logo. The title
 * and then the quote step down until everything clears the footer; a quote
 * that still does not fit is left out. Resolves to the title's final size.
 */
window.renderPageCard = async function (card, height, min) {
	const h = React.createElement;
	const root = ReactDOM.createRoot(document.getElementById('root'));
	const foot =
		card.kind === 'site'
			? '~ > npm i -g qotm'
			: card.path.replace(/^\//, '') + '  ·  a thought between commands';
	const draw = (withQuote) =>
		ReactDOM.flushSync(() =>
			root.render(
				h(
					'div',
					{
						className: 'qk-share qk-share--quote qk-og',
						role: 'img',
						'aria-label': card.title
					},
					h('div', { className: 'qk-og__eyebrow' }, card.eyebrow),
					h('div', { className: 'qk-og__title' }, card.title),
					card.line ? h('div', { className: 'qk-og__line' }, card.line) : null,
					withQuote && card.quote
						? h(
								'div',
								{ className: 'qk-og__quote' },
								h(
									'div',
									{ className: 'qk-og__text' },
									'“' + card.quote.text + '”'
								),
								h(
									'div',
									{ className: 'qk-share__by' },
									h('span', null, '—'),
									' ',
									card.quote.author
								)
							)
						: null,
					h(
						'div',
						{ className: 'qk-share__foot' },
						h('span', { className: 'qk-og__path' }, foot),
						h(QotmKit.Logo, { lockup: 'symbol', height: 44 })
					)
				)
			)
		);
	draw(true);
	await document.fonts.ready;
	await Promise.all(
		[...document.images].map((img) => img.decode().catch(() => {}))
	);

	const footTop = () =>
		document.querySelector('.qk-share__foot').getBoundingClientRect().top - 32;
	const bottom = () =>
		[...document.querySelectorAll('.qk-og > :not(.qk-share__foot)')].reduce(
			(max, el) => Math.max(max, el.getBoundingClientRect().bottom),
			0
		);
	const title = () => document.querySelector('.qk-og__title');
	const text = () => document.querySelector('.qk-og__text');

	let size = parseFloat(getComputedStyle(title()).fontSize);
	while (
		bottom() > footTop() &&
		text() &&
		parseFloat(getComputedStyle(text()).fontSize) > 28
	) {
		text().style.fontSize =
			parseFloat(getComputedStyle(text()).fontSize) - 2 + 'px';
	}
	if (bottom() > footTop() && text()) draw(false);
	while (bottom() > footTop() && size > min) {
		size -= 4;
		title().style.fontSize = size + 'px';
	}
	return bottom() <= footTop() ? size : null;
};

/*
 * The terminal card: the CLI's default pull quote (cli/src/render.ts) in a
 * terminal window. One size for the whole body, as in a terminal, stepped
 * down until the last prompt clears the bottom edge. Resolves to that size.
 */
/*
 * The CLI's marks, "▄▄ ▄▄" over "▀█ ▀█": drawn on their 5×2 cell grid (each
 * cell two half-rows) rather than typed, since no bundled face has the block
 * glyphs. Mirrors the web's ShareCard.
 */
var MARKS = (function () {
	var cells = [[0, 1], [1, 1], [3, 1], [4, 1], [0, 2], [1, 2], [3, 2], [4, 2], [1, 3], [4, 3]];
	return (
		'<svg viewBox="0 0 5 4" preserveAspectRatio="none" width="100%" height="100%" fill="currentColor">' +
		cells.map(function (c) { return '<rect x="' + c[0] + '" y="' + c[1] + '" width="1.02" height="1.02"/>'; }).join('') +
		'</svg>'
	);
})();

window.renderTerminalCard = async function (card, height, start, min) {
	const h = React.createElement;
	const root = ReactDOM.createRoot(document.getElementById('root'));
	const ref = card.id ? '  ·  q/' + card.id.replace(/^q_/, '') : '';
	ReactDOM.flushSync(() =>
		root.render(
			h(
				'div',
				{ className: 'qk-term-card', role: 'img', 'aria-label': '“' + card.text + '” — ' + card.author },
				h('div', { className: 'qk-term-card__bar' }, h('i'), h('i'), h('i')),
				h(
					'div',
					{ className: 'qk-term-card__body' },
					h('div', null, h('span', { className: 'qk-term-card__accent' }, '~ >'), ' qotm'),
					h(
						'div',
						{ className: 'qk-term-card__row' },
						h('span', { className: 'qk-term-card__marks', dangerouslySetInnerHTML: { __html: MARKS } }),
						h(
							'div',
							{ className: 'qk-term-card__col' },
							h('div', { className: 'qk-term-card__text' }, card.text),
							h(
								'div',
								{ className: 'qk-term-card__by' },
								h('span', { className: 'qk-term-card__accent' }, '—'),
								'  ' + card.author,
								ref ? h('span', { className: 'qk-term-card__ref' }, ref) : null
							)
						)
					),
					h('div', { className: 'qk-term-card__cmd' }, h('span', { className: 'qk-term-card__accent' }, '~ >'), ' ', h('span', { className: 'qk-term-card__cursor' }))
				)
			)
		)
	);
	await document.fonts.ready;
	const body = document.querySelector('.qk-term-card__body');
	const fits = () => document.querySelector('.qk-term-card__cmd').getBoundingClientRect().bottom <= height - 24;
	let size = start;
	body.style.fontSize = size + 'px';
	while (!fits() && size > min) {
		size -= 2;
		body.style.fontSize = size + 'px';
	}
	return fits() ? size : null;
};
