---
name: add-resource
description: Add a resource to this API — a Nest module with its controller, service, Zod DTOs and response entities, permission checks and tests — following the users module. Use when asked to "add an endpoint", "add a /things API", "expose X", "CRUD for Y", or to build a backend task that serves data to a screen.
---

# Add a resource

`src/users/` is the pattern to copy: read `controllers/users.controller.ts`,
`services/users.service.ts`, `dto/filters.dto.ts` and `entity/user.entity.ts`
before writing anything.

The model it serves comes first: if it does not exist
yet, use `add-model`.

## 1. The module

`src/<things>/` with `controllers/ services/ dto/ entity/ decorators/
__tests__/`, each exporting through an `index.ts` barrel, and
`<things>.module.ts`:

```ts
@Module({ controllers: [ThingsController], providers: [ThingsService] })
export class ThingsModule {}
```

Register it in the `imports` of `src/app.module.ts`, next to the other
feature modules. A service other modules need goes in `exports`.

## 2. DTOs and entities (Zod)

- **Inputs** in `dto/`: `export const CreateThing = z.object({...})` and
  `export type CreateThing = z.output<typeof CreateThing>`. List filters
  extend `CommonFilters` from `common/dto` (search, page, limit). Reuse the
  field helpers in `common/schemas/fields.ts` (`dateTime`, `email`, `decimal`,
  `sortKeys`…).
- **Outputs** in `entity/`: a Zod object with `.meta({ id: 'ThingEntity' })`
  (the id becomes the OpenAPI component name the frontend's types use) and
  `export type ThingEntity = z.input<typeof ThingEntity>`. Lists use
  `paginated(ThingEntity, 'PaginatedThingEntity')` from `common/entity`;
  acknowledgements return `ok()` / `OKEntity`.
- The entity is the contract: the serializer drops fields it does not declare
  and fails on a mismatch, so a field the client needs must be in it.

## 3. Permissions

- Add the resource's actions to `statements` in `src/lib/access.ts`
  (`thing: ['create', 'list', 'get', 'update', 'delete']`) and grant them to
  the roles that hold them. Roles are added nowhere else.
- Add a typed wrapper in `<things>/decorators/`, so a typo'd action is a
  compile error:
  `export const ThingPermissions = (...a: PermissionAction<'thing'>[]) => applyDecorators(UserHasPermission({ permission: { thing: a } }));`
- A member acting on their own records needs no statement: check ownership in
  the service (`findFirst({ where: { id, userId: user.id } })`).
- Public reads take `@AllowAnonymous()`; every other route requires a session.

## 4. The controller

```ts
@ApiTags('Things')
@Controller({ path: 'things', version: '1' })     // → /v1/things
export class ThingsController {
	constructor(private service: ThingsService) {}

	@Get()
	@Op('things', '/v1/things', 'List things')
	@Returns(PaginatedThingEntity)
	@ThingPermissions('list')
	findAll(@Query({ schema: ThingFilters }) filters: ThingFilters, @Session() { user }: UserSession) {
		return this.service.paginate(user, filters);
	}

	@Post()
	@Op('things/create', '/v1/things', 'Create a thing')
	@Returns(ThingEntity)
	create(@Body({ schema: CreateThing }) body: CreateThing, @Session() { user }: UserSession) {
		return this.service.create(user, body);
	}
}
```

`@IdParam()` plus `@ApiNotFoundResponse` on `:id` routes; `@HttpCode(200)` on
a POST that does not create. `Op`, `Returns` and `IdParam` come from
`common/decorators`; `Session` and `UserSession` from
`@thallesp/nestjs-better-auth`.

## 5. The service

Inject `PrismaService` as `db`. Paginate with
`const [list, meta] = await this.db.x.thing.paginate({ where, page, limit })`
and return `{ list, ...meta }`. Throw Nest exceptions (`NotFoundException`…);
Prisma's own errors are already mapped (unique → 409, missing → 404). Use
`ensureExists` / `ensureUnique` from `common/utils` for request-level checks.
Return 404, not 403, for a record the viewer may not see.

## 6. Tests

- **Unit** in `__tests__/`: `TestBed.solitary(ThingsService).compile()` from
  `@suites/unit`, mock `db.x.thing.paginate`, assert with
  `ThingEntity.safeParse(result).success`. Controller specs check delegation
  only (see `src/users/__tests__/`).
- **E2e** in `test/things.spec.ts`: `AppFactory.init()`, `await app.refresh()`,
  `app.signIn(TEST_USER.email, TEST_USER.password)` for a cookie,
  `app.request.get('/v1/things').set('Cookie', cookie)`, and
  `await app.close()` in `afterAll`. Cover each role the permissions
  distinguish, and the 404 for someone else's record. Add factories to
  `test/factory/entity.ts` and `dto.ts` as needed.

Run `yarn test` and `yarn test:e2e`.

## Finish

`yarn build && yarn lint`, then open `/docs` to check the operation and its
schemas. Tell the frontend to run `yarn gen` for the new types.
