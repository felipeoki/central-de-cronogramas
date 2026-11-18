import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Trash2, Pencil, Printer, FileSpreadsheet, Flag } from "lucide-react";
import ab5Logo from "@/assets/ab5-logo.png";
import {
  PHASES,
  executedValue,
  formatBRL,
  formatDate,
  hasBaseline,
  invoicedValue,
  loadProjects,
  measuredValue,
  physicalProgress,
  plannedToday,
  progress,
  projectSpan,
  reschedule,
  saveProjects,
  uid,
  withBaseline,
  type Phase,
  type Project,
  type ProjectInfo,
} from "@/lib/schedule";
import { defaultCalendar, workdaysBetween } from "@/lib/calendar";
import { downloadProjectCsv } from "@/lib/export";
import { ProjectFormDialog, PROJECT_FIELDS } from "@/components/ProjectFormDialog";
import { Gantt } from "@/components/Gantt";
import { StageTable } from "@/components/StageTable";
import { Measurements } from "@/components/Measurements";
import { SCurve } from "@/components/SCurve";
import { CalendarSettings } from "@/components/CalendarSettings";
import { Overview } from "@/components/Overview";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Central de Cronogramas · Ab5" },
      {
        name: "description",
        content: "Cronogramas, medições e Curva S dos projetos da Ab5 em um só lugar.",
      },
      { property: "og:title", content: "Central de Cronogramas · Ab5" },
      {
        property: "og:description",
        content: "Cronogramas, medições e Curva S dos projetos da Ab5 em um só lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type PhaseFilter = "ativos" | "todos" | Phase;

const select =
  "w-full rounded-md border border-border bg-card px-2 py-1.5 text-sm outline-none focus:border-primary";

function Index() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [activeId, setActiveId] = useState<string | "all">("all");
  const [creating, setCreating] = useState(false);
  const [phase, setPhase] = useState<PhaseFilter>("ativos");
  const [client, setClient] = useState("");
  const [manager, setManager] = useState("");
  useEffect(() => setProjects(loadProjects()), []);
  useEffect(() => {
    if (projects) saveProjects(projects);
  }, [projects]);

  if (!projects) return <div className="min-h-screen bg-background" />;

  const update = (id: string, fn: (p: Project) => Project) =>
    setProjects(projects.map((p) => (p.id === id ? fn(p) : p)));
  /** Applies a change and pushes dependent stages forward. */
  const updateScheduled = (id: string, fn: (p: Project) => Project) =>
    update(id, (p) => {
      const next = fn(p);
      return { ...next, tasks: reschedule(next.tasks, next.calendar) };
    });
  const addProject = (info: ProjectInfo) => {
    const p: Project = {
      id: uid(),
      ...info,
      color: projects.length % 5,
      calendar: defaultCalendar(),
      tasks: [],
      measurements: [],
    };
    setProjects([...projects, p]);
    setActiveId(p.id);
  };

  const clients = [...new Set(projects.map((p) => p.client).filter(Boolean))].sort();
  const managers = [...new Set(projects.map((p) => p.manager).filter(Boolean))].sort();
  const filtered = projects.filter(
    (p) =>
      (phase === "todos" || (phase === "ativos" ? p.phase !== "encerrado" : p.phase === phase)) &&
      (!client || p.client === client) &&
      (!manager || p.manager === manager),
  );
  const active = projects.find((p) => p.id === activeId);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="w-72 shrink-0 border-r border-border bg-sidebar p-6 print:hidden">
        <div className="mb-8 border-b-2 border-primary pb-5">
          <img src={ab5Logo} alt="Ab5 Indústria e Comércio" className="h-14 w-auto" />
          <h1 className="font-display mt-3 text-xl leading-tight">Central de Cronogramas</h1>
        </div>
        <button
          onClick={() => setActiveId("all")}
          className={`nav-item ${activeId === "all" ? "nav-item-active" : ""}`}
        >
          Visão geral <span className="text-xs opacity-70">{filtered.length}</span>
        </button>

        <div className="mt-6 space-y-2">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Filtros</p>
          <select
            aria-label="Filtrar por fase"
            className={select}
            value={phase}
            onChange={(e) => setPhase(e.target.value as PhaseFilter)}
          >
            <option value="ativos">Projetos ativos</option>
            <option value="todos">Todos os projetos</option>
            {Object.entries(PHASES).map(([k, v]) => (
              <option key={k} value={k}>
                Fase: {v}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar por cliente"
            className={select}
            value={client}
            onChange={(e) => setClient(e.target.value)}
          >
            <option value="">Todos os clientes</option>
            {clients.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar por responsável"
            className={select}
            value={manager}
            onChange={(e) => setManager(e.target.value)}
          >
            <option value="">Todos os responsáveis</option>
            {managers.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        <p className="mb-2 mt-6 text-xs uppercase tracking-widest text-muted-foreground">
          Projetos
        </p>
        <div className="space-y-1">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => setActiveId(p.id)}
              className={`nav-item ${activeId === p.id ? "nav-item-active" : ""}`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full proj-${p.color}`} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{p.name}</span>
                  <span className="truncate text-[11px] opacity-70">
                    {[p.client, PHASES[p.phase]].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </span>
              <span className="text-xs opacity-70">{progress(p)}%</span>
            </button>
          ))}
          {!filtered.length && (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              Nenhum projeto com esses filtros.
            </p>
          )}
        </div>
        <ProjectFormDialog
          mode="create"
          open={creating}
          onOpenChange={setCreating}
          onSubmit={addProject}
        />
        <button
          onClick={() => setCreating(true)}
          className="mt-4 flex w-full items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary"
        >
          <Plus className="h-4 w-4" /> Novo projeto
        </button>
      </aside>

      <main className="min-w-0 flex-1 p-8 print:p-0">
        {active ? (
          <>
            <ProjectHeader
              project={active}
              onSave={(info) => update(active.id, (p) => ({ ...p, ...info }))}
              onBaseline={() => update(active.id, withBaseline)}
              onDelete={() => {
                setProjects(projects.filter((p) => p.id !== active.id));
                setActiveId("all");
              }}
            />
            <Gantt projects={[active]} calendar={active.calendar} />
            <StageTable
              project={active}
              onChange={(tasks) => updateScheduled(active.id, (p) => ({ ...p, tasks }))}
              onOrderValueChange={(orderValue) => update(active.id, (p) => ({ ...p, orderValue }))}
            />
            <SCurve project={active} />
            <Measurements
              project={active}
              onChange={(measurements) => update(active.id, (p) => ({ ...p, measurements }))}
            />
            <CalendarSettings
              calendar={active.calendar}
              onChange={(calendar) => updateScheduled(active.id, (p) => ({ ...p, calendar }))}
            />
          </>
        ) : (
          <>
            <header className="mb-8 print:mb-4">
              <PrintBanner title="Visão geral dos projetos" />
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    {phase === "ativos"
                      ? "Projetos ativos"
                      : phase === "todos"
                        ? "Todos os projetos"
                        : `Fase: ${PHASES[phase]}`}
                    {client && ` · ${client}`}
                    {manager && ` · ${manager}`}
                  </p>
                  <h2 className="font-display text-4xl">Visão geral</h2>
                </div>
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 print:hidden"
                >
                  <Printer className="h-4 w-4" /> Imprimir
                </button>
              </div>
            </header>
            <Overview projects={filtered} onOpen={setActiveId} />
            <h3 className="mb-3 mt-8 font-display text-2xl">Cronograma geral</h3>
            <Gantt projects={filtered} />
          </>
        )}
      </main>
    </div>
  );
}

function PrintBanner({ title }: { title: string }) {
  return (
    <div className="mb-4 hidden items-center justify-between border-b-2 border-primary pb-3 print:flex">
      <img src={ab5Logo} alt="Ab5 Indústria e Comércio" className="h-12 w-auto" />
      <div className="text-right text-xs text-muted-foreground">
        <p className="font-display text-base text-foreground">{title}</p>
        <p>Emitido em {format(new Date(), "dd/MM/yyyy", { locale: ptBR })}</p>
      </div>
    </div>
  );
}

function ProjectHeader({
  project,
  onSave,
  onBaseline,
  onDelete,
}: {
  project: Project;
  onSave: (info: ProjectInfo) => void;
  onBaseline: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const details = PROJECT_FIELDS.filter((f) => f.key !== "name");
  const physical = physicalProgress(project);
  const planned = plannedToday(project);
  const end = projectSpan(project).end;
  const baseEnd = projectSpan(project, true).end;
  const slip = baseEnd && end > baseEnd ? workdaysBetween(baseEnd, end, project.calendar) - 1 : 0;
  const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  const kpis = [
    { label: "Avanço físico", value: pct(physical), alert: physical + 0.05 < planned },
    { label: "Previsto para hoje", value: pct(planned) },
    { label: "Executado", value: formatBRL(executedValue(project)) },
    { label: "Medido", value: formatBRL(measuredValue(project)) },
    { label: "Faturado", value: formatBRL(invoicedValue(project)) },
    {
      label: "Término previsto",
      value: formatDate(end) || "—",
      sub: baseEnd
        ? slip > 0
          ? `+${slip} dia(s) útil(eis) vs. base`
          : "dentro da linha de base"
        : "sem linha de base",
      alert: slip > 0,
    },
  ];
  const btn = "flex items-center gap-1 text-sm text-muted-foreground hover:text-primary";

  return (
    <header className="mb-8 print:mb-4">
      <PrintBanner title="Cronograma do projeto" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Projeto · <span className="text-foreground">{PHASES[project.phase]}</span>
          </p>
          <h2 className="truncate font-display text-4xl">{project.name || "Sem título"}</h2>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-4 print:hidden">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
          >
            <Printer className="h-4 w-4" /> Imprimir
          </button>
          <button
            onClick={() => downloadProjectCsv(project)}
            className={btn}
            title="Baixa um arquivo .csv que abre no Excel"
          >
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </button>
          <button
            onClick={() =>
              (!hasBaseline(project) ||
                confirm("Substituir a linha de base atual pelas datas de hoje do cronograma?")) &&
              onBaseline()
            }
            className={btn}
            title="Congela as datas atuais para comparar com o realizado"
          >
            <Flag className="h-4 w-4" />{" "}
            {hasBaseline(project) ? "Atualizar linha de base" : "Salvar linha de base"}
          </button>
          <button onClick={() => setEditing(true)} className={btn}>
            <Pencil className="h-4 w-4" /> Editar dados
          </button>
          <button
            onClick={() => confirm("Excluir este projeto?") && onDelete()}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" /> Excluir
          </button>
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-5 print:grid-cols-5">
        {details.map((f) => (
          <div key={f.key} className="bg-card px-4 py-3">
            <dt className="text-[11px] uppercase tracking-widest text-muted-foreground">
              {f.label}
            </dt>
            <dd className="mt-0.5 truncate text-sm">
              {project[f.key] || <span className="text-muted-foreground">—</span>}
            </dd>
          </div>
        ))}
        <div className="bg-card px-4 py-3">
          <dt className="text-[11px] uppercase tracking-widest text-muted-foreground">
            Valor do pedido
          </dt>
          <dd className="mt-0.5 truncate text-sm font-medium">
            {project.orderValue ? (
              formatBRL(project.orderValue)
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </dd>
        </div>
      </dl>
      <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3 xl:grid-cols-6 print:grid-cols-6">
        {kpis.map((k) => (
          <div key={k.label} className="bg-card px-4 py-3">
            <dt className="text-[11px] uppercase tracking-widest text-muted-foreground">
              {k.label}
            </dt>
            <dd
              className={`mt-0.5 text-lg font-semibold tabular-nums ${k.alert ? "text-primary" : ""}`}
            >
              {k.value}
            </dd>
            {k.sub && (
              <dd className={`text-[11px] ${k.alert ? "text-primary" : "text-muted-foreground"}`}>
                {k.sub}
              </dd>
            )}
          </div>
        ))}
      </dl>
      <ProjectFormDialog
        mode="edit"
        open={editing}
        onOpenChange={setEditing}
        initial={project}
        onSubmit={onSave}
      />
    </header>
  );
}
