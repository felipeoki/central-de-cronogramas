import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import ab5Logo from "@/assets/ab5-logo.png";
import { PhotoImage } from "@/components/StagePhotos";
import { loadPhotos } from "@/lib/photos";
import { PHASES, formatDate, type Project } from "@/lib/schedule";

export type PrintMode = "all" | "schedule" | "photos";

export const projectPhotoIds = (p: Project) => p.tasks.flatMap((t) => t.photos.map((ph) => ph.id));

/**
 * Prints the page in the chosen mode. `body[data-print]` drives which sections show (see styles.css);
 * photos are loaded first so none is missing from the printout.
 */
export async function printProject(p: Project | undefined, mode: PrintMode) {
  if (p && mode !== "schedule") await loadPhotos(projectPhotoIds(p));
  document.body.dataset["print"] = mode;
  // Let React paint the loaded images before the print dialog snapshots the page.
  await new Promise((r) => setTimeout(r, 150));
  const reset = () => {
    delete document.body.dataset["print"];
    window.removeEventListener("afterprint", reset);
  };
  window.addEventListener("afterprint", reset);
  window.print();
}

/** Print-only photo report (Ab5 template): header with project data, then photos grouped by stage. */
export function PhotoReport({ project }: { project: Project }) {
  const stages = project.tasks.filter((t) => t.photos.length);
  if (!stages.length) return null;
  let n = 0;
  const info = [
    ["Projeto", project.name],
    ["Cliente", project.client],
    ["Pedido", project.order],
    ["Orçamento", project.budget],
    ["Responsável", project.manager],
    ["Fase", PHASES[project.phase]],
  ].filter(([, v]) => v);

  return (
    <section className="photo-report hidden print:block">
      <div className="flex items-center justify-between border-b-2 border-primary pb-3">
        <img src={ab5Logo} alt="Ab5 Indústria e Comércio" className="h-12 w-auto" />
        <div className="text-right">
          <p className="font-display text-xl">Relatório fotográfico</p>
          <p className="text-xs text-muted-foreground">
            Emitido em {format(new Date(), "dd/MM/yyyy", { locale: ptBR })}
          </p>
        </div>
      </div>
      <dl className="mb-4 mt-3 grid grid-cols-3 gap-x-6 gap-y-1 rounded-md bg-muted px-4 py-2 text-xs">
        {info.map(([k, v]) => (
          <div key={k} className="flex gap-2">
            <dt className="font-semibold uppercase tracking-wider text-muted-foreground">{k}:</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>

      {stages.map((t) => (
        <div key={t.id} className="mb-4">
          <h4 className="mb-2 flex items-baseline justify-between border-l-4 border-primary bg-muted/60 px-3 py-1.5 text-sm break-after-avoid">
            <span className="font-semibold">{t.name || "Etapa sem nome"}</span>
            <span className="text-xs text-muted-foreground">
              {t.kind === "milestone"
                ? formatDate(t.start)
                : `${formatDate(t.start)} a ${formatDate(t.end)}`}{" "}
              · avanço {t.progress.toLocaleString("pt-BR")}%
            </span>
          </h4>
          <div className="grid grid-cols-3 gap-3">
            {t.photos.map((ph) => {
              n += 1;
              return (
                <figure key={ph.id} className="break-inside-avoid">
                  <PhotoImage
                    id={ph.id}
                    alt={ph.caption}
                    className="aspect-[4/3] w-full rounded-sm border border-border object-cover"
                  />
                  <figcaption className="mt-1 text-[11px] leading-snug">
                    <span className="font-semibold">Foto {String(n).padStart(2, "0")}</span>
                    {ph.caption && <> — {ph.caption}</>}
                    {ph.date && (
                      <span className="text-muted-foreground"> · {formatDate(ph.date)}</span>
                    )}
                  </figcaption>
                </figure>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
