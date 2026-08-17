# Couple support — implementation plan

Status legend: `[ ]` todo · `[x]` done · `[~]` in progress

## Settled decisions

1. **Person = domain, User = auth.** Ownership shares hang off `persons`, so they
   work in solo/open mode with nobody logging in. `persons.user_id` links to a
   login when there is one.
2. **Config lives in the DB `settings` table, edited from the UI.** Env stays for
   infra only (`DATABASE_URL`, `TZ`, `PATTERN_PACKS`); break-glass gets npm scripts.
3. **Privacy ⇒ auth.** One switch, not two — visibility separation without login
   is theatre (`lib/auth/index.ts:42`).
4. **Three orthogonal axes, never merged:** ownership share (how much is yours) ·
   visibility (whether it's visible to the other) · payment share (who funds it).

## The core problem

`visibility` is a boolean, and it works fine for *flows* that belong wholly to one
person (budgets, contributions). Patrimoine is a *stock* that can be co-owned in a
proportion, and a boolean cannot tell 50/50 from 60/40.

This is already a latent bug: `getNetWorth()` sums `a.valueCents` whole for every
visible asset (`lib/db/assets.ts:41-46`). Two users in enforced mode with a shared
house → both see the full value, same house counted twice. Phase C fixes it.

## Dependency order

```
0 ──▶ A ──┬──▶ B ──┬──▶ D ──▶ E
          └──▶ C ──┘
```

`0` working tree · `A` persons↔users · `B` comptes · `C` quotes-parts ·
`D` réglages · `E` vues couple

**C only depends on A.** B and C are independent of each other.

---

## Phase 0 — Land the working tree

- [x] Verify the seven modified files typecheck, test and lint clean
- [x] Fix a pre-existing `npm run typecheck` failure (see below)
- [x] Commit them

**Pre-existing typecheck breakage, fixed here.** `npm run typecheck` was already
red before any of this work: in vitest 4.1.9 the `vitest/config` subpath's types
entry (`node_modules/vitest/config.d.ts`) re-exports from `"vitest/config"`, which
resolves straight back to itself, so `defineConfig` is never exported. Renamed to
`vitest.config.mts` (the tsconfig `include` already listed `**/*.mts`) and replaced
`defineConfig` with a plain object checked via `satisfies { test: TestUserConfig }`
from `vitest/node`, which has no cycle. Typecheck has to be a trustworthy gate for
every phase below, so this had to go first.

Six files add `items={{...}}` to Base UI `<Select>` roots so the trigger renders
the French label instead of the raw value. `components/assets/asset-form.tsx`
(+135/−32) adds per-nature type lists, `changeKind()` resnapping invalid types,
and the "also record the mortgage" checkbox.

Do this first: Phase C rewrites `asset-form.tsx` substantially. That mortgage
checkbox is the natural place for Phase C's `linked_asset_id`.

---

## Phase A — Persons ↔ users

**Goal:** a household member can map to a login. Today `persons.user_id` is
declared and then only ever *nulled* (`app/api/users/[id]/route.ts:88`) — never
set, never read.

**Schema:** none. The column exists (`lib/db/entities.ts:304`).

- [ ] `lib/validation.ts:32` — `personInputSchema` accepts `userId: number | null`
- [ ] `app/api/persons/route.ts`, `[id]/route.ts` — accept and persist the link
- [ ] `lib/db/household.ts` *(new)* — `listMembers()` joining persons + users
- [ ] `lib/db/seed.ts:82` — in `backfillOwnership`, ensure a `Person` exists for
      the owner user
- [ ] `components/persons/person-form.tsx` — optional "compte utilisateur" select

The seed step matters: without it a solo user has zero person rows until they
visit `/apports`, and Phase C's share picker would have nobody to assign to.

---

## Phase B — Accounts CRUD + per-account import

**Goal:** actually be able to have three accounts. Today
`getOrCreateDefaultAccount()` takes `find({ take: 1 })` — the first account,
whatever it is — or creates "Compte courant" (`lib/ingest/index.ts:44-51`), and
`/api/accounts` is GET-only. Every import lands in the same account.

**Schema:** `accounts.kind` text default `'personal'` — `personal` | `joint`.

Why an explicit column rather than deriving from `visibility`: joint-ness is a
fact about the *bank account*, and Phase E needs it to scope contribution
matching. Today a salary landing in a personal account can match a contribution
pattern, because matching runs over every transaction in scope
(`lib/db/contributions.ts:72-78`).

- [ ] `lib/db/entities.ts:236` — `AccountEntity` + `kind`
- [ ] `lib/validation.ts` — `accountInputSchema`
- [ ] `app/api/accounts/route.ts` — add `POST`
- [ ] `app/api/accounts/[id]/route.ts` *(new)* — `PATCH` / `DELETE`
- [ ] `lib/ingest/index.ts:44-51,182` — accept an `accountId`; default lookup
      becomes fallback only
- [ ] `app/api/ingest/route.ts` — read `accountId` from the multipart form
- [ ] `components/import/import-button.tsx` — account selector
- [ ] `app/(dashboard)/comptes/page.tsx` + `components/accounts/` *(new)*
- [ ] `components/layout/sidebar.tsx` — nav entry
- [ ] `lib/db/seed.ts` — backfill existing account → `kind='personal'`

**Risk:** no DB-level FKs, so `DELETE` on an account with transactions would
orphan them silently. Block deletion when `count(transactions) > 0` and say so in
the error, consistent with the category/person DELETE routes.

**Free win:** the transactions account filter already exists, gated behind
`accounts.length > 1` (`components/transactions/filters.tsx:249`) — it appears on
its own.

---

## Phase C — Ownership shares for patrimoine

**Goal:** one apartment owned 100% by one person, one house owned 60/40, correct
net worth per person and for the household.

**Schema:**

```
asset_owners (id, asset_id, person_id, share_bps)
  unique (asset_id, person_id) · index (asset_id)

assets.linked_asset_id  int null   -- pairs a liability with the asset it finances
```

Basis points to match the existing `interest_rate_bps` convention. A join table
rather than `owner_id + share_bps` on `assets`: a percentage column forces you to
duplicate the asset row to express 60/40, which duplicates its valuations and its
mortgage link too.

**Invariants** (app-level, matching the no-FK-constraints convention):

- Shares for an asset sum to `10000`. Reject writes that don't.
- **An asset with no `asset_owners` rows reads as 100% to `assets.owner_id`.**
  Keeps every existing row correct without a data migration, and keeps solo mode
  working untouched.

- [ ] `lib/db/entities.ts:383,449` — `AssetOwnerEntity`, `assets.linked_asset_id`,
      add to `ALL_ENTITIES`
- [ ] `lib/db/assets.ts:32-60,69` — share-aware net worth + history,
      `getNetWorthByPerson()`
- [ ] `lib/validation.ts:138` — `assetInputSchema` gains
      `owners: [{personId, shareBps}]`
- [ ] `app/api/assets/route.ts:23`, `[id]/route.ts` — write owner rows
      transactionally with the asset
- [ ] `components/assets/asset-form.tsx` — share picker, three presets:
      **Commun 50/50** · **À moi** · **Personnalisé…**; the mortgage checkbox
      defaults the loan's shares from the house's
- [ ] `components/assets/assets-pane.tsx` — show the share on each row
- [ ] `app/(dashboard)/patrimoine/page.tsx` — per-person cards alongside the
      household total
- [ ] tests — sum-to-10000, per-person net worth, legacy asset with no owner rows

**Accepted limitation:** shares are not versioned. Buying out a partner mid-loan
would retroactively rewrite history, since `asset_valuations` is already a time
series. Rare enough to defer — the join table is what lets `from_date` be added
later without a rewrite.

**Deliberately separate:** ownership share ≠ payment share. A house owned 50/50
can be funded 70/30 through the joint account; that second fact already lives in
`contributions` + `fixed_expenses`. Show both, do not reconcile them.

---

## Phase D — Settings page, wizard, break-glass

**Goal:** make the above configurable by the non-technical half of the couple.
There is no settings page today (`/settings` 404s); the sidebar auth prompt is the
only config surface.

- [ ] `app/(dashboard)/parametres/page.tsx` *(new)* — **Foyer** (members),
      **Confidentialité** (single privacy switch, reusing
      `components/auth/enable-auth-dialog.tsx`), **Comptes** shortcut
- [ ] `settings.household` → `solo` | `couple`, written like `authMode`
      (`app/api/auth/setup/route.ts:36` — `settings.key` is the PK, `save` upserts)
- [ ] first-run wizard: *Solo ou couple ? → noms → comptes → privé ou partagé ?*
- [ ] `scripts/auth-reset.ts` + `npm run auth:reset` — reset the owner password /
      drop back to `open`. Enforcing auth and forgetting the password is currently
      an unrecoverable lockout. A legitimate ops tool, not a throwaway script.

---

## Phase E — Couple views

- [ ] **Apports** — scope contribution matching to `kind='joint'` transactions
      (depends on B); removes the false-positive class above
- [ ] **Dashboard** — household by default, per-person toggle in couple mode
- [ ] **Patrimoine** — per-person net worth from Phase C

**Out of scope for v1:** who-owes-whom settlement, and splitting a single
transaction across two people. Both real, both big, neither needed to answer
"what's mine, what's ours".

---

## Cross-cutting

**No migrations.** `synchronize: true` derives the schema from entities. New
nullable columns, new columns with defaults, and new tables are all safe. Run
`npm run db:migrate` after B and after C.

**Every phase must be a no-op for a solo user.** `getScope()` returns
`{scoped: false}` in open mode and all the scope helpers no-op
(`lib/db/scope.ts:15-19`), so the couple work rides the same path rather than
forking it. Verify after each phase that a single-account, single-person setup
renders identically.

**Tests** (`npm run test`, vitest, no DB): the share math is the part worth
covering. Amortization logic is untouched.
