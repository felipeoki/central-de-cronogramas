import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Route } from "@/routes/index";
import { printProject } from "@/components/PhotoReport";
import { loadPhoto, savePhoto } from "@/lib/photos";
import { newTask, normalizeProject } from "@/lib/schedule";

const PIXEL = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==";

beforeAll(() => {
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
afterEach(() => localStorage.clear());

const project = () =>
  normalizeProject({
    id: "p1",
    name: "Pintura tanque",
    client: "Cliente X",
    orderValue: 1000,
    tasks: [
      newTask({
        id: "t1",
        name: "Jateamento",
        start: "2026-11-16",
        end: "2026-11-20",
        weight: 100,
        photos: [{ id: "ph1", caption: "Antes do jateamento", date: "2026-11-16" }],
      }),
    ],
  });

describe("stage photos", () => {
  it("keeps photo metadata when loading older or new projects", () => {
    expect(normalizeProject({ tasks: [newTask({})] }).tasks[0]?.photos).toEqual([]);
    expect(project().tasks[0]?.photos).toEqual([
      { id: "ph1", caption: "Antes do jateamento", date: "2026-11-16" },
    ]);
  });

  it("stores and loads images", async () => {
    await savePhoto("x", PIXEL);
    expect(await loadPhoto("x")).toBe(PIXEL);
  });

  it("shows the photo field and the print-only photo report", async () => {
    await savePhoto("ph1", PIXEL);
    localStorage.setItem("cronogramas.v1", JSON.stringify([project()]));
    const Index = Route.options.component!;
    render(<Index />);
    fireEvent.click(screen.getAllByRole("button", { name: /Pintura tanque/ })[0]!);
    fireEvent.click(screen.getByRole("button", { name: "Mostrar detalhes" }));
    expect(screen.getByText(/Fotos da etapa/)).toBeInTheDocument();
    expect(screen.getByDisplayValue("Antes do jateamento")).toBeInTheDocument();
    expect(screen.getByText("Relatório fotográfico")).toBeInTheDocument();
    expect(screen.getByText("Foto 01")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getAllByAltText("Antes do jateamento")[0]).toHaveAttribute("src", PIXEL),
    );
  });

  it("prints in the chosen mode and resets afterwards", async () => {
    const print = vi.fn();
    window.print = print;
    await printProject(project(), "photos");
    expect(print).toHaveBeenCalledOnce();
    expect(document.body.dataset["print"]).toBe("photos");
    window.dispatchEvent(new Event("afterprint"));
    expect(document.body.dataset["print"]).toBeUndefined();
  });
});
