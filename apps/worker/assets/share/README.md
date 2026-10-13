# Share-image template assets

The ShareCard's quote card is rendered from qotm_kit's own component, so the
PNGs match the design system:

- `qotm-kit.js`, `qotm-kit.css`: qotm_kit `components/bundle.js` and
  `bundle.css` (design system artifact 4MLqv3U59CQp4YfsjsBufn, version
  1791715211-d5c9). The Google Fonts `@import` is removed from the CSS: the
  renderer loads the fonts from `@fontsource` instead (self-hosted).
- `tokens.css`: the kit's tokens as CSS (the design canvas's
  `ds/qotmkit/tokens.css`).
- `react*.production.min.js`: React 18.3.1, as the kit ships it.

When the kit changes, replace these files and bump `SHARE_TEMPLATE_VERSION`
in `apps/api/src/share/cards.ts`, so every image renders again.

`render.js` is ours: `renderShareCard` draws the kit's ShareCard (the quote
card), `renderTerminalCard` draws the terminal card as the CLI's default pull
quote (the web's ShareCard draws the same; bump `TERMINAL_TEMPLATE_VERSION` in
`cards.ts` when it changes, which re-renders only terminal images), and
`renderPageCard` draws an author's, topic's or the site's og:image in the
same frame (its styles are in `render.ts`). The API bundles the rendered site
card as its last-resort og:image (`apps/api/src/share/fallback.ts`):
regenerate it when the page card changes.
