export type Status = "todo" | "doing" | "done";
export interface Task { id: string; name: string; start: string; end: string; status: Status; owner: string }
/** `name` is the project title. */
export interface Project {
  id: string; name: string; client: string; manager: string; budget: string; order: string; color: number; tasks: Task[];
}
/** Fields filled in the project registration form. */
export type ProjectInfo = Pick<Project, "name" | "client" | "manager" | "budget" | "order">;
export const emptyProjectInfo = (): ProjectInfo => ({ name: "", client: "", manager: "", budget: "", order: "" });

export const uid = () => Math.random().toString(36).slice(2, 10);
const KEY = "cronogramas.v1";

/** Fills fields missing from projects saved before they existed. */
export const normalizeProject = (p: Partial<Project>): Project => ({
  id: p.id ?? uid(), name: p.name ?? "", client: p.client ?? "", manager: p.manager ?? "",
  budget: p.budget ?? "", order: p.order ?? "", color: p.color ?? 0, tasks: p.tasks ?? [],
});

export function loadProjects(): Project[] {
  try { const raw = localStorage.getItem(KEY); if (raw) return (JSON.parse(raw) as Partial<Project>[]).map(normalizeProject); } catch {}
  const t = new Date(); const d = (n: number) => { const x = new Date(t); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  return [{ id: uid(), name: "Projeto exemplo", client: "", manager: "Felipe", budget: "", order: "", color: 0, tasks: [
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
