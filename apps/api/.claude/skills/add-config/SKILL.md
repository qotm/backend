---
name: add-config
description: Add an environment variable to this API end to end — validated by the Zod config schema, mapped into the typed config, exposed through CustomConfigService, and documented in .env.example. Use whenever code needs a new setting, key, URL or credential, or when asked to "make X configurable".
---

# Add a config variable

App code never reads `process.env`. Every variable goes through
`src/common/services/config.service.ts`, so a missing or malformed one fails
the process at boot instead of at first use.

In `config.service.ts`:

1. **The type**: add the field to the right group in the `Config.Env`
   interface, or a new group (and its entry in `Env`).
2. **The schema**: a key in `schema`, using the helpers: `str()` for a
   required non-empty string, `num()` for a number,
   `z.string().default('…')` or `.optional()` when it has a safe default. A
   value that may legitimately be absent in development must not be `str()`.
3. **The mapping**: in `getVariables()`, put it in its group
   (`apiKey: env.THING_API_KEY || ''`).
4. **The getter**: a new group needs a getter on `CustomConfigService`
   (`get thing() { return this.config.get('thing', { infer: true }); }`).

Then:

5. **Document it** in `.env.example`, with a comment saying what it is and
   where to get it. Secrets get an empty value, never a real one.
6. **Tests**: if the schema requires it, add a value to `.env.test.example`
   (and your `.env.test`), or the test app will not boot.
7. **Read it** by injecting `CustomConfigService`: `this.config.thing.apiKey`.

A variable that belongs to an optional template feature carries that
feature's markers in every place above, like the existing ones do.

The only code that reads `process.env` directly is what runs before DI:
`src/lib/auth.ts`, `src/common/constants/options.ts` and the telemetry
config. Do not add to that list.

Set the real value in `.env`.
Deployed environments get theirs from Infisical; `yarn secrets` pulls them.
