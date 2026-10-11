/**
 * Where release artifacts live in the bucket. A preview is content-addressed
 * (its sha256 is in the key), so a rebuilt preview never overwrites one that
 * may already be cached; publishing copies it to the version's own path,
 * `<prefix>/v2026.09.1/qotm.sqlite`, served at `<baseUrl>/v2026.09.1/qotm.sqlite`
 * and never overwritten (BUILD-PLAN §9, QOT-10).
 */
export const DATASET_FILE = 'qotm.sqlite';
export const MANIFEST_FILE = 'manifest.json';

export const previewDir = (prefix: string, version: string, sha256: string) =>
	`${prefix}/previews/${version}/${sha256}`;

export const releaseDir = (prefix: string, version: string) =>
	`${prefix}/${version}`;

export const datasetUrl = (baseUrl: string, version: string) =>
	`${baseUrl}/${version}/${DATASET_FILE}`;
