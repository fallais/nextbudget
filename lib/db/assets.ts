import "server-only";
import { In } from "typeorm";
import { getDataSource } from "./client";
import { AssetEntity, AssetValuationEntity, type Asset } from "./entities";
import { getScope, applyOwnedScope } from "./scope";

export async function listAssets(): Promise<Asset[]> {
  const ds = await getDataSource();
  const qb = ds
    .getRepository(AssetEntity)
    .createQueryBuilder("a")
    .orderBy("a.kind", "ASC")
    .addOrderBy("a.name", "ASC");
  applyOwnedScope(qb, "a", await getScope());
  return qb.getMany();
}

export async function getVisibleAsset(id: number): Promise<Asset | null> {
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
  for (const a of assets) {
    if (a.kind === "asset") assetsCents += a.valueCents;
    else liabilitiesCents += a.valueCents;
    const key = `${a.kind}:${a.type}`;
    byTypeMap.set(key, (byTypeMap.get(key) ?? 0) + a.valueCents);
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
  const sign = (a: Asset) => (a.kind === "asset" ? 1 : -1);

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
