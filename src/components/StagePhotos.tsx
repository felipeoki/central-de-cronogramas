import { useRef, useState } from "react";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { deletePhoto, resizeImage, savePhoto, usePhoto, type PhotoMeta } from "@/lib/photos";
import { formatDate, todayIso, uid } from "@/lib/schedule";

const field =
  "w-full rounded-md border border-border bg-card px-2 py-1 text-xs outline-none focus:border-primary";

/** Photo field of a stage: add (resized automatically), caption, date, enlarge and delete. */
export function StagePhotos({
  photos,
  onChange,
}: {
  photos: PhotoMeta[];
  onChange: (p: PhotoMeta[]) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [zoom, setZoom] = useState<PhotoMeta | null>(null);

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    const added: PhotoMeta[] = [];
    const errors: string[] = [];
    for (const file of Array.from(files)) {
      try {
        const id = uid();
        await savePhoto(id, await resizeImage(file));
        added.push({ id, caption: "", date: todayIso() });
      } catch (e) {
        errors.push(e instanceof Error ? e.message : String(e));
      }
    }
    setBusy(false);
    if (added.length) onChange([...photos, ...added]);
    if (errors.length) alert(errors.join("\n"));
    if (input.current) input.current.value = "";
  };

  const set = (id: string, patch: Partial<PhotoMeta>) =>
    onChange(photos.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const remove = (p: PhotoMeta) => {
    if (!confirm("Excluir esta foto?")) return;
    onChange(photos.filter((x) => x.id !== p.id));
    void deletePhoto(p.id);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
          Fotos da etapa {photos.length > 0 && `(${photos.length})`}
        </span>
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="flex items-center gap-1 rounded-md border border-border bg-card px-3 py-1 text-sm hover:border-primary hover:text-primary disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          {busy ? "Processando..." : "Adicionar fotos"}
        </button>
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          hidden
          aria-label="Selecionar fotos da etapa"
          onChange={(e) => void add(e.target.files)}
        />
      </div>
      {photos.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {photos.map((p) => (
            <figure key={p.id} className="space-y-1 rounded-md border border-border bg-card p-1.5">
              <button
                type="button"
                onClick={() => setZoom(p)}
                className="block w-full"
                aria-label="Ampliar foto"
              >
                <PhotoImage
                  id={p.id}
                  alt={p.caption}
                  className="aspect-[4/3] w-full rounded object-cover"
                />
              </button>
              <input
                className={field}
                placeholder="Legenda"
                aria-label="Legenda da foto"
                value={p.caption}
                onChange={(e) => set(p.id, { caption: e.target.value })}
              />
              <div className="flex items-center gap-1">
                <input
                  type="date"
                  className={field}
                  aria-label="Data da foto"
                  value={p.date}
                  onChange={(e) => set(p.id, { date: e.target.value })}
                />
                <button
                  type="button"
                  aria-label="Excluir foto"
                  onClick={() => remove(p)}
                  className="shrink-0 p-1 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </figure>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Nenhuma foto. As fotos são reduzidas automaticamente e entram no relatório fotográfico da
          impressão.
        </p>
      )}
      <Dialog open={!!zoom} onOpenChange={(o) => !o && setZoom(null)}>
        <DialogContent className="max-w-4xl">
          <DialogTitle className="text-base">
            {zoom?.caption || "Foto"}{" "}
            {zoom?.date && <span className="text-muted-foreground">· {formatDate(zoom.date)}</span>}
          </DialogTitle>
          {zoom && (
            <PhotoImage
              id={zoom.id}
              alt={zoom.caption}
              className="max-h-[75vh] w-full rounded object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function PhotoImage({
  id,
  alt,
  className,
}: {
  id: string;
  alt: string;
  className?: string;
}) {
  const url = usePhoto(id);
  return url ? (
    <img src={url} alt={alt || "Foto da etapa"} className={className} />
  ) : (
    <div
      className={`${className ?? ""} flex items-center justify-center bg-muted text-xs text-muted-foreground`}
    >
      Foto indisponível neste navegador
    </div>
  );
}
