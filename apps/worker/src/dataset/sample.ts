/**
 * Builds a sample `qotm.sqlite` from the database in the worker's `.env`
 * (the dev seed): `yarn dataset:sample [out-file]`. For inspecting the
 * schema with `sqlite3`; releases are built by the releases worker.
 */
import { resolve } from 'node:path';
import { DB } from '#app/db.js';
import { loadDataset } from './load.js';
import { writeDataset } from './write.js';

const file = resolve(process.argv[2] ?? 'qotm.sqlite');
const dataset = await loadDataset(DB.instance, 'v0000.00.0');
const count = writeDataset(file, dataset);
console.log(`${count} quotes → ${file}`);
await DB.instance.disconnect();
