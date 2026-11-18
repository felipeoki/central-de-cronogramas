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

/**
 * Project work calendar.
 * - `blackouts`: periods with no work (e.g. collective vacation, site access blocked).
 * - `shutdowns`: client plant shutdowns. They are working periods, only highlighted on the Gantt.
 */
export interface WorkCalendar {
  workweek: Workweek;
  nationalHolidays: boolean;
  holidays: string[];
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

const holidayCache = new Map<number, Set<string>>();

/** Brazilian national holidays of a year (fixed dates plus Good Friday). */
export function nationalHolidays(year: number): Set<string> {
  const cached = holidayCache.get(year);
  if (cached) return cached;
  const fixed = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"];
  const set = new Set(fixed.map((md) => `${year}-${md}`));
  set.add(iso(addDays(easter(year), -2)));
  holidayCache.set(year, set);
  return set;
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
  if (cal.holidays.includes(s)) return false;
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
  holidays: c?.holidays ?? [],
  blackouts: c?.blackouts ?? [],
  shutdowns: c?.shutdowns ?? [],
});
