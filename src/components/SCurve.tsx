import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatDate,
  hasBaseline,
  physicalProgress,
  plannedToday,
  sCurve,
  todayIso,
  type Project,
} from "@/lib/schedule";

const RED = "var(--ab5-red)";
const BLACK = "var(--ab5-black)";
const GRAY = "var(--ab5-gray)";

const pct = (v: unknown) => `${Number(v).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/** S-curve: baseline vs current forecast vs measured, plus today's physical progress. */
export function SCurve({ project }: { project: Project }) {
  const data = sCurve(project);
  const today = todayIso();
  const planned = plannedToday(project);
  const physical = physicalProgress(project);
  const gap = Math.round((physical - planned) * 10) / 10;

  return (
    <section className="mt-10 print:mt-6 print:break-inside-avoid">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <h3 className="font-display text-2xl">Curva S</h3>
        <p className="text-sm text-muted-foreground">
          Hoje: previsto <strong className="text-foreground">{pct(planned)}</strong> · realizado{" "}
          <strong className="text-foreground">{pct(physical)}</strong> ·{" "}
          <strong className={gap < 0 ? "text-primary" : "text-foreground"}>
            {gap < 0
              ? `${pct(-gap)} atrás do previsto`
              : gap > 0
                ? `${pct(gap)} à frente`
                : "no previsto"}
          </strong>
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        {data.length < 2 ? (
          <p className="py-10 text-center text-muted-foreground">
            Cadastre etapas com datas e pesos para ver a Curva S.
          </p>
        ) : (
          <div className="h-72 print:h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
                <CartesianGrid stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => formatDate(d).slice(0, 5)}
                  tick={{ fontSize: 11, fill: GRAY }}
                  minTickGap={24}
                />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(v: number) => `${v}%`}
                  tick={{ fontSize: 11, fill: GRAY }}
                  width={48}
                />
                <Tooltip formatter={(v) => pct(v)} labelFormatter={(d) => formatDate(String(d))} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {today >= data[0]!.date && today <= data.at(-1)!.date && (
                  <ReferenceLine
                    x={today}
                    stroke={RED}
                    strokeDasharray="3 3"
                    label={{ value: "Hoje", fontSize: 11, fill: RED, position: "top" }}
                  />
                )}
                {hasBaseline(project) && (
                  <Line
                    type="monotone"
                    dataKey="baseline"
                    name="Linha de base"
                    stroke={GRAY}
                    strokeDasharray="6 4"
                    dot={false}
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="forecast"
                  name="Previsto atual"
                  stroke={BLACK}
                  dot={false}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
                <Line
                  type="stepAfter"
                  dataKey="measured"
                  name="Medido"
                  stroke={RED}
                  dot={false}
                  strokeWidth={2.5}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                <Line
                  dataKey="physical"
                  name="Avanço físico (hoje)"
                  stroke={RED}
                  strokeWidth={0}
                  dot={{ r: 6, fill: RED, stroke: "white", strokeWidth: 2 }}
                  legendType="circle"
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}
