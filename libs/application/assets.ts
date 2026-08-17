import "server-only";
import { In, type EntityManager } from "typeorm";
import { getDataSource } from "@infrastructure/db/client";
import { AssetEntity, AssetOwnerEntity, AssetValuationEntity, PersonEntity } from "@infrastructure/db/schemas";
import type { AssetRow, AssetOwnerRow, PersonRow } from "@domain/entities";
import { toAsset } from "@infrastructure/db/mappers";
import { getScope, applyOwnedScope } from "@application/scope";
import { Ownership, Share, type OwnerShareRow } from "@domain/value-objects/share";

export async function listAssets(): Promise<AssetRow[]> {
  const ds = await getDataSource();
  const qb = ds
    .getRepository(AssetEntity)
    .createQueryBuilder("a")
    .orderBy("a.kind", "ASC")
    .addOrderBy("a.name", "ASC");
  applyOwnedScope(qb, "a", await getScope());
  return qb.getMany();
}

export async function getVisibleAsset(id: number): Promise<AssetRow | null> {
  const ds = await getDataSource();
  const qb = ds.getRepository(AssetEntity).createQueryBuilder("a").where("a.id = :id", { id });
  applyOwnedScope(qb, "a", await getScope());
  return qb.getOne();
}

export type NetWorth = {
  assetsCents: number;
  liabilitiesCents: number;
  netCents: number;
  byType: { kind: "asset" | "liability"; type: string; totalCents: number }[];
};

export async function getNetWorth(): Promise<NetWorth> {
  const ds = await getDataSource();
  const qb = ds.getRepository(AssetEntity).createQueryBuilder("a").where("a.is_active = true");
  applyOwnedScope(qb, "a", await getScope());
  const assets = await qb.getMany();

  let assetsCents = 0;
  let liabilitiesCents = 0;
  const byTypeMap = new Map<string, number>();
  for (const row of assets) {
    const asset = toAsset(row);
    if (asset.kind === "asset") assetsCents += asset.value.cents;
    else liabilitiesCents += asset.value.cents;
    const key = `${asset.kind}:${asset.type}`;
    byTypeMap.set(key, (byTypeMap.get(key) ?? 0) + asset.value.cents);
  }
  const byType = [...byTypeMap.entries()]
    .map(([k, totalCents]) => {
      const [kind, type] = k.split(":");
      return { kind: kind as "asset" | "liability", type, totalCents };
    })
    .sort((a, b) => b.totalCents - a.totalCents);

  return {
    assetsCents,
    liabilitiesCents,
    netCents: assetsCents - liabilitiesCents,
    byType,
  };
}

/** Ownership rows for the given assets, keyed by asset id. */
export async function listAssetOwners(
  assetIds: number[],
): Promise<Map<number, AssetOwnerRow[]>> {
  const byAsset = new Map<number, AssetOwnerRow[]>();
  if (assetIds.length === 0) return byAsset;
  const ds = await getDataSource();
  const rows = await ds.getRepository(AssetOwnerEntity).findBy({ assetId: In(assetIds) });
  for (const r of rows) {
    const arr = byAsset.get(r.assetId) ?? [];
    arr.push(r);
    byAsset.set(r.assetId, arr);
  }
  return byAsset;
}

/**
 * Who owns `asset`, and in what proportion.
 *
 * With no explicit rows the asset belongs wholly to the person behind
 * `assets.owner_id` — that is what keeps rows created before shares existed,
 * and every solo install, reading correctly with no data migration. If that
 * user has no person (or the asset has no owner at all) nobody is charged
 * with it: it still counts in the household total, but in no personal one.
 */
export function effectiveOwners(
  asset: AssetRow,
  explicit: AssetOwnerRow[] | undefined,
  personByUserId: Map<number, PersonRow>,
): OwnerShareRow[] {
  if (explicit && explicit.length > 0) {
    return explicit.map((o) => ({ personId: o.personId, shareBps: o.shareBps }));
  }
  const fallback = asset.ownerId != null ? personByUserId.get(asset.ownerId) : undefined;
  return fallback ? Ownership.sole(fallback.id).toRows() : [];
}

/**
 * Replace an asset's ownership rows. Caller validates the shares; this only
 * checks the persons exist, since a share pointing at a deleted person would
 * quietly vanish from every personal total.
 */
export async function replaceAssetOwners(
  manager: EntityManager,
  assetId: number,
  owners: OwnerShareRow[],
): Promise<{ error: string } | null> {
  const personIds = owners.map((o) => o.personId);
  const found = await manager.getRepository(PersonEntity).findBy({ id: In(personIds) });
  if (found.length !== personIds.length) {
    return { error: "Personne introuvable." };
  }
  const repo = manager.getRepository(AssetOwnerEntity);
  await repo.delete({ assetId });
  await repo.save(owners.map((o) => repo.create({ assetId, ...o })));
  return null;
}

export type PersonNetWorth = {
  personId: number;
  personName: string;
  assetsCents: number;
  liabilitiesCents: number;
  netCents: number;
};

export type NetWorthBreakdown = {
  household: NetWorth;
  byPerson: PersonNetWorth[];
  /** Signed net value belonging to no identified person. */
  unattributedNetCents: number;
};

/**
 * Net worth split by household member.
 *
 * The household total uses whole values; each person gets their share. Summing
 * the personal nets therefore reproduces the household net (give or take a
 * cent of rounding on indivisible splits), rather than double-counting a
 * jointly-owned house the way an unweighted per-user query would.
 */
export async function getNetWorthByPerson(): Promise<NetWorthBreakdown> {
  const ds = await getDataSource();
  const qb = ds.getRepository(AssetEntity).createQueryBuilder("a").where("a.is_active = true");
  applyOwnedScope(qb, "a", await getScope());
  const assets = await qb.getMany();

  const [owners, persons] = await Promise.all([
    listAssetOwners(assets.map((a) => a.id)),
    ds.getRepository(PersonEntity).find({ order: { name: "ASC" } }),
  ]);

  const personById = new Map(persons.map((p) => [p.id, p]));
  const personByUserId = new Map(
    persons.filter((p) => p.userId != null).map((p) => [p.userId as number, p]),
  );

  const totals = new Map<number, { assets: number; liabilities: number }>();
  let unattributedNetCents = 0;

  for (const row of assets) {
    // Through the entity: the sign of a liability and the size of a slice are
    // domain rules, not query-shaping details.
    const asset = toAsset(row);
    const shares = effectiveOwners(row, owners.get(row.id), personByUserId);
    if (shares.length === 0) {
      unattributedNetCents += asset.netWorthContribution.cents;
      continue;
    }
    for (const s of shares) {
      const slice = Share.fromBps(s.shareBps).applyTo(row.valueCents);
      const acc = totals.get(s.personId) ?? { assets: 0, liabilities: 0 };
      if (asset.kind === "asset") acc.assets += slice;
      else acc.liabilities += slice;
      totals.set(s.personId, acc);
    }
  }

  const byPerson: PersonNetWorth[] = [...totals.entries()]
    .map(([personId, t]) => ({
      personId,
      personName: personById.get(personId)?.name ?? "—",
      assetsCents: t.assets,
      liabilitiesCents: t.liabilities,
      netCents: t.assets - t.liabilities,
    }))
    .sort((x, y) => y.netCents - x.netCents);

  return { household: await getNetWorth(), byPerson, unattributedNetCents };
}

export type NetWorthPoint = { date: string; netCents: number };

/**
 * Reconstruct net worth over time from `asset_valuations`: at each valuation
 * date, each asset contributes its most recent valuation on/before that date
 * (falling back to its current value), signed by kind. Empty if no valuations.
 */
export async function getNetWorthHistory(): Promise<NetWorthPoint[]> {
  const ds = await getDataSource();
  const assets = (await listAssets()).filter((a) => a.isActive);
  if (assets.length === 0) return [];
  const assetIds = assets.map((a) => a.id);

  const valuations = await ds.getRepository(AssetValuationEntity).find({
    where: { assetId: In(assetIds) },
    order: { date: "ASC" },
  });
  if (valuations.length === 0) return [];

  const valsByAsset = new Map<number, { date: string; valueCents: number }[]>();
  for (const v of valuations) {
    const arr = valsByAsset.get(v.assetId) ?? [];
    arr.push({ date: v.date, valueCents: v.valueCents });
    valsByAsset.set(v.assetId, arr);
  }

  const dates = [...new Set(valuations.map((v) => v.date))].sort();
  const sign = (a: AssetRow) => (a.kind === "asset" ? 1 : -1);

  return dates.map((date) => {
    let net = 0;
    for (const a of assets) {
      const hist = valsByAsset.get(a.id) ?? [];
      let value = a.valueCents;
      for (const v of hist) {
        if (v.date <= date) value = v.valueCents;
        else break;
      }
      net += sign(a) * value;
    }
    return { date, netCents: net };
  });
}
