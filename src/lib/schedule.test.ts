import { describe, it, expect } from "vitest";
import { defaultCalendar } from "./calendar";
import { csvCell, projectCsv } from "./export";
import {
  executedValue,
  measuredValue,
  newTask,
  normalizeProject,
  parseBRNumber,
  physicalProgress,
  plannedToday,
  reschedule,
  sCurve,
  stageValue,
  taskDelay,
  totalWeight,
  weightFromValue,
  wouldCreateCycle,
  type Task,
} from "./schedule";

const cal = defaultCalendar();
const p = (tasks: Task[], extra = {}) => normalizeProject({ id: "p", name: "", tasks, ...extra });

describe("physical progress", () => {
  it("is weighted by stage weight", () => {
    const proj = p([newTask({ weight: 20, progress: 100 }), newTask({ weight: 80, progress: 50 })]);
    expect(physicalProgress(proj)).toBe(60);
  });
  it("uses equal weights when no stage has a weight", () => {
    expect(physicalProgress(p([newTask({ progress: 100 }), newTask({ progress: 0 })]))).toBe(50);
  });
  it("is 0 with no stages", () => expect(physicalProgress(p([]))).toBe(0));
});

describe("normalizeProject", () => {
  it("fills fields missing from older saved projects", () => {
    const old = normalizeProject({
      id: "a",
      name: "Antigo",
      color: 2,
      tasks: [
        {
          id: "s",
          name: "",
          start: "2026-01-05",
          end: "2026-01-09",
          owner: "",
          status: "done",
        } as Task,
      ],
    });
    expect(old).toMatchObject({
      client: "",
      orderValue: 0,
      color: 2,
      phase: "execucao",
      measurements: [],
    });
    expect(old.calendar.workweek).toBe("mon-fri");
    expect(old.tasks[0]).toMatchObject({
      weight: 0,
      progress: 100,
      kind: "task",
      predecessors: [],
    });
  });
});

describe("values", () => {
  it("computes stage value from weight and back", () => {
    expect(stageValue(250000, 12.5)).toBe(31250);
    expect(weightFromValue(250000, 31250)).toBe(12.5);
    expect(weightFromValue(0, 100)).toBe(0);
  });
  it("sums weights", () =>
    expect(totalWeight(p([newTask({ weight: 10 }), newTask({ weight: 70.5 })]))).toBe(80.5));
  it("computes executed and measured values", () => {
    const a = newTask({ id: "a", weight: 40, progress: 50 });
    const proj = p([a], {
      orderValue: 100000,
      measurements: [
        { id: "m", date: "2026-01-10", taskId: "a", percent: 25, bm: "", invoice: "" },
      ],
    });
    expect(executedValue(proj)).toBe(20000);
    expect(measuredValue(proj)).toBe(10000);
  });
});

describe("dependencies", () => {
  it("pushes successors after their predecessors, keeping working-day duration", () => {
    const a = newTask({ id: "a", start: "2026-11-16", end: "2026-11-19" }); // Mon..Thu
    const b = newTask({ id: "b", start: "2026-11-16", end: "2026-11-17", predecessors: ["a"] }); // 2 working days
    const [, nb] = reschedule([a, b], cal);
    expect(nb).toMatchObject({ start: "2026-11-23", end: "2026-11-24" }); // 20/11 is a holiday
  });
  it("never pulls a successor back", () => {
    const a = newTask({ id: "a", start: "2026-11-16", end: "2026-11-17" });
    const b = newTask({ id: "b", start: "2026-12-01", end: "2026-12-02", predecessors: ["a"] });
    expect(reschedule([a, b], cal)[1]).toMatchObject({ start: "2026-12-01" });
  });
  it("detects cycles", () => {
    const a = newTask({ id: "a" });
    const b = newTask({ id: "b", predecessors: ["a"] });
    expect(wouldCreateCycle([a, b], "a", "b")).toBe(true);
    expect(wouldCreateCycle([a, b], "b", "a")).toBe(false);
  });
});

describe("delays", () => {
  it("reports overdue and slip in working days", () => {
    const t = newTask({
      start: "2026-11-09",
      end: "2026-11-13",
      progress: 50,
      baselineStart: "2026-11-09",
      baselineEnd: "2026-11-11",
    });
    expect(taskDelay(t, cal, "2026-11-18")).toEqual({ overdue: 3, slip: 2 });
  });
});

describe("S-curve", () => {
  it("goes from 0 to 100% and matches planned today", () => {
    const proj = p([newTask({ weight: 100, start: "2026-11-02", end: "2026-11-29" })]);
    const curve = sCurve(proj, "2026-11-15");
    expect(curve[0]!.forecast).toBeGreaterThan(0);
    expect(curve.at(-1)!.forecast).toBe(100);
    expect(plannedToday(proj, "2026-11-15")).toBe(50);
  });
});

describe("parseBRNumber", () => {
  it.each([
    ["1.234,56", 1234.56],
    ["R$ 250.000,00", 250000],
    ["1234,5", 1234.5],
    ["1234.5", 1234.5],
    ["250.000", 250000],
    ["12,5%", 12.5],
  ])("parses %s", (text, n) => expect(parseBRNumber(text)).toBe(n));
  it("rejects text", () => expect(parseBRNumber("abc")).toBeNaN());
});

describe("CSV export", () => {
  it("escapes separators and quotes", () => {
    expect(csvCell('a;b "c"')).toBe('"a;b ""c"""');
    expect(csvCell("simples")).toBe("simples");
  });
  it("uses pt-BR numbers and dates", () => {
    const csv = projectCsv(
      p([newTask({ name: "Pintura", start: "2026-11-16", end: "2026-11-27", weight: 12.5 })], {
        orderValue: 1000.5,
      }),
    );
    expect(csv).toContain("Valor do pedido (R$);1000,5");
    expect(csv).toContain("Pintura;Etapa;;16/11/2026;27/11/2026;9;12,5;125,06");
  });
});
