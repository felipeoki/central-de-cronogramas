import { describe, expect, it } from "vitest";
import {
  dayOffReason,
  normalizeCalendar,
  type DayOff,
  addWorkdays,
  defaultCalendar,
  easter,
  iso,
  isWorkday,
  nationalHolidays,
  nextWorkday,
  workdaysBetween,
} from "./calendar";

const cal = defaultCalendar();

describe("holidays", () => {
  it("computes Easter", () => {
    expect(iso(easter(2025))).toBe("2025-04-20");
    expect(iso(easter(2026))).toBe("2026-04-05");
  });
  it("includes Good Friday and fixed national holidays", () => {
    const h = nationalHolidays(2026);
    expect(h.has("2026-04-03")).toBe(true);
    expect(h.has("2026-11-20")).toBe(true);
    expect(h.has("2026-12-25")).toBe(true);
  });
});

describe("working days", () => {
  it("skips weekends and holidays", () => {
    expect(isWorkday("2026-11-14", cal)).toBe(false); // Saturday
    expect(isWorkday("2026-11-20", cal)).toBe(false); // Consciência Negra (Friday)
    expect(isWorkday("2026-11-19", cal)).toBe(true);
  });
  it("counts working days inclusively", () => {
    // Mon 16/11 .. Fri 27/11/2026, minus the 20/11 holiday
    expect(workdaysBetween("2026-11-16", "2026-11-27", cal)).toBe(9);
    expect(workdaysBetween("2026-11-16", "2026-11-27", { ...cal, workweek: "mon-sat" })).toBe(10); // + Saturday 21/11
  });
  it("respects custom holidays and blackouts", () => {
    const c = {
      ...cal,
      holidays: [{ date: "2026-11-16", reason: "Aniversário da cidade" }],
      blackouts: [{ id: "b", start: "2026-11-23", end: "2026-11-24", description: "" }],
    };
    expect(workdaysBetween("2026-11-16", "2026-11-27", c)).toBe(6);
  });
  it("finds the next working day and adds working days", () => {
    expect(nextWorkday("2026-11-20", cal)).toBe("2026-11-23");
    expect(addWorkdays("2026-11-18", 3, cal)).toBe("2026-11-23"); // 18, 19, (20 holiday), 23
  });
});

describe("days off with reasons", () => {
  it("explains why a day is not worked", () => {
    const c = {
      ...cal,
      holidays: [{ date: "2026-11-16", reason: "Chuva forte, área interditada" }],
      blackouts: [
        { id: "b", start: "2026-11-23", end: "2026-11-24", description: "Férias coletivas" },
      ],
    };
    expect(dayOffReason("2026-11-16", c)).toBe("Chuva forte, área interditada");
    expect(dayOffReason("2026-11-20", c)).toBe(
      "Feriado nacional: Dia Nacional de Zumbi e da Consciência Negra",
    );
    expect(dayOffReason("2026-11-24", c)).toBe("Férias coletivas");
    expect(dayOffReason("2026-11-17", c)).toBe("");
  });
  it("migrates days off saved without a reason", () => {
    const c = normalizeCalendar({ holidays: ["2026-11-16"] as unknown as DayOff[] });
    expect(c.holidays).toEqual([{ date: "2026-11-16", reason: "" }]);
  });
});
