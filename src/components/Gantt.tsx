import type { CSSProperties } from "react";
import { addDays, differenceInCalendarDays, format, parseISO, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { defaultCalendar, isShutdown, isWorkday, iso, type WorkCalendar } from "@/lib/calendar";
import { formatDate, taskDelay, todayIso, type Project, type Task } from "@/lib/schedule";

const DAY = 32;
const LABEL = 240;
/** A4 landscape printable width (277 mm) in CSS px, minus a small margin. */
const PRINT_WIDTH = 1040;

/**
 * Gantt chart. Each bar shows physical progress as a solid fill; the thin bar below is the baseline.
 * Milestones are diamonds. Shaded columns are non-working days; red-tinted ones are client shutdowns.
 */
export function Gantt({ projects, calendar }: { projects: Project[]; calendar?: WorkCalendar }) {
  const cal = calendar ?? defaultCalendar();
  const today = todayIso();
  const rows = projects.flatMap((p) =>
    p.tasks.filter((t) => t.start && t.end).map((t) => ({ t, p })),
  );

  if (!rows.length)
    return (
      <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">
        Nenhuma etapa com datas ainda. Adicione etapas abaixo.
      </div>
    );

  const dates = rows
    .flatMap(({ t }) => [t.start, t.end, t.baselineStart, t.baselineEnd])
    .filter(Boolean)
    .sort();
  const min = dates[0]! < today ? dates[0]! : today;
  const max = dates.at(-1)! > today ? dates.at(-1)! : today;
  const start = startOfWeek(addDays(parseISO(min), -2), { weekStartsOn: 1 });
  const days = Math.max(differenceInCalendarDays(parseISO(max), start) + 7, 28);
  const off = (day: string) => differenceInCalendarDays(parseISO(day), start);
  const width = LABEL + days * DAY;
  const columns = Array.from({ length: days }, (_, i) => {
    const d = addDays(start, i);
    const s = iso(d);
    return { d, s, off: !isWorkday(d, cal), shutdown: !!calendar && isShutdown(s, cal) };
  });
  const names = new Map(rows.map(({ t }) => [t.id, t.name || "Sem nome"]));

  return (
    <div
      className="gantt-print overflow-x-auto rounded-lg border border-border bg-card shadow-soft"
      style={{ "--gantt-print-zoom": Math.min(1, PRINT_WIDTH / width) } as CSSProperties}
    >
      <div className="relative" style={{ width }}>
        {/* Non-working days and client shutdowns, behind the bars. */}
        <div className="pointer-events-none absolute inset-y-0 flex" style={{ left: LABEL }}>
          {columns.map((c) => (
            <div
              key={c.s}
              style={{ width: DAY }}
              className={`shrink-0 ${c.shutdown ? "bg-primary/10" : c.off ? "bg-muted" : ""}`}
            />
          ))}
        </div>

        <div className="relative flex border-b border-border">
          <div className="sticky left-0 z-10 w-60 shrink-0 border-r border-border bg-card px-4 py-2 text-xs uppercase tracking-widest text-muted-foreground">
            Etapa
          </div>
          {columns.map(({ d, s, off: nonWorking }, i) => (
            <div
              key={s}
              style={{ width: DAY }}
              className={`shrink-0 py-1 text-center text-[10px] ${nonWorking ? "text-muted-foreground" : ""}`}
            >
              {d.getDate() === 1 || i === 0 ? (
                <div className="font-semibold uppercase">{format(d, "MMM", { locale: ptBR })}</div>
              ) : (
                <div>&nbsp;</div>
              )}
              {d.getDate()}
            </div>
          ))}
        </div>

        {rows.map(({ t, p }) => (
          <GanttRow
            key={`${p.id}-${t.id}`}
            t={t}
            p={p}
            showProject={projects.length > 1}
            off={off}
            predecessorNames={t.predecessors
              .map((id) => names.get(id))
              .filter(Boolean)
              .join(", ")}
          />
        ))}

        <div
          className="pointer-events-none absolute bottom-0 top-0 z-20 w-0.5 bg-primary"
          style={{ left: LABEL + off(today) * DAY + DAY / 2 }}
          title="Hoje"
        />
      </div>
      <Legend shutdowns={!!calendar?.shutdowns.length} />
    </div>
  );
}

function GanttRow({
  t,
  p,
  showProject,
  off,
  predecessorNames,
}: {
  t: Task;
  p: Project;
  showProject: boolean;
  off: (day: string) => number;
  predecessorNames: string;
}) {
  const { overdue, slip } = taskDelay(t, p.calendar);
  const hasBase = !!(t.baselineStart && t.baselineEnd);
  const left = off(t.start) * DAY;
  const len = Math.max(differenceInCalendarDays(parseISO(t.end), parseISO(t.start)) + 1, 1) * DAY;
  const tip = [
    t.name || "Sem nome",
    `${formatDate(t.start)} → ${formatDate(t.end)}`,
    `Avanço ${t.progress}%`,
    hasBase ? `Linha de base ${formatDate(t.baselineStart)} → ${formatDate(t.baselineEnd)}` : "",
    overdue ? `Atrasada ${overdue} dia(s) útil(eis)` : "",
    slip ? `${slip} dia(s) útil(eis) após a linha de base` : "",
    predecessorNames ? `Depende de: ${predecessorNames}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="relative flex h-12 items-center border-b border-border last:border-0">
      <div className="sticky left-0 z-10 flex h-full w-60 shrink-0 flex-col justify-center border-r border-border bg-card px-4">
        <span className="truncate text-sm">
          {t.kind === "milestone" && <span className="mr-1 text-primary">◆</span>}
          {t.name || "Sem nome"}
        </span>
        <span className="truncate text-[11px] text-muted-foreground">
          {showProject && <>{p.name} · </>}
          {overdue ? (
            <span className="font-semibold text-primary">atrasada {overdue}d</span>
          ) : (
            `${t.progress}%`
          )}
          {slip > 0 && <span> · +{slip}d vs. base</span>}
        </span>
      </div>
      <div className="relative h-full flex-1" title={tip}>
        {hasBase && (
          <div
            className="absolute bottom-1.5 h-1.5 rounded-full bg-foreground/25"
            style={{
              left: off(t.baselineStart) * DAY + 4,
              width:
                Math.max(
                  differenceInCalendarDays(parseISO(t.baselineEnd), parseISO(t.baselineStart)) + 1,
                  1,
                ) *
                  DAY -
                8,
            }}
          />
        )}
        {t.kind === "milestone" ? (
          <div
            className={`absolute top-3 h-4 w-4 rotate-45 proj-${p.color} ${overdue ? "ring-2 ring-primary ring-offset-1" : ""}`}
            style={{ left: left + DAY / 2 - 8 }}
          />
        ) : (
          <div
            className={`absolute top-2 h-6 overflow-hidden rounded-md ${overdue ? "ring-2 ring-primary ring-offset-1" : ""}`}
            style={{ left: left + 2, width: len - 4 }}
          >
            <div className={`absolute inset-0 opacity-30 proj-${p.color}`} />
            <div
              className={`absolute inset-y-0 left-0 proj-${p.color}`}
              style={{ width: `${t.progress}%` }}
            />
            <span className="relative flex h-full items-center px-2 text-[11px] font-semibold text-foreground mix-blend-normal">
              <span className="truncate rounded bg-card/80 px-1">{t.progress}%</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function Legend({ shutdowns }: { shutdowns: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-6 rounded-sm bg-foreground/60" /> Avanço físico
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-6 rounded-sm bg-foreground/15" /> Previsto
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-1.5 w-6 rounded-full bg-foreground/25" /> Linha de base
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rotate-45 bg-foreground/70" /> Marco
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-4 bg-muted" /> Dia não útil
      </span>
      {shutdowns && (
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-4 bg-primary/10" /> Parada do cliente
        </span>
      )}
      <span className="flex items-center gap-1.5">
        <span className="h-3 w-0.5 bg-primary" /> Hoje
      </span>
    </div>
  );
}
