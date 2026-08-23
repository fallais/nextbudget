import { describe, it, expect } from "vitest";
import {
  distanceMetres,
  estimate,
  fitLandWeight,
  MIN_SAMPLE,
  type Comparable,
} from "./estimation";

const HERE = { latitude: 43.6346, longitude: 1.392 };

/** A subject with neither of the two optional inputs given. */
const HERE_PLAIN = { ...HERE, landM2: null, condition: null };

/** A sale `metres` away, at `pricePerM2` euros, of `surfaceM2`. */
function sale(
  pricePerM2: number,
  surfaceM2: number,
  metres = 0,
  date = "2024-06-01",
  landM2 = 0,
): Comparable {
  return {
    valueCents: Math.round(pricePerM2 * surfaceM2 * 100),
    surfaceM2,
    landM2,
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
    const e = estimate({ ...HERE_PLAIN, surfaceM2: 100 }, around3000, 1000);
    expect(e?.pricePerM2Cents).toBe(3000_00);
    expect(e?.valueCents).toBe(300_000_00);
    expect(e?.sampleSize).toBe(5);
  });

  it("is not dragged off by one château", () => {
    // The reason for a median: a mean here would be 4 550 €/m².
    const withOutlier = [...around3000, sale(12_000, 100)];
    const e = estimate({ ...HERE_PLAIN, surfaceM2: 100 }, withOutlier, 1000);
    expect(e!.pricePerM2Cents).toBeLessThan(3200_00);
  });

  it("reports a range, not just a number", () => {
    const e = estimate({ ...HERE_PLAIN, surfaceM2: 100 }, around3000, 1000)!;
    expect(e.lowCents).toBeLessThan(e.valueCents);
    expect(e.highCents).toBeGreaterThan(e.valueCents);
  });

  it("refuses to answer on too small a sample", () => {
    expect(estimate({ ...HERE_PLAIN, surfaceM2: 100 }, around3000.slice(0, MIN_SAMPLE - 1), 1000)).toBeNull();
  });

  it("drops sales too far away, and says so if that empties the sample", () => {
    const faraway = around3000.map((c) => ({ ...c, latitude: HERE.latitude + 0.1 }));
    expect(estimate({ ...HERE_PLAIN, surfaceM2: 100 }, faraway, 1000)).toBeNull();
    expect(estimate({ ...HERE_PLAIN, surfaceM2: 100 }, faraway, 20_000)?.sampleSize).toBe(5);
  });

  it("compares like with like: a studio is no guide to a farmhouse", () => {
    // Same price per m², wildly different sizes — all filtered out.
    const studios = [2800, 2900, 3000, 3100, 3200].map((p) => sale(p, 25));
    expect(estimate({ ...HERE_PLAIN, surfaceM2: 100 }, studios, 1000)).toBeNull();
  });

  it("keeps sizes within the tolerance band", () => {
    const near = [2800, 2900, 3000, 3100, 3200].map((p, i) => sale(p, 80 + i * 10));
    expect(estimate({ ...HERE_PLAIN, surfaceM2: 100 }, near, 1000)?.sampleSize).toBe(5);
  });

  it("reports the span the sales are drawn from", () => {
    const spread = around3000.map((c, i) => ({ ...c, date: `202${i}-03-01` }));
    const e = estimate({ ...HERE_PLAIN, surfaceM2: 100 }, spread, 1000)!;
    expect(e.oldestDate).toBe("2020-03-01");
    expect(e.newestDate).toBe("2024-03-01");
  });

  it("has nothing to say about a surface of zero", () => {
    expect(estimate({ ...HERE_PLAIN, surfaceM2: 0 }, around3000, 1000)).toBeNull();
  });

  it("leaves the figure alone when the plot is not known", () => {
    const land = { rateCents: 300_00, weight: 1 };
    const e = estimate({ ...HERE_PLAIN, surfaceM2: 100 }, around3000, 1000, land)!;
    expect(e.valueCents).toBe(e.marketCents);
    expect(e.landAdjustmentCents).toBe(0);
    expect(e.comparableLandM2).toBeNull();
  });

  it("pays for a plot bigger than the neighbours', and charges for a smaller one", () => {
    const onPlots = [2800, 2900, 3000, 3100, 3200].map((p) => sale(p, 100, 0, "2024-06-01", 500));
    const land = { rateCents: 200_00, weight: 0.5 };
    const big = estimate({ ...HERE_PLAIN, surfaceM2: 100, landM2: 1500 }, onPlots, 1000, land)!;
    const small = estimate({ ...HERE_PLAIN, surfaceM2: 100, landM2: 100 }, onPlots, 1000, land)!;

    expect(big.comparableLandM2).toBe(500);
    // 1 000 m² more than the median plot, at half of 200 €/m².
    expect(big.landAdjustmentCents).toBe(100_000_00);
    expect(big.valueCents).toBe(big.marketCents + 100_000_00);
    expect(small.landAdjustmentCents).toBe(-40_000_00);
    // The band moves with the figure rather than widening around it.
    expect(big.highCents - big.lowCents).toBe(small.highCents - small.lowCents);
  });

  it("refuses a plot adjustment that would wipe out the house", () => {
    const onPlots = [2800, 2900, 3000, 3100, 3200].map((p) => sale(p, 100, 0, "2024-06-01", 50_000));
    const land = { rateCents: 500_00, weight: 1 };
    const e = estimate({ ...HERE_PLAIN, surfaceM2: 100, landM2: 200 }, onPlots, 1000, land)!;
    expect(e.landAdjustmentCents).toBe(0);
    expect(e.valueCents).toBe(e.marketCents);
  });

  it("applies the declared condition to the whole property, plot included", () => {
    const onPlots = [2800, 2900, 3000, 3100, 3200].map((p) => sale(p, 100, 0, "2024-06-01", 500));
    const land = { rateCents: 200_00, weight: 0.5 };
    const e = estimate(
      { ...HERE_PLAIN, surfaceM2: 100, landM2: 1500, condition: "a_renover" },
      onPlots,
      1000,
      land,
    )!;
    expect(e.conditionAdjustmentCents).toBe(
      Math.round((e.marketCents + e.landAdjustmentCents) * -0.2),
    );
    expect(e.valueCents).toBe(e.marketCents + e.landAdjustmentCents + e.conditionAdjustmentCents);
  });

  it("says nothing about condition when the owner has not", () => {
    expect(estimate({ ...HERE_PLAIN, surfaceM2: 100 }, around3000, 1000)!.conditionAdjustmentCents)
      .toBe(0);
  });

  it("keeps the price per m² agreeing with the figure it prints", () => {
    const onPlots = [2800, 2900, 3000, 3100, 3200].map((p) => sale(p, 100, 0, "2024-06-01", 500));
    const e = estimate(
      { ...HERE_PLAIN, surfaceM2: 100, landM2: 1500, condition: "neuf" },
      onPlots,
      1000,
      { rateCents: 200_00, weight: 0.5 },
    )!;
    expect(e.pricePerM2Cents).toBe(Math.round(e.valueCents / 100));
  });
});

describe("fitLandWeight", () => {
  const RADII = [1000];

  /** `n` sales whose price is `base` plus `perM2` for every m² of plot. */
  function market(n: number, base: number, perM2: number, plot: (i: number) => number) {
    return Array.from({ length: n }, (_, i) => {
      const landM2 = plot(i);
      const value = base + perM2 * landM2;
      return {
        valueCents: Math.round(value * 100),
        surfaceM2: 100,
        landM2,
        date: "2024-06-01",
        latitude: HERE.latitude + (i % 5) / 111_320,
        longitude: HERE.longitude,
      };
    });
  }

  it("has no opinion without a rate for bare ground", () => {
    expect(fitLandWeight(market(60, 300_000, 100, (i) => 200 + i * 40), null, RADII)).toBeNull();
  });

  it("stays out of the way when too few sales carry a plot", () => {
    const tiny = market(10, 300_000, 100, (i) => 200 + i * 40);
    expect(fitLandWeight(tiny, 100_00, RADII)).toBeNull();
  });

  it("finds no weight where every plot is the same size", () => {
    // Nothing to learn from: plot size cannot explain a price it never varies with.
    const uniform = market(60, 300_000, 0, () => 400);
    expect(fitLandWeight(uniform, 200_00, RADII)).toBeNull();
  });

  it("picks up a market where the plot really does carry the price", () => {
    // Built so that a m² of plot is worth exactly the bare-ground rate.
    const priced = market(60, 200_000, 150, (i) => 200 + (i % 20) * 100);
    const fitted = fitLandWeight(priced, 150_00, RADII);
    expect(fitted).not.toBeNull();
    expect(fitted!.weight).toBeGreaterThanOrEqual(0.75);
    expect(fitted!.rateCents).toBe(150_00);
  });

  it("will not adopt a weight that barely beats doing nothing", () => {
    // Plot explains a sliver of the price. On a few hundred sales that sliver
    // is indistinguishable from noise, and believing it costs more than it pays.
    const faint = market(60, 300_000, 2, (i) => 200 + (i % 20) * 100);
    expect(fitLandWeight(faint, 150_00, RADII)).toBeNull();
  });

  it("does not let a plot rate through where it would make things worse", () => {
    // Price is flat whatever the plot, so any weight above zero adds error.
    const flat = market(60, 300_000, 0, (i) => 200 + i * 100);
    expect(fitLandWeight(flat, 400_00, RADII)).toBeNull();
  });
});