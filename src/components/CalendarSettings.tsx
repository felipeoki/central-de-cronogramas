import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  WORKWEEKS,
  nationalHolidays,
  type DateRange,
  type WorkCalendar,
  type Workweek,
} from "@/lib/calendar";
import { formatDate, uid } from "@/lib/schedule";

const field =
  "rounded-md border border-border bg-card px-2 py-1.5 text-sm outline-none focus:border-primary";

/** Project work calendar: workweek, holidays, periods without work and client shutdowns. */
export function CalendarSettings({
  calendar,
  onChange,
}: {
  calendar: WorkCalendar;
  onChange: (c: WorkCalendar) => void;
}) {
  const [holiday, setHoliday] = useState("");
  const year = new Date().getFullYear();
  const national = [...nationalHolidays(year)].sort().map(formatDate).join(", ");

  return (
    <details className="group mt-10 rounded-lg border border-border bg-card print:hidden">
      <summary className="cursor-pointer select-none px-4 py-3 font-display text-lg">
        Calendário do projeto
        <span className="ml-3 text-sm font-normal text-muted-foreground">
          {WORKWEEKS[calendar.workweek]}
          {calendar.nationalHolidays && " · feriados nacionais"}
          {calendar.holidays.length > 0 && ` · ${calendar.holidays.length} dia(s) sem trabalho`}
          {calendar.blackouts.length > 0 && ` · ${calendar.blackouts.length} bloqueio(s)`}
          {calendar.shutdowns.length > 0 && ` · ${calendar.shutdowns.length} parada(s) do cliente`}
        </span>
      </summary>
      <div className="grid gap-6 border-t border-border p-4 text-sm lg:grid-cols-2">
        <div className="space-y-3">
          <label className="block space-y-1">
            <span className="block text-[11px] uppercase tracking-widest text-muted-foreground">
              Dias de trabalho
            </span>
            <select
              className={field}
              value={calendar.workweek}
              onChange={(e) => onChange({ ...calendar, workweek: e.target.value as Workweek })}
            >
              {Object.entries(WORKWEEKS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1 accent-[var(--ab5-red)]"
              checked={calendar.nationalHolidays}
              onChange={(e) => onChange({ ...calendar, nationalHolidays: e.target.checked })}
            />
            <span>
              Considerar feriados nacionais
              <span className="block text-xs text-muted-foreground">
                {year}: {national}
              </span>
            </span>
          </label>
          <div className="space-y-1">
            <span className="block text-[11px] uppercase tracking-widest text-muted-foreground">
              Outros dias sem trabalho (feriados locais, pontos facultativos)
            </span>
            <div className="flex gap-2">
              <input
                type="date"
                className={field}
                value={holiday}
                onChange={(e) => setHoliday(e.target.value)}
              />
              <button
                className="flex items-center gap-1 rounded-md border border-border px-3 text-sm hover:border-primary hover:text-primary disabled:opacity-50"
                disabled={!holiday || calendar.holidays.includes(holiday)}
                onClick={() => {
                  onChange({ ...calendar, holidays: [...calendar.holidays, holiday].sort() });
                  setHoliday("");
                }}
              >
                <Plus className="h-4 w-4" /> Incluir
              </button>
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {calendar.holidays.map((h) => (
                <span
                  key={h}
                  className="flex items-center gap-1 rounded bg-muted px-2 py-1 text-xs"
                >
                  {formatDate(h)}
                  <button
                    aria-label={`Remover ${formatDate(h)}`}
                    onClick={() =>
                      onChange({ ...calendar, holidays: calendar.holidays.filter((x) => x !== h) })
                    }
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </div>
        <div className="space-y-5">
          <RangeList
            title="Bloqueios (períodos sem trabalho)"
            hint="Ex.: férias coletivas, acesso à área bloqueado. Não contam como dias úteis."
            items={calendar.blackouts}
            onChange={(blackouts) => onChange({ ...calendar, blackouts })}
          />
          <RangeList
            title="Paradas do cliente"
            hint="Janelas de parada da planta. Aparecem destacadas no Gantt e contam como dias úteis."
            items={calendar.shutdowns}
            onChange={(shutdowns) => onChange({ ...calendar, shutdowns })}
          />
        </div>
      </div>
    </details>
  );
}

function RangeList({
  title,
  hint,
  items,
  onChange,
}: {
  title: string;
  hint: string;
  items: DateRange[];
  onChange: (r: DateRange[]) => void;
}) {
  const set = (id: string, patch: Partial<DateRange>) =>
    onChange(items.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <span className="block text-[11px] uppercase tracking-widest text-muted-foreground">
            {title}
          </span>
          <span className="text-xs text-muted-foreground">{hint}</span>
        </div>
        <button
          className="flex shrink-0 items-center gap-1 rounded-md border border-border px-3 py-1 text-sm hover:border-primary hover:text-primary"
          onClick={() => onChange([...items, { id: uid(), start: "", end: "", description: "" }])}
        >
          <Plus className="h-4 w-4" /> Período
        </button>
      </div>
      {items.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            className={field}
            value={r.start}
            onChange={(e) =>
              set(r.id, {
                start: e.target.value,
                end: r.end && r.end < e.target.value ? e.target.value : r.end,
              })
            }
          />
          <span className="text-muted-foreground">até</span>
          <input
            type="date"
            className={field}
            value={r.end}
            min={r.start}
            onChange={(e) => set(r.id, { end: e.target.value })}
          />
          <input
            className={`${field} min-w-40 flex-1`}
            placeholder="Descrição"
            value={r.description}
            onChange={(e) => set(r.id, { description: e.target.value })}
          />
          <button
            aria-label="Remover período"
            onClick={() => onChange(items.filter((x) => x.id !== r.id))}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
