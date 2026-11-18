import { describe, it, expect } from "vitest";
import { progress } from "./schedule";
const t = (status: any) => ({ id: "x", name: "", start: "", end: "", owner: "", status });
describe("progress", () => {
  it("is share of done tasks", () => expect(progress({ id: "p", name: "", color: 0, tasks: [t("done"), t("todo"), t("doing"), t("done")] })).toBe(50));
  it("is 0 with no tasks", () => expect(progress({ id: "p", name: "", color: 0, tasks: [] })).toBe(0));
});
