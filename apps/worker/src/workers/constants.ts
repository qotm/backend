/**
 * Queue names, shared with whatever produces the jobs. A worker listening on a
 * name nothing produces to simply idles forever — there is no error — so keep
 * these in step with the producer.
 */
export const EXAMPLE_QUEUE = 'example';

/**
 * Originality and duplicate checks. Produced by the API's SubmissionsModule
 * (`apps/api/src/submissions/services/submissions.service.ts`, MATCHING_QUEUE),
 * which also schedules the nightly re-check.
 */
export const MATCHING_QUEUE = 'matching';
export const CHECK_ORIGINALITY = 'check-originality';
export const RECHECK_ORIGINALS = 'recheck-originals';

/**
 * Dataset releases. Produced by the API's ReleasesModule
 * (`apps/api/src/releases/jobs.ts`, RELEASES_QUEUE): one build at a time.
 */
export const RELEASES_QUEUE = 'releases';
export const BUILD_PREVIEW = 'build-preview';
export const PUBLISH_RELEASE = 'publish-release';

/**
 * Share-image renders. Produced by the API's ShareModule
 * (`apps/api/src/share/jobs.ts`, SHARE_IMAGES_QUEUE).
 */
export const SHARE_IMAGES_QUEUE = 'share-images';
export const RENDER_SHARE_IMAGE = 'render-share-image';

/**
 * CSV exports. Produced by the API's ExportsModule
 * (`apps/api/src/exports/jobs.ts`, EXPORTS_QUEUE).
 */
export const EXPORTS_QUEUE = 'exports';
export const EXPORT_QUOTES = 'export-quotes';
