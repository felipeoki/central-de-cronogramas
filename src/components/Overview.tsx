import { addDays, format, parseISO, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, CalendarClock, Scale, Receipt } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { iso } from "@/lib/calendar";
import {
  PHASES,
  executedValue,
  formatBRL,
  formatDate,
  invoicedValue,
  measuredPercent,
  measuredValue,
  physicalProgress,
  projectSpan,
  taskDelay,
  todayIso,
  totalWeight,
  type Project,
} from "@/lib/schedule";

interface Alert {
  project: Project;
  icon: typeof AlertTriangle;
  text: string;
  tone: "late" | "soon" | "info";
}

/** Alerts across projects: overdue stages, stages due in 7 days, weights not closing 100%, over-measured stages. */
export function projectAlerts(projects: Project[], today = todayIso()): Alert[] {
  const in7 = iso(addDays(parseISO(today), 7));
  const alerts: Alert[] = [];
  for (const p of projects) {
    if (p.phase === "encerrado") continue;
    for (const t of p.tasks) {
      const { overdue } = taskDelay(t, p.calendar, today);
      const name = t.name || "Sem nome";
      if (overdue)
        alerts.push({
          project: p,
          icon: AlertTriangle,
          tone: "late",
          text: `${name}: atrasada ${overdue} dia(s) útil(eis) (fim ${formatDate(t.end)}, ${t.progress}%)`,
        });
      else if (t.progress < 100 && t.end >= today && t.end <= in7)
        alerts.push({
          project: p,
          icon: CalendarClock,
          tone: "soon",
          text: `${name}: termina em ${formatDate(t.end)} e está em ${t.progress}%`,
        });
      if (t.kind === "task" && measuredPercent(p, t.id) > t.progress + 0.001)
        alerts.push({
          project: p,
          icon: Receipt,
          tone: "info",
          text: `${name}: medido acima do avanço físico`,
        });
    }
    const w = totalWeight(p);
    if (p.tasks.length && w !== 100)
      alerts.push({
        project: p,
        icon: Scale,
        tone: "info",
        text: `Soma dos pesos em ${w.toLocaleString("pt-BR")}%`,
      });
  }
  const order = { late: 0, soon: 1, info: 2 };
  return alerts.sort((a, b) => order[a.tone] - order[b.tone]);
}

/** Peak crew (people) per week across projects, for unfinished stages. */
export function crewByWeek(projects: Project[], weeks = 16, today = todayIso()) {
  const start = startOfWeek(parseISO(today), { weekStartsOn: 1 });
  return Array.from({ length: weeks }, (_, w) => {
    const weekStart = addDays(start, w * 7);
    let peak = 0;
    for (let d = 0; d < 7; d++) {
      const day = iso(addDays(weekStart, d));
      const people = projects
        .filter((p) => p.phase !== "encerrado")
        .flatMap((p) => p.tasks)
        .filter((t) => t.kind === "task" && t.progress < 100 && t.start <= day && t.end >= day)
        .reduce((s, t) => s + t.crew, 0);
      peak = Math.max(peak, people);
    }
    return { week: format(weekStart, "dd/MM", { locale: ptBR }), people: peak };
  });
}

const TONE = { late: "text-primary", soon: "text-foreground", info: "text-muted-foreground" };

export function Overview({
  projects,
  onOpen,
}: {
  projects: Project[];
  onOpen: (id: string) => void;
}) {
  const active = projects.filter((p) => p.phase !== "encerrado");
  const alerts = projectAlerts(projects);
  const crew = crewByWeek(projects);
  const sum = (f: (p: Project) => number) => active.reduce((s, p) => s + f(p), 0);
  const cards = [
    { label: "Projetos ativos", value: String(active.length) },
    { label: "Carteira (valor dos pedidos)", value: formatBRL(sum((p) => p.orderValue)) },
    { label: "Executado", value: formatBRL(sum(executedValue)) },
    { label: "Medido", value: formatBRL(sum(measuredValue)) },
    { label: "Medido sem NF", value: formatBRL(sum((p) => measuredValue(p) - invoicedValue(p))) },
    {
      label: "Saldo a medir",
      value: formatBRL(sum((p) => Math.max(0, p.orderValue - measuredValue(p)))),
    },
  ];

  return (
    <div className="space-y-8">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3 xl:grid-cols-6 print:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="bg-card px-4 py-3">
            <dt className="text-[11px] uppercase tracking-widest text-muted-foreground">
              {c.label}
            </dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums">{c.value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 xl:grid-cols-5">
        <section className="xl:col-span-3">
          <h3 className="mb-3 font-display text-2xl">
            Alertas {alerts.length > 0 && <span className="text-primary">({alerts.length})</span>}
          </h3>
          <div className="max-h-80 overflow-y-auto rounded-lg border border-border bg-card print:max-h-none">
            {alerts.length ? (
              <ul className="divide-y divide-border">
                {alerts.map((a, i) => (
                  <li key={i}>
                    <button
                      onClick={() => onOpen(a.project.id)}
                      className="flex w-full items-start gap-3 px-4 py-2.5 text-left text-sm hover:bg-muted"
                    >
                      <a.icon className={`mt-0.5 h-4 w-4 shrink-0 ${TONE[a.tone]}`} />
                      <span>
                        <span className="font-semibold">{a.project.name}</span>
                        <span className="text-muted-foreground"> · </span>
                        <span className={a.tone === "late" ? "text-primary" : ""}>{a.text}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-8 text-center text-muted-foreground">
                Nenhum alerta. Tudo em dia.
              </p>
            )}
          </div>
        </section>

        <section className="xl:col-span-2">
          <h3 className="mb-3 font-display text-2xl">Equipe nas próximas semanas</h3>
          <div className="rounded-lg border border-border bg-card p-4">
            {crew.some((c) => c.people > 0) ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={crew} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
                    <CartesianGrid stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="week"
                      tick={{ fontSize: 10, fill: "var(--ab5-gray)" }}
                      interval={1}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--ab5-gray)" }} />
                    <Tooltip
                      formatter={(v) => [`${v} pessoa(s)`, "Pico na semana"]}
                      labelFormatter={(w) => `Semana de ${w}`}
                    />
                    <Bar
                      dataKey="people"
                      fill="var(--ab5-red)"
                      radius={[3, 3, 0, 0]}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Informe a equipe (pessoas) nos detalhes das etapas para ver o histograma.
              </p>
            )}
          </div>
        </section>
      </div>

      <section>
        <h3 className="mb-3 font-display text-2xl">Projetos</h3>
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[900px] text-sm print:min-w-0 print:text-xs">
            <thead className="bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Projeto</th>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Fase</th>
                <th className="px-3 py-2 text-right">Físico</th>
                <th className="px-3 py-2">Término previsto</th>
                <th className="px-3 py-2 text-right">Pedido</th>
                <th className="px-3 py-2 text-right">Medido</th>
                <th className="px-3 py-2 text-right">Alertas</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => {
                const end = projectSpan(p).end;
                const base = projectSpan(p, true).end;
                const n = alerts.filter((a) => a.project.id === p.id && a.tone !== "info").length;
                return (
                  <tr
                    key={p.id}
                    onClick={() => onOpen(p.id)}
                    className="cursor-pointer border-t border-border hover:bg-muted"
                  >
                    <td className="px-3 py-2 font-medium">
                      <span
                        className={`mr-2 inline-block h-2.5 w-2.5 rounded-full proj-${p.color}`}
                      />
                      {p.name}
                    </td>
                    <td className="px-3 py-2">{p.client || "—"}</td>
                    <td className="px-3 py-2">{PHASES[p.phase]}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {Math.round(physicalProgress(p))}%
                    </td>
                    <td className="px-3 py-2">
                      {formatDate(end) || "—"}
                      {base && end > base && (
                        <span className="ml-1 text-xs text-primary">(base {formatDate(base)})</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatBRL(p.orderValue)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatBRL(measuredValue(p))}
                    </td>
                    <td
                      className={`px-3 py-2 text-right ${n ? "font-semibold text-primary" : "text-muted-foreground"}`}
                    >
                      {n || "—"}
                    </td>
                  </tr>
                );
              })}
              {!projects.length && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                    Nenhum projeto com esses filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
