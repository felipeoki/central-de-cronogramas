import { describe, expect, it, beforeAll, beforeEach, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { Route } from "@/routes/index";

// jsdom lacks ResizeObserver, which recharts' ResponsiveContainer uses.
beforeAll(() => {
  // Recent Node versions expose a broken global localStorage under jsdom; use an in-memory one.
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
    },
  });
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});
beforeEach(() => localStorage.clear());

const Index = Route.options.component!;

describe("app screens", () => {
  it("renders the overview with the sample project", () => {
    render(<Index />);
    expect(screen.getByRole("heading", { name: "Visão geral" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Alertas/ })).toBeInTheDocument();
    expect(screen.getByText("Cronograma geral")).toBeInTheDocument();
    expect(screen.getAllByText("Projeto exemplo").length).toBeGreaterThan(0);
  });

  it("opens a project with all sections and edits a stage", () => {
    render(<Index />);
    fireEvent.click(screen.getAllByRole("button", { name: /Projeto exemplo/ })[0]!);
    for (const title of [
      "Etapas do cronograma",
      "Curva S",
      "Medições e faturamento",
      "Calendário do projeto",
    ])
      expect(screen.getByText(title)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Atualizar linha de base/ })).toBeInTheDocument();

    // Physical progress of "Execução" 30% -> 100% raises the project's weighted progress.
    const progress = screen.getAllByLabelText("Avanço físico da etapa (%)");
    fireEvent.focus(progress[1]!);
    fireEvent.change(progress[1]!, { target: { value: "100" } });
    fireEvent.blur(progress[1]!);
    const kpi = screen.getByText("Avanço físico", { selector: "dt" }).parentElement!;
    expect(within(kpi).getByText("80%")).toBeInTheDocument();
  });

  it("adds a stage, a milestone and a measurement", () => {
    render(<Index />);
    fireEvent.click(screen.getAllByRole("button", { name: /Projeto exemplo/ })[0]!);
    const before = screen.getAllByLabelText("Avanço físico da etapa (%)").length;
    fireEvent.click(screen.getByRole("button", { name: /Adicionar etapa/ }));
    fireEvent.click(screen.getByRole("button", { name: /Marco/ }));
    expect(screen.getAllByLabelText("Avanço físico da etapa (%)").length).toBe(before + 2);
    const rows = screen.getAllByLabelText("Excluir medição").length;
    fireEvent.click(screen.getByRole("button", { name: /Nova medição/ }));
    expect(screen.getAllByLabelText("Excluir medição").length).toBe(rows + 1);
  });

  it("opens the stage details with dependencies", () => {
    render(<Index />);
    fireEvent.click(screen.getAllByRole("button", { name: /Projeto exemplo/ })[0]!);
    fireEvent.click(screen.getAllByRole("button", { name: "Mostrar detalhes" })[1]!);
    expect(screen.getByText("Depende de (só começa após o fim de)")).toBeInTheDocument();
    expect(screen.getByText("Equipe (pessoas)")).toBeInTheDocument();
  });

  it("exports the project as CSV", () => {
    const createObjectURL = vi.fn(() => "blob:x");
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = vi.fn();
    render(<Index />);
    fireEvent.click(screen.getAllByRole("button", { name: /Projeto exemplo/ })[0]!);
    fireEvent.click(screen.getByRole("button", { name: /Excel/ }));
    expect(createObjectURL).toHaveBeenCalledOnce();
  });
});

describe("stage order", () => {
  it("moves a stage with the arrow buttons and sorts by date", () => {
    render(<Index />);
    fireEvent.click(screen.getAllByRole("button", { name: /Projeto exemplo/ })[0]!);
    const names = () =>
      screen
        .getAllByPlaceholderText(/Nome da etapa|Nome do marco/)
        .map((i) => (i as HTMLInputElement).value);
    const first = names()[0];
    fireEvent.click(screen.getAllByRole("button", { name: "Mover etapa para baixo" })[0]!);
    expect(names()[1]).toBe(first);
    fireEvent.click(screen.getByRole("button", { name: /Ordenar por data/ }));
    expect(names()[0]).toBe(first);
  });
});
