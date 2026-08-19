# NextBudget

Local-first personal finance dashboard. Next.js 15 (App Router) + PostgreSQL (TypeORM).
UI text is **French**, code/identifiers are **English**.

## Commands
```
npm run dev          # start dev server (needs a reachable Postgres via DATABASE_URL)
npm run build        # production build (does NOT need a database)
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run test         # vitest (unit tests, no DB)
npm run db:migrate   # connect, synchronize schema from entities, seed defaults (idempotent)
npm run auth:reset   # break-glass: drop back to open mode, or `-- <password>` to reset the owner's
```
`db:migrate` and `auth:reset` are standalone `tsx` scripts, so they do **not**
read `.env.local` (Next loads that, not node). Pass `DATABASE_URL=… npm run …`.

## Conventions
- Amounts stored as signed integer **cents** (Postgres `bigint`, exposed as JS numbers
  via a column transformer); format only at the UI edge (`libs/shared/format.ts`).
- All `app/api/**/route.ts` must `export const runtime = 'nodejs'` (TypeORM/pg).
- French locale for dates/currency: `1 234,56 €`, `15 mai 2026`, `15/05/2026`.
- Transaction dedup hash: `sha256(date|amountCents|normalizedDescription)` — a
  pure content fingerprint. Uniqueness is **per account**, enforced by the
  composite `transactions_account_hash_uniq (account_id, hash)` index: two people
  can genuinely pay the same merchant the same amount on the same day from
  different accounts. Ingest treats Postgres error `23505` as a duplicate.
- DB connection is `DATABASE_URL` (e.g. `postgres://nextbudget:nextbudget@localhost:5432/nextbudget`).
- Import is a browser upload: the Import page POSTs files to `/api/ingest` as
  `multipart/form-data`; parsed in-memory. Accepted: `.csv`, `.tsv`, `.txt`.

## Data layer (TypeORM)
- `libs/domain/entities/` — one file per entity: the class (invariants, behaviour)
  and its `*Row` type. `libs/infrastructure/persistence/schemas/` holds the matching
  `EntitySchema` definitions (no decorators), one file per table plus shared
  column fragments in `columns.ts`; `ALL_ENTITIES` in its `index.ts` is what the
  DataSource is given.
- `libs/infrastructure/persistence/client.ts` — lazy, process-global `DataSource`
  (`getDataSource()`, `repo()`). `synchronize: true` (no migrations); the schema is
  derived from the entities. The DataSource initializes on first use, never at
  import → `next build` needs no DB.
- **All persistence goes through a repository.** `libs/domain/repositories/`
  declares the ports (interfaces only, no TypeORM);
  `libs/infrastructure/persistence/repositories/` implements them, and its
  `index.ts` is the composition root exporting one instance per table
  (`accounts`, `transactions`, …). Nothing in `app/` may call `repo()`,
  `getDataSource()` or `createQueryBuilder()` — that is the rule the layering
  rests on.
- One generic `TypeOrmRepository` serves every table. Reads use `reconstitute`
  (a stored row was valid when written); **writes go through the entity's
  `create()`**, and `update()` re-validates the *merged* row, so a partial patch
  cannot leave a row its invariants would reject. Tables needing more than CRUD
  extend the port (`TransactionRepository`, `AssetRepository`, `UserRepository`…).
- Multi-table writes belong in the repository that owns the aggregate and run in
  `ds.transaction` — see `asset-repository.ts` (asset + ownership shares) and
  `user-repository.ts` (delete + detach references).
- Aggregates use the query builder with `getRawMany()`/`getRawOne()`; wrap numeric
  results in `Number(...)`. Month buckets use `substr(date,1,7)` (date is ISO text).
- `typeorm`/`pg` are in `serverExternalPackages` (next.config.ts) so webpack does
  not bundle their optional drivers.
- No DB-level FK constraints (scalar FK columns); delete cascades that mattered are
  reproduced in the repositories and in use cases (`@application/categories`,
  `@application/household`, `@application/users`).

## Route handlers
- Routes parse input, call a use case or repository, and map the result to HTTP.
  They hold no queries.
- `app/api/_lib/respond.ts` is the edge: `parseId`, `badRequest`/`notFound`/
  `conflict`/`ok`, and `handle()`, which maps a thrown `DomainError` to 400 and a
  Postgres unique violation to 409. Wrap write handlers in `handle()` so an
  invariant surfaces as its French message, not a 500.

## Layout — layered, dependencies point inward
```
app/            pages + route handlers   →  may use every layer
components/     React                    →  @domain (types), @shared
libs/domain/    entities, VOs, services  →  nothing. No I/O, no imports outward
libs/application/  use cases             →  @domain, @infrastructure
libs/infrastructure/  persistence, auth, parsers  →  @domain
libs/shared/    format, cn, icons        →  nothing
```
Aliases: `@domain/*`, `@application/*`, `@infrastructure/*`, `@shared/*`, `@/*`
(tsconfig `paths`; **mirrored in `vitest.config.mts`**, which does not read them).

- `libs/domain/ddd/` — `Entity` (identity equality), `AggregateRoot` (consistency
  boundary), `ValueObject`. No event machinery: nothing publishes events, and an
  unused event bus is a liability, not robustness.
- `libs/domain/entities/` — one file per entity. Each exports the **class**
  (behaviour + invariants, server-side) and its **`*Row` type** — the persisted
  shape, which doubles as the DTO, since class instances cannot cross into a
  Client Component. `create()` validates user input; `reconstitute()` trusts a
  stored row (re-validating on read would let a new rule break old data).
- `libs/domain/enums/` — closed value sets as `as const` arrays with the union
  derived from them, **not** TS `enum`s. See that folder's README for why.
- `libs/domain/value-objects/` — `Money` (signed cents), `Share`/`Ownership`
  (basis points; the 100 % invariant lives on the set), `period`,
  `normalized-description`.
- `libs/domain/services/` — `amortization` (loan cost + schedule),
  `categorization` (rule compiling and matching).
- `libs/domain/repositories/` — persistence **ports**: interfaces only, no TypeORM,
  so the dependency points inward and a use case can be tested against a fake.
- `libs/infrastructure/persistence/` — `client` (DataSource), `schemas/`
  (EntitySchemas, one per table), `repositories/` (port implementations +
  composition root), `errors`.
- `scripts/` — standalone `tsx` entrypoints: `db-migrate.ts` (`npm run db:migrate`,
  schema sync + additive seed) and `auth-reset.ts` (break-glass).
- `app/(dashboard)/` — pages (sidebar shell); the layout guards auth via
  `getCurrentUser()`. `app/api/` — route handlers.
- `components/{layout,dashboard,transactions,categories,import,assets,auth,budgets,persons,accounts,settings,ui}/`

## Household (couple support)
See `docs/couple-plan.md` for the full design and what was deliberately left out.
- **Person ≠ user.** `persons` is the domain concept (everyone whose money is
  tracked, no login needed); `users` is auth. `persons.user_id` links them.
  Ownership and contributions attach to **persons**, so they work in open mode.
- **Accounts** carry `kind` (`personal` | `joint`). Joint-ness is a fact about the
  bank account, distinct from `visibility`. Contributions are matched only against
  joint accounts, falling back to all visible ones when none is marked joint.
- **Ownership shares** live in `asset_owners (asset_id, person_id, share_bps)`,
  10000 = 100%, validated in app code (`libs/domain/value-objects/share.ts`). An asset with **no** rows
  reads as wholly owned by its `owner_id` — that is what keeps legacy rows and solo
  installs correct with no migration. Three separate axes, never merged: ownership
  share (how much is yours) · visibility (who can see it) · payment share (who funds
  it, via `contributions`/`fixed_expenses`).
- **Config** (`settings.household` = `solo` | `couple`) is DB + UI like `authMode`,
  edited at `/parametres`. Env stays for deployment facts only.
- Every couple feature is gated so a **solo install is unchanged** — share pickers
  and account selectors appear only past one person / one account.

## PATCH bodies
Use `patchSchema(xInputSchema)` from `libs/application/contracts/validation.ts`, never
`xInputSchema.partial()`. Zod 4 keeps `.default()` on a key made optional by
`.partial()`, so an omitted field materialises its default and the route writes it
over the stored value. `patchSchema` unwraps defaults first.

## Auth & visibility
- **Auth mode** is in `settings.authMode` (`open` | `enforced`), not an env var.
  `open` (default) resolves the single owner with no login; `enforced` requires a
  session cookie (redirect to `/login`). Toggle via the sidebar "enable auth" prompt
  (`/api/auth/setup`). Sessions are opaque DB tokens (`libs/infrastructure/auth/session.ts`).
- **Scoping** (`libs/application/scope.ts`): list/aggregate queries filter to
  `owner_id = me OR visibility = 'shared' OR owner_id IS NULL` — a **no-op in open
  mode**. Transactions/stats inherit visibility from their **account**; accounts,
  contributions, fixed_expenses, budgets, assets are scoped directly. Writes stamp
  `owner_id`. Categories/rules stay shared config. Per-row toggles → `/api/visibility`.

## Categorization (rules + merchant catalogue)
Three layers decide a category, merged into one ordered list by
`libs/application/categorize/engine.ts`:
1. **Your rules** — the `rules` table, edited on a category's page.
2. **Synthetic rules** — contributions, at priority 40, so an apport labelled
   "DE JEAN - EDF" is an apport and not an energy bill.
3. **The shipped catalogue** — `libs/infrastructure/categorize/catalog/*.ts`,
   evaluated **at runtime**, never seeded into `rules`.

Ordering is one comparison (`orderRules`): priority ascending, then the longer
matched pattern (so "UBER EATS" beats "UBER" with no hand-tuned priorities),
then `source: "user"` before `"catalog"`.

- **Where things live.** The *vocabulary* is domain (`libs/domain/enums/merchant-kind.ts`
  — kinds, their French labels, and the category **name** each files into) and so
  is the matching (`libs/domain/services/{categorization,merchant-catalog}.ts`).
  The *brands* are infrastructure: swapping `catalog/` for another country's
  changes no domain code. Assembly is application.
- **Overrides, not edits.** `merchant_overrides (merchant_key, category_id,
  disabled)` stores only what the user changed, so untouched entries keep
  improving with each release and "réinitialiser" is a `DELETE`. Managed on a
  category's page → `/api/merchants/[key]`.
- **Seeding** is now categories only (`default-categories.ts`); `db:migrate`
  also prunes `rules` rows still identical to a catalogue entry, left behind by
  the YAML era. An edited rule differs, so it is kept — and still wins.
- Contributed merchants stay **generic** (national/international chains).
  Hyper-local or personal merchants belong in your own install as a rule.
  Patterns are `contains` on the normalised description, ≥4 characters unless
  allowlisted in `catalog/testing.ts`; use `regex` with `\b…\b` for short names
  (`BUT`, `FLY`, `ASF`). One test file per catalogue file.

## Adding a new bank parser
Add `libs/infrastructure/ingest/parsers/<name>.ts` exporting a function returning `ParseResult`,
then register it in `libs/infrastructure/ingest/parsers/registry.ts` (extension- or
signature-based). Reuse `parseAmountToCents` and `normalizeDescription`.

## Deployment (Docker + GHCR)

CI (`.github/workflows/docker.yml`) builds and pushes the image to
`ghcr.io/${{ github.repository }}` (→ `ghcr.io/fallais/nextbudget`) on every push
to `main` and any `v*` tag.

**Self-host with Docker Compose** (app + Postgres — see `docker-compose.yaml`):
```bash
docker compose up -d
docker compose exec app npm run db:migrate   # first run: schema + seed
# → http://localhost:3000
```

**Upgrade:**
```bash
docker compose pull && docker compose up -d
docker compose exec app npm run db:migrate    # if entities changed (safe; idempotent)
```

**Backup / restore** (standard Postgres):
```bash
docker compose exec db pg_dump -U nextbudget nextbudget > nextbudget.sql
cat nextbudget.sql | docker compose exec -T db psql -U nextbudget nextbudget
```

## DB investigation — no throwaway scripts
Do **not** create `scripts/foo.ts` for one-shot DB inspection. Use `psql`:

```bash
docker compose exec db psql -U nextbudget nextbudget -c \
  "SELECT date, description, amount_cents FROM transactions WHERE date >= '2026-05-01' AND amount_cents > 0 ORDER BY date LIMIT 20;"
```

`scripts/` is reserved for things genuinely impossible in a one-liner (multi-step
bulk fixes the user explicitly approved). Treat them as throwaway — propose
deletion once done. Investigation queries leave **no files behind**.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
