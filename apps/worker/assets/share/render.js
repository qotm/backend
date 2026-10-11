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
