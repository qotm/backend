# Build from the backend root — the image needs packages/db as well as this app:
#
#   docker build -f apps/api/Dockerfile -t qotm-api .
#   docker build -f apps/api/Dockerfile --target migrate -t qotm-api-migrate .
#
# The `migrate` target runs `prisma migrate deploy` against $DATABASE_URL and
# exits. Run it once before starting a new API image; the API image itself has
# no Prisma CLI.

# ---------- prune ----------
# A copy of the monorepo with only @qotm/api and the workspaces it depends on.
# out/json holds the manifests + pruned lockfile, out/full the sources, so the
# install layer below is reused until a dependency actually changes.
FROM aurostack.dev/wesnetech/nodejs:24 AS prune
WORKDIR /repo
RUN corepack enable
COPY . .
RUN yarn dlx -q turbo@2.11.7 prune @qotm/api --docker

# ---------- build ----------
FROM aurostack.dev/wesnetech/nodejs:24 AS build
WORKDIR /repo
# The image bundles Yarn 1.x; corepack switches to the Yarn 4 release pinned by
# the root package.json's `packageManager`. Each stage is a fresh image, so it
# has to be enabled again here.
RUN corepack enable

# out/json carries .yarnrc.yml too: without it Yarn uses PnP instead of the
# node-modules linker.
COPY --from=prune /repo/out/json/ ./
RUN yarn install --immutable

COPY --from=prune /repo/out/full/ ./
# Builds @qotm/db (prisma generate + tsc) first, then the API.
RUN yarn turbo run build --filter=@qotm/api

# ---------- migrate ----------
FROM build AS migrate
WORKDIR /repo/packages/db
CMD ["yarn", "prisma", "migrate", "deploy"]

# ---------- prod deps ----------
# Yarn 4 has no `install --production`; focusing the workspace is its equivalent.
FROM build AS prod
RUN yarn workspaces focus @qotm/api --production \
	&& mkdir -p apps/api/node_modules packages/db/node_modules

# ---------- runtime ----------
FROM aurostack.dev/wesnetech/nodejs:24
WORKDIR /repo

# node_modules/@qotm/db is a symlink to packages/db, so the package has to sit at
# the same relative path here or the API fails with "Cannot find module".
COPY --from=prod /repo/package.json ./
COPY --from=prod /repo/node_modules ./node_modules
COPY --from=prod /repo/packages/db/package.json ./packages/db/
COPY --from=prod /repo/packages/db/node_modules ./packages/db/node_modules
COPY --from=prod /repo/packages/db/dist ./packages/db/dist
COPY --from=prod /repo/apps/api/package.json ./apps/api/
COPY --from=prod /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=prod /repo/apps/api/dist ./apps/api/dist
COPY --from=prod /repo/apps/api/public ./apps/api/public

WORKDIR /repo/apps/api
EXPOSE 5000

CMD ["node", "dist/src/main"]
