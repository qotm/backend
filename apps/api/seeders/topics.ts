/**
 * The topic taxonomy the design ships with, in its order. Slugs are the names
 * with spaces as hyphens (`qotm --topic software-design`).
 */
export const TOPICS = [
	'programming',
	'software design',
	'software engineering',
	'unix',
	'open source',
	'databases',
	'distributed systems',
	'security',
	'web development',
	'debugging',
	'simplicity',
	'complexity',
	'engineering leadership',
	'learning',
	'creativity'
].map((name) => ({ name, slug: name.replace(/ /g, '-') }));
