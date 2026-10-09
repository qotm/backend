# qotm-worker

A standalone TypeScript background worker, generated from the stacks
`node-worker` template (`stack.json` records which features it has). It runs
no HTTP server: it consumes the jobs an API produces, against the API's own
database.

## Commands

```sh
yarn dev            # run with the telemetry preload (tsx)
yarn dev:watch      # same, restarting on change
yarn typecheck && yarn lint && yarn format:check
yarn build          # tsc → dist/
yarn db:generate    # Prisma client from prisma/schema (needed after every schema change)
```

There is no test script. The Docker build (`yarn install --immutable`,
`yarn db:generate`, `yarn build`) is what CI runs, so `yarn.lock` and
`.yarnrc.yml` must be committed.

## Layout

- `src/index.ts`: starts every worker and shuts them down on SIGTERM/SIGINT.
- `src/config.ts`: the typed config object. `src/logger.ts`: pino.
- `src/workers/`: one directory per queue consumer, names in `constants.ts`,
  re-exported from `index.ts`.
- `src/utils/worker.ts`: `createWorker`, the only way to build a consumer.
- `src/db.ts`: `DB.instance`, the Prisma client (`DB.instance.$` adds
  `exists`, `paginate`).
- `src/utils/browser.ts`: `launchBrowser()` for headless Chromium.
- Imports use the `#app/*`, `#utils/*`, `#lib/*`, `#prisma/*` aliases, with
  `.js` extensions (`#app/logger.js`).

## Rules

- **The API owns the database.** `prisma/schema/` is a copy (or a submodule)
  of the API's schema; never write migrations here. Replace the placeholder
  `User` in `base.prisma` with the API's models rather than deleting it: the
  `db.ts` extensions are typed against it. Run `yarn db:generate` after every
  schema change.
- **Queue names and Redis must match the producer's.** A worker on the wrong
  queue or Redis waits forever with no error. Names live in
  `src/workers/constants.ts`; keep them identical to the API's
  `QueueModule.register('<name>')`.
- **Throw on failure.** A job handler that throws is retried with the
  producer's `attempts` / `backoff`; one that swallows an error is marked done.
  Retry policy is set by the producer, not here.
- **Log structured.** `logger.info({ jobId: job.id, ...fields }, 'message')`,
  errors as `{ err }`.
- **Config has no schema.** A new variable goes in the `Config` interface and
  the `config` literal in `src/config.ts`, with a default where one is safe,
  and in `.env.example` with a comment. Telemetry variables are read from
  `process.env` in `src/telemetry/config.ts` instead, because they are needed
  before config loads.

## Skills

- `add-worker`: a new queue consumer for a job the API produces.
