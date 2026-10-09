---
name: add-model
description: Add or change a Prisma model in this API — the schema file, relations, enums, the migration, seed data — following the template's naming conventions. Use when asked to "add a table", "store X", "add a field to Y", "model these entities", or before building a resource whose data does not exist yet.
---

# Add a Prisma model

The schema lives in the shared `@qotm/db` package, split by area under
`../../packages/db/prisma/schema/` (paths below are relative to it): `base.prisma`
(datasource, generators), `auth.prisma` (User, Session, Account,
Verification), `enum.prisma` (every enum), and one file per feature. Read one
existing model before writing yours.

## 1. The model

`packages/db/prisma/schema/<area>.prisma`:

```prisma
model Thing {
  id        String    @id(map: "things_pk") @default(cuid())
  ownerId   String    @map("owner_id")
  title     String
  status    ThingStatus @default(DRAFT)
  createdAt DateTime  @default(now()) @map("created_at")
  updatedAt DateTime  @updatedAt @map("updated_at")

  owner User @relation(fields: [ownerId], references: [id], onDelete: Cascade, map: "things_owner_fk")

  @@index([ownerId, createdAt], map: "things_owner_created_idx")
  @@map("things")
}
```

- camelCase fields, snake_case columns (`@map`), a plural snake_case table
  (`@@map`).
- Name every constraint: `@id(map: "<table>_pk")`, FKs `"<table>_<rel>_fk"`,
  indexes `"<table>_<cols>_idx"`. Migrations then read predictably.
- `cuid()` ids, `createdAt` / `updatedAt` as above.
- A relation to `User` needs its back-relation field added to `User` in
  `auth.prisma`.
- Enums go in `enum.prisma`, never beside the model.
- Index what the service filters and sorts by.

## 2. Migrate

```sh
yarn db:migrate          # prisma migrate dev in @qotm/db, then rebuilds the client
```

Name it for the change (`add_things`). Review the SQL it wrote in
`packages/db/prisma/migrations/`. A destructive change (dropping or narrowing a column
with data) needs a deliberate, multi-step migration: say so rather than
letting `migrate dev` reset the database. Never edit a migration already
applied elsewhere. `yarn db:migrate:create` writes one without applying it,
for hand-adjusting first.

`yarn db:migrate` rebuilds the client (`yarn db:generate` does it alone).
Import types from `@qotm/db/client` (`Prisma`, `Thing`) and enums from
`@qotm/db/enums`, then restart `yarn dev`: it runs the compiled client.

## 3. Seed (if it needs reference data)

Add a private method to `seeders/index.ts` and call it from `seed()`; data
only tests need goes behind `isTest`. Users are created only through
`auth.api.createUser`, never as rows.

## 4. Test database

The test database is pushed, not migrated: `yarn test:db:push` (or
`yarn test:dc:reinstall`) after a schema change, before running tests.

## Other services

The node worker (`apps/worker`) imports the same `@qotm/db` client, so it gets
the change automatically. Run `yarn typecheck` from the backend root to catch
anything the change broke there. A Python worker needs its SQLAlchemy model
updated by hand.
