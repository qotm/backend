/**
 * How long a failed job stays in Redis (and Bull Board) before BullMQ drops
 * it: long enough to look into, short enough not to pile up. The default for
 * every queue (app.module); producers that set their own options repeat it.
 */
export const FAILED_JOBS_KEPT = { age: 30 * 24 * 60 * 60 };
