/* @ds-bundle: {"format":4,"namespace":"QotmKit","components":[{"name":"Button"},{"name":"IconButton"},{"name":"Link"},{"name":"Badge"},{"name":"Eyebrow"},{"name":"Divider"},{"name":"Logo"},{"name":"Kbd"},{"name":"Avatar"},{"name":"Terminal"},{"name":"QuoteBlock"},{"name":"InstallPill"},{"name":"CommandBlock"},{"name":"Swatch"},{"name":"Field"},{"name":"Input"},{"name":"Textarea"},{"name":"Select"},{"name":"Checkbox"},{"name":"RadioGroup"},{"name":"Switch"},{"name":"SearchField"},{"name":"TopicPicker"},{"name":"SiteHeader"},{"name":"SiteFooter"},{"name":"Tabs"},{"name":"Pagination"},{"name":"Breadcrumbs"},{"name":"SideNav"},{"name":"Card"},{"name":"Tile"},{"name":"Dialog"},{"name":"Menu"},{"name":"Toast"},{"name":"Notice"},{"name":"EmptyState"},{"name":"Skeleton"},{"name":"StatusBadge"},{"name":"TopicTag"},{"name":"Attribution"},{"name":"ActionBar"},{"name":"QuoteCard"},{"name":"ProvenancePanel"},{"name":"LifecycleSteps"},{"name":"ShareCard"},{"name":"AuthorHeader"},{"name":"ProfileHeader"},{"name":"ContributionRow"},{"name":"DataTable"},{"name":"StatCard"},{"name":"ReleaseSummary"},{"name":"ReviewDecision"},{"name":"MatchCompare"}]} */
var QotmKit = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: !0 });
  }, __copyProps = (to, from, except, desc) => {
    if (from && typeof from == "object" || typeof from == "function")
      for (let key of __getOwnPropNames(from))
        !__hasOwnProp.call(to, key) && key !== except && __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: !0 }), mod);

  // ../src/index.js
  var src_exports = {};
  __export(src_exports, {
    ActionBar: () => ActionBar,
    Attribution: () => Attribution,
    AuthorHeader: () => AuthorHeader,
    Avatar: () => Avatar,
    Badge: () => Badge,
    Breadcrumbs: () => Breadcrumbs,
    Button: () => Button,
    Card: () => Card,
    Checkbox: () => Checkbox,
    CommandBlock: () => CommandBlock,
    ContributionRow: () => ContributionRow,
    Cursor: () => Cursor,
    DataTable: () => DataTable,
    Dialog: () => Dialog,
    Divider: () => Divider,
    EmptyState: () => EmptyState,
    Eyebrow: () => Eyebrow,
    Field: () => Field,
    IconButton: () => IconButton,
    Input: () => Input,
    InstallPill: () => InstallPill,
    Kbd: () => Kbd,
    LifecycleSteps: () => LifecycleSteps,
    Link: () => Link,
    Logo: () => Logo,
    MatchCompare: () => MatchCompare,
    Menu: () => Menu,
    Notice: () => Notice,
    Pagination: () => Pagination,
    ProfileHeader: () => ProfileHeader,
    Prompt: () => Prompt,
    ProvenancePanel: () => ProvenancePanel,
    QuoteBlock: () => QuoteBlock,
    QuoteCard: () => QuoteCard,
    RadioGroup: () => RadioGroup,
    ReleaseSummary: () => ReleaseSummary,
    ReviewDecision: () => ReviewDecision,
    STATUSES: () => STATUSES,
    SearchField: () => SearchField,
    Select: () => Select,
    ShareCard: () => ShareCard,
    SideNav: () => SideNav,
    SiteFooter: () => SiteFooter,
    SiteHeader: () => SiteHeader,
    Skeleton: () => Skeleton,
    StatCard: () => StatCard,
    StatusBadge: () => StatusBadge,
    Swatch: () => Swatch,
    Switch: () => Switch,
    TRACKS: () => TRACKS,
    Tabs: () => Tabs,
    Terminal: () => Terminal,
    Textarea: () => Textarea,
    Tile: () => Tile,
    Toast: () => Toast,
    TopicPicker: () => TopicPicker,
    TopicTag: () => TopicTag
  });

  // ../src/_react.js
  var R = window.React, react_default = R, useState = R.useState, useEffect = R.useEffect, useRef = R.useRef, useId = R.useId, Fragment = R.Fragment;

  // ../src/_util.js
  var cx = (...a) => a.filter(Boolean).join(" "), g = (c) => c + "\uFE0E", fmt = (n) => typeof n == "number" ? n.toLocaleString("en-US") : n;

  // ../src/svg/qotm-symbol.svg
  var qotm_symbol_default = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="24.00 24.00 208.00 236.00"><path fill-rule="nonzero" fill="%23111111" d="M 166.00 100.00 A 66.00 66.00 0 1 1 34.00 100.00 A 66.00 66.00 0 1 1 166.00 100.00 Z M 136.00 100.00 A 36.00 36.00 0 1 0 64.00 100.00 A 36.00 36.00 0 1 0 136.00 100.00 Z M 136.00 34.00 L 166.00 34.00 L 166.00 240.00 L 136.00 240.00 Z M 151.00 210.00 L 197.00 210.00 A 15.00 15.00 0 0 1 212.00 225.00 L 212.00 225.00 A 15.00 15.00 0 0 1 197.00 240.00 L 151.00 240.00 A 15.00 15.00 0 0 1 136.00 225.00 L 136.00 225.00 A 15.00 15.00 0 0 1 151.00 210.00 Z"></path></svg>';

  // ../src/svg/qotm-symbol-white.svg
  var qotm_symbol_white_default = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="24.00 24.00 208.00 236.00"><path fill-rule="nonzero" fill="%23FFFFFF" d="M 166.00 100.00 A 66.00 66.00 0 1 1 34.00 100.00 A 66.00 66.00 0 1 1 166.00 100.00 Z M 136.00 100.00 A 36.00 36.00 0 1 0 64.00 100.00 A 36.00 36.00 0 1 0 136.00 100.00 Z M 136.00 34.00 L 166.00 34.00 L 166.00 240.00 L 136.00 240.00 Z M 151.00 210.00 L 197.00 210.00 A 15.00 15.00 0 0 1 212.00 225.00 L 212.00 225.00 A 15.00 15.00 0 0 1 197.00 240.00 L 151.00 240.00 A 15.00 15.00 0 0 1 136.00 225.00 L 136.00 225.00 A 15.00 15.00 0 0 1 151.00 210.00 Z"></path></svg>';

  // ../src/svg/qotm-wordmark.svg
  var qotm_wordmark_default = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8.00 -12.00 400.00 170.00"><path transform="translate(-12.700,8.700) scale(0.55000)" fill-rule="nonzero" fill="%23111111" d="M 166.00 100.00 A 66.00 66.00 0 1 1 34.00 100.00 A 66.00 66.00 0 1 1 166.00 100.00 Z M 140.00 100.00 A 40.00 40.00 0 1 0 60.00 100.00 A 40.00 40.00 0 1 0 140.00 100.00 Z M 140.00 34.00 L 166.00 34.00 L 166.00 220.00 L 140.00 220.00 Z"></path><g fill="%23111111"><path transform="translate(88.600,100.000) scale(0.14938,-0.14938)" d="M307 -14Q233 -14 175.5 16.5Q118 47 85.0 104.0Q52 161 52 239V254Q52 332 85.0 388.5Q118 445 175.5 476.0Q233 507 307 507Q381 507 439.0 476.0Q497 445 530.0 388.5Q563 332 563 254V239Q563 161 530.0 104.0Q497 47 439.0 16.5Q381 -14 307 -14ZM307 78Q375 78 417.5 121.5Q460 165 460 242V251Q460 328 418.0 371.5Q376 415 307 415Q240 415 197.5 371.5Q155 328 155 251V242Q155 165 197.5 121.5Q240 78 307 78Z"></path><path transform="translate(178.977,100.000) scale(0.14938,-0.14938)" d="M261 0Q216 0 189.5 27.0Q163 54 163 99V406H27V493H163V656H266V493H413V406H266V117Q266 87 294 87H397V0Z"></path><path transform="translate(245.900,100.000) scale(0.14938,-0.14938)" d="M76 0V493H177V435H193Q207 461 238.0 481.0Q269 501 322 501Q377 501 410.5 478.5Q444 456 461 421H477Q494 455 526.5 478.0Q559 501 619 501Q667 501 704.0 481.5Q741 462 763.0 423.5Q785 385 785 328V0H682V320Q682 365 657.5 389.5Q633 414 588 414Q540 414 511.0 383.0Q482 352 482 294V0H379V320Q379 365 354.5 389.5Q330 414 285 414Q237 414 208.0 383.0Q179 352 179 294V0Z"></path></g></svg>';

  // ../src/svg/qotm-wordmark-white.svg
  var qotm_wordmark_white_default = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8.00 -12.00 400.00 170.00"><path transform="translate(-12.700,8.700) scale(0.55000)" fill-rule="nonzero" fill="%23FFFFFF" d="M 166.00 100.00 A 66.00 66.00 0 1 1 34.00 100.00 A 66.00 66.00 0 1 1 166.00 100.00 Z M 140.00 100.00 A 40.00 40.00 0 1 0 60.00 100.00 A 40.00 40.00 0 1 0 140.00 100.00 Z M 140.00 34.00 L 166.00 34.00 L 166.00 220.00 L 140.00 220.00 Z"></path><g fill="%23FFFFFF"><path transform="translate(88.600,100.000) scale(0.14938,-0.14938)" d="M307 -14Q233 -14 175.5 16.5Q118 47 85.0 104.0Q52 161 52 239V254Q52 332 85.0 388.5Q118 445 175.5 476.0Q233 507 307 507Q381 507 439.0 476.0Q497 445 530.0 388.5Q563 332 563 254V239Q563 161 530.0 104.0Q497 47 439.0 16.5Q381 -14 307 -14ZM307 78Q375 78 417.5 121.5Q460 165 460 242V251Q460 328 418.0 371.5Q376 415 307 415Q240 415 197.5 371.5Q155 328 155 251V242Q155 165 197.5 121.5Q240 78 307 78Z"></path><path transform="translate(178.977,100.000) scale(0.14938,-0.14938)" d="M261 0Q216 0 189.5 27.0Q163 54 163 99V406H27V493H163V656H266V493H413V406H266V117Q266 87 294 87H397V0Z"></path><path transform="translate(245.900,100.000) scale(0.14938,-0.14938)" d="M76 0V493H177V435H193Q207 461 238.0 481.0Q269 501 322 501Q377 501 410.5 478.5Q444 456 461 421H477Q494 455 526.5 478.0Q559 501 619 501Q667 501 704.0 481.5Q741 462 763.0 423.5Q785 385 785 328V0H682V320Q682 365 657.5 389.5Q633 414 588 414Q540 414 511.0 383.0Q482 352 482 294V0H379V320Q379 365 354.5 389.5Q330 414 285 414Q237 414 208.0 383.0Q179 352 179 294V0Z"></path></g></svg>';

  // ../src/svg/qotm-horizontal.svg
  var qotm_horizontal_default = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="-16.00 -16.00 558.00 176.00"><g transform="translate(-21.080,-21.080) scale(0.62)"><path fill-rule="nonzero" fill="%23111111" d="M 166.00 100.00 A 66.00 66.00 0 1 1 34.00 100.00 A 66.00 66.00 0 1 1 166.00 100.00 Z M 136.00 100.00 A 36.00 36.00 0 1 0 64.00 100.00 A 36.00 36.00 0 1 0 136.00 100.00 Z M 136.00 34.00 L 166.00 34.00 L 166.00 240.00 L 136.00 240.00 Z M 151.00 210.00 L 197.00 210.00 A 15.00 15.00 0 0 1 212.00 225.00 L 212.00 225.00 A 15.00 15.00 0 0 1 197.00 240.00 L 151.00 240.00 A 15.00 15.00 0 0 1 136.00 225.00 L 136.00 225.00 A 15.00 15.00 0 0 1 151.00 210.00 Z"></path></g><g transform="translate(146.360,-2.140) scale(1.0)"><path transform="translate(-12.700,8.700) scale(0.55000)" fill-rule="nonzero" fill="%23111111" d="M 166.00 100.00 A 66.00 66.00 0 1 1 34.00 100.00 A 66.00 66.00 0 1 1 166.00 100.00 Z M 140.00 100.00 A 40.00 40.00 0 1 0 60.00 100.00 A 40.00 40.00 0 1 0 140.00 100.00 Z M 140.00 34.00 L 166.00 34.00 L 166.00 220.00 L 140.00 220.00 Z"></path><g fill="%23111111"><path transform="translate(88.600,100.000) scale(0.14938,-0.14938)" d="M307 -14Q233 -14 175.5 16.5Q118 47 85.0 104.0Q52 161 52 239V254Q52 332 85.0 388.5Q118 445 175.5 476.0Q233 507 307 507Q381 507 439.0 476.0Q497 445 530.0 388.5Q563 332 563 254V239Q563 161 530.0 104.0Q497 47 439.0 16.5Q381 -14 307 -14ZM307 78Q375 78 417.5 121.5Q460 165 460 242V251Q460 328 418.0 371.5Q376 415 307 415Q240 415 197.5 371.5Q155 328 155 251V242Q155 165 197.5 121.5Q240 78 307 78Z"></path><path transform="translate(178.977,100.000) scale(0.14938,-0.14938)" d="M261 0Q216 0 189.5 27.0Q163 54 163 99V406H27V493H163V656H266V493H413V406H266V117Q266 87 294 87H397V0Z"></path><path transform="translate(245.900,100.000) scale(0.14938,-0.14938)" d="M76 0V493H177V435H193Q207 461 238.0 481.0Q269 501 322 501Q377 501 410.5 478.5Q444 456 461 421H477Q494 455 526.5 478.0Q559 501 619 501Q667 501 704.0 481.5Q741 462 763.0 423.5Q785 385 785 328V0H682V320Q682 365 657.5 389.5Q633 414 588 414Q540 414 511.0 383.0Q482 352 482 294V0H379V320Q379 365 354.5 389.5Q330 414 285 414Q237 414 208.0 383.0Q179 352 179 294V0Z"></path></g></g></svg>';

  // ../src/svg/qotm-horizontal-white.svg
  var qotm_horizontal_white_default = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="-16.00 -16.00 558.00 176.00"><g transform="translate(-21.080,-21.080) scale(0.62)"><path fill-rule="nonzero" fill="%23FFFFFF" d="M 166.00 100.00 A 66.00 66.00 0 1 1 34.00 100.00 A 66.00 66.00 0 1 1 166.00 100.00 Z M 136.00 100.00 A 36.00 36.00 0 1 0 64.00 100.00 A 36.00 36.00 0 1 0 136.00 100.00 Z M 136.00 34.00 L 166.00 34.00 L 166.00 240.00 L 136.00 240.00 Z M 151.00 210.00 L 197.00 210.00 A 15.00 15.00 0 0 1 212.00 225.00 L 212.00 225.00 A 15.00 15.00 0 0 1 197.00 240.00 L 151.00 240.00 A 15.00 15.00 0 0 1 136.00 225.00 L 136.00 225.00 A 15.00 15.00 0 0 1 151.00 210.00 Z"></path></g><g transform="translate(146.360,-2.140) scale(1.0)"><path transform="translate(-12.700,8.700) scale(0.55000)" fill-rule="nonzero" fill="%23FFFFFF" d="M 166.00 100.00 A 66.00 66.00 0 1 1 34.00 100.00 A 66.00 66.00 0 1 1 166.00 100.00 Z M 140.00 100.00 A 40.00 40.00 0 1 0 60.00 100.00 A 40.00 40.00 0 1 0 140.00 100.00 Z M 140.00 34.00 L 166.00 34.00 L 166.00 220.00 L 140.00 220.00 Z"></path><g fill="%23FFFFFF"><path transform="translate(88.600,100.000) scale(0.14938,-0.14938)" d="M307 -14Q233 -14 175.5 16.5Q118 47 85.0 104.0Q52 161 52 239V254Q52 332 85.0 388.5Q118 445 175.5 476.0Q233 507 307 507Q381 507 439.0 476.0Q497 445 530.0 388.5Q563 332 563 254V239Q563 161 530.0 104.0Q497 47 439.0 16.5Q381 -14 307 -14ZM307 78Q375 78 417.5 121.5Q460 165 460 242V251Q460 328 418.0 371.5Q376 415 307 415Q240 415 197.5 371.5Q155 328 155 251V242Q155 165 197.5 121.5Q240 78 307 78Z"></path><path transform="translate(178.977,100.000) scale(0.14938,-0.14938)" d="M261 0Q216 0 189.5 27.0Q163 54 163 99V406H27V493H163V656H266V493H413V406H266V117Q266 87 294 87H397V0Z"></path><path transform="translate(245.900,100.000) scale(0.14938,-0.14938)" d="M76 0V493H177V435H193Q207 461 238.0 481.0Q269 501 322 501Q377 501 410.5 478.5Q444 456 461 421H477Q494 455 526.5 478.0Q559 501 619 501Q667 501 704.0 481.5Q741 462 763.0 423.5Q785 385 785 328V0H682V320Q682 365 657.5 389.5Q633 414 588 414Q540 414 511.0 383.0Q482 352 482 294V0H379V320Q379 365 354.5 389.5Q330 414 285 414Q237 414 208.0 383.0Q179 352 179 294V0Z"></path></g></g></svg>';

  // ../src/svg/qotm-stacked.svg
  var qotm_stacked_default = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="-18.00 -18.00 465.00 396.00"><g transform="translate(117.290,-24.480) scale(0.72)"><path fill-rule="nonzero" fill="%23111111" d="M 166.00 100.00 A 66.00 66.00 0 1 1 34.00 100.00 A 66.00 66.00 0 1 1 166.00 100.00 Z M 136.00 100.00 A 36.00 36.00 0 1 0 64.00 100.00 A 36.00 36.00 0 1 0 136.00 100.00 Z M 136.00 34.00 L 166.00 34.00 L 166.00 240.00 L 136.00 240.00 Z M 151.00 210.00 L 197.00 210.00 A 15.00 15.00 0 0 1 212.00 225.00 L 212.00 225.00 A 15.00 15.00 0 0 1 197.00 240.00 L 151.00 240.00 A 15.00 15.00 0 0 1 136.00 225.00 L 136.00 225.00 A 15.00 15.00 0 0 1 151.00 210.00 Z"></path></g><g transform="translate(-6.900,192.020) scale(1.15)"><path transform="translate(-12.700,8.700) scale(0.55000)" fill-rule="nonzero" fill="%23111111" d="M 166.00 100.00 A 66.00 66.00 0 1 1 34.00 100.00 A 66.00 66.00 0 1 1 166.00 100.00 Z M 140.00 100.00 A 40.00 40.00 0 1 0 60.00 100.00 A 40.00 40.00 0 1 0 140.00 100.00 Z M 140.00 34.00 L 166.00 34.00 L 166.00 220.00 L 140.00 220.00 Z"></path><g fill="%23111111"><path transform="translate(88.600,100.000) scale(0.14938,-0.14938)" d="M307 -14Q233 -14 175.5 16.5Q118 47 85.0 104.0Q52 161 52 239V254Q52 332 85.0 388.5Q118 445 175.5 476.0Q233 507 307 507Q381 507 439.0 476.0Q497 445 530.0 388.5Q563 332 563 254V239Q563 161 530.0 104.0Q497 47 439.0 16.5Q381 -14 307 -14ZM307 78Q375 78 417.5 121.5Q460 165 460 242V251Q460 328 418.0 371.5Q376 415 307 415Q240 415 197.5 371.5Q155 328 155 251V242Q155 165 197.5 121.5Q240 78 307 78Z"></path><path transform="translate(178.977,100.000) scale(0.14938,-0.14938)" d="M261 0Q216 0 189.5 27.0Q163 54 163 99V406H27V493H163V656H266V493H413V406H266V117Q266 87 294 87H397V0Z"></path><path transform="translate(245.900,100.000) scale(0.14938,-0.14938)" d="M76 0V493H177V435H193Q207 461 238.0 481.0Q269 501 322 501Q377 501 410.5 478.5Q444 456 461 421H477Q494 455 526.5 478.0Q559 501 619 501Q667 501 704.0 481.5Q741 462 763.0 423.5Q785 385 785 328V0H682V320Q682 365 657.5 389.5Q633 414 588 414Q540 414 511.0 383.0Q482 352 482 294V0H379V320Q379 365 354.5 389.5Q330 414 285 414Q237 414 208.0 383.0Q179 352 179 294V0Z"></path></g></g></svg>';

  // ../src/svg/qotm-stacked-white.svg
  var qotm_stacked_white_default = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="-18.00 -18.00 465.00 396.00"><g transform="translate(117.290,-24.480) scale(0.72)"><path fill-rule="nonzero" fill="%23FFFFFF" d="M 166.00 100.00 A 66.00 66.00 0 1 1 34.00 100.00 A 66.00 66.00 0 1 1 166.00 100.00 Z M 136.00 100.00 A 36.00 36.00 0 1 0 64.00 100.00 A 36.00 36.00 0 1 0 136.00 100.00 Z M 136.00 34.00 L 166.00 34.00 L 166.00 240.00 L 136.00 240.00 Z M 151.00 210.00 L 197.00 210.00 A 15.00 15.00 0 0 1 212.00 225.00 L 212.00 225.00 A 15.00 15.00 0 0 1 197.00 240.00 L 151.00 240.00 A 15.00 15.00 0 0 1 136.00 225.00 L 136.00 225.00 A 15.00 15.00 0 0 1 151.00 210.00 Z"></path></g><g transform="translate(-6.900,192.020) scale(1.15)"><path transform="translate(-12.700,8.700) scale(0.55000)" fill-rule="nonzero" fill="%23FFFFFF" d="M 166.00 100.00 A 66.00 66.00 0 1 1 34.00 100.00 A 66.00 66.00 0 1 1 166.00 100.00 Z M 140.00 100.00 A 40.00 40.00 0 1 0 60.00 100.00 A 40.00 40.00 0 1 0 140.00 100.00 Z M 140.00 34.00 L 166.00 34.00 L 166.00 220.00 L 140.00 220.00 Z"></path><g fill="%23FFFFFF"><path transform="translate(88.600,100.000) scale(0.14938,-0.14938)" d="M307 -14Q233 -14 175.5 16.5Q118 47 85.0 104.0Q52 161 52 239V254Q52 332 85.0 388.5Q118 445 175.5 476.0Q233 507 307 507Q381 507 439.0 476.0Q497 445 530.0 388.5Q563 332 563 254V239Q563 161 530.0 104.0Q497 47 439.0 16.5Q381 -14 307 -14ZM307 78Q375 78 417.5 121.5Q460 165 460 242V251Q460 328 418.0 371.5Q376 415 307 415Q240 415 197.5 371.5Q155 328 155 251V242Q155 165 197.5 121.5Q240 78 307 78Z"></path><path transform="translate(178.977,100.000) scale(0.14938,-0.14938)" d="M261 0Q216 0 189.5 27.0Q163 54 163 99V406H27V493H163V656H266V493H413V406H266V117Q266 87 294 87H397V0Z"></path><path transform="translate(245.900,100.000) scale(0.14938,-0.14938)" d="M76 0V493H177V435H193Q207 461 238.0 481.0Q269 501 322 501Q377 501 410.5 478.5Q444 456 461 421H477Q494 455 526.5 478.0Q559 501 619 501Q667 501 704.0 481.5Q741 462 763.0 423.5Q785 385 785 328V0H682V320Q682 365 657.5 389.5Q633 414 588 414Q540 414 511.0 383.0Q482 352 482 294V0H379V320Q379 365 354.5 389.5Q330 414 285 414Q237 414 208.0 383.0Q179 352 179 294V0Z"></path></g></g></svg>';

  // ../src/svg/divider.svg
  var divider_default = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 24"><line x1="0" y1="12" x2="250" y2="12" stroke="%23DAD7D0" stroke-width="2"></line><path d="M294 6 L306 12 L294 18" fill="none" stroke="%236E6A64" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"></path><circle cx="330" cy="12" r="4" fill="%23B85C3E"></circle><path d="M354 6 L366 12 L354 18" fill="none" stroke="%236E6A64" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"></path><line x1="410" y1="12" x2="660" y2="12" stroke="%23DAD7D0" stroke-width="2"></line></svg>';

  // ../src/svg/between-commands.svg
  var between_commands_default = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 60"><path d="M41 19 L63 30 L41 41" fill="none" stroke="%23141210" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"></path><circle cx="130" cy="30" r="7" fill="%23B85C3E"></circle><path d="M197 19 L219 30 L197 41" fill="none" stroke="%23141210" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"></path></svg>';

  // ../src/core.jsx
  function Button({ children, variant = "solid", size = "md", mono = !1, pill = !1, block = !1, disabled = !1, type = "button", className, ...rest }) {
    return /* @__PURE__ */ react_default.createElement("button", { type, disabled, className: cx("qk-btn", "qk-btn--" + variant, "qk-btn--" + size, mono && "qk-btn--mono", pill && "qk-btn--pill", block && "qk-btn--block", className), ...rest }, children);
  }
  function IconButton({ glyph = "\u276F", label, size = "md", variant = "outline", pressed, disabled = !1, className, ...rest }) {
    return /* @__PURE__ */ react_default.createElement("button", { type: "button", "aria-label": label, title: label, "aria-pressed": pressed, disabled, className: cx("qk-iconbtn", "qk-iconbtn--" + variant, "qk-iconbtn--" + size, className), ...rest }, g(glyph));
  }
  function Link({ children, href = "#", variant = "default", mono = !1, className, ...rest }) {
    return /* @__PURE__ */ react_default.createElement("a", { href, className: cx("qk-link", variant === "quiet" && "qk-link--quiet", mono && "qk-link--mono", className), ...rest }, children);
  }
  function Badge({ children, tone = "neutral", uppercase = !1, className, ...rest }) {
    return /* @__PURE__ */ react_default.createElement("span", { className: cx("qk-badge", "qk-badge--" + tone, uppercase && "qk-badge--upper", className), ...rest }, children);
  }
  function Eyebrow({ children, tone = "muted", as: Tag = "p", className, ...rest }) {
    return /* @__PURE__ */ react_default.createElement(Tag, { className: cx("qk-eyebrow", "qk-eyebrow--" + tone, className), ...rest }, children);
  }
  function Divider({ variant = "rule", gap = "var(--qotm-space-8)", style, ...rest }) {
    return variant === "graphic" ? /* @__PURE__ */ react_default.createElement("img", { src: divider_default, alt: "", className: "qk-divider-img", style: { margin: gap + " 0", ...style }, ...rest }) : variant === "mark" ? /* @__PURE__ */ react_default.createElement("img", { src: between_commands_default, alt: "", className: "qk-divider-mark", style: { margin: gap + " auto", ...style }, ...rest }) : /* @__PURE__ */ react_default.createElement("hr", { className: "qk-divider", style: { margin: gap + " 0", ...style }, ...rest });
  }
  var LOGOS = { symbol: [qotm_symbol_default, qotm_symbol_white_default], wordmark: [qotm_wordmark_default, qotm_wordmark_white_default], horizontal: [qotm_horizontal_default, qotm_horizontal_white_default], stacked: [qotm_stacked_default, qotm_stacked_white_default] };
  function Logo({ lockup = "horizontal", reversed = !1, height = 32, className, style, ...rest }) {
    let pair = LOGOS[lockup] || LOGOS.horizontal;
    return /* @__PURE__ */ react_default.createElement("img", { src: pair[reversed ? 1 : 0], alt: "qotm", className: cx("qk-logo", className), style: { height, ...style }, ...rest });
  }
  function Kbd({ children, onDark = !1, className, ...rest }) {
    return /* @__PURE__ */ react_default.createElement("kbd", { className: cx("qk-kbd", onDark && "qk-kbd--dark", className), ...rest }, children);
  }
  function Avatar({ name = "", handle, src, size = 32, className, style, ...rest }) {
    let base = (handle || name || "?").replace(/^@/, ""), initials = name ? name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("") : base.slice(0, 2);
    return /* @__PURE__ */ react_default.createElement("span", { className: cx("qk-avatar", className), style: { width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)), ...style }, "aria-label": name || handle, role: "img", ...rest }, src ? /* @__PURE__ */ react_default.createElement("img", { src, alt: "" }) : initials.toLowerCase());
  }

  // ../src/brand.jsx
  function Terminal({ children, title, shadow = !0, className, bodyClassName, ...rest }) {
    return /* @__PURE__ */ react_default.createElement("div", { className: cx("qk-term", !shadow && "qk-term--flat", className), ...rest }, /* @__PURE__ */ react_default.createElement("div", { className: "qk-term__bar" }, /* @__PURE__ */ react_default.createElement("i", null), /* @__PURE__ */ react_default.createElement("i", null), /* @__PURE__ */ react_default.createElement("i", null), title ? /* @__PURE__ */ react_default.createElement("span", { className: "qk-term__title" }, title) : null), /* @__PURE__ */ react_default.createElement("div", { className: cx("qk-term__body", bodyClassName) }, children));
  }
  function Prompt({ children = "~ >" }) {
    return /* @__PURE__ */ react_default.createElement("span", { className: "qk-prompt" }, children);
  }
  function Cursor({ className, ...rest }) {
    return /* @__PURE__ */ react_default.createElement("span", { "aria-hidden": "true", className: cx("qk-cursor", className), ...rest });
  }
  function QuoteBlock({ quote, author, cite, size = "md", onDark = !1, quoted = !0, className, ...rest }) {
    return /* @__PURE__ */ react_default.createElement("figure", { className: cx("qk-quote", "qk-quote--" + size, onDark && "qk-quote--dark", className), ...rest }, /* @__PURE__ */ react_default.createElement("blockquote", null, quoted ? "\u201C" + quote + "\u201D" : quote), author ? /* @__PURE__ */ react_default.createElement("figcaption", null, "\u2014 " + author, cite ? /* @__PURE__ */ react_default.createElement("span", { className: "qk-quote__cite" }, " \xB7 " + cite) : null) : null);
  }
  function useCopy(text) {
    let [copied, setCopied] = useState(!1);
    return [copied, () => {
      try {
        navigator.clipboard && navigator.clipboard.writeText(text);
      } catch {
      }
      setCopied(!0), setTimeout(() => setCopied(!1), 1400);
    }];
  }
  function InstallPill({ command = "npm i -g qotm", glyph = "$", copyable = !1, onDark = !1, className, ...rest }) {
    let [copied, copy] = useCopy(command);
    return /* @__PURE__ */ react_default.createElement(copyable ? "button" : "span", { type: copyable ? "button" : void 0, onClick: copyable ? copy : void 0, className: cx("qk-pill", copyable && "qk-pill--copy", onDark && "qk-pill--dark", className), ...rest }, /* @__PURE__ */ react_default.createElement("span", { className: "qk-pill__glyph" }, glyph), /* @__PURE__ */ react_default.createElement("span", null, command), copyable ? /* @__PURE__ */ react_default.createElement("span", { className: "qk-pill__hint", "aria-live": "polite" }, copied ? "copied" : "copy") : null);
  }
  function CommandBlock({ command, caption, glyph = "$", tone = "dark", className, ...rest }) {
    let [copied, copy] = useCopy(command);
    return /* @__PURE__ */ react_default.createElement("div", { className: cx("qk-cmd", "qk-cmd--" + tone, className), ...rest }, caption ? /* @__PURE__ */ react_default.createElement("div", { className: "qk-cmd__caption" }, caption) : null, /* @__PURE__ */ react_default.createElement("div", { className: "qk-cmd__row" }, /* @__PURE__ */ react_default.createElement("code", null, /* @__PURE__ */ react_default.createElement("span", { className: "qk-cmd__glyph" }, glyph), " ", command), /* @__PURE__ */ react_default.createElement("button", { type: "button", className: "qk-cmd__copy", onClick: copy, "aria-live": "polite" }, copied ? "copied" : "copy")));
  }
  function Swatch({ name, hex, use, height = 78, className, ...rest }) {
    return /* @__PURE__ */ react_default.createElement("div", { className: cx("qk-swatch", className), ...rest }, /* @__PURE__ */ react_default.createElement("div", { className: "qk-swatch__chip", style: { height, background: hex } }), /* @__PURE__ */ react_default.createElement("div", { className: "qk-swatch__meta" }, /* @__PURE__ */ react_default.createElement("span", { className: "qk-swatch__name" }, name), " ", /* @__PURE__ */ react_default.createElement("span", null, hex), use ? /* @__PURE__ */ react_default.createElement("span", { className: "qk-swatch__use" }, use) : null));
  }

  // ../src/forms.jsx
  function Field({ label, hint, error, required = !1, optional = !1, htmlFor, count, className, children, ...rest }) {
    return /* @__PURE__ */ react_default.createElement("div", { className: cx("qk-field", error && "qk-field--error", className), ...rest }, label ? /* @__PURE__ */ react_default.createElement("label", { className: "qk-field__label", htmlFor }, label, required ? /* @__PURE__ */ react_default.createElement("span", { className: "qk-field__req" }, " required") : null, optional ? /* @__PURE__ */ react_default.createElement("span", { className: "qk-field__opt" }, " optional") : null, count ? /* @__PURE__ */ react_default.createElement("span", { className: "qk-field__count" }, count) : null) : null, children, error ? /* @__PURE__ */ react_default.createElement("span", { className: "qk-field__msg qk-field__msg--error" }, "\xD7 " + error) : hint ? /* @__PURE__ */ react_default.createElement("span", { className: "qk-field__msg" }, hint) : null);
  }
  function Input({ label, hint, error, required, optional, mono = !1, size = "md", id, className, ...rest }) {
    let auto = useId(), fid = id || auto;
    return /* @__PURE__ */ react_default.createElement(Field, { label, hint, error, required, optional, htmlFor: fid, className }, /* @__PURE__ */ react_default.createElement("input", { id: fid, "aria-invalid": !!error, className: cx("qk-control", mono && "qk-control--mono", size === "sm" && "qk-control--sm"), ...rest }));
  }
  function Textarea({ label, hint, error, required, optional, rows = 4, maxLength, value, defaultValue, onChange, display = !1, id, className, ...rest }) {
    let auto = useId(), fid = id || auto, [inner, setInner] = useState(defaultValue || ""), v = value !== void 0 ? value : inner;
    return /* @__PURE__ */ react_default.createElement(Field, { label, hint, error, required, optional, htmlFor: fid, className, count: maxLength ? (v || "").length + " / " + maxLength : null }, /* @__PURE__ */ react_default.createElement("textarea", { id: fid, rows, maxLength, value: v, "aria-invalid": !!error, onChange: (e) => {
      setInner(e.target.value), onChange && onChange(e);
    }, className: cx("qk-control", "qk-textarea", display && "qk-textarea--display"), ...rest }));
  }
  function Select({ label, hint, error, required, optional, options = [], size = "md", id, className, ...rest }) {
    let auto = useId(), fid = id || auto;
    return /* @__PURE__ */ react_default.createElement(Field, { label, hint, error, required, optional, htmlFor: fid, className }, /* @__PURE__ */ react_default.createElement("span", { className: "qk-select" }, /* @__PURE__ */ react_default.createElement("select", { id: fid, className: cx("qk-control", size === "sm" && "qk-control--sm"), ...rest }, options.map((o) => {
      let val = typeof o == "string" ? o : o.value, lab = typeof o == "string" ? o : o.label;
      return /* @__PURE__ */ react_default.createElement("option", { key: val, value: val }, lab);
    })), /* @__PURE__ */ react_default.createElement("span", { "aria-hidden": "true", className: "qk-select__caret" }, "\u2304")));
  }
  function Checkbox({ label, description, className, ...rest }) {
    return /* @__PURE__ */ react_default.createElement("label", { className: cx("qk-check", className) }, /* @__PURE__ */ react_default.createElement("input", { type: "checkbox", ...rest }), /* @__PURE__ */ react_default.createElement("span", { "aria-hidden": "true", className: "qk-check__box" }, "\u2713"), /* @__PURE__ */ react_default.createElement("span", { className: "qk-check__text" }, label, description ? /* @__PURE__ */ react_default.createElement("span", { className: "qk-check__desc" }, description) : null));
  }
  function RadioGroup({ label, name, options = [], value, defaultValue, onChange, variant = "list", className, ...rest }) {
    let auto = useId(), nm = name || auto, [inner, setInner] = useState(defaultValue), cur = value !== void 0 ? value : inner;
    return /* @__PURE__ */ react_default.createElement("fieldset", { className: cx("qk-radios", "qk-radios--" + variant, className), ...rest }, label ? /* @__PURE__ */ react_default.createElement("legend", { className: "qk-field__label" }, label) : null, options.map((o) => /* @__PURE__ */ react_default.createElement("label", { key: o.value, className: cx("qk-radio", cur === o.value && "is-checked", o.disabled && "is-disabled") }, /* @__PURE__ */ react_default.createElement("input", { type: "radio", name: nm, value: o.value, checked: cur === o.value, disabled: o.disabled, onChange: () => {
      setInner(o.value), onChange && onChange(o.value);
    } }), /* @__PURE__ */ react_default.createElement("span", { "aria-hidden": "true", className: "qk-radio__dot" }), /* @__PURE__ */ react_default.createElement("span", { className: "qk-radio__text" }, /* @__PURE__ */ react_default.createElement("span", { className: "qk-radio__label" }, o.label), o.description ? /* @__PURE__ */ react_default.createElement("span", { className: "qk-radio__desc" }, o.description) : null))));
  }
  function Switch({ label, description, className, ...rest }) {
    return /* @__PURE__ */ react_default.createElement("label", { className: cx("qk-switch", className) }, /* @__PURE__ */ react_default.createElement("input", { type: "checkbox", role: "switch", ...rest }), /* @__PURE__ */ react_default.createElement("span", { "aria-hidden": "true", className: "qk-switch__track" }, /* @__PURE__ */ react_default.createElement("span", { className: "qk-switch__knob" })), /* @__PURE__ */ react_default.createElement("span", { className: "qk-check__text" }, label, description ? /* @__PURE__ */ react_default.createElement("span", { className: "qk-check__desc" }, description) : null));
  }
  function SearchField({ placeholder = "Search quotes, authors, topics", shortcut = "/", size = "md", onSubmit, className, ...rest }) {
    return /* @__PURE__ */ react_default.createElement("form", { role: "search", className: cx("qk-search", size === "sm" && "qk-search--sm", className), onSubmit: (e) => {
      e.preventDefault(), onSubmit && onSubmit(e.currentTarget.q.value);
    } }, /* @__PURE__ */ react_default.createElement("span", { "aria-hidden": "true", className: "qk-search__glyph" }, "\u276F"), /* @__PURE__ */ react_default.createElement("input", { name: "q", type: "search", placeholder, "aria-label": "Search", ...rest }), shortcut ? /* @__PURE__ */ react_default.createElement(Kbd, null, shortcut) : null);
  }
  function TopicPicker({ label = "Topics", topics = [], value, defaultValue = [], onChange, max = 3, hint, className }) {
    let [inner, setInner] = useState(defaultValue), sel = value !== void 0 ? value : inner, toggle = (t) => {
      let on = sel.includes(t);
      if (!on && sel.length >= max) return;
      let next = on ? sel.filter((x) => x !== t) : sel.concat(t);
      setInner(next), onChange && onChange(next);
    };
    return /* @__PURE__ */ react_default.createElement(Field, { label, count: sel.length + " / " + max, hint: hint || "Pick up to " + max + " from the qotm taxonomy.", className }, /* @__PURE__ */ react_default.createElement("div", { className: "qk-topicpick", role: "group", "aria-label": label }, topics.map((t) => {
      let id = typeof t == "string" ? t : t.slug, lab = typeof t == "string" ? t : t.label, on = sel.includes(id);
      return /* @__PURE__ */ react_default.createElement("button", { key: id, type: "button", "aria-pressed": on, disabled: !on && sel.length >= max, className: cx("qk-topic", on && "is-on"), onClick: () => toggle(id) }, on ? g("\u2713") + " " : "", lab);
    })));
  }

  // ../src/navigation.jsx
  var norm = (it) => typeof it == "string" ? { id: it, label: it, href: "#" + it } : { href: "#" + it.id, ...it };
  function SiteHeader({ items = [], active, onSelect, search, actions, children, sticky = !1, wide = !1, dark = !1, className, ...rest }) {
    return /* @__PURE__ */ react_default.createElement("header", { className: cx("qk-header", sticky && "qk-header--sticky", dark && "qk-header--dark", className), ...rest }, /* @__PURE__ */ react_default.createElement("div", { className: cx("qk-header__in", wide && "qk-header__in--wide") }, /* @__PURE__ */ react_default.createElement("a", { href: "/", className: "qk-header__brand", "aria-label": "qotm home" }, /* @__PURE__ */ react_default.createElement(Logo, { lockup: "symbol", height: 24, reversed: dark }), /* @__PURE__ */ react_default.createElement("b", null, "qotm")), /* @__PURE__ */ react_default.createElement("nav", { className: "qk-header__nav", "aria-label": "Primary" }, items.map(norm).map((it) => /* @__PURE__ */ react_default.createElement("a", { key: it.id, href: it.href, "aria-current": active === it.id ? "page" : void 0, className: cx("qk-navlink", active === it.id && "is-active"), onClick: (e) => {
      onSelect && (e.preventDefault(), onSelect(it.id));
    } }, it.label))), /* @__PURE__ */ react_default.createElement("div", { className: "qk-header__end" }, search, actions, children)));
  }
  function SiteFooter({ columns = [], tagline = "A thought between commands.", note = "MIT \xB7 github.com/wesscoby/qotm", children, wide = !1, className, ...rest }) {
    return /* @__PURE__ */ react_default.createElement("footer", { className: cx("qk-footer", className), ...rest }, /* @__PURE__ */ react_default.createElement("div", { className: cx("qk-footer__in", wide && "qk-header__in--wide") }, /* @__PURE__ */ react_default.createElement("div", { className: "qk-footer__brand" }, /* @__PURE__ */ react_default.createElement(Logo, { lockup: "symbol", height: 22 }), /* @__PURE__ */ react_default.createElement("div", null, /* @__PURE__ */ react_default.createElement("b", null, "qotm"), /* @__PURE__ */ react_default.createElement("p", null, tagline))), /* @__PURE__ */ react_default.createElement("div", { className: "qk-footer__cols" }, columns.map((c) => /* @__PURE__ */ react_default.createElement("div", { key: c.title, className: "qk-footer__col" }, /* @__PURE__ */ react_default.createElement("h4", null, c.title), c.links.map((l) => {
      let x = norm(l);
      return /* @__PURE__ */ react_default.createElement("a", { key: x.id, href: x.href }, x.label);
    })))), children, /* @__PURE__ */ react_default.createElement("div", { className: "qk-footer__note" }, note)));
  }
  function Tabs({ items = [], active, onSelect, dark = !1, className, ...rest }) {
    return /* @__PURE__ */ react_default.createElement("div", { role: "tablist", className: cx("qk-tabs", dark && "qk-tabs--dark", className), ...rest }, items.map((raw) => {
      let it = norm(raw), inner = /* @__PURE__ */ react_default.createElement(react_default.Fragment, null, it.label, it.count != null ? /* @__PURE__ */ react_default.createElement("span", { className: "qk-tab__count" }, it.count) : null);
      return typeof raw == "object" && raw.href ? /* @__PURE__ */ react_default.createElement("a", { key: it.id, href: raw.href, role: "tab", "aria-selected": active === it.id, "aria-current": active === it.id ? "page" : void 0, className: cx("qk-tab", active === it.id && "is-active") }, inner) : /* @__PURE__ */ react_default.createElement("button", { key: it.id, type: "button", role: "tab", "aria-selected": active === it.id, className: cx("qk-tab", active === it.id && "is-active"), onClick: () => onSelect && onSelect(it.id) }, inner);
    }));
  }
  function Pagination({ page = 1, pageSize = 25, total = 0, onPage, mode = "pages", loading = !1, className }) {
    if (mode === "more")
      return /* @__PURE__ */ react_default.createElement("div", { className: cx("qk-pager", "qk-pager--more", className) }, /* @__PURE__ */ react_default.createElement("button", { type: "button", className: "qk-btn qk-btn--outline qk-btn--md qk-btn--mono", disabled: loading, onClick: () => onPage && onPage(page + 1) }, loading ? "loading\u2026" : "load more"));
    let from = total ? (page - 1) * pageSize + 1 : 0, to = Math.min(total, page * pageSize), last = Math.max(1, Math.ceil(total / pageSize));
    return /* @__PURE__ */ react_default.createElement("nav", { className: cx("qk-pager", className), "aria-label": "Pagination" }, /* @__PURE__ */ react_default.createElement("span", { className: "qk-pager__range" }, from.toLocaleString("en-US"), "\u2013", to.toLocaleString("en-US"), " of ", total.toLocaleString("en-US")), /* @__PURE__ */ react_default.createElement("span", { className: "qk-pager__btns" }, /* @__PURE__ */ react_default.createElement("button", { type: "button", disabled: page <= 1, onClick: () => onPage && onPage(page - 1) }, "\u2190 prev"), /* @__PURE__ */ react_default.createElement("span", { className: "qk-pager__page" }, page, " / ", last), /* @__PURE__ */ react_default.createElement("button", { type: "button", disabled: page >= last, onClick: () => onPage && onPage(page + 1) }, "next \u2192")));
  }
  function Breadcrumbs({ items = [], className }) {
    return /* @__PURE__ */ react_default.createElement("nav", { "aria-label": "Breadcrumb", className: cx("qk-crumbs", className) }, items.map((it, i) => {
      let x = typeof it == "string" ? { label: it } : it, last = i === items.length - 1;
      return /* @__PURE__ */ react_default.createElement("span", { key: i, className: "qk-crumbs__item" }, last || !x.href ? /* @__PURE__ */ react_default.createElement("span", { "aria-current": last ? "page" : void 0 }, x.label) : /* @__PURE__ */ react_default.createElement("a", { href: x.href }, x.label), last ? null : /* @__PURE__ */ react_default.createElement("span", { className: "qk-crumbs__sep", "aria-hidden": "true" }, "/"));
    }));
  }
  function SideNav({ sections = [], active, onSelect, className, ...rest }) {
    return /* @__PURE__ */ react_default.createElement("nav", { className: cx("qk-sidenav", className), ...rest }, sections.map((s, i) => /* @__PURE__ */ react_default.createElement("div", { key: i, className: "qk-sidenav__group" }, s.title ? /* @__PURE__ */ react_default.createElement("div", { className: "qk-sidenav__title" }, s.title) : null, s.items.map(norm).map((it) => /* @__PURE__ */ react_default.createElement("a", { key: it.id, href: it.href, "aria-current": active === it.id ? "page" : void 0, className: cx("qk-sidenav__item", active === it.id && "is-active"), onClick: (e) => {
      onSelect && (e.preventDefault(), onSelect(it.id));
    } }, /* @__PURE__ */ react_default.createElement("span", null, it.label), it.count != null ? /* @__PURE__ */ react_default.createElement("span", { className: cx("qk-sidenav__count", it.attention && "is-attn") }, it.count) : null)))));
  }

  // ../src/surfaces.jsx
  function Card({ children, label, title, tone = "raised", interactive = !1, padding = "md", as: Tag = "div", className, ...rest }) {
    return /* @__PURE__ */ react_default.createElement(Tag, { className: cx("qk-card", "qk-card--" + tone, interactive && "qk-card--interactive", padding === "sm" && "qk-card--pad-sm", padding === "none" && "qk-card--pad-none", className), ...rest }, label ? /* @__PURE__ */ react_default.createElement("h4", { className: "qk-card__label" }, label) : null, title ? /* @__PURE__ */ react_default.createElement("h3", { className: "qk-card__title" }, title) : null, children);
  }
  function Tile({ children, caption, dark = !1, className, ...rest }) {
    return /* @__PURE__ */ react_default.createElement("div", { className, ...rest }, /* @__PURE__ */ react_default.createElement("div", { className: cx("qk-tile", dark && "qk-tile--dark") }, children), caption ? /* @__PURE__ */ react_default.createElement("div", { className: "qk-tile__caption" }, caption) : null);
  }
  function Dialog({ open = !0, title, description, children, footer, onClose, width = 480, inline = !1, className }) {
    if (useEffect(() => {
      if (!open || inline || !onClose) return;
      let k = (e) => {
        e.key === "Escape" && onClose();
      };
      return window.addEventListener("keydown", k), () => window.removeEventListener("keydown", k);
    }, [open, inline, onClose]), !open) return null;
    let box = /* @__PURE__ */ react_default.createElement("div", { role: "dialog", "aria-modal": !inline, "aria-label": title, className: cx("qk-dialog", className), style: { width }, onClick: (e) => e.stopPropagation() }, /* @__PURE__ */ react_default.createElement("div", { className: "qk-dialog__head" }, title ? /* @__PURE__ */ react_default.createElement("h3", null, title) : null, onClose ? /* @__PURE__ */ react_default.createElement("button", { type: "button", className: "qk-dialog__x", "aria-label": "Close", onClick: onClose }, g("\u2715")) : null), description ? /* @__PURE__ */ react_default.createElement("p", { className: "qk-dialog__desc" }, description) : null, /* @__PURE__ */ react_default.createElement("div", { className: "qk-dialog__body" }, children), footer ? /* @__PURE__ */ react_default.createElement("div", { className: "qk-dialog__foot" }, footer) : null);
    return inline ? /* @__PURE__ */ react_default.createElement("div", { className: "qk-scrim qk-scrim--inline" }, box) : /* @__PURE__ */ react_default.createElement("div", { className: "qk-scrim", onClick: onClose }, box);
  }
  function Menu({ trigger, children, items = [], onSelect, align = "end", defaultOpen = !1, className }) {
    let [open, setOpen] = useState(defaultOpen), ref = useRef(null);
    return useEffect(() => {
      if (!open) return;
      let d = (e) => {
        ref.current && !ref.current.contains(e.target) && setOpen(!1);
      }, k = (e) => {
        e.key === "Escape" && setOpen(!1);
      };
      return document.addEventListener("mousedown", d), window.addEventListener("keydown", k), () => {
        document.removeEventListener("mousedown", d), window.removeEventListener("keydown", k);
      };
    }, [open]), /* @__PURE__ */ react_default.createElement("div", { ref, className: cx("qk-menu", className) }, /* @__PURE__ */ react_default.createElement("span", { onClick: () => setOpen(!open), "aria-haspopup": "menu", "aria-expanded": open }, trigger || children), open ? /* @__PURE__ */ react_default.createElement("div", { role: "menu", className: cx("qk-menu__panel", "qk-menu__panel--" + align) }, items.map((it, i) => it.divider ? /* @__PURE__ */ react_default.createElement("div", { key: i, className: "qk-menu__rule", role: "separator" }) : it.heading ? /* @__PURE__ */ react_default.createElement("div", { key: i, className: "qk-menu__heading" }, it.heading) : /* @__PURE__ */ react_default.createElement("a", { key: it.id || i, role: "menuitem", href: it.href || "#", className: cx("qk-menu__item", it.danger && "is-danger"), onClick: (e) => {
      it.href || e.preventDefault(), setOpen(!1), onSelect && onSelect(it.id);
    } }, /* @__PURE__ */ react_default.createElement("span", null, it.label), it.hint ? /* @__PURE__ */ react_default.createElement("span", { className: "qk-menu__hint" }, it.hint) : null))) : null);
  }
  function Toast({ message, action, onAction, onClose, glyph = "\u2713", floating = !1, className }) {
    return /* @__PURE__ */ react_default.createElement("div", { role: "status", className: cx("qk-toast", floating && "qk-toast--floating", className) }, glyph ? /* @__PURE__ */ react_default.createElement("span", { className: "qk-toast__glyph" }, g(glyph)) : null, /* @__PURE__ */ react_default.createElement("span", { className: "qk-toast__msg" }, message), action ? /* @__PURE__ */ react_default.createElement("button", { type: "button", className: "qk-toast__action", onClick: onAction }, action) : null, onClose ? /* @__PURE__ */ react_default.createElement("button", { type: "button", className: "qk-toast__x", "aria-label": "Dismiss", onClick: onClose }, g("\u2715")) : null);
  }
  var NOTICE_GLYPH = { info: "\u2192", wash: "\xB7", attention: "?", dark: "~ >" };
  function Notice({ tone = "info", title, children, glyph, action, className, ...rest }) {
    return /* @__PURE__ */ react_default.createElement("div", { role: "note", className: cx("qk-notice", "qk-notice--" + tone, className), ...rest }, /* @__PURE__ */ react_default.createElement("span", { "aria-hidden": "true", className: "qk-notice__glyph" }, g(glyph || NOTICE_GLYPH[tone] || "\u2192")), /* @__PURE__ */ react_default.createElement("div", { className: "qk-notice__body" }, title ? /* @__PURE__ */ react_default.createElement("strong", null, title) : null, children ? /* @__PURE__ */ react_default.createElement("div", null, children) : null), action ? /* @__PURE__ */ react_default.createElement("div", { className: "qk-notice__action" }, action) : null);
  }
  function EmptyState({ command, title, children, action, className, ...rest }) {
    return /* @__PURE__ */ react_default.createElement("div", { className: cx("qk-empty", className), ...rest }, command ? /* @__PURE__ */ react_default.createElement("code", { className: "qk-empty__cmd" }, /* @__PURE__ */ react_default.createElement("span", { className: "qk-prompt-l" }, "~ >"), " ", command) : null, title ? /* @__PURE__ */ react_default.createElement("h3", null, title) : null, children ? /* @__PURE__ */ react_default.createElement("p", null, children) : null, action ? /* @__PURE__ */ react_default.createElement("div", { className: "qk-empty__action" }, action) : null);
  }
  function Skeleton({ lines = 3, width, height = 12, block = !1, className, style }) {
    return block ? /* @__PURE__ */ react_default.createElement("div", { className: cx("qk-skel", className), style: { width: width || "100%", height, ...style }, "aria-hidden": "true" }) : /* @__PURE__ */ react_default.createElement("div", { className: cx("qk-skel-lines", className), style, "aria-busy": "true", "aria-label": "Loading" }, Array.from({ length: lines }).map((_, i) => /* @__PURE__ */ react_default.createElement("div", { key: i, className: "qk-skel", style: { height, width: i === lines - 1 ? "62%" : "100%" } })));
  }

  // ../src/svg/cursor-quote.svg
  var cursor_quote_default = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 68"><path d="M30 18 L42 18 L38 44 L26 44 Z" fill="%23B85C3E"></path><path d="M52 18 L64 18 L60 44 L48 44 Z" fill="%23B85C3E"></path><rect x="78" y="16" width="16" height="34" rx="2" fill="%23141210"></rect></svg>';

  // ../src/quotes.jsx
  var STATUSES = {
    SUBMITTED: ["submitted", "pending", "\u25CB"],
    UNDER_REVIEW: ["under review", "pending", "\u2026"],
    NEEDS_EVIDENCE: ["needs evidence", "attention", "?"],
    REJECTED: ["rejected", "negative", "\xD7"],
    VERIFIED: ["verified", "positive", "\u2713"],
    CURATION_REVIEW: ["curation review", "pending", "\u2026"],
    CURATION_CANDIDATE: ["curation candidate", "pending", "\u2191"],
    CURATED: ["curated", "curated", "\u276F"],
    DATASET_RELEASE: ["in release", "curated", "\u276F"],
    ORIGINALITY_CHECK: ["originality check", "pending", "\u2026"],
    PUBLISHED: ["published", "positive", "\u2713"],
    COMMUNITY_DISCOVERY: ["in community", "pending", "\xB7"],
    DISPUTED: ["disputed", "attention", "!"],
    WITHDRAWN: ["withdrawn", "negative", "\u2212"],
    CANONICAL: ["canonical", "neutral", ""],
    ORIGINAL: ["declared original", "neutral", ""],
    PRIVATE: ["private", "neutral", "\xB7"],
    PUBLIC: ["public", "neutral", ""],
    PERSONAL: ["personal", "neutral", ""],
    COMMUNITY: ["community", "neutral", ""],
    MEMBER: ["member", "neutral", ""],
    VERIFIER: ["verifier", "positive", ""],
    MODERATOR: ["moderator", "positive", ""],
    ADMIN: ["admin", "curated", ""]
  };
  function StatusBadge({ status, label, className, ...rest }) {
    let s = STATUSES[status] || [String(status || "").toLowerCase().replace(/_/g, " "), "neutral", ""];
    return /* @__PURE__ */ react_default.createElement("span", { className: cx("qk-status", "qk-status--" + s[1], className), "data-status": status, ...rest }, s[2] ? /* @__PURE__ */ react_default.createElement("span", { "aria-hidden": "true", className: "qk-status__glyph" }, g(s[2])) : null, label || s[0]);
  }
  function TopicTag({ children, slug, href, selected = !1, className, ...rest }) {
    return /* @__PURE__ */ react_default.createElement("a", { href: href || "/topics/" + (slug || String(children).toLowerCase().replace(/\s+/g, "-")), className: cx("qk-topic", selected && "is-on", className), ...rest }, children);
  }
  function Attribution({ author, authorHref, work, year, contributor, contributorHref, type = "canonical", onDark = !1, compact = !1, className }) {
    let handle = contributor ? contributor[0] === "@" ? contributor : "@" + contributor : null, ch = contributorHref || (handle ? "/" + handle : void 0);
    if (type === "original")
      return /* @__PURE__ */ react_default.createElement("div", { className: cx("qk-attr", onDark && "qk-attr--dark", className) }, /* @__PURE__ */ react_default.createElement("span", { className: "qk-attr__dash" }, "\u2014"), " Declared original by ", handle ? /* @__PURE__ */ react_default.createElement("a", { href: ch }, handle) : "its author");
    if (type === "private")
      return /* @__PURE__ */ react_default.createElement("div", { className: cx("qk-attr", onDark && "qk-attr--dark", className) }, /* @__PURE__ */ react_default.createElement("span", { className: "qk-attr__dash" }, "\u2014"), " ", author || "you", " ", /* @__PURE__ */ react_default.createElement("span", { className: "qk-attr__sub" }, "\xB7 private, only you can see this"));
    let src = [work, year].filter(Boolean).join(", ");
    return /* @__PURE__ */ react_default.createElement("div", { className: cx("qk-attr", onDark && "qk-attr--dark", className) }, /* @__PURE__ */ react_default.createElement("div", null, /* @__PURE__ */ react_default.createElement("span", { className: "qk-attr__dash" }, "\u2014"), " ", authorHref ? /* @__PURE__ */ react_default.createElement("a", { href: authorHref }, author) : author, src ? /* @__PURE__ */ react_default.createElement("span", { className: "qk-attr__sub" }, " \xB7 " + src) : null), handle && !compact ? /* @__PURE__ */ react_default.createElement("div", { className: "qk-attr__credit" }, "submitted by ", /* @__PURE__ */ react_default.createElement("a", { href: ch }, handle)) : null);
  }
  var ACTS = {
    like: { word: "like", glyph: ["\u2661", "\u2665"], count: "likes", on: "liked", meaning: "I enjoyed this quote" },
    favorite: { word: "favorite", glyph: ["\u2606", "\u2605"], count: "favorites", on: "favorited", meaning: "Save to my library" },
    recommend: { word: "recommend", glyph: ["\u2191", "\u2191"], count: "recommends", on: "recommended", meaning: "Consider for the default collection" },
    share: { word: "share", glyph: ["\u2197", "\u2197"] },
    report: { word: "report", glyph: ["\u2691", "\u2691"] }
  };
  function ActionBar({ actions = ["like", "favorite", "recommend", "share", "report"], counts = {}, state = {}, onAction, size = "md", onDark = !1, className }) {
    let [local, setLocal] = useState(state), [n, setN] = useState(counts), act = (a) => {
      let d = ACTS[a];
      if (d.on) {
        let was = !!local[d.on];
        setLocal({ ...local, [d.on]: !was }), n[d.count] != null && setN({ ...n, [d.count]: n[d.count] + (was ? -1 : 1) });
      }
      onAction && onAction(a);
    };
    return /* @__PURE__ */ react_default.createElement("div", { className: cx("qk-actions", "qk-actions--" + size, onDark && "qk-actions--dark", className), role: "group", "aria-label": "Quote actions" }, actions.map((a) => {
      let d = ACTS[a], on = d.on ? !!local[d.on] : !1, c = d.count ? n[d.count] : null;
      return /* @__PURE__ */ react_default.createElement("button", { key: a, type: "button", className: cx("qk-act", "qk-act--" + a, on && "is-on"), "aria-pressed": d.on ? on : void 0, title: d.meaning || d.word, "aria-label": d.word + (c != null ? ", " + c : ""), onClick: () => act(a) }, /* @__PURE__ */ react_default.createElement("span", { "aria-hidden": "true", className: "qk-act__glyph" }, g(d.glyph[on ? 1 : 0])), size !== "sm" ? /* @__PURE__ */ react_default.createElement("span", { className: "qk-act__word" }, on ? d.on : d.word) : null, c != null ? /* @__PURE__ */ react_default.createElement("span", { className: "qk-act__count" }, fmt(c)) : null);
    }));
  }
  function QuoteCard({ quote = {}, href, variant = "feed", showActions = !0, onAction, className }) {
    let q = quote, link = href || (q.id ? "/q/" + q.id : void 0), badges = [];
    return q.type === "original" && badges.push("ORIGINAL"), q.type === "private" && badges.push("PRIVATE"), q.status && badges.push(q.status), /* @__PURE__ */ react_default.createElement("article", { className: cx("qk-qcard", "qk-qcard--" + variant, className) }, badges.length || q.id ? /* @__PURE__ */ react_default.createElement("div", { className: "qk-qcard__top" }, badges.map((b) => /* @__PURE__ */ react_default.createElement(StatusBadge, { key: b, status: b })), /* @__PURE__ */ react_default.createElement("span", { className: "qk-qcard__id" }, q.id)) : null, /* @__PURE__ */ react_default.createElement("a", { className: "qk-qcard__text", href: link }, "\u201C" + (q.text || "") + "\u201D"), /* @__PURE__ */ react_default.createElement(Attribution, { author: q.author, authorHref: q.authorSlug ? "/authors/" + q.authorSlug : void 0, work: variant === "compact" ? null : q.work, year: variant === "compact" ? null : q.year, contributor: q.contributor, type: q.type, compact: variant === "compact" }), q.topics && q.topics.length && variant !== "compact" || showActions ? /* @__PURE__ */ react_default.createElement("div", { className: "qk-qcard__foot" }, /* @__PURE__ */ react_default.createElement("div", { className: "qk-qcard__topics" }, variant !== "compact" ? (q.topics || []).map((t) => /* @__PURE__ */ react_default.createElement(TopicTag, { key: t }, t)) : null), showActions ? /* @__PURE__ */ react_default.createElement(ActionBar, { size: "sm", actions: q.status === "CURATED" || q.type === "canonical" ? ["like", "favorite", "share"] : ["like", "favorite", "recommend", "share"], counts: { likes: q.likes, favorites: q.favorites, recommends: q.recommends }, state: { liked: q.liked, favorited: q.favorited, recommended: q.recommended }, onAction }) : null) : null);
  }
  function Row({ k, children }) {
    return children == null || children === "" ? null : /* @__PURE__ */ react_default.createElement("div", { className: "qk-prov__row" }, /* @__PURE__ */ react_default.createElement("dt", null, k), /* @__PURE__ */ react_default.createElement("dd", null, children));
  }
  function ProvenancePanel({ quote = {}, className }) {
    let q = quote, orig = q.type === "original", h = (x) => x ? x[0] === "@" ? x : "@" + x : null;
    return /* @__PURE__ */ react_default.createElement("section", { className: cx("qk-card", "qk-card--raised", "qk-prov", className), "aria-label": "Provenance" }, /* @__PURE__ */ react_default.createElement("div", { className: "qk-prov__head" }, /* @__PURE__ */ react_default.createElement("h4", { className: "qk-card__label" }, "Provenance"), q.status ? /* @__PURE__ */ react_default.createElement(StatusBadge, { status: q.status }) : null), /* @__PURE__ */ react_default.createElement("dl", null, orig ? /* @__PURE__ */ react_default.createElement(react_default.Fragment, null, /* @__PURE__ */ react_default.createElement(Row, { k: "Author" }, "Declared original by ", /* @__PURE__ */ react_default.createElement("a", { href: "/" + h(q.contributor) }, h(q.contributor))), /* @__PURE__ */ react_default.createElement(Row, { k: "Matching" }, q.noMatch !== !1 ? "No known matching attribution found." : "Possible match under review.")) : /* @__PURE__ */ react_default.createElement(react_default.Fragment, null, /* @__PURE__ */ react_default.createElement(Row, { k: "Author" }, q.authorSlug ? /* @__PURE__ */ react_default.createElement("a", { href: "/authors/" + q.authorSlug }, q.author) : q.author), /* @__PURE__ */ react_default.createElement(Row, { k: "Work" }, q.work), /* @__PURE__ */ react_default.createElement(Row, { k: "Year" }, q.year), /* @__PURE__ */ react_default.createElement(Row, { k: "Source" }, q.sourceUrl ? /* @__PURE__ */ react_default.createElement("a", { href: q.sourceUrl, className: "qk-prov__url" }, q.source || q.sourceUrl) : q.source), /* @__PURE__ */ react_default.createElement(Row, { k: "Context" }, q.context)), /* @__PURE__ */ react_default.createElement(Row, { k: "Topics" }, q.topics && q.topics.length ? /* @__PURE__ */ react_default.createElement("span", { className: "qk-prov__topics" }, q.topics.map((t) => /* @__PURE__ */ react_default.createElement(TopicTag, { key: t }, t))) : null)), /* @__PURE__ */ react_default.createElement("div", { className: "qk-prov__credit" }, /* @__PURE__ */ react_default.createElement("dl", null, orig ? null : /* @__PURE__ */ react_default.createElement(Row, { k: "Submitted by" }, q.contributor ? /* @__PURE__ */ react_default.createElement("a", { href: "/" + h(q.contributor) }, h(q.contributor)) : null), /* @__PURE__ */ react_default.createElement(Row, { k: "Verified by" }, q.verifier ? /* @__PURE__ */ react_default.createElement("a", { href: "/" + h(q.verifier) }, h(q.verifier)) : null), /* @__PURE__ */ react_default.createElement(Row, { k: "Verified on" }, q.verifiedAt), /* @__PURE__ */ react_default.createElement(Row, { k: "Releases" }, q.releases && q.releases.length ? q.releases.join(" \xB7 ") : null), /* @__PURE__ */ react_default.createElement(Row, { k: "Quote id" }, q.id ? /* @__PURE__ */ react_default.createElement("code", null, q.id) : null))));
  }
  var TRACKS = {
    canonical: ["SUBMITTED", "UNDER_REVIEW", "VERIFIED", "CURATION_REVIEW", "CURATED", "DATASET_RELEASE"],
    original: ["SUBMITTED", "ORIGINALITY_CHECK", "PUBLISHED", "COMMUNITY_DISCOVERY", "CURATION_CANDIDATE", "CURATION_REVIEW", "CURATED", "DATASET_RELEASE"]
  };
  function LifecycleSteps({ track = "canonical", current, outcome, dates = {}, orientation = "horizontal", className }) {
    let steps = TRACKS[track] || TRACKS.canonical, at = Math.max(0, steps.indexOf(current));
    return /* @__PURE__ */ react_default.createElement("ol", { className: cx("qk-steps", "qk-steps--" + orientation, className) }, steps.map((s, i) => {
      let st = i < at ? "done" : i === at ? outcome ? "off" : "current" : "todo";
      return /* @__PURE__ */ react_default.createElement("li", { key: s, className: cx("qk-step", "is-" + st), "aria-current": i === at ? "step" : void 0 }, /* @__PURE__ */ react_default.createElement("span", { className: "qk-step__dot", "aria-hidden": "true" }, st === "done" ? g("\u2713") : st === "off" ? outcome === "REJECTED" ? "\xD7" : "?" : ""), /* @__PURE__ */ react_default.createElement("span", { className: "qk-step__text" }, /* @__PURE__ */ react_default.createElement("span", { className: "qk-step__label" }, (STATUSES[s] || [s])[0]), st === "off" ? /* @__PURE__ */ react_default.createElement("span", { className: "qk-step__out" }, (STATUSES[outcome] || [outcome])[0]) : null, dates[s] ? /* @__PURE__ */ react_default.createElement("span", { className: "qk-step__date" }, dates[s]) : null));
    }));
  }
  function ShareCard({ quote, author, variant = "quote", id, width = 600, className }) {
    let s = width / 1200, len = (quote || "").length, fs = len <= 60 ? 60 : len <= 100 ? 50 : 42;
    return /* @__PURE__ */ react_default.createElement("div", { className: cx("qk-share-wrap", className), style: { width, height: 630 * s } }, /* @__PURE__ */ react_default.createElement("div", { className: cx("qk-share", "qk-share--" + variant), style: { transform: "scale(" + s + ")" }, role: "img", "aria-label": "\u201C" + quote + "\u201D \u2014 " + author }, variant === "terminal" ? /* @__PURE__ */ react_default.createElement(react_default.Fragment, null, /* @__PURE__ */ react_default.createElement("div", { className: "qk-share__bar" }, /* @__PURE__ */ react_default.createElement("i", null), /* @__PURE__ */ react_default.createElement("i", null), /* @__PURE__ */ react_default.createElement("i", null)), /* @__PURE__ */ react_default.createElement("div", { className: "qk-share__body" }, /* @__PURE__ */ react_default.createElement("div", { className: "qk-share__cmd" }, /* @__PURE__ */ react_default.createElement("span", { className: "qk-prompt" }, "~ >"), " qotm"), /* @__PURE__ */ react_default.createElement("div", { className: "qk-share__quote", style: { fontSize: fs } }, quote), /* @__PURE__ */ react_default.createElement("div", { className: "qk-share__by" }, /* @__PURE__ */ react_default.createElement("span", null, "\u2014"), " ", author), /* @__PURE__ */ react_default.createElement("div", { className: "qk-share__cmd" }, /* @__PURE__ */ react_default.createElement("span", { className: "qk-prompt" }, "~ >"), " ", /* @__PURE__ */ react_default.createElement("span", { className: "qk-share__cursor" })))) : /* @__PURE__ */ react_default.createElement(react_default.Fragment, null, /* @__PURE__ */ react_default.createElement("img", { src: cursor_quote_default, alt: "", className: "qk-share__marks" }), /* @__PURE__ */ react_default.createElement("div", { className: "qk-share__quote", style: { fontSize: fs } }, quote), /* @__PURE__ */ react_default.createElement("div", { className: "qk-share__by" }, /* @__PURE__ */ react_default.createElement("span", null, "\u2014"), " ", author), /* @__PURE__ */ react_default.createElement("div", { className: "qk-share__foot" }, /* @__PURE__ */ react_default.createElement("span", null, id ? "q/" + id.replace(/^q_/, "") + "  \xB7  " : "", "a thought between commands"), /* @__PURE__ */ react_default.createElement(Logo, { lockup: "symbol", height: 44 })))));
  }

  // ../src/people.jsx
  function Stats({ items = [] }) {
    return /* @__PURE__ */ react_default.createElement("dl", { className: "qk-stats" }, items.map((s) => /* @__PURE__ */ react_default.createElement("div", { key: s.label }, /* @__PURE__ */ react_default.createElement("dt", null, s.label), /* @__PURE__ */ react_default.createElement("dd", null, fmt(s.value)))));
  }
  function AuthorHeader({ name, line, stats = [], topics = [], className }) {
    return /* @__PURE__ */ react_default.createElement("header", { className: cx("qk-phead", className) }, /* @__PURE__ */ react_default.createElement("div", { className: "qk-phead__main" }, /* @__PURE__ */ react_default.createElement("p", { className: "qk-eyebrow qk-eyebrow--muted" }, "Author"), /* @__PURE__ */ react_default.createElement("h1", { className: "qk-phead__name" }, name), line ? /* @__PURE__ */ react_default.createElement("p", { className: "qk-phead__line" }, line) : null, topics.length ? /* @__PURE__ */ react_default.createElement("div", { className: "qk-phead__topics" }, topics.map((t) => /* @__PURE__ */ react_default.createElement(TopicTag, { key: t }, t))) : null), /* @__PURE__ */ react_default.createElement(Stats, { items: stats }));
  }
  function ProfileHeader({ name, handle, role = "MEMBER", joined, bio, stats = [], actions, className }) {
    let h = handle && handle[0] === "@" ? handle : "@" + handle;
    return /* @__PURE__ */ react_default.createElement("header", { className: cx("qk-phead", className) }, /* @__PURE__ */ react_default.createElement("div", { className: "qk-phead__main qk-phead__main--row" }, /* @__PURE__ */ react_default.createElement(Avatar, { name, handle, size: 64 }), /* @__PURE__ */ react_default.createElement("div", null, /* @__PURE__ */ react_default.createElement("h1", { className: "qk-phead__name qk-phead__name--sm" }, name || h), /* @__PURE__ */ react_default.createElement("p", { className: "qk-phead__line" }, /* @__PURE__ */ react_default.createElement("span", { className: "qk-phead__handle" }, h), role && role !== "MEMBER" ? /* @__PURE__ */ react_default.createElement(react_default.Fragment, null, " ", /* @__PURE__ */ react_default.createElement(StatusBadge, { status: role })) : null, joined ? /* @__PURE__ */ react_default.createElement("span", null, " \xB7 joined " + joined) : null), bio ? /* @__PURE__ */ react_default.createElement("p", { className: "qk-phead__bio" }, bio) : null)), /* @__PURE__ */ react_default.createElement("div", { className: "qk-phead__side" }, /* @__PURE__ */ react_default.createElement(Stats, { items: stats }), actions ? /* @__PURE__ */ react_default.createElement("div", { className: "qk-phead__actions" }, actions) : null));
  }
  function ContributionRow({ text, author, type = "canonical", status, date, release, href, className }) {
    return /* @__PURE__ */ react_default.createElement("a", { href: href || "#", className: cx("qk-contrib", className) }, /* @__PURE__ */ react_default.createElement("span", { className: "qk-contrib__main" }, /* @__PURE__ */ react_default.createElement("span", { className: "qk-contrib__text" }, "\u201C" + text + "\u201D"), /* @__PURE__ */ react_default.createElement("span", { className: "qk-contrib__meta" }, type === "original" ? "declared original" : "\u2014 " + author, date ? " \xB7 " + date : "", release ? " \xB7 shipped in " + release : "")), status ? /* @__PURE__ */ react_default.createElement(StatusBadge, { status }) : null);
  }

  // ../src/admin.jsx
  function DataTable({ columns = [], rows = [], rowKey = "id", selectable = !1, selected, onSelect, onRowClick, empty = "Nothing here.", dense = !1, className }) {
    let [inner, setInner] = useState([]), sel = selected || inner, set = (v) => {
      setInner(v), onSelect && onSelect(v);
    }, all = rows.length > 0 && sel.length === rows.length;
    return /* @__PURE__ */ react_default.createElement("div", { className: cx("qk-table-wrap", className) }, /* @__PURE__ */ react_default.createElement("table", { className: cx("qk-table", dense && "qk-table--dense") }, /* @__PURE__ */ react_default.createElement("thead", null, /* @__PURE__ */ react_default.createElement("tr", null, selectable ? /* @__PURE__ */ react_default.createElement("th", { className: "qk-table__sel" }, /* @__PURE__ */ react_default.createElement("input", { type: "checkbox", "aria-label": "Select all", checked: all, onChange: () => set(all ? [] : rows.map((r) => r[rowKey])) })) : null, columns.map((c) => /* @__PURE__ */ react_default.createElement("th", { key: c.key, style: { width: c.width, textAlign: c.align } }, c.label)))), /* @__PURE__ */ react_default.createElement("tbody", null, rows.length === 0 ? /* @__PURE__ */ react_default.createElement("tr", null, /* @__PURE__ */ react_default.createElement("td", { colSpan: columns.length + (selectable ? 1 : 0), className: "qk-table__empty" }, empty)) : rows.map((r) => {
      let k = r[rowKey], on = sel.includes(k);
      return /* @__PURE__ */ react_default.createElement("tr", { key: k, className: cx(on && "is-selected", onRowClick && "is-clickable"), onClick: onRowClick ? () => onRowClick(r) : void 0 }, selectable ? /* @__PURE__ */ react_default.createElement("td", { className: "qk-table__sel", onClick: (e) => e.stopPropagation() }, /* @__PURE__ */ react_default.createElement("input", { type: "checkbox", "aria-label": "Select " + k, checked: on, onChange: () => set(on ? sel.filter((x) => x !== k) : sel.concat(k)) })) : null, columns.map((c) => /* @__PURE__ */ react_default.createElement("td", { key: c.key, className: cx(c.mono && "is-mono"), style: { textAlign: c.align } }, c.render ? c.render(r[c.key], r) : c.key === "status" ? /* @__PURE__ */ react_default.createElement(StatusBadge, { status: r[c.key] }) : fmt(r[c.key]))));
    }))));
  }
  function StatCard({ label, value, delta, note, className }) {
    return /* @__PURE__ */ react_default.createElement("div", { className: cx("qk-card", "qk-card--raised", "qk-stat", className) }, /* @__PURE__ */ react_default.createElement("div", { className: "qk-stat__label" }, label), /* @__PURE__ */ react_default.createElement("div", { className: "qk-stat__value" }, fmt(value)), delta ? /* @__PURE__ */ react_default.createElement("div", { className: "qk-stat__delta" }, delta) : null, note ? /* @__PURE__ */ react_default.createElement("div", { className: "qk-stat__note" }, note) : null);
  }
  function ReleaseSummary({ version, eligible, added = 0, corrected = 0, withdrawn = 0, state = "draft", size, sha256, publishedAt, onBuildPreview, onPublish, className }) {
    let label = { draft: "draft", preview: "preview built", published: "published" }[state] || state;
    return /* @__PURE__ */ react_default.createElement("section", { className: cx("qk-card", "qk-card--raised", "qk-release", className), "aria-label": "Dataset " + version }, /* @__PURE__ */ react_default.createElement("div", { className: "qk-release__head" }, /* @__PURE__ */ react_default.createElement("div", null, /* @__PURE__ */ react_default.createElement("p", { className: "qk-eyebrow qk-eyebrow--muted" }, "Dataset release"), /* @__PURE__ */ react_default.createElement("h3", { className: "qk-release__v" }, "v", version)), /* @__PURE__ */ react_default.createElement("span", { className: cx("qk-status", state === "published" ? "qk-status--curated" : state === "preview" ? "qk-status--positive" : "qk-status--pending") }, label)), /* @__PURE__ */ react_default.createElement("div", { className: "qk-release__count" }, /* @__PURE__ */ react_default.createElement("b", null, fmt(eligible)), " eligible quotes"), /* @__PURE__ */ react_default.createElement("div", { className: "qk-release__diff", "aria-label": "Changes since the last release" }, /* @__PURE__ */ react_default.createElement("span", { className: "qk-diff qk-diff--add" }, "+", fmt(added), " new"), /* @__PURE__ */ react_default.createElement("span", { className: "qk-diff qk-diff--mod" }, "~", fmt(corrected), " corrected"), /* @__PURE__ */ react_default.createElement("span", { className: "qk-diff qk-diff--del" }, "\u2212", fmt(withdrawn), " withdrawn")), size || sha256 || publishedAt ? /* @__PURE__ */ react_default.createElement("dl", { className: "qk-release__meta" }, size ? /* @__PURE__ */ react_default.createElement("div", null, /* @__PURE__ */ react_default.createElement("dt", null, "size"), /* @__PURE__ */ react_default.createElement("dd", null, size)) : null, sha256 ? /* @__PURE__ */ react_default.createElement("div", null, /* @__PURE__ */ react_default.createElement("dt", null, "sha256"), /* @__PURE__ */ react_default.createElement("dd", null, sha256)) : null, publishedAt ? /* @__PURE__ */ react_default.createElement("div", null, /* @__PURE__ */ react_default.createElement("dt", null, "published"), /* @__PURE__ */ react_default.createElement("dd", null, publishedAt)) : null) : null, state !== "published" ? /* @__PURE__ */ react_default.createElement("div", { className: "qk-release__actions" }, /* @__PURE__ */ react_default.createElement(Button, { variant: "outline", mono: !0, onClick: onBuildPreview }, "Build preview"), /* @__PURE__ */ react_default.createElement(Button, { variant: "accent", disabled: state !== "preview", onClick: onPublish }, "Publish")) : null);
  }
  var DECISIONS = {
    verification: [["VERIFIED", "Verify", "solid"], ["NEEDS_EVIDENCE", "Needs evidence", "outline"], ["REJECTED", "Reject", "quiet"]],
    curation: [["CURATED", "Curate", "accent"], ["VERIFIED", "Keep out of dataset", "outline"]],
    moderation: [["PUBLISHED", "Publish", "solid"], ["DISPUTED", "Mark disputed", "outline"], ["WITHDRAWN", "Withdraw", "quiet"]]
  };
  function ReviewDecision({ kind = "verification", question, onDecide, className }) {
    let [note, setNote] = useState(""), q = question || { verification: "Did this person actually say or write these words, and is there sufficient evidence?", curation: "Is this quote appropriate and valuable enough to distribute to qotm users by default?", moderation: "Does this quote meet the community guidelines?" }[kind];
    return /* @__PURE__ */ react_default.createElement("section", { className: cx("qk-card", "qk-card--paper", "qk-decide", className) }, /* @__PURE__ */ react_default.createElement("p", { className: "qk-eyebrow qk-eyebrow--clay" }, kind), /* @__PURE__ */ react_default.createElement("p", { className: "qk-decide__q" }, q), /* @__PURE__ */ react_default.createElement(Textarea, { label: "Note", rows: 3, placeholder: "What you checked, and where.", value: note, onChange: (e) => setNote(e.target.value), hint: "Kept in the audit log with your name." }), /* @__PURE__ */ react_default.createElement("div", { className: "qk-decide__btns" }, (DECISIONS[kind] || []).map(([s, l, v]) => /* @__PURE__ */ react_default.createElement(Button, { key: s, variant: v, onClick: () => onDecide && onDecide(s, note) }, l))));
  }
  function MatchCompare({ submitted, match = {}, method = "fuzzy", score, onDismiss, onMarkDuplicate, className }) {
    let methodLabel = { exact: "normalized exact match", fuzzy: "fuzzy text match", author: "author match" }[method] || method;
    return /* @__PURE__ */ react_default.createElement("section", { className: cx("qk-card", "qk-card--raised", "qk-match", className) }, /* @__PURE__ */ react_default.createElement("div", { className: "qk-match__head" }, /* @__PURE__ */ react_default.createElement("span", { className: "qk-status qk-status--attention" }, /* @__PURE__ */ react_default.createElement("span", { className: "qk-status__glyph" }, "?"), "possible match"), /* @__PURE__ */ react_default.createElement("span", { className: "qk-match__method" }, methodLabel, score != null ? " \xB7 " + Math.round(score * 100) + "% similar" : "")), /* @__PURE__ */ react_default.createElement("div", { className: "qk-match__cols" }, /* @__PURE__ */ react_default.createElement("div", null, /* @__PURE__ */ react_default.createElement("div", { className: "qk-match__label" }, "Submitted"), /* @__PURE__ */ react_default.createElement("p", { className: "qk-match__text" }, "\u201C" + submitted + "\u201D")), /* @__PURE__ */ react_default.createElement("div", null, /* @__PURE__ */ react_default.createElement("div", { className: "qk-match__label" }, "Existing ", match.id ? /* @__PURE__ */ react_default.createElement("code", null, match.id) : null), /* @__PURE__ */ react_default.createElement("p", { className: "qk-match__text" }, "\u201C" + (match.text || "") + "\u201D"), match.author ? /* @__PURE__ */ react_default.createElement("div", { className: "qk-attr" }, /* @__PURE__ */ react_default.createElement("span", { className: "qk-attr__dash" }, "\u2014"), " ", match.author) : null)), /* @__PURE__ */ react_default.createElement("div", { className: "qk-match__btns" }, /* @__PURE__ */ react_default.createElement(Button, { variant: "outline", size: "sm", onClick: onDismiss }, "Not a duplicate"), /* @__PURE__ */ react_default.createElement(Button, { variant: "solid", size: "sm", onClick: onMarkDuplicate }, "Mark duplicate")));
  }
  return __toCommonJS(src_exports);
})();
window.QotmKit = QotmKit;
