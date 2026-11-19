import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import ab5Logo from "@/assets/ab5-logo.png";
import { Gantt } from "@/components/Gantt";
import { iso, workdaysBetween } from "@/lib/calendar";
import {
  PHASES,
  formatDate,
  physicalProgress,
  plannedToday,
  projectSpan,
  taskDelay,
  taskSituation,
  todayIso,
  type Project,
  type Task,
} from "@/lib/schedule";

/** "seg 16/11/2026" — weekday helps leaders plan crews; "—" when empty. */
const WEEKDAYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const longDate = (d: string) =>
  d ? `${WEEKDAYS[parseISO(d).getDay()]} ${format(parseISO(d), "dd/MM/yyyy")}` : "—";
const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/**
 * Print-only schedule for team leaders: dates in detail, progress and situation, and NO monetary
 * data (no order value, stage weights or values, measurements or invoices).
 */
export function LeaderReport({ project }: { project: Project }) {
  const cal = project.calendar;
  const today = todayIso();
  const span = projectSpan(project);
  const base = projectSpan(project, true);
  const names = new Map(project.tasks.map((t) => [t.id, t.name || "Sem nome"]));
  const in14 = iso(addDays(parseISO(today), 14));
  const upcoming = project.tasks.filter(
    (t) => t.progress < 100 && t.start && t.start <= in14 && t.end >= today,
  );
  const daysOff = [
    ...cal.holidays.map((h) => ({ when: longDate(h.date), why: h.reason || "—" })),
    ...cal.blackouts
      .filter((r) => r.start && r.end)
      .map((r) => ({
        when: `${longDate(r.start)} a ${longDate(r.end)}`,
        why: r.description || "—",
      })),
  ];
  const shutdowns = cal.shutdowns.filter((r) => r.start && r.end);
  const info: [string, string][] = [
    ["Projeto", project.name],
    ["Cliente", project.client],
    ["Responsável", project.manager],
    ["Fase", PHASES[project.phase]],
    ["Início previsto", longDate(span.start)],
    ["Término previsto", longDate(span.end)],
    [
      "Prazo",
      span.start && span.end
        ? `${workdaysBetween(span.start, span.end, cal)} dias úteis · ${differenceInCalendarDays(parseISO(span.end), parseISO(span.start)) + 1} dias corridos`
        : "—",
    ],
    [
      "Avanço físico",
      `${pct(physicalProgress(project))} (previsto hoje ${pct(plannedToday(project))})`,
    ],
  ];
  if (base.end) info.push(["Término na linha de base", longDate(base.end)]);

  return (
    <section className="leader-report hidden text-[11px]">
      <div className="flex items-center justify-between border-b-2 border-primary pb-3">
        <img src={ab5Logo} alt="Ab5 Indústria e Comércio" className="h-12 w-auto" />
        <div className="text-right">
          <p className="font-display text-xl">Cronograma de execução</p>
          <p className="text-xs text-muted-foreground">
            Emitido em {format(new Date(), "dd/MM/yyyy", { locale: ptBR })}
          </p>
        </div>
      </div>

      <dl className="mb-4 mt-3 grid grid-cols-3 gap-x-6 gap-y-1 rounded-md bg-muted px-4 py-2">
        {info
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <dt className="whitespace-nowrap font-semibold uppercase tracking-wider text-muted-foreground">
                {k}:
              </dt>
              <dd>{v}</dd>
            </div>
          ))}
      </dl>

      <Gantt projects={[project]} calendar={cal} />

      <h3 className="mb-2 mt-5 font-display text-base">Etapas e datas</h3>
      <table className="w-full border-collapse">
        <thead className="bg-muted text-left uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-2 py-1.5">Nº</th>
            <th className="px-2 py-1.5">Etapa</th>
            <th className="px-2 py-1.5">Responsável</th>
            <th className="px-2 py-1.5">Início previsto</th>
            <th className="px-2 py-1.5">Término previsto</th>
            <th className="px-2 py-1.5 text-right">Dias úteis</th>
            <th className="px-2 py-1.5 text-right">Dias corridos</th>
            <th className="px-2 py-1.5">Início real</th>
            <th className="px-2 py-1.5">Término real</th>
            <th className="px-2 py-1.5">Linha de base</th>
            <th className="px-2 py-1.5 text-right">Avanço</th>
            <th className="px-2 py-1.5">Situação</th>
            <th className="px-2 py-1.5">Depende de</th>
            <th className="px-2 py-1.5">Equipe</th>
          </tr>
        </thead>
        <tbody>
          {project.tasks.map((t, i) => (
            <LeaderRow key={t.id} n={i + 1} t={t} project={project} names={names} />
          ))}
        </tbody>
      </table>

      <div className="mt-5 grid grid-cols-2 gap-6 break-inside-avoid">
        <div>
          <h3 className="mb-2 font-display text-base">Próximas 2 semanas</h3>
          {upcoming.length ? (
            <ul className="space-y-1">
              {upcoming.map((t) => (
                <li key={t.id} className="border-l-2 border-primary pl-2">
                  <span className="font-semibold">{t.name || "Sem nome"}</span> —{" "}
                  {longDate(t.start)}
                  {t.kind === "milestone" ? "" : ` a ${longDate(t.end)}`} · {pct(t.progress)}
                  {t.owner && <span className="text-muted-foreground"> · {t.owner}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">
              Nenhuma etapa prevista para as próximas 2 semanas.
            </p>
          )}
        </div>
        <div>
          <h3 className="mb-2 font-display text-base">Dias sem trabalho e paradas</h3>
          {daysOff.length || shutdowns.length ? (
            <ul className="space-y-1">
              {daysOff.map((d, i) => (
                <li key={`off-${i}`}>
                  <span className="font-semibold">{d.when}</span> — {d.why}
                </li>
              ))}
              {shutdowns.map((r) => (
                <li key={r.id}>
                  <span className="font-semibold">
                    {longDate(r.start)} a {longDate(r.end)}
                  </span>{" "}
                  — Parada do cliente{r.description ? `: ${r.description}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">
              Nenhum além de fins de semana{cal.nationalHolidays ? " e feriados nacionais" : ""}.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function LeaderRow({
  n,
  t,
  project,
  names,
}: {
  n: number;
  t: Task;
  project: Project;
  names: Map<string, string>;
}) {
  const cal = project.calendar;
  const milestone = t.kind === "milestone";
  const { slip } = taskDelay(t, cal);
  const situation = taskSituation(t, cal);
  const late = situation.tone === "late";
  return (
    <tr className="break-inside-avoid border-t border-border align-top">
      <td className="px-2 py-1 tabular-nums">{n}</td>
      <td className="px-2 py-1 font-medium">
        {milestone && <span className="mr-1 text-primary">◆</span>}
        {t.name || "Sem nome"}
        {t.equipment && (
          <span className="block font-normal text-muted-foreground">{t.equipment}</span>
        )}
      </td>
      <td className="px-2 py-1">{t.owner || "—"}</td>
      <td className="whitespace-nowrap px-2 py-1">{longDate(t.start)}</td>
      <td className="whitespace-nowrap px-2 py-1">{milestone ? "—" : longDate(t.end)}</td>
      <td className="px-2 py-1 text-right tabular-nums">
        {milestone ? "—" : workdaysBetween(t.start, t.end, cal)}
      </td>
      <td className="px-2 py-1 text-right tabular-nums">
        {milestone || !t.start || !t.end
          ? "—"
          : differenceInCalendarDays(parseISO(t.end), parseISO(t.start)) + 1}
      </td>
      <td className="whitespace-nowrap px-2 py-1">{formatDate(t.actualStart) || "—"}</td>
      <td className="whitespace-nowrap px-2 py-1">{formatDate(t.actualEnd) || "—"}</td>
      <td className="whitespace-nowrap px-2 py-1">
        {t.baselineStart ? `${formatDate(t.baselineStart)} a ${formatDate(t.baselineEnd)}` : "—"}
        {slip > 0 && <span className="block text-primary">+{slip} dia(s) útil(eis)</span>}
      </td>
      <td className="px-2 py-1 text-right tabular-nums">{pct(t.progress)}</td>
      <td className={`whitespace-nowrap px-2 py-1 ${late ? "font-semibold text-primary" : ""}`}>
        {situation.label}
      </td>
      <td className="px-2 py-1">
        {t.predecessors
          .map((id) => names.get(id))
          .filter(Boolean)
          .join(", ") || "—"}
      </td>
      <td className="px-2 py-1 text-right tabular-nums">{t.crew ? `${t.crew} pessoa(s)` : "—"}</td>
    </tr>
  );
}
