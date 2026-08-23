import { describe, it, expect } from "vitest";
import { projectBalance, type ScheduledFlow } from "./projection";

const base = {
  from: "2026-08-23",
  to: "2026-08-31",
  startingBalanceCents: 100_000,
  flows: [] as ScheduledFlow[],
  dailyDiscretionaryCents: 0,
};

describe("projecting the balance", () => {
  it("gives one closing balance per day, both ends included", () => {
    const p = projectBalance(base);
    expect(p.points).toHaveLength(9);
    expect(p.points[0].date).toBe("2026-08-23");
    expect(p.points[8].date).toBe("2026-08-31");
    expect(p.endBalanceCents).toBe(100_000);
  });

  it("takes the everyday spending off every day", () => {
    const p = projectBalance({ ...base, dailyDiscretionaryCents: 2_000 });
    expect(p.endBalanceCents).toBe(100_000 - 9 * 2_000);
    expect(p.discretionaryCents).toBe(18_000);
  });

  it("finds the day the account is lowest, not the last one", () => {
    // The rent leaves on the 25th and the salary lands on the 28th: the month
    // ends comfortably and the 27th does not.
    const p = projectBalance({
      ...base,
      flows: [
        { label: "Loyer", amountCents: -90_000, date: "2026-08-25" },
        { label: "Salaire", amountCents: 220_000, date: "2026-08-28" },
      ],
    });
    expect(p.low.date).toBe("2026-08-25");
    expect(p.low.balanceCents).toBe(10_000);
    expect(p.endBalanceCents).toBe(230_000);
  });

  it("still expects a charge whose due day has already gone by", () => {
    // Due on the 5th, unpaid, and today is the 23rd. Dropping it would report
    // money that is about to leave as money you have.
    const p = projectBalance({
      ...base,
      flows: [{ label: "Assurance", amountCents: -4_500, date: "2026-08-05" }],
    });
    expect(p.points[0].balanceCents).toBe(95_500);
    expect(p.scheduledOutCents).toBe(4_500);
  });

  it("ignores what falls past the horizon", () => {
    const p = projectBalance({
      ...base,
      flows: [{ label: "Loyer", amountCents: -90_000, date: "2026-09-05" }],
    });
    expect(p.endBalanceCents).toBe(100_000);
    expect(p.upcoming).toEqual([]);
  });

  it("keeps the two kinds of movement apart", () => {
    const p = projectBalance({
      ...base,
      dailyDiscretionaryCents: 1_000,
      flows: [
        { label: "Loyer", amountCents: -90_000, date: "2026-08-25" },
        { label: "Salaire", amountCents: 220_000, date: "2026-08-28" },
      ],
    });
    expect(p.scheduledOutCents).toBe(90_000);
    expect(p.scheduledInCents).toBe(220_000);
    expect(p.discretionaryCents).toBe(9_000);
    expect(p.endBalanceCents).toBe(100_000 - 90_000 + 220_000 - 9_000);
  });

  it("lists what is still to come, soonest first", () => {
    const p = projectBalance({
      ...base,
      flows: [
        { label: "Salaire", amountCents: 220_000, date: "2026-08-28" },
        { label: "Loyer", amountCents: -90_000, date: "2026-08-25" },
      ],
    });
    expect(p.upcoming.map((f) => f.label)).toEqual(["Loyer", "Salaire"]);
  });

  it("reports today when the horizon is today", () => {
    const p = projectBalance({ ...base, to: base.from });
    expect(p.points).toHaveLength(1);
    expect(p.low.date).toBe("2026-08-23");
  });
});
