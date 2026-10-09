# Build from the backend root — the image needs packages/db as well as this app:
#
#   docker build -f apps/worker/Dockerfile -t qotm-worker .
#
# The worker never migrates; the API's `migrate` target owns the schema.

# ---------- prune ----------
# A copy of the monorepo with only @qotm/worker and the workspaces it depends on.
# out/json holds the manifests + pruned lockfile, out/full the sources, so the
# install layer below is reused until a dependency actually changes.
FROM aurostack.dev/wesnetech/nodejs:24 AS prune
WORKDIR /repo
RUN corepack enable
COPY . .
RUN yarn dlx -q turbo@2.11.7 prune @qotm/worker --docker

# ---------- build ----------
FROM aurostack.dev/wesnetech/nodejs:24 AS build

# Chromium comes from apk in the runtime stage; don't download a second copy.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
	PUPPETEER_SKIP_DOWNLOAD=true

WORKDIR /repo
# The image bundles Yarn 1.x; corepack switches to the Yarn 4 release pinned by
# the root package.json's `packageManager`.
RUN corepack enable

# out/json carries .yarnrc.yml too: without it Yarn uses PnP, which Prisma
# cannot generate under.
COPY --from=prune /repo/out/json/ ./
# Long timeout, one request at a time: tolerant of a slow or flaky registry.
RUN YARN_HTTP_TIMEOUT=300000 YARN_NETWORK_CONCURRENCY=1 yarn install --immutable

COPY --from=prune /repo/out/full/ ./
# Builds @qotm/db (prisma generate + tsc) first, then the worker.
RUN yarn turbo run build --filter=@qotm/worker

# Yarn 4 has no `install --production`; focusing the workspace is its equivalent.
RUN yarn workspaces focus @qotm/worker --production \
	&& mkdir -p apps/worker/node_modules packages/db/node_modules

# ---------- runtime ----------
FROM aurostack.dev/wesnetech/nodejs:24
WORKDIR /repo

RUN apk add --no-cache \
	chromium \
	nss \
	freetype \
	harfbuzz \
	ca-certificates \
	ttf-freefont \
	udev

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
	PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# node_modules/@qotm/db is a symlink to packages/db, so the package has to sit at
# the same relative path here or the worker fails with "Cannot find module".
COPY --from=build /repo/package.json ./
COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages/db/package.json ./packages/db/
COPY --from=build /repo/packages/db/node_modules ./packages/db/node_modules
COPY --from=build /repo/packages/db/dist ./packages/db/dist
COPY --from=build /repo/apps/worker/package.json /repo/apps/worker/ecosystem.config.cjs ./apps/worker/
COPY --from=build /repo/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=build /repo/apps/worker/dist ./apps/worker/dist

WORKDIR /repo/apps/worker

# pm2-runtime ships in the house base image; Debian's needs it installed.
CMD [ "pm2-runtime", "start", "ecosystem.config.cjs" ]
