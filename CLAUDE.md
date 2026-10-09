# qotm backend

The qotm API and background worker in one Turborepo + Yarn 4 workspace
(`nodeLinker: node-modules`). They share one database through one Prisma
package, so a schema change and the code that uses it land in the same commit.

| Workspace | Path | What it is |
|---|---|---|
| `@qotm/api` | `apps/api` | NestJS API (CommonJS). Owns the database. See `apps/api/CLAUDE.md`. |
| `@qotm/worker` | `apps/worker` | BullMQ worker (ESM, headless Chromium). See `apps/worker/CLAUDE.md`. |
| `@qotm/db` | `packages/db` | Prisma schema, migrations and the generated client, compiled to `dist/`. |

## Commands (from this folder)

```sh
yarn install                    # one lockfile for every workspace
yarn dc:up && yarn dc:wait      # Postgres + Redis from compose.yml, shared by both apps
yarn db:migrate                 # the API's migrate: prisma migrate dev in @qotm/db, then rebuild it
yarn db:seed
yarn dev                        # builds @qotm/db, then runs the API and the worker
yarn build | lint | typecheck | test   # turbo run …, across every workspace
```

Run one workspace's script with `yarn workspace @qotm/api <script>` or from
its folder. The test stack (`compose.test.yml`) and the e2e suite are driven
from `apps/api`.

## Rules

- **Prisma lives only in `packages/db`.** Import it as `@qotm/db/client` and
  `@qotm/db/enums`; never generate a client inside an app. The client is
  generated as CommonJS and compiled, so the CJS API and the ESM worker load
  the same build.
- **The API owns migrations.** Every `db:*` command runs from the API, which
  loads its own `.env*` and runs Prisma in `@qotm/db`. The worker never
  migrates.
- **The apps run the compiled client** (`packages/db/dist`). Turbo builds it
  before `build`, `typecheck`, `test` and `dev`; after a schema change outside
  turbo, run `yarn db:generate` and restart `yarn dev`.
- **The API keeps its dependencies in `apps/api/node_modules`**
  (`installConfig.hoistingLimits: "workspaces"`), because Suites must resolve
  its Vitest adapter from beside `@suites/unit`. Root-level binaries such as
  `turbo` are therefore not on the PATH inside `apps/api`; call them from the
  root.
- **A dependency goes in the workspace that imports it**, never the root (the
  root only holds `turbo`).

## Docker

Images are built from this folder, because each one needs `packages/db` as
well as its app:

```sh
docker build -f apps/api/Dockerfile -t qotm-api .
docker build -f apps/api/Dockerfile --target migrate -t qotm-api-migrate .
docker build -f apps/worker/Dockerfile -t qotm-worker .
```

Each Dockerfile runs `turbo prune <app> --docker`, installs from the pruned
lockfile, builds with turbo and keeps only production dependencies.
`node_modules/@qotm/db` is a symlink, so a runtime stage must copy
`packages/db` (its `package.json` and `dist/`) at the same relative path. Run
`qotm-api-migrate` once before starting a new API image, and deploy the API and
worker on the same tag. The only `.dockerignore` is the one here.

## CI (`.forgejo/workflows/`)

- `ci.yml`: every branch except `main`/`development`. Runs
  `turbo run lint typecheck test build`.
- `test-e2e.yml`: PRs into `development`. Runs the API's e2e suite against
  service containers.
- `build-and-push.yml`: `main` and manual runs. Pushes `qotm-api`,
  `qotm-api-migrate` and `qotm-worker` under one shared tag.
