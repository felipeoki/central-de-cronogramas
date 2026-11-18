export type Status = "todo" | "doing" | "done";
export interface Task { id: string; name: string; start: string; end: string; status: Status; owner: string }
export interface Project { id: string; name: string; color: number; tasks: Task[] }

export const uid = () => Math.random().toString(36).slice(2, 10);
const KEY = "cronogramas.v1";

export function loadProjects(): Project[] {
  try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw); } catch {}
  const t = new Date(); const d = (n: number) => { const x = new Date(t); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  return [{ id: uid(), name: "Projeto exemplo", color: 0, tasks: [
    { id: uid(), name: "Planejamento", start: d(-3), end: d(2), status: "doing", owner: "Felipe" },
    { id: uid(), name: "Execução", start: d(3), end: d(14), status: "todo", owner: "" },
    { id: uid(), name: "Entrega", start: d(15), end: d(17), status: "todo", owner: "" },
  ] }];
}
export const saveProjects = (p: Project[]) => localStorage.setItem(KEY, JSON.stringify(p));

/** Overall progress: share of tasks marked done (0-100). */
export function progress(p: Project) {
  if (!p.tasks.length) return 0;
  return Math.round((p.tasks.filter((t) => t.status === "done").length / p.tasks.length) * 100);
}
