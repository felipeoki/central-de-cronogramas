import { Plus, Trash2 } from "lucide-react";
import { NumberField } from "@/components/NumberField";
import {
  executedValue,
  formatBRL,
  invoicedValue,
  measuredPercent,
  measuredValue,
  measurementValue,
  todayIso,
  uid,
  type Measurement,
  type Project,
} from "@/lib/schedule";

/** Measurements (boletins de medição) per stage, with order / executed / measured / invoiced totals. */
export function Measurements({
  project,
  onChange,
}: {
  project: Project;
  onChange: (m: Measurement[]) => void;
}) {
  const stages = project.tasks.filter((t) => t.kind === "task");
  const set = (id: string, patch: Partial<Measurement>) =>
    onChange(project.measurements.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const add = () => {
    // Suggest the first stage with executed work not yet measured.
    const pending = stages
      .map((t) => ({ t, gap: t.progress - measuredPercent(project, t.id) }))
      .find((x) => x.gap > 0);
    const target = pending?.t ?? stages[0];
    if (!target) return;
    const next = project.measurements.length + 1;
    onChange([
      ...project.measurements,
      {
        id: uid(),
        date: todayIso(),
        taskId: target.id,
        percent: Math.max(0, Math.round((pending?.gap ?? 0) * 100) / 100),
        bm: `BM ${String(next).padStart(2, "0")}`,
        invoice: "",
      },
    ]);
  };

  const executed = executedValue(project);
  const measured = measuredValue(project);
  const invoiced = invoicedValue(project);
  const over = stages.filter(
    (t) => measuredPercent(project, t.id) > Math.max(t.progress, 0) + 0.001,
  );
  const cards = [
    { label: "Valor do pedido", value: formatBRL(project.orderValue) },
    { label: "Executado (físico)", value: formatBRL(executed) },
    { label: "Medido", value: formatBRL(measured) },
    { label: "A medir (executado − medido)", value: formatBRL(Math.max(0, executed - measured)) },
    { label: "Faturado (com NF)", value: formatBRL(invoiced) },
    {
      label: "Saldo do pedido a medir",
      value: formatBRL(Math.max(0, project.orderValue - measured)),
    },
  ];

  return (
    <section className="mt-10 print:mt-6 print:break-inside-avoid">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-2xl">Medições e faturamento</h3>
        <button
          onClick={add}
          disabled={!stages.length}
          className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50 print:hidden"
        >
          <Plus className="h-4 w-4" /> Nova medição
        </button>
      </div>

      <dl className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3 xl:grid-cols-6 print:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="bg-card px-4 py-3">
            <dt className="text-[11px] uppercase tracking-widest text-muted-foreground">
              {c.label}
            </dt>
            <dd className="mt-0.5 text-sm font-semibold tabular-nums">{c.value}</dd>
          </div>
        ))}
      </dl>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[760px] text-sm print:min-w-0 print:text-xs">
          <thead className="bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Etapa</th>
              <th className="w-32 px-3 py-2 text-right">% da etapa</th>
              <th className="w-36 px-3 py-2 text-right">Valor (R$)</th>
              <th className="px-3 py-2">BM nº</th>
              <th className="px-3 py-2">NF nº</th>
              <th className="print:hidden" />
            </tr>
          </thead>
          <tbody>
            {project.measurements.map((m) => (
              <tr key={m.id} className="border-t border-border">
                <td className="px-1">
                  <input
                    type="date"
                    className="cell"
                    value={m.date}
                    onChange={(e) => set(m.id, { date: e.target.value })}
                  />
                </td>
                <td className="px-1">
                  <select
                    className="cell"
                    value={m.taskId}
                    onChange={(e) => set(m.id, { taskId: e.target.value })}
                  >
                    {!stages.some((t) => t.id === m.taskId) && (
                      <option value={m.taskId}>(etapa excluída)</option>
                    )}
                    {stages.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name || "Sem nome"}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-1">
                  <NumberField
                    className="cell text-right"
                    value={m.percent}
                    aria-label="Percentual medido da etapa"
                    onValueChange={(percent) => set(m.id, { percent: Math.min(100, percent) })}
                  />
                </td>
                <td className="px-3 text-right tabular-nums">
                  {formatBRL(measurementValue(project, m))}
                </td>
                <td className="px-1">
                  <input
                    className="cell"
                    placeholder="—"
                    value={m.bm}
                    onChange={(e) => set(m.id, { bm: e.target.value })}
                  />
                </td>
                <td className="px-1">
                  <input
                    className="cell"
                    placeholder="Pendente"
                    value={m.invoice}
                    onChange={(e) => set(m.id, { invoice: e.target.value })}
                  />
                </td>
                <td className="px-2 text-right print:hidden">
                  <button
                    aria-label="Excluir medição"
                    onClick={() => onChange(project.measurements.filter((x) => x.id !== m.id))}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {!project.measurements.length && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                  Nenhuma medição registrada. Use “Nova medição” para lançar um boletim de medição.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {over.length > 0 && (
        <p className="mt-2 text-sm text-primary">
          Medido acima do avanço físico em: {over.map((t) => t.name || "Sem nome").join(", ")}.
        </p>
      )}
    </section>
  );
}
