# Stage 1: Build
FROM aurostack.dev/wesnetech/nodejs:24 AS build
WORKDIR /app

# The image bundles Yarn 1.x; corepack switches to the Yarn 4 release pinned by
# package.json's `packageManager`, which is what can read yarn.lock.
RUN corepack enable

# yarn.lock and .yarnrc.yml must both land here: --immutable requires a lockfile,
# and without .yarnrc.yml Yarn uses PnP instead of the node-modules linker.
COPY package.json yarn.lock .yarnrc.yml ./
RUN yarn install --immutable

COPY tsconfig*.json nest-cli.json prisma.config.ts ./
COPY .bin ./.bin
COPY prisma ./prisma
RUN yarn db:generate

COPY src ./src
COPY public ./public
COPY emails ./emails
RUN yarn build

# Remove dev dependencies after build is done. Yarn 4 has no
# `install --production`; focusing the root workspace is its equivalent.
RUN yarn workspaces focus --all --production

# Stage 2: Production
FROM aurostack.dev/wesnetech/nodejs:24
WORKDIR /app

COPY package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma

EXPOSE 5000

CMD ["node", "dist/src/main"]
