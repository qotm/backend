/**
 * Queue names, shared with whatever produces the jobs. A worker listening on a
 * name nothing produces to simply idles forever — there is no error — so keep
 * these in step with the producer.
 */
export const EXAMPLE_QUEUE = 'example';
