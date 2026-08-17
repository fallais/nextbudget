# BanqueJS

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
  via a column transformer); format only at the UI edge (`lib/format.ts`).
- All `app/api/**/route.ts` must `export const runtime = 'nodejs'` (TypeORM/pg).
- French locale for dates/currency: `1 234,56 €`, `15 mai 2026`, `15/05/2026`.
- Transaction dedup hash: `sha256(date|amountCents|normalizedDescription)` — a
  pure content fingerprint. Uniqueness is **per account**, enforced by the
  composite `transactions_account_hash_uniq (account_id, hash)` index: two people
  can genuinely pay the same merchant the same amount on the same day from
  different accounts. Ingest treats Postgres error `23505` as a duplicate.
- DB connection is `DATABASE_URL` (e.g. `postgres://banquejs:banquejs@localhost:5432/banquejs`).
- Import is a browser upload: the Import page POSTs files to `/api/ingest` as
  `multipart/form-data`; parsed in-memory. Accepted: `.csv`, `.tsv`, `.txt`.

## Data layer (TypeORM)
- `lib/db/entities.ts` — `EntitySchema` definitions (no decorators) + row interfaces.
- `lib/db/client.ts` — lazy, process-global `DataSource` (`getDataSource()`, `repo()`).
  `synchronize: true` (no migrations); the schema is derived from the entities.
  The DataSource initializes on first use, never at import → `next build` needs no DB.
- `lib/db/schema.ts` — backwards-compatible **type** barrel re-exporting entity row types.
- Aggregates use the query builder with `getRawMany()`/`getRawOne()`; wrap numeric
  results in `Number(...)`. Month buckets use `substr(date,1,7)` (date is ISO text).
- `typeorm`/`pg` are in `serverExternalPackages` (next.config.ts) so webpack does
  not bundle their optional drivers.
- No DB-level FK constraints (scalar FK columns); delete cascades that mattered are
  reproduced in app code (see category/person DELETE routes).

## Layout
- `app/(dashboard)/` — pages (sidebar shell); the layout guards auth via `getCurrentUser()`
- `app/api/` — route handlers (incl. `auth/`, `users/`, `assets/`, `visibility`)
- `lib/db/` — entities, client (DataSource), queries, stats, seed, `scope.ts`, `assets.ts`,
  `amortization.ts`, `household.ts` (persons ↔ users), `settings.ts` (household mode)
- `lib/auth/` — argon2 password hashing, DB-backed sessions, `getCurrentUser`/`getAuthMode`
- `lib/shares.ts` — pure ownership maths in basis points (DB-free, unit-tested)
- `lib/ingest/` — parser registry + CSV parser; PDF stubbed
- `lib/categorize/` — rule engine + normalize; `categories.yaml` + `defaults.ts`
  are the seeded defaults (see below); `llm.ts` is a v2 stub
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
  10000 = 100%, validated in app code (`lib/shares.ts`). An asset with **no** rows
  reads as wholly owned by its `owner_id` — that is what keeps legacy rows and solo
  installs correct with no migration. Three separate axes, never merged: ownership
  share (how much is yours) · visibility (who can see it) · payment share (who funds
  it, via `contributions`/`fixed_expenses`).
- **Config** (`settings.household` = `solo` | `couple`) is DB + UI like `authMode`,
  edited at `/parametres`. Env stays for deployment facts only.
- Every couple feature is gated so a **solo install is unchanged** — share pickers
  and account selectors appear only past one person / one account.

## PATCH bodies
Use `patchSchema(xInputSchema)` from `lib/validation.ts`, never
`xInputSchema.partial()`. Zod 4 keeps `.default()` on a key made optional by
`.partial()`, so an omitted field materialises its default and the route writes it
over the stored value. `patchSchema` unwraps defaults first.

## Auth & visibility
- **Auth mode** is in `settings.authMode` (`open` | `enforced`), not an env var.
  `open` (default) resolves the single owner with no login; `enforced` requires a
  session cookie (redirect to `/login`). Toggle via the sidebar "enable auth" prompt
  (`/api/auth/setup`). Sessions are opaque DB tokens (`lib/auth/session.ts`).
- **Scoping** (`lib/db/scope.ts`): list/aggregate queries filter to
  `owner_id = me OR visibility = 'shared' OR owner_id IS NULL` — a **no-op in open
  mode**. Transactions/stats inherit visibility from their **account**; accounts,
  contributions, fixed_expenses, budgets, assets are scoped directly. Writes stamp
  `owner_id`. Categories/rules stay shared config. Per-row toggles → `/api/visibility`.

## Categorization defaults
Default categories and merchant patterns live in **one YAML file**,
`lib/categorize/categories.yaml`, validated by a Zod schema in
`lib/categorize/defaults.ts`.
- **Seeded into `categories` + `rules`** at `db:migrate`, additively: only
  missing rows are created, so edits made in the Rules UI survive a re-run.
- After seeding, the **DB is the only source the engine reads**. There is no
  runtime overlay and no `PATTERN_PACKS` env — what the Rules page shows is what
  runs.
- A pattern is normally just a string; use the long form
  (`pattern`/`matchType`/`amountCondition`/`priority`) only when a rule needs it.
- Keep contributed merchants **generic** (national/international chains).
  Hyper-local or personal merchants belong in your own install, added from the
  Rules page — not in this file.

## Adding a new bank parser
Add `lib/ingest/parsers/<name>.ts` exporting a function returning `ParseResult`,
then register it in `lib/ingest/parsers/registry.ts` (extension- or
signature-based). Reuse `parseAmountToCents` and `normalizeDescription`.

## Deployment (Docker + GHCR)

CI (`.github/workflows/docker.yml`) builds and pushes the image to
`ghcr.io/${{ github.repository }}` (→ `ghcr.io/banquejs/banquejs`) on every push
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
docker compose exec db pg_dump -U banquejs banquejs > banquejs.sql
cat banquejs.sql | docker compose exec -T db psql -U banquejs banquejs
```

## DB investigation — no throwaway scripts
Do **not** create `scripts/foo.ts` for one-shot DB inspection. Use `psql`:

```bash
docker compose exec db psql -U banquejs banquejs -c \
  "SELECT date, description, amount_cents FROM transactions WHERE date >= '2026-05-01' AND amount_cents > 0 ORDER BY date LIMIT 20;"
```

`scripts/` is reserved for things genuinely impossible in a one-liner (multi-step
bulk fixes the user explicitly approved). Treat them as throwaway — propose
deletion once done. Investigation queries leave **no files behind**.
