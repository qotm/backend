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
