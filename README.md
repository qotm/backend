# qotm backend

The API and background worker behind [qotm.dev](https://qotm.dev): one
considered programming quote in your terminal, from a community that verifies
and curates them. The terminal side is [qotm/cli](https://github.com/qotm/cli)
(`npm i -g qotm`), the site is [qotm/web](https://github.com/qotm/web).

| Workspace | Path | What it is |
|---|---|---|
| `@qotm/api` | `apps/api` | NestJS API: quotes, review, releases, accounts, og:images |
| `@qotm/worker` | `apps/worker` | BullMQ worker: originality checks, share images (headless Chromium), dataset releases, exports |
| `@qotm/db` | `packages/db` | Prisma schema, migrations and the generated client, shared by both |

## Running it

Requires Node.js 24, Yarn 4 (through Corepack) and Docker.

```sh
yarn install
yarn dc:up && yarn dc:wait      # Postgres and Redis
cp apps/api/.env.example apps/api/.env && cp apps/worker/.env.example apps/worker/.env
yarn db:migrate
yarn db:seed
yarn dev                        # the API and the worker
```

The API's reference is at `http://localhost:5000/docs`. Lint, typecheck,
test and build every workspace with `yarn lint`, `yarn typecheck`,
`yarn test` and `yarn build`; the API's end-to-end suite runs from
`apps/api` against its own test stack (`yarn test:dc:reinstall`, then
`yarn test:e2e`).

## Docker

Each image is built from this folder:

```sh
docker build -f apps/api/Dockerfile -t qotm-api .
docker build -f apps/api/Dockerfile --target migrate -t qotm-api-migrate .
docker build -f apps/worker/Dockerfile -t qotm-worker .
```

Run `qotm-api-migrate` once before starting a new API image, and deploy the
API and worker on the same tag.

## License

The code is MIT. Quote texts and citations drawn from
[Wikiquote](https://en.wikiquote.org) remain under
[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/), with
attribution to Wikiquote's contributors through each quote's source; facts
from Wikidata are CC0. Members' originals are theirs, shared under the terms
at [qotm.dev/terms](https://qotm.dev/terms).
