# NextBudget

Local-first personal finance dashboard. Next.js 16 (App Router) + PostgreSQL (TypeORM).
UI text is **French**, code and identifiers are **English**.

## Commands
```
npm run dev        # dev server (needs DATABASE_URL)
npm run build      # production build (no database needed)
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run test       # vitest, no database
npm run db:migrate # sync schema from entities, seed defaults (idempotent)
npm run auth:reset # break-glass: back to open mode, or `-- <password>` to set one
```
`db:migrate` and `auth:reset` are standalone `tsx` scripts, so they do not read
`.env.local`. Pass `DATABASE_URL=... npm run ...`.

Definition of done: typecheck, lint, test and build all green, then commit to
`main` and push. No feature branches unless asked.

## Layering
```
app/                 pages + route handlers    @application, @domain (types), @shared
components/          React                     @domain + @application (types), @shared
libs/domain/         entities, VOs, services   nothing. No I/O, no outward imports
libs/application/    use cases                 @domain, @infrastructure (not client/schemas)
libs/infrastructure/ persistence, auth, parsers, categorize, ingest, estimation
libs/shared/         format, palette, theme    nothing
```
Three of these are **enforced by eslint**, not just described: `app/` may not import
`@infrastructure/*` except as a type, `libs/application/` may not import
`persistence/client` or `persistence/schemas`, and `libs/domain/` may not import outward
at all. All three were broken for a long time while this file said otherwise.

**Command and query are not symmetric.** Writes go through a repository port, because
that is where the invariants are. Reads that are genuinely read models — a figure shaped
for a screen, with no aggregate to rebuild — live in `libs/infrastructure/persistence/queries/`
and are re-exported by a thin `@application` module. That keeps SQL out of the
application layer without inventing an entity per dashboard tile. A thin facade there is
the design, not an omission.

Aliases `@domain/*`, `@application/*`, `@infrastructure/*`, `@shared/*`, `@/*` live in
tsconfig `paths` and are **mirrored in `vitest.config.mts`**, which does not read them.

**Use cases take their dependencies.** Every use case ends with an optional `deps`
parameter defaulting to the live wiring, so callers pass nothing and a test passes fakes:

```ts
export type EstimationDeps = { assets: Pick<AssetRepository, "findById" | "addEstimation">; ... };
const LIVE: EstimationDeps = { assets, geocode, fetchComparables };
export async function estimateAsset(id: number, now = new Date(), deps: EstimationDeps = LIVE)
```
`Pick` the repository down to the methods actually used, so a stand-in is two functions
rather than twenty. There is no DI container: the seam is the parameter list.

## Rules that are easy to break
- **Money is signed integer cents**, `bigint` in Postgres, exposed as JS numbers by a
  column transformer. Format only at the UI edge (`libs/shared/format.ts`).
- Every `app/api/**/route.ts` must `export const runtime = "nodejs"` (TypeORM and pg).
- **All persistence goes through a repository or a read model.** Ports in
  `libs/domain/repositories` (interfaces only), implementations and the composition root
  in `libs/infrastructure/persistence/repositories`; read models in
  `libs/infrastructure/persistence/queries`. Neither `app/` nor `libs/application/` may
  call `getDataSource()` or `createQueryBuilder()`.
- **No migrations.** `synchronize: true` derives the schema from
  `libs/infrastructure/persistence/schemas`, so connecting is the migration. Reads use
  `reconstitute` (a stored row was valid when written), writes go through the entity's
  `create()`, and `update()` re-validates the merged row.
- PATCH bodies use `patchSchema(xInputSchema)`, never `.partial()`: Zod 4 keeps
  `.default()` on a key made optional, so an omitted field would overwrite the stored value.
- Route handlers parse input, call a use case, map the result to HTTP, and hold no
  queries. **A decision taken in a handler is a decision nothing can test or reuse** —
  stamping an owner, defaulting a visibility, hashing a password all belong in the use
  case. Wrap writes in `handle()` from `app/api/_lib/respond.ts` so a broken invariant
  surfaces as its French message. Pass `badRequest` a `ZodError`, not its `.message`.
- A use case that has to refuse returns a result object (`{ ok: false, reason: ... }`),
  never an HTTP status: which code that becomes is the edge's business.
- Closed value sets are `as const` arrays in `libs/domain/enums`, not TS `enum`s.
- French locale everywhere: `1 234,56 €`, `15 mai 2026`, `15/05/2026`.
- No em dashes in prose, README or commit messages.

## Domain notes
- **Person is not user.** `persons` is everyone whose money is tracked (no login
  needed); `users` is auth; `persons.user_id` links them. Ownership shares
  (`asset_owners`, basis points) and contributions attach to persons, so they work in
  open mode. Three separate axes, never merged: ownership share, visibility, payment share.
- **Accounts** carry `kind` (`personal` | `joint`). Contributions match only against
  joint accounts. `opening_balance_cents` (+ optional date) is what makes a real
  balance possible: summing transactions alone gives net movement, not a balance.
- **Auth mode** is `settings.authMode` (`open` | `enforced`), not an env var. `open`
  resolves the single owner with no login. First run only, `db:migrate` seeds the
  owner's login from `NEXTBUDGET_OWNER_{NAME,EMAIL,PASSWORD}`.
- **Visibility scoping** (`libs/application/scope.ts`) filters to
  `owner_id = me OR visibility = 'shared' OR owner_id IS NULL`, a no-op in open mode.
  Transactions inherit visibility from their account.
- **Loans**: `loan_prepayments` rebuild the schedule rather than adjusting a stored
  balance. `mode: "duration"` keeps the instalment, `"payment"` redraws it.
  `Asset.outstandingCents` derives the balance from the schedule and must be given the
  prepayments, or it reports a debt already paid down.
- **Property estimation** is on demand only: BAN geocoder, then DVF's per-commune CSVs.
  Nothing is stored, and nothing leaves the machine on a page load.

## Import and categorisation
- Import is a browser upload to `/api/ingest`, parsed in memory (`.csv`, `.tsv`, `.txt`).
  New bank: add `libs/infrastructure/ingest/parsers/<name>.ts` and register it in
  `registry.ts`. Reuse `parseAmountToCents` and `normalizeDescription`.
- **Dedup hash** is `sha256(date|amountCents|normalizedDescription)`, plus `|#n` for the
  nth occurrence in the account. Occurrence 0 omits the suffix, so old rows still match.
  Ingest counts occurrences (`ingest/dedup.ts`): a fingerprint appearing k times in the
  file and e times in the account writes k - e rows. Uniqueness is per account.
- Three layers decide a category, merged by `libs/application/categorize/engine.ts`:
  your `rules`, synthetic rules from contributions (priority 40), and the shipped
  catalogue in `libs/infrastructure/categorize/catalog` (evaluated at runtime, never
  seeded). Ordering: priority ascending, then longer matched pattern, then user before catalog.
- `merchant_overrides` stores one decision, `disabled`. A merchant cannot be re-pointed
  at another category: a kind maps to a category and that mapping ships with the release.
  Disagreeing with it is what a `rules` row is for, and a rule outranks the catalogue.
- Contributed merchants stay generic (national chains). Patterns are `contains` on the
  normalised description, 4 characters minimum unless allowlisted in `catalog/testing.ts`.
  One test file per catalogue file.

## Investigating the database
Do **not** write throwaway scripts. Use psql:
```bash
docker compose exec db psql -U nextbudget nextbudget -c "SELECT ..."
```
`scripts/` is for things impossible in a one-liner, and they are throwaway.

## Deployment
CI publishes `ghcr.io/fallais/nextbudget` on every push to `main` and any `v*` tag.
Self-host with `docker-compose.yaml`: `docker compose up -d`, then
`docker compose exec app npm run db:migrate` on the first run and after entity changes.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
