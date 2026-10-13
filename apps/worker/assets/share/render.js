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
