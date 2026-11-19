import { beforeAll, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { LeaderReport } from "@/components/LeaderReport";
import { newTask, normalizeProject } from "@/lib/schedule";

beforeAll(() => {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

const a = newTask({
  id: "a",
  name: "Jateamento",
  owner: "Carlos",
  start: "2026-11-16",
  end: "2026-11-27",
  weight: 40,
  progress: 50,
  crew: 6,
});
const b = newTask({
  id: "b",
  name: "Pintura",
  start: "2026-11-30",
  end: "2026-12-04",
  weight: 60,
  predecessors: ["a"],
});
const project = normalizeProject({
  name: "Pintura tanque",
  client: "Cliente X",
  budget: "ORC-2026-045",
  order: "PO 4500123",
  orderValue: 987654.32,
  tasks: [a, b],
  measurements: [
    { id: "m", date: "2026-11-20", taskId: "a", percent: 30, bm: "BM 01", invoice: "NF 555" },
  ],
});

describe("leaders' print (no values)", () => {
  it("shows no monetary data", () => {
    const { container } = render(<LeaderReport project={project} />);
    const text = container.textContent ?? "";
    for (const forbidden of [
      "R$",
      "987",
      "Valor",
      "Peso",
      "Medi",
      "NF 555",
      "BM 01",
      "Fatur",
      "ORC-2026-045",
    ])
      expect(text).not.toContain(forbidden);
  });

  it("details start and end dates", () => {
    render(<LeaderReport project={project} />);
    expect(screen.getByText("Cronograma de execução")).toBeInTheDocument();
    expect(screen.getAllByText(/seg\.? 16\/11\/2026/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/sex\.? 27\/11\/2026/).length).toBeGreaterThan(0);
    // 16..27/11 has 9 working days (20/11 is a holiday) and 12 calendar days.
    const row = screen
      .getAllByText("Jateamento")
      .find((el) => el.closest("tr"))!
      .closest("tr")!;
    expect(row).toHaveTextContent("9");
    expect(row).toHaveTextContent("12");
    expect(row).toHaveTextContent("6 pessoa(s)");
    expect(screen.getAllByText("Jateamento").length).toBeGreaterThan(1); // also in "Depende de"
  });
});
