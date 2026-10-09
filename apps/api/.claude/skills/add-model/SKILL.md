---
name: add-model
description: Add or change a Prisma model in this API — the schema file, relations, enums, the migration, seed data — following the template's naming conventions. Use when asked to "add a table", "store X", "add a field to Y", "model these entities", or before building a resource whose data does not exist yet.
---

# Add a Prisma model

The schema is split by area under `prisma/schema/`: `base.prisma`
(datasource, generators), `auth.prisma` (User, Session, Account,
Verification), `enum.prisma` (every enum), and one file per feature. Read one
existing model before writing yours.

## 1. The model

`prisma/schema/<area>.prisma`:

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
yarn db:migrate          # prisma migrate dev: names, creates and applies the migration
```

Name it for the change (`add_things`). Review the SQL it wrote in
`prisma/migrations/`. A destructive change (dropping or narrowing a column
with data) needs a deliberate, multi-step migration: say so rather than
letting `migrate dev` reset the database. Never edit a migration already
applied elsewhere. `yarn db:migrate:create` writes one without applying it,
for hand-adjusting first.

The client regenerates with the migration; import types from `@db/client`
(`Prisma`, `Thing`) and enums from `@db/enums`.

## 3. Seed (if it needs reference data)

Add a private method to `seeders/index.ts` and call it from `seed()`; data
only tests need goes behind `isTest`. Users are created only through
`auth.api.createUser`, never as rows.

## 4. Test database

The test database is pushed, not migrated: `yarn test:db:push` (or
`yarn test:dc:reinstall`) after a schema change, before running tests.

## Other services

A worker that reads this table gets the schema change too: copy the schema
file (or update the submodule) and run its `yarn db:generate`. A Python worker
needs its SQLAlchemy model updated by hand.
