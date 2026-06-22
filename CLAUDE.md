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
```

## Conventions
- Amounts stored as signed integer **cents** (Postgres `bigint`, exposed as JS numbers
  via a column transformer); format only at the UI edge (`lib/format.ts`).
- All `app/api/**/route.ts` must `export const runtime = 'nodejs'` (TypeORM/pg).
- French locale for dates/currency: `1 234,56 €`, `15 mai 2026`, `15/05/2026`.
- Transaction dedup hash: `sha256(date|amountCents|normalizedDescription)`; the
  `transactions.hash` unique index enforces it. Ingest treats Postgres error
  `23505` as a duplicate.
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
- `app/(dashboard)/` — pages (sidebar shell)
- `app/api/` — route handlers
- `lib/db/` — entities, client (DataSource), queries, stats, seed
- `lib/ingest/` — parser registry + CSV parser; PDF stubbed
- `lib/categorize/` — rule engine + normalize; `llm.ts` is a v2 stub
- `lib/categorize/packs/` — pattern packs (see below); `core/` = open-source defaults
- `components/{layout,dashboard,transactions,categories,import,ui}/`

## Pattern packs (categorization defaults)
Default merchant→category patterns live as **YAML packs**, not hardcoded in seed.
- `lib/categorize/packs/core/*.yaml` — open-source defaults (well-known FR/EU
  chains). Community contributions add patterns here. Validated by a Zod schema
  (`lib/categorize/packs/schema.ts`). **Seeded into the `rules` table** at
  `db:migrate` (editable afterwards in the Rules UI).
- `PATTERN_PACKS` env (comma-separated file/dir paths, or an installed package
  dir) loads **extra packs at runtime** as a fallback layer *below* the DB rules
  (user rules always win). Used for private/personal packs and the proprietary
  SaaS "premium" pack — these are **never** written to the DB.
- Keep merchant rules **generic** (national/international chains). Put hyper-local
  or personal merchants in a local pack (`*.local.yaml`, gitignored).

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
