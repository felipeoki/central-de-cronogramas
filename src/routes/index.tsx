import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { addDays, differenceInCalendarDays, format, parseISO, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Trash2, CalendarRange, Pencil } from "lucide-react";
import { loadProjects, saveProjects, progress, uid, type Project, type ProjectInfo, type Task, type Status } from "@/lib/schedule";
import { ProjectFormDialog, PROJECT_FIELDS } from "@/components/ProjectFormDialog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cronogramas — todos os seus projetos em um lugar" },
      { name: "description", content: "Organize e acompanhe os cronogramas de todos os seus projetos em uma linha do tempo única." },
      { property: "og:title", content: "Cronogramas — todos os seus projetos em um lugar" },
      { property: "og:description", content: "Organize e acompanhe os cronogramas de todos os seus projetos em uma linha do tempo única." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const STATUS: Record<Status, string> = { todo: "A fazer", doing: "Em andamento", done: "Concluído" };
const DAY = 32;

function Index() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [activeId, setActiveId] = useState<string | "all">("all");
  const [creating, setCreating] = useState(false);
  useEffect(() => setProjects(loadProjects()), []);
  useEffect(() => { if (projects) saveProjects(projects); }, [projects]);

  if (!projects) return <div className="min-h-screen bg-background" />;

  const update = (id: string, fn: (p: Project) => Project) => setProjects(projects.map((p) => (p.id === id ? fn(p) : p)));
  const addProject = (info: ProjectInfo) => {
    const p: Project = { id: uid(), ...info, color: projects.length % 5, tasks: [] };
    setProjects([...projects, p]); setActiveId(p.id);
  };
  const visible = activeId === "all" ? projects : projects.filter((p) => p.id === activeId);
  const active = projects.find((p) => p.id === activeId);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="w-72 shrink-0 border-r border-border bg-sidebar p-6">
        <div className="mb-10 flex items-center gap-2">
          <CalendarRange className="h-5 w-5 text-primary" />
          <h1 className="font-display text-3xl leading-none">Cronogramas</h1>
        </div>
        <button onClick={() => setActiveId("all")} className={`nav-item ${activeId === "all" ? "nav-item-active" : ""}`}>
          Visão geral <span className="text-xs opacity-70">{projects.length}</span>
        </button>
        <p className="mb-2 mt-8 text-xs uppercase tracking-widest text-muted-foreground">Projetos</p>
        <div className="space-y-1">
          {projects.map((p) => (
            <button key={p.id} onClick={() => setActiveId(p.id)} className={`nav-item ${activeId === p.id ? "nav-item-active" : ""}`}>
              <span className="flex min-w-0 items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full proj-${p.color}`} />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate">{p.name}</span>
                  {p.client && <span className="truncate text-[11px] opacity-70">{p.client}</span>}
                </span>
              </span>
              <span className="text-xs opacity-70">{progress(p)}%</span>
            </button>
          ))}
        </div>
        <ProjectFormDialog mode="create" open={creating} onOpenChange={setCreating} onSubmit={addProject} />
        <button onClick={() => setCreating(true)} className="mt-4 flex w-full items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary">
          <Plus className="h-4 w-4" /> Novo projeto
        </button>
      </aside>

      <main className="min-w-0 flex-1 p-8">
        {active ? (
          <ProjectHeader project={active}
            onSave={(info) => update(active.id, (p) => ({ ...p, ...info }))}
            onDelete={() => { setProjects(projects.filter((p) => p.id !== active.id)); setActiveId("all"); }} />
        ) : (
          <header className="mb-8">
            <p className="text-xs uppercase tracking-widest text-muted-foreground">Todos os projetos</p>
            <h2 className="font-display text-5xl">Visão geral</h2>
          </header>
        )}
        <Gantt projects={visible} />
        {active && <TaskTable project={active} onChange={(tasks) => update(active.id, (p) => ({ ...p, tasks }))} />}
      </main>
    </div>
  );
}

function ProjectHeader({ project, onSave, onDelete }: { project: Project; onSave: (info: ProjectInfo) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const details = PROJECT_FIELDS.filter((f) => f.key !== "name");
  return (
    <header className="mb-8">
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Projeto · {progress(project)}% concluído</p>
          <h2 className="truncate font-display text-5xl">{project.name || "Sem título"}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
            <Pencil className="h-4 w-4" /> Editar dados
          </button>
          <button onClick={() => confirm("Excluir este projeto?") && onDelete()} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-destructive">
            <Trash2 className="h-4 w-4" /> Excluir
          </button>
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
        {details.map((f) => (
          <div key={f.key} className="bg-card px-4 py-3">
            <dt className="text-[11px] uppercase tracking-widest text-muted-foreground">{f.label}</dt>
            <dd className="mt-0.5 truncate text-sm">{project[f.key] || <span className="text-muted-foreground">—</span>}</dd>
          </div>
        ))}
      </dl>
      <ProjectFormDialog mode="edit" open={editing} onOpenChange={setEditing} initial={project} onSubmit={onSave} />
    </header>
  );
}

function Gantt({ projects }: { projects: Project[] }) {
  const tasks = projects.flatMap((p) => p.tasks.filter((t) => t.start && t.end).map((t) => ({ ...t, project: p })));
  const range = useMemo(() => {
    const today = new Date();
    const dates = tasks.flatMap((t) => [parseISO(t.start), parseISO(t.end)]);
    const min = dates.length ? new Date(Math.min(...dates.map(Number), +today)) : today;
    const max = dates.length ? new Date(Math.max(...dates.map(Number), +today)) : addDays(today, 21);
    const start = startOfWeek(addDays(min, -2), { weekStartsOn: 1 });
    return { start, days: Math.max(differenceInCalendarDays(max, start) + 7, 28) };
  }, [tasks]);
  const todayOff = differenceInCalendarDays(new Date(), range.start);

  if (!tasks.length) return <div className="rounded-lg border border-dashed border-border p-12 text-center text-muted-foreground">Nenhuma tarefa com datas ainda. Adicione tarefas abaixo.</div>;

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-soft">
      <div className="relative" style={{ width: 240 + range.days * DAY }}>
        <div className="sticky top-0 flex border-b border-border bg-card">
          <div className="sticky left-0 z-10 w-60 shrink-0 border-r border-border bg-card px-4 py-2 text-xs uppercase tracking-widest text-muted-foreground">Tarefa</div>
          {Array.from({ length: range.days }).map((_, i) => {
            const d = addDays(range.start, i);
            return (
              <div key={i} style={{ width: DAY }} className={`shrink-0 py-1 text-center text-[10px] ${d.getDay() % 6 === 0 ? "bg-muted text-muted-foreground" : ""}`}>
                {d.getDate() === 1 || i === 0 ? <div className="font-semibold uppercase">{format(d, "MMM", { locale: ptBR })}</div> : <div>&nbsp;</div>}
                {d.getDate()}
              </div>
            );
          })}
        </div>
        {tasks.map((t) => {
          const off = differenceInCalendarDays(parseISO(t.start), range.start);
          const len = Math.max(differenceInCalendarDays(parseISO(t.end), parseISO(t.start)) + 1, 1);
          return (
            <div key={t.id} className="flex h-11 items-center border-b border-border last:border-0">
              <div className="sticky left-0 z-10 flex h-full w-60 shrink-0 flex-col justify-center border-r border-border bg-card px-4">
                <span className="truncate text-sm">{t.name || "Sem nome"}</span>
                {projects.length > 1 && <span className="truncate text-[11px] text-muted-foreground">{t.project.name}</span>}
              </div>
              <div className="relative h-full flex-1">
                <div title={`${t.name}: ${t.start} → ${t.end}`} style={{ left: off * DAY + 2, width: len * DAY - 4 }}
                  className={`absolute top-2 flex h-7 items-center overflow-hidden rounded-md px-2 text-xs font-medium proj-${t.project.color} ${t.status === "done" ? "opacity-50" : ""} ${t.status === "doing" ? "ring-2 ring-foreground/30" : ""}`}>
                  <span className="truncate text-primary-foreground">{t.owner}</span>
                </div>
              </div>
            </div>
          );
        })}
        <div className="pointer-events-none absolute bottom-0 top-0 w-px bg-destructive" style={{ left: 240 + todayOff * DAY + DAY / 2 }} />
      </div>
    </div>
  );
}

function TaskTable({ project, onChange }: { project: Project; onChange: (t: Task[]) => void }) {
  const set = (id: string, patch: Partial<Task>) => onChange(project.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const add = () => {
    const last = project.tasks.at(-1);
    const start = last?.end ? addDays(parseISO(last.end), 1) : new Date();
    onChange([...project.tasks, { id: uid(), name: "", start: format(start, "yyyy-MM-dd"), end: format(addDays(start, 4), "yyyy-MM-dd"), status: "todo", owner: "" }]);
  };
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-2xl">Tarefas</h3>
        <button onClick={add} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"><Plus className="h-4 w-4" /> Adicionar tarefa</button>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr><th className="px-3 py-2">Tarefa</th><th className="px-3 py-2">Responsável</th><th className="px-3 py-2">Início</th><th className="px-3 py-2">Fim</th><th className="px-3 py-2">Status</th><th /></tr>
          </thead>
          <tbody>
            {project.tasks.map((t) => (
              <tr key={t.id} className="border-t border-border">
                <td className="px-1"><input className="cell" placeholder="Nome da tarefa" value={t.name} onChange={(e) => set(t.id, { name: e.target.value })} /></td>
                <td className="px-1"><input className="cell" placeholder="—" value={t.owner} onChange={(e) => set(t.id, { owner: e.target.value })} /></td>
                <td className="px-1"><input type="date" className="cell" value={t.start} onChange={(e) => set(t.id, { start: e.target.value })} /></td>
                <td className="px-1"><input type="date" className="cell" value={t.end} min={t.start} onChange={(e) => set(t.id, { end: e.target.value })} /></td>
                <td className="px-1">
                  <select className="cell" value={t.status} onChange={(e) => set(t.id, { status: e.target.value as Status })}>
                    {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </td>
                <td className="px-2 text-right"><button aria-label="Excluir tarefa" onClick={() => onChange(project.tasks.filter((x) => x.id !== t.id))} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button></td>
              </tr>
            ))}
            {!project.tasks.length && <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">Nenhuma tarefa ainda.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
