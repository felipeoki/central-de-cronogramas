import { addDays, differenceInCalendarDays, parseISO } from "date-fns";
import {
  addWorkdays,
  iso,
  nextWorkday,
  normalizeCalendar,
  workdaysBetween,
  type WorkCalendar,
} from "./calendar";

export type Status = "todo" | "doing" | "done";
export type TaskKind = "task" | "milestone";

/**
 * A schedule stage (or a milestone, which has no duration: start === end).
 * - `weight`: share (%) of the order value this stage represents.
 * - `progress`: physical progress (0-100).
 * - `baselineStart/End`: dates frozen with "Salvar linha de base" ("" when never saved).
 * - `actualStart/End`: dates the stage really started / finished.
 * - `predecessors`: ids of stages that must finish before this one starts (finish-to-start).
 */
export interface Task {
  id: string;
  name: string;
  kind: TaskKind;
  start: string;
  end: string;
  owner: string;
  weight: number;
  progress: number;
  status: Status;
  baselineStart: string;
  baselineEnd: string;
  actualStart: string;
  actualEnd: string;
  predecessors: string[];
  crew: number;
  equipment: string;
}

/** A measurement (boletim de medição) of part of a stage. `percent` is the share of the stage value measured. */
export interface Measurement {
  id: string;
  date: string;
  taskId: string;
  percent: number;
  bm: string;
  invoice: string;
}

export type Phase =
  "proposta" | "aprovado" | "mobilizacao" | "execucao" | "desmobilizacao" | "encerrado";
export const PHASES: Record<Phase, string> = {
  proposta: "Proposta",
  aprovado: "Aprovado",
  mobilizacao: "Mobilização",
  execucao: "Em execução",
  desmobilizacao: "Desmobilização",
  encerrado: "Encerrado",
};

/** `name` is the project title; `orderValue` is the order's total value in BRL. */
export interface Project {
  id: string;
  name: string;
  client: string;
  manager: string;
  budget: string;
  order: string;
  orderValue: number;
  phase: Phase;
  color: number;
  calendar: WorkCalendar;
  tasks: Task[];
  measurements: Measurement[];
}

/** Fields filled in the project registration form. */
export type ProjectInfo = Pick<
  Project,
  "name" | "client" | "manager" | "budget" | "order" | "orderValue" | "phase"
>;
export const emptyProjectInfo = (): ProjectInfo => ({
  name: "",
  client: "",
  manager: "",
  budget: "",
  order: "",
  orderValue: 0,
  phase: "aprovado",
});

export const uid = () => Math.random().toString(36).slice(2, 10);
export const todayIso = () => iso(new Date());
const KEY = "cronogramas.v1";

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const str = (v: unknown) => (typeof v === "string" ? v : "");
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export const statusFromProgress = (progress: number): Status =>
  progress >= 100 ? "done" : progress > 0 ? "doing" : "todo";

export function newTask(patch: Partial<Task> = {}): Task {
  return normalizeTask({ id: uid(), ...patch });
}

/** Fills fields missing from stages saved by older versions. */
export function normalizeTask(t: Partial<Task>): Task {
  // Older versions only had a status; a finished stage counts as 100% done.
  const progress = clamp(
    t.progress !== undefined ? num(t.progress) : t.status === "done" ? 100 : 0,
    0,
    100,
  );
  const kind: TaskKind = t.kind === "milestone" ? "milestone" : "task";
  const start = str(t.start);
  return {
    id: t.id ?? uid(),
    name: str(t.name),
    kind,
    start,
    end: kind === "milestone" ? start : str(t.end),
    owner: str(t.owner),
    weight: num(t.weight),
    progress,
    status: statusFromProgress(progress),
    baselineStart: str(t.baselineStart),
    baselineEnd: str(t.baselineEnd),
    actualStart: str(t.actualStart),
    actualEnd: str(t.actualEnd),
    predecessors: Array.isArray(t.predecessors)
      ? t.predecessors.filter((p) => typeof p === "string")
      : [],
    crew: num(t.crew),
    equipment: str(t.equipment),
  };
}

/** Fills fields missing from projects saved by older versions. */
export const normalizeProject = (p: Partial<Project>): Project => ({
  id: p.id ?? uid(),
  name: str(p.name),
  client: str(p.client),
  manager: str(p.manager),
  budget: str(p.budget),
  order: str(p.order),
  orderValue: num(p.orderValue),
  phase: p.phase && p.phase in PHASES ? p.phase : "execucao",
  color: num(p.color),
  calendar: normalizeCalendar(p.calendar),
  tasks: (p.tasks ?? []).map(normalizeTask),
  measurements: (p.measurements ?? []).map((m) => ({
    id: m.id ?? uid(),
    date: str(m.date),
    taskId: str(m.taskId),
    percent: num(m.percent),
    bm: str(m.bm),
    invoice: str(m.invoice),
  })),
});

function sampleProject(): Project {
  const d = (n: number) => iso(addDays(new Date(), n));
  const plan = newTask({
    name: "Planejamento e mobilização",
    start: d(-10),
    end: d(-4),
    weight: 10,
    progress: 100,
    owner: "Felipe",
    crew: 2,
  });
  const exec = newTask({
    name: "Execução",
    start: d(-3),
    end: d(20),
    weight: 70,
    progress: 30,
    owner: "Felipe",
    crew: 8,
    predecessors: [plan.id],
    equipment: "Andaime, PTA",
  });
  const done = newTask({
    name: "Desmobilização e entrega",
    start: d(21),
    end: d(25),
    weight: 20,
    crew: 3,
    predecessors: [exec.id],
  });
  const accept = newTask({
    name: "Aceite do cliente",
    kind: "milestone",
    start: d(26),
    predecessors: [done.id],
  });
  for (const t of [plan, exec, done, accept]) {
    t.baselineStart = t.start;
    t.baselineEnd = t.end;
  }
  plan.actualStart = plan.start;
  plan.actualEnd = plan.end;
  exec.actualStart = exec.start;
  return normalizeProject({
    name: "Projeto exemplo",
    manager: "Felipe",
    orderValue: 100000,
    phase: "execucao",
    tasks: [plan, exec, done, accept],
    measurements: [
      { id: uid(), date: d(-3), taskId: plan.id, percent: 100, bm: "BM 01", invoice: "" },
    ],
  });
}

export function loadProjects(): Project[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return (JSON.parse(raw) as Partial<Project>[]).map(normalizeProject);
  } catch {
    /* corrupted storage: start over with the sample */
  }
  return [sampleProject()];
}
export const saveProjects = (p: Project[]) => localStorage.setItem(KEY, JSON.stringify(p));

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Sum of stage weights (%). */
export const totalWeight = (p: Project) => round2(p.tasks.reduce((s, t) => s + t.weight, 0));

/** Weight used in progress math: the stage weight, or equal weights when no stage has one. */
function effectiveWeights(p: Project): Map<string, number> {
  const useWeights = totalWeight(p) > 0;
  const stages = p.tasks.filter((t) => useWeights || t.kind === "task");
  return new Map(stages.map((t) => [t.id, useWeights ? t.weight : 1]));
}

/** Physical progress of the project (0-100), weighted by stage weight. */
export function physicalProgress(p: Project): number {
  const w = effectiveWeights(p);
  const total = [...w.values()].reduce((s, x) => s + x, 0);
  if (!total) return 0;
  return round2(p.tasks.reduce((s, t) => s + (w.get(t.id) ?? 0) * t.progress, 0) / total);
}

/** Physical progress rounded to an integer, for compact display. */
export const progress = (p: Project) => Math.round(physicalProgress(p));

/** Stage value in BRL from its weight (%) of the order value. */
export const stageValue = (orderValue: number, weight: number) =>
  round2((orderValue * weight) / 100);

/** Weight (%) a stage value represents of the order value; 0 when there is no order value. */
export const weightFromValue = (orderValue: number, value: number) =>
  orderValue > 0 ? Math.round((value / orderValue) * 100 * 10000) / 10000 : 0;

/** Value of the work physically done (BRL). */
export const executedValue = (p: Project) =>
  round2(p.tasks.reduce((s, t) => s + (stageValue(p.orderValue, t.weight) * t.progress) / 100, 0));

/** Share (%) of a stage already measured. */
export const measuredPercent = (p: Project, taskId: string) =>
  round2(p.measurements.filter((m) => m.taskId === taskId).reduce((s, m) => s + m.percent, 0));

export function measurementValue(p: Project, m: Measurement) {
  const t = p.tasks.find((x) => x.id === m.taskId);
  return t ? round2((stageValue(p.orderValue, t.weight) * m.percent) / 100) : 0;
}

export const measuredValue = (p: Project) =>
  round2(p.measurements.reduce((s, m) => s + measurementValue(p, m), 0));
export const invoicedValue = (p: Project) =>
  round2(
    p.measurements.filter((m) => m.invoice.trim()).reduce((s, m) => s + measurementValue(p, m), 0),
  );

/** Project start / forecast end (ISO) from its stages; "" when there are no dated stages. */
export function projectSpan(p: Project, baseline = false) {
  const starts = p.tasks
    .map((t) => (baseline ? t.baselineStart : t.start))
    .filter(Boolean)
    .sort();
  const ends = p.tasks
    .map((t) => (baseline ? t.baselineEnd : t.end))
    .filter(Boolean)
    .sort();
  return { start: starts[0] ?? "", end: ends.at(-1) ?? "" };
}

export const hasBaseline = (p: Project) => p.tasks.some((t) => t.baselineStart && t.baselineEnd);

/** Freezes current dates as the baseline. */
export const withBaseline = (p: Project): Project => ({
  ...p,
  tasks: p.tasks.map((t) => ({ ...t, baselineStart: t.start, baselineEnd: t.end })),
});

/**
 * Delay of a stage in working days.
 * - `overdue`: not finished and its end date has passed.
 * - `slip`: current end later than the baseline end.
 */
export function taskDelay(t: Task, cal: WorkCalendar, today = todayIso()) {
  const after = (day: string) => iso(addDays(parseISO(day), 1));
  const overdue =
    t.progress < 100 && t.end && t.end < today ? workdaysBetween(after(t.end), today, cal) : 0;
  const slip =
    t.baselineEnd && t.end > t.baselineEnd ? workdaysBetween(after(t.baselineEnd), t.end, cal) : 0;
  return { overdue, slip };
}

/** Status label of a stage, including delay. */
export function taskSituation(t: Task, cal: WorkCalendar, today = todayIso()) {
  const { overdue } = taskDelay(t, cal, today);
  if (t.progress >= 100) return { label: "Concluída", tone: "done" as const };
  if (overdue) return { label: `Atrasada ${overdue}d`, tone: "late" as const };
  if (t.progress > 0) return { label: "Em andamento", tone: "doing" as const };
  if (t.start && t.start <= today) return { label: "Deveria ter iniciado", tone: "late" as const };
  return { label: t.kind === "milestone" ? "Previsto" : "A iniciar", tone: "todo" as const };
}

/** Would making `predId` a predecessor of `taskId` create a dependency cycle? */
export function wouldCreateCycle(tasks: Task[], taskId: string, predId: string): boolean {
  if (taskId === predId) return true;
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const seen = new Set<string>();
  const stack = [predId];
  while (stack.length) {
    const id = stack.pop()!;
    if (id === taskId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(byId.get(id)?.predecessors ?? []));
  }
  return false;
}

/**
 * Pushes stages forward so each starts on the first working day after all its predecessors end
 * (finish-to-start), keeping its duration in working days. Stages are never pulled back.
 */
export function reschedule(tasks: Task[], cal: WorkCalendar): Task[] {
  const byId = new Map(
    tasks.map((t) => [t.id, { ...t, predecessors: t.predecessors.filter((p) => p !== t.id) }]),
  );
  const done = new Set<string>();
  const visiting = new Set<string>();
  const visit = (id: string) => {
    if (done.has(id) || visiting.has(id)) return;
    visiting.add(id);
    const t = byId.get(id)!;
    t.predecessors = t.predecessors.filter((p) => byId.has(p));
    t.predecessors.forEach(visit);
    const ends = t.predecessors
      .map((p) => byId.get(p)!.end)
      .filter(Boolean)
      .sort();
    const last = ends.at(-1);
    if (last && t.start) {
      const earliest = nextWorkday(iso(addDays(parseISO(last), 1)), cal);
      if (t.start < earliest) {
        const duration = Math.max(1, workdaysBetween(t.start, t.end || t.start, cal));
        t.start = earliest;
        t.end = t.kind === "milestone" ? earliest : addWorkdays(earliest, duration, cal);
      }
    }
    visiting.delete(id);
    done.add(id);
  };
  tasks.forEach((t) => visit(t.id));
  return tasks.map((t) => byId.get(t.id)!);
}

/** Share (0-1) of [start, end] elapsed at the end of `day`, in calendar days. */
function elapsed(start: string, end: string, day: string) {
  if (!start || !end) return 0;
  if (day < start) return 0;
  if (day >= end) return 1;
  const total = differenceInCalendarDays(parseISO(end), parseISO(start)) + 1;
  return (differenceInCalendarDays(parseISO(day), parseISO(start)) + 1) / total;
}

export interface SCurvePoint {
  date: string;
  baseline?: number;
  forecast: number;
  measured?: number;
  physical?: number;
}

/**
 * S-curve (cumulative %, weighted by stage weight), sampled weekly:
 * baseline plan, current forecast, cumulative measured (up to today) and physical progress today.
 */
export function sCurve(p: Project, today = todayIso()): SCurvePoint[] {
  const w = effectiveWeights(p);
  const total = [...w.values()].reduce((s, x) => s + x, 0);
  if (!total) return [];
  const base = hasBaseline(p);
  const dates = [
    ...p.tasks.flatMap((t) => [t.start, t.end, t.baselineStart, t.baselineEnd]),
    ...p.measurements.map((m) => m.date),
  ]
    .filter(Boolean)
    .sort();
  if (!dates.length) return [];
  const first = parseISO(dates[0]!);
  const last = dates.at(-1)!;
  const days = new Set<string>();
  for (let d = first; iso(d) <= last; d = addDays(d, 7)) days.add(iso(d));
  days.add(last);
  if (today >= dates[0]! && today <= last) days.add(today);
  const measuredByTask = (day: string) =>
    p.measurements
      .filter((m) => m.date && m.date <= day)
      .reduce((s, m) => s + ((w.get(m.taskId) ?? 0) * m.percent) / 100, 0);
  const pct = (n: number) => round2((n / total) * 100);
  return [...days].sort().map((day) => {
    const point: SCurvePoint = {
      date: day,
      forecast: pct(
        p.tasks.reduce((s, t) => s + (w.get(t.id) ?? 0) * elapsed(t.start, t.end, day), 0),
      ),
    };
    if (base)
      point.baseline = pct(
        p.tasks.reduce(
          (s, t) => s + (w.get(t.id) ?? 0) * elapsed(t.baselineStart, t.baselineEnd, day),
          0,
        ),
      );
    if (day <= today) point.measured = pct(measuredByTask(day));
    if (day === today) point.physical = physicalProgress(p);
    return point;
  });
}

/** Planned progress (%) for today: baseline if saved, otherwise the current schedule. */
export function plannedToday(p: Project, today = todayIso()) {
  const w = effectiveWeights(p);
  const total = [...w.values()].reduce((s, x) => s + x, 0);
  if (!total) return 0;
  const base = hasBaseline(p);
  return round2(
    (p.tasks.reduce(
      (s, t) =>
        s +
        (w.get(t.id) ?? 0) *
          elapsed(base ? t.baselineStart : t.start, base ? t.baselineEnd : t.end, today),
      0,
    ) /
      total) *
      100,
  );
}

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const formatBRL = (n: number) => BRL.format(n);

/** ISO date as dd/MM/yyyy ("" stays ""). */
export const formatDate = (isoDate: string) =>
  isoDate ? isoDate.split("-").reverse().join("/") : "";

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
