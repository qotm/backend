# Share-image template assets

The ShareCard (quote card and terminal card) is rendered from qotm_kit's own
component, so the PNGs match the design system:

- `qotm-kit.js`, `qotm-kit.css`: qotm_kit `components/bundle.js` and
  `bundle.css` (design system artifact 4MLqv3U59CQp4YfsjsBufn, version
  1791715211-d5c9). The Google Fonts `@import` is removed from the CSS: the
  renderer loads the fonts from `@fontsource` instead (self-hosted).
- `tokens.css`: the kit's tokens as CSS (the design canvas's
  `ds/qotmkit/tokens.css`).
- `react*.production.min.js`: React 18.3.1, as the kit ships it.

When the kit changes, replace these files and bump `SHARE_TEMPLATE_VERSION`
in `apps/api/src/share/cards.ts`, so every image renders again.
