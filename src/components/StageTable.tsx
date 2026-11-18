import { Fragment, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { ChevronDown, ChevronRight, Plus, Trash2, X } from "lucide-react";
import { NumberField } from "@/components/NumberField";
import { nextWorkday, addWorkdays, workdaysBetween } from "@/lib/calendar";
import {
  executedValue,
  formatBRL,
  formatDate,
  measuredPercent,
  newTask,
  physicalProgress,
  stageValue,
  taskSituation,
  todayIso,
  totalWeight,
  weightFromValue,
  wouldCreateCycle,
  type Project,
  type Task,
  type TaskKind,
} from "@/lib/schedule";

const TONE: Record<string, string> = {
  done: "bg-foreground/10 text-foreground",
  doing: "bg-foreground text-background",
  late: "bg-primary text-primary-foreground",
  todo: "bg-muted text-muted-foreground",
};

const fmtPct = (n: number) => `${(Math.round(n * 100) / 100).toLocaleString("pt-BR")}%`;

/** Editable stage table. Changes go through `onChange`; the parent reschedules dependencies. */
export function StageTable({
  project,
  onChange,
  onOrderValueChange,
}: {
  project: Project;
  onChange: (t: Task[]) => void;
  onOrderValueChange: (v: number) => void;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const cal = project.calendar;
  const today = todayIso();
  const toggle = (id: string) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const set = (id: string, patch: Partial<Task>) =>
    onChange(project.tasks.map((t) => (t.id === id ? applyPatch(t, patch) : t)));

  /** Keeps dates consistent and records actual start/finish when progress changes. */
  const applyPatch = (t: Task, patch: Partial<Task>): Task => {
    const n = { ...t, ...patch };
    if (n.kind === "milestone") n.end = n.start;
    else if (n.start && n.end && n.end < n.start) n.end = n.start;
    if (patch.progress !== undefined) {
      n.progress = Math.min(100, Math.max(0, patch.progress));
      n.status = n.progress >= 100 ? "done" : n.progress > 0 ? "doing" : "todo";
      if (n.progress > 0 && !n.actualStart) n.actualStart = today;
      if (n.progress >= 100 && !n.actualEnd) n.actualEnd = today;
      if (n.progress < 100) n.actualEnd = "";
    }
    return n;
  };

  const add = (kind: TaskKind) => {
    const last = project.tasks.at(-1);
    const start = nextWorkday(
      last?.end ? format(addDays(parseISO(last.end), 1), "yyyy-MM-dd") : today,
      cal,
    );
    const t = newTask({
      kind,
      start,
      end: kind === "milestone" ? start : addWorkdays(start, 5, cal),
      weight: kind === "milestone" ? 0 : Math.max(0, 100 - totalWeight(project)),
      predecessors: last ? [last.id] : [],
    });
    onChange([...project.tasks, t]);
  };

  const remove = (id: string) =>
    onChange(
      project.tasks
        .filter((x) => x.id !== id)
        .map((x) => ({ ...x, predecessors: x.predecessors.filter((p) => p !== id) })),
    );

  const total = totalWeight(project);
  const totalValue = project.tasks.reduce(
    (s, t) => s + stageValue(project.orderValue, t.weight),
    0,
  );
  const hasValue = project.orderValue > 0;

  return (
    <section className="mt-10 print:mt-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-display text-2xl">Etapas do cronograma</h3>
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            Valor do pedido R$
            <NumberField
              value={project.orderValue}
              onValueChange={onOrderValueChange}
              aria-label="Valor total do pedido"
              className="w-36 rounded-md border border-border bg-card px-2 py-1.5 text-right text-foreground outline-none focus:border-primary"
            />
          </label>
          <button
            onClick={() => add("milestone")}
            className="flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1.5 text-sm hover:border-primary hover:text-primary"
          >
            <span className="text-primary">◆</span> Marco
          </button>
          <button
            onClick={() => add("task")}
            className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Adicionar etapa
          </button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full min-w-[1040px] text-sm print:min-w-0 print:text-xs">
          <thead className="bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="w-8 print:hidden" />
              <th className="px-3 py-2">Etapa</th>
              <th className="px-3 py-2">Responsável</th>
              <th className="px-3 py-2">Início</th>
              <th className="px-3 py-2">Fim</th>
              <th
                className="px-3 py-2 text-right"
                title="Dias úteis conforme o calendário do projeto"
              >
                Dias úteis
              </th>
              <th className="w-24 px-3 py-2 text-right">Peso (%)</th>
              <th className="w-32 px-3 py-2 text-right">Valor (R$)</th>
              <th className="w-24 px-3 py-2 text-right">Avanço (%)</th>
              <th className="px-3 py-2">Situação</th>
              <th className="print:hidden" />
            </tr>
          </thead>
          <tbody>
            {project.tasks.map((t) => {
              const milestone = t.kind === "milestone";
              const situation = taskSituation(t, cal, today);
              const expanded = open.has(t.id);
              return (
                <Fragment key={t.id}>
                  <tr className="border-t border-border">
                    <td className="pl-2 print:hidden">
                      <button
                        aria-label={expanded ? "Ocultar detalhes" : "Mostrar detalhes"}
                        onClick={() => toggle(t.id)}
                        className="text-muted-foreground hover:text-primary"
                      >
                        {expanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    </td>
                    <td className="px-1">
                      <div className="flex items-center">
                        {milestone && (
                          <span className="pl-2 text-primary" title="Marco">
                            ◆
                          </span>
                        )}
                        <input
                          className="cell"
                          placeholder={milestone ? "Nome do marco" : "Nome da etapa"}
                          value={t.name}
                          onChange={(e) => set(t.id, { name: e.target.value })}
                        />
                      </div>
                    </td>
                    <td className="px-1">
                      <input
                        className="cell"
                        placeholder="—"
                        value={t.owner}
                        onChange={(e) => set(t.id, { owner: e.target.value })}
                      />
                    </td>
                    <td className="px-1">
                      <input
                        type="date"
                        className="cell"
                        value={t.start}
                        onChange={(e) => set(t.id, { start: e.target.value })}
                      />
                    </td>
                    <td className="px-1">
                      {milestone ? (
                        <span className="px-2 text-muted-foreground">—</span>
                      ) : (
                        <input
                          type="date"
                          className="cell"
                          value={t.end}
                          min={t.start}
                          onChange={(e) => set(t.id, { end: e.target.value })}
                        />
                      )}
                    </td>
                    <td className="px-3 text-right tabular-nums">
                      {milestone ? "—" : workdaysBetween(t.start, t.end, cal)}
                    </td>
                    <td className="px-1">
                      <NumberField
                        className="cell text-right"
                        decimals={4}
                        value={t.weight}
                        aria-label="Peso da etapa (%)"
                        onValueChange={(weight) => set(t.id, { weight })}
                      />
                    </td>
                    <td className="px-1">
                      <NumberField
                        className="cell text-right disabled:cursor-not-allowed disabled:opacity-60"
                        value={stageValue(project.orderValue, t.weight)}
                        aria-label="Valor da etapa (R$)"
                        disabled={!hasValue}
                        title={
                          hasValue
                            ? undefined
                            : "Informe o valor do pedido para editar o valor da etapa"
                        }
                        onValueChange={(v) =>
                          set(t.id, { weight: weightFromValue(project.orderValue, v) })
                        }
                      />
                    </td>
                    <td className="px-1">
                      <NumberField
                        className="cell text-right"
                        decimals={1}
                        value={t.progress}
                        aria-label="Avanço físico da etapa (%)"
                        onValueChange={(progress) => set(t.id, { progress })}
                      />
                    </td>
                    <td className="px-3">
                      <span
                        className={`whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium ${TONE[situation.tone]}`}
                      >
                        {situation.label}
                      </span>
                    </td>
                    <td className="px-2 text-right print:hidden">
                      <button
                        aria-label="Excluir etapa"
                        onClick={() =>
                          confirm(`Excluir "${t.name || "etapa sem nome"}"?`) && remove(t.id)
                        }
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="bg-muted/40 print:hidden">
                      <td />
                      <td colSpan={10} className="px-3 pb-4 pt-2">
                        <StageDetails project={project} t={t} set={(patch) => set(t.id, patch)} />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {!project.tasks.length && (
              <tr>
                <td colSpan={11} className="px-3 py-8 text-center text-muted-foreground">
                  Nenhuma etapa ainda.
                </td>
              </tr>
            )}
          </tbody>
          {project.tasks.length > 0 && (
            <tfoot className="border-t-2 border-border bg-muted/50 font-medium">
              <tr>
                <td className="print:hidden" />
                <td
                  colSpan={5}
                  className="px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground"
                >
                  Total · executado {formatBRL(executedValue(project))}
                </td>
                <td className={`px-3 py-2 text-right ${total === 100 ? "" : "text-destructive"}`}>
                  {fmtPct(total)}
                </td>
                <td className="px-3 py-2 text-right">{formatBRL(totalValue)}</td>
                <td className="px-3 py-2 text-right" title="Avanço físico ponderado pelo peso">
                  {fmtPct(physicalProgress(project))}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {project.tasks.length > 0 && total !== 100 && (
        <p className="mt-2 text-sm text-destructive">
          A soma dos pesos é {fmtPct(total)} —{" "}
          {total < 100 ? `faltam ${fmtPct(100 - total)}` : `excede em ${fmtPct(total - 100)}`} para
          fechar 100% do pedido.
        </p>
      )}
      {!hasValue && project.tasks.length > 0 && (
        <p className="mt-2 text-sm text-muted-foreground print:hidden">
          Informe o valor do pedido para calcular o valor de cada etapa.
        </p>
      )}
      <p className="mt-2 text-xs text-muted-foreground print:hidden">
        Clique na seta de uma etapa para editar tipo, dependências, datas reais, equipe e
        equipamentos. Ao mudar uma data, as etapas que dependem dela são empurradas automaticamente.
      </p>
    </section>
  );
}

function StageDetails({
  project,
  t,
  set,
}: {
  project: Project;
  t: Task;
  set: (patch: Partial<Task>) => void;
}) {
  const others = project.tasks.filter((x) => x.id !== t.id && !t.predecessors.includes(x.id));
  const name = (id: string) => project.tasks.find((x) => x.id === id)?.name || "Sem nome";
  const measured = measuredPercent(project, t.id);
  const field =
    "rounded-md border border-border bg-card px-2 py-1.5 text-sm outline-none focus:border-primary";

  return (
    <div className="grid gap-4 text-sm md:grid-cols-2 xl:grid-cols-4">
      <label className="space-y-1">
        <span className="block text-[11px] uppercase tracking-widest text-muted-foreground">
          Tipo
        </span>
        <select
          className={`${field} w-full`}
          value={t.kind}
          onChange={(e) => set({ kind: e.target.value as TaskKind })}
        >
          <option value="task">Etapa (com duração)</option>
          <option value="milestone">Marco (data única)</option>
        </select>
      </label>

      <div className="space-y-1 xl:col-span-3">
        <span className="block text-[11px] uppercase tracking-widest text-muted-foreground">
          Depende de (só começa após o fim de)
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {t.predecessors.map((id) => (
            <span
              key={id}
              className="flex items-center gap-1 rounded bg-foreground px-2 py-1 text-xs text-background"
            >
              {name(id)}
              <button
                aria-label={`Remover dependência de ${name(id)}`}
                onClick={() => set({ predecessors: t.predecessors.filter((p) => p !== id) })}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {others.length > 0 && (
            <select
              className={field}
              value=""
              onChange={(e) => {
                const id = e.target.value;
                if (!id) return;
                if (wouldCreateCycle(project.tasks, t.id, id)) {
                  alert(`"${name(id)}" já depende desta etapa; isso criaria um ciclo.`);
                  return;
                }
                set({ predecessors: [...t.predecessors, id] });
              }}
            >
              <option value="">+ Adicionar dependência</option>
              {others.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.name || "Sem nome"}
                </option>
              ))}
            </select>
          )}
          {!t.predecessors.length && !others.length && (
            <span className="text-muted-foreground">Nenhuma outra etapa.</span>
          )}
        </div>
      </div>

      <label className="space-y-1">
        <span className="block text-[11px] uppercase tracking-widest text-muted-foreground">
          Início real
        </span>
        <input
          type="date"
          className={`${field} w-full`}
          value={t.actualStart}
          onChange={(e) => set({ actualStart: e.target.value })}
        />
      </label>
      <label className="space-y-1">
        <span className="block text-[11px] uppercase tracking-widest text-muted-foreground">
          Término real
        </span>
        <input
          type="date"
          className={`${field} w-full`}
          value={t.actualEnd}
          min={t.actualStart}
          onChange={(e) => set({ actualEnd: e.target.value })}
        />
      </label>
      <label className="space-y-1">
        <span className="block text-[11px] uppercase tracking-widest text-muted-foreground">
          Equipe (pessoas)
        </span>
        <NumberField
          className={`${field} w-full`}
          decimals={0}
          value={t.crew}
          onValueChange={(crew) => set({ crew: Math.round(crew) })}
        />
      </label>
      <label className="space-y-1">
        <span className="block text-[11px] uppercase tracking-widest text-muted-foreground">
          Equipamentos
        </span>
        <input
          className={`${field} w-full`}
          placeholder="Ex.: andaime, PTA, balancim"
          value={t.equipment}
          onChange={(e) => set({ equipment: e.target.value })}
        />
      </label>

      <div className="space-y-1 text-muted-foreground md:col-span-2 xl:col-span-4">
        <span>
          Linha de base:{" "}
          {t.baselineStart ? (
            <strong className="text-foreground">
              {formatDate(t.baselineStart)} → {formatDate(t.baselineEnd)}
            </strong>
          ) : (
            "não definida (use “Salvar linha de base” no topo do projeto)"
          )}
        </span>
        <span className="mx-3">·</span>
        <span>
          Medido:{" "}
          <strong className={measured > t.progress ? "text-primary" : "text-foreground"}>
            {fmtPct(measured)}
          </strong>
          {measured > t.progress && " (acima do avanço físico)"}
        </span>
      </div>
    </div>
  );
}
