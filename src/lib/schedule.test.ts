import { describe, it, expect } from "vitest";
import {
  normalizeProject,
  parseBRNumber,
  progress,
  stageValue,
  totalWeight,
  weightFromValue,
  type Status,
  type Task,
} from "./schedule";
const t = (status: Status, weight = 0): Task => ({
  id: "x",
  name: "",
  start: "",
  end: "",
  owner: "",
  status,
  weight,
});
const p = (tasks: Task[]) => normalizeProject({ id: "p", name: "", tasks });
describe("progress", () => {
  it("is share of done tasks", () =>
    expect(progress(p([t("done"), t("todo"), t("doing"), t("done")]))).toBe(50));
  it("is 0 with no tasks", () => expect(progress(p([]))).toBe(0));
});
describe("normalizeProject", () => {
  it("fills fields missing from older saved projects", () => {
    const old = normalizeProject({
      id: "a",
      name: "Antigo",
      color: 2,
      tasks: [{ id: "s", name: "", start: "", end: "", owner: "", status: "todo" } as Task],
    });
    expect(old).toMatchObject({
      client: "",
      manager: "",
      budget: "",
      order: "",
      orderValue: 0,
      color: 2,
    });
    expect(old.tasks[0]?.weight).toBe(0);
  });
});
describe("stage value and weight", () => {
  it("computes stage value from weight", () => expect(stageValue(250000, 12.5)).toBe(31250));
  it("computes weight from stage value", () => expect(weightFromValue(250000, 31250)).toBe(12.5));
  it("weight is 0 without order value", () => expect(weightFromValue(0, 100)).toBe(0));
  it("sums weights", () => expect(totalWeight(p([t("todo", 10), t("todo", 70.5)]))).toBe(80.5));
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
