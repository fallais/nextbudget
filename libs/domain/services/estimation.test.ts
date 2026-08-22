import { describe, it, expect } from "vitest";
import { distanceMetres, estimate, MIN_SAMPLE, type Comparable } from "./estimation";

const HERE = { latitude: 43.6346, longitude: 1.392 };

/** A sale `metres` away, at `pricePerM2` euros, of `surfaceM2`. */
function sale(pricePerM2: number, surfaceM2: number, metres = 0, date = "2024-06-01"): Comparable {
  return {
    valueCents: Math.round(pricePerM2 * surfaceM2 * 100),
    surfaceM2,
    date,
    latitude: HERE.latitude + metres / 111_320,
    longitude: HERE.longitude,
  };
}

describe("distanceMetres", () => {
  it("is zero for the same point", () => {
    expect(distanceMetres(HERE, HERE)).toBe(0);
  });

  it("measures a degree of latitude at about 111 km", () => {
    const d = distanceMetres(HERE, { ...HERE, latitude: HERE.latitude + 1 });
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });
});

describe("estimate", () => {
  const around3000 = [2800, 2900, 3000, 3100, 3200].map((p) => sale(p, 100));

  it("multiplies the median price per m² by the surface", () => {
    const e = estimate({ ...HERE, surfaceM2: 100 }, around3000, 1000);
    expect(e?.pricePerM2Cents).toBe(3000_00);
    expect(e?.valueCents).toBe(300_000_00);
    expect(e?.sampleSize).toBe(5);
  });

  it("is not dragged off by one château", () => {
    // The reason for a median: a mean here would be 4 550 €/m².
    const withOutlier = [...around3000, sale(12_000, 100)];
    const e = estimate({ ...HERE, surfaceM2: 100 }, withOutlier, 1000);
    expect(e!.pricePerM2Cents).toBeLessThan(3200_00);
  });

  it("reports a range, not just a number", () => {
    const e = estimate({ ...HERE, surfaceM2: 100 }, around3000, 1000)!;
    expect(e.lowCents).toBeLessThan(e.valueCents);
    expect(e.highCents).toBeGreaterThan(e.valueCents);
  });

  it("refuses to answer on too small a sample", () => {
    expect(estimate({ ...HERE, surfaceM2: 100 }, around3000.slice(0, MIN_SAMPLE - 1), 1000)).toBeNull();
  });

  it("drops sales too far away, and says so if that empties the sample", () => {
    const faraway = around3000.map((c) => ({ ...c, latitude: HERE.latitude + 0.1 }));
    expect(estimate({ ...HERE, surfaceM2: 100 }, faraway, 1000)).toBeNull();
    expect(estimate({ ...HERE, surfaceM2: 100 }, faraway, 20_000)?.sampleSize).toBe(5);
  });

  it("compares like with like: a studio is no guide to a farmhouse", () => {
    // Same price per m², wildly different sizes — all filtered out.
    const studios = [2800, 2900, 3000, 3100, 3200].map((p) => sale(p, 25));
    expect(estimate({ ...HERE, surfaceM2: 100 }, studios, 1000)).toBeNull();
  });

  it("keeps sizes within the tolerance band", () => {
    const near = [2800, 2900, 3000, 3100, 3200].map((p, i) => sale(p, 80 + i * 10));
    expect(estimate({ ...HERE, surfaceM2: 100 }, near, 1000)?.sampleSize).toBe(5);
  });

  it("reports the span the sales are drawn from", () => {
    const spread = around3000.map((c, i) => ({ ...c, date: `202${i}-03-01` }));
    const e = estimate({ ...HERE, surfaceM2: 100 }, spread, 1000)!;
    expect(e.oldestDate).toBe("2020-03-01");
    expect(e.newestDate).toBe("2024-03-01");
  });

  it("has nothing to say about a surface of zero", () => {
    expect(estimate({ ...HERE, surfaceM2: 0 }, around3000, 1000)).toBeNull();
  });
});
