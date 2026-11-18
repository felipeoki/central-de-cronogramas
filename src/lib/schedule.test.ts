import { describe, it, expect } from "vitest";
import { normalizeProject, progress, type Status, type Task } from "./schedule";
const t = (status: Status): Task => ({ id: "x", name: "", start: "", end: "", owner: "", status });
const p = (tasks: Task[]) => normalizeProject({ id: "p", name: "", tasks });
describe("progress", () => {
  it("is share of done tasks", () =>
    expect(progress(p([t("done"), t("todo"), t("doing"), t("done")]))).toBe(50));
  it("is 0 with no tasks", () => expect(progress(p([]))).toBe(0));
});
describe("normalizeProject", () => {
  it("fills registration fields missing from older saved projects", () => {
    const old = normalizeProject({ id: "a", name: "Antigo", color: 2, tasks: [] });
    expect(old).toEqual({
      id: "a",
      name: "Antigo",
      client: "",
      manager: "",
      budget: "",
      order: "",
      color: 2,
      tasks: [],
    });
  });
});
