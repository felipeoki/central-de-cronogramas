import { addDays, format, parseISO } from "date-fns";

/** Which weekdays count as working days. */
export type Workweek = "mon-fri" | "mon-sat" | "all";

/** A date range (ISO yyyy-MM-dd, inclusive) with a description. */
export interface DateRange {
  id: string;
  start: string;
  end: string;
  description: string;
}

/** A single day without work (local holiday, optional day off...) and why it was not worked. */
export interface DayOff {
  date: string;
  reason: string;
}

/**
 * Project work calendar.
 * - `holidays`: extra single days without work, each with its reason.
 * - `blackouts`: periods with no work (e.g. collective vacation, site access blocked).
 * - `shutdowns`: client plant shutdowns. They are working periods, only highlighted on the Gantt.
 */
export interface WorkCalendar {
  workweek: Workweek;
  nationalHolidays: boolean;
  holidays: DayOff[];
  blackouts: DateRange[];
  shutdowns: DateRange[];
}

export const WORKWEEKS: Record<Workweek, string> = {
  "mon-fri": "Segunda a sexta",
  "mon-sat": "Segunda a sábado",
  all: "Todos os dias",
};

export const defaultCalendar = (): WorkCalendar => ({
  workweek: "mon-fri",
  nationalHolidays: true,
  holidays: [],
  blackouts: [],
  shutdowns: [],
});

export const iso = (d: Date) => format(d, "yyyy-MM-dd");

/** Easter Sunday (Gregorian calendar, anonymous algorithm). */
export function easter(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const holidayCache = new Map<number, Map<string, string>>();

const FIXED_HOLIDAYS: [string, string][] = [
  ["01-01", "Confraternização Universal"],
  ["04-21", "Tiradentes"],
  ["05-01", "Dia do Trabalho"],
  ["09-07", "Independência do Brasil"],
  ["10-12", "Nossa Senhora Aparecida"],
  ["11-02", "Finados"],
  ["11-15", "Proclamação da República"],
  ["11-20", "Dia Nacional de Zumbi e da Consciência Negra"],
  ["12-25", "Natal"],
];

/** Brazilian national holidays of a year (fixed dates plus Good Friday), date → name. */
export function nationalHolidays(year: number): Map<string, string> {
  const cached = holidayCache.get(year);
  if (cached) return cached;
  const map = new Map(FIXED_HOLIDAYS.map(([md, name]) => [`${year}-${md}`, name]));
  map.set(iso(addDays(easter(year), -2)), "Sexta-feira Santa");
  holidayCache.set(year, new Map([...map].sort(([a], [b]) => a.localeCompare(b))));
  return holidayCache.get(year)!;
}

/** Why a day is not worked ("" when it is a working day or just a weekend). */
export function dayOffReason(day: string, cal: WorkCalendar): string {
  const custom = cal.holidays.find((h) => h.date === day);
  if (custom) return custom.reason || "Dia sem trabalho";
  if (cal.nationalHolidays) {
    const name = nationalHolidays(parseISO(day).getFullYear()).get(day);
    if (name) return `Feriado nacional: ${name}`;
  }
  const blackout = cal.blackouts.find((r) => inRange(day, r));
  if (blackout) return blackout.description || "Bloqueio (sem trabalho)";
  return "";
}

const inRange = (day: string, r: DateRange) =>
  !!r.start && !!r.end && day >= r.start && day <= r.end;

export function isWorkday(day: Date | string, cal: WorkCalendar): boolean {
  const d = typeof day === "string" ? parseISO(day) : day;
  const dow = d.getDay();
  if (cal.workweek === "mon-fri" && (dow === 0 || dow === 6)) return false;
  if (cal.workweek === "mon-sat" && dow === 0) return false;
  const s = iso(d);
  if (cal.nationalHolidays && nationalHolidays(d.getFullYear()).has(s)) return false;
  if (cal.holidays.some((h) => h.date === s)) return false;
  if (cal.blackouts.some((r) => inRange(s, r))) return false;
  return true;
}

export const isShutdown = (day: string, cal: WorkCalendar) =>
  cal.shutdowns.some((r) => inRange(day, r));

/** Guard against endless loops on calendars with no working day at all. */
const MAX_SCAN = 3660;

/** Working days from `start` to `end`, both inclusive. */
export function workdaysBetween(start: string, end: string, cal: WorkCalendar): number {
  if (!start || !end || end < start) return 0;
  let d = parseISO(start);
  let n = 0;
  for (let i = 0; i < MAX_SCAN && iso(d) <= end; i++, d = addDays(d, 1)) if (isWorkday(d, cal)) n++;
  return n;
}

/** First working day on or after `day`. */
export function nextWorkday(day: string, cal: WorkCalendar): string {
  let d = parseISO(day);
  for (let i = 0; i < MAX_SCAN && !isWorkday(d, cal); i++) d = addDays(d, 1);
  return iso(d);
}

/** Date of the n-th working day counting from `start` (n >= 1; `start` counts if it is a working day). */
export function addWorkdays(start: string, n: number, cal: WorkCalendar): string {
  let d = parseISO(start);
  let count = 0;
  for (let i = 0; i < MAX_SCAN; i++, d = addDays(d, 1)) {
    if (isWorkday(d, cal) && ++count >= Math.max(1, n)) return iso(d);
  }
  return iso(d);
}

/** Fills fields missing from calendars saved by older versions. */
export const normalizeCalendar = (c?: Partial<WorkCalendar>): WorkCalendar => ({
  ...defaultCalendar(),
  ...c,
  // Older versions stored extra days off as plain date strings, without a reason.
  holidays: ((c?.holidays ?? []) as (DayOff | string)[])
    .map((h) =>
      typeof h === "string"
        ? { date: h, reason: "" }
        : { date: h.date ?? "", reason: h.reason ?? "" },
    )
    .filter((h) => h.date)
    .sort((a, b) => a.date.localeCompare(b.date)),
  blackouts: c?.blackouts ?? [],
  shutdowns: c?.shutdowns ?? [],
});
