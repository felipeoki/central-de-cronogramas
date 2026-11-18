export type Status = "todo" | "doing" | "done";
/** A schedule stage. `weight` is the share (%) of the project's order value this stage represents. */
export interface Task {
  id: string; name: string; start: string; end: string; status: Status; owner: string; weight: number;
}
/** `name` is the project title; `orderValue` is the order's total value in BRL. */
export interface Project {
  id: string; name: string; client: string; manager: string; budget: string; order: string; orderValue: number;
  color: number; tasks: Task[];
}
/** Fields filled in the project registration form. */
export type ProjectInfo = Pick<Project, "name" | "client" | "manager" | "budget" | "order" | "orderValue">;
export const emptyProjectInfo = (): ProjectInfo => ({ name: "", client: "", manager: "", budget: "", order: "", orderValue: 0 });

export const uid = () => Math.random().toString(36).slice(2, 10);
const KEY = "cronogramas.v1";

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/** Fills fields missing from projects saved before they existed. */
export const normalizeProject = (p: Partial<Project>): Project => ({
  id: p.id ?? uid(), name: p.name ?? "", client: p.client ?? "", manager: p.manager ?? "",
  budget: p.budget ?? "", order: p.order ?? "", orderValue: num(p.orderValue), color: p.color ?? 0,
  tasks: (p.tasks ?? []).map((t) => ({ ...t, weight: num(t.weight) })),
});

export function loadProjects(): Project[] {
  try { const raw = localStorage.getItem(KEY); if (raw) return (JSON.parse(raw) as Partial<Project>[]).map(normalizeProject); } catch {}
  const t = new Date(); const d = (n: number) => { const x = new Date(t); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  return [{ id: uid(), name: "Projeto exemplo", client: "", manager: "Felipe", budget: "", order: "", orderValue: 100000, color: 0, tasks: [
    { id: uid(), name: "Planejamento", start: d(-3), end: d(2), status: "doing", owner: "Felipe", weight: 10 },
    { id: uid(), name: "Execução", start: d(3), end: d(14), status: "todo", owner: "", weight: 70 },
    { id: uid(), name: "Entrega", start: d(15), end: d(17), status: "todo", owner: "", weight: 20 },
  ] }];
}
export const saveProjects = (p: Project[]) => localStorage.setItem(KEY, JSON.stringify(p));

/** Overall progress: share of tasks marked done (0-100). */
export function progress(p: Project) {
  if (!p.tasks.length) return 0;
  return Math.round((p.tasks.filter((t) => t.status === "done").length / p.tasks.length) * 100);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Stage value in BRL from its weight (%) of the order value. */
export const stageValue = (orderValue: number, weight: number) => round2((orderValue * weight) / 100);

/** Weight (%) a stage value represents of the order value; 0 when there is no order value. */
export const weightFromValue = (orderValue: number, value: number) =>
  orderValue > 0 ? Math.round((value / orderValue) * 100 * 10000) / 10000 : 0;

/** Sum of stage weights (%). */
export const totalWeight = (p: Project) => round2(p.tasks.reduce((s, t) => s + t.weight, 0));

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const formatBRL = (n: number) => BRL.format(n);

/** Number in pt-BR style ("1.234,56", "1234,5", "R$ 10") or plain ("1234.56"); NaN when not a number. */
export function parseBRNumber(text: string): number {
  let s = text.replace(/R\$|\s|%/g, "");
  if (!s) return NaN;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  return /^-?\d*\.?\d+$/.test(s) ? Number(s) : NaN;
}

/** Number shown in pt-BR style for editing ("1234,5"). */
export const formatBRNumber = (n: number, decimals = 2) =>
  n.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: decimals });
