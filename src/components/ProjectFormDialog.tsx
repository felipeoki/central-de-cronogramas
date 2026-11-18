import { useEffect, useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { emptyProjectInfo, type ProjectInfo } from "@/lib/schedule";

const FIELDS: { key: keyof ProjectInfo; label: string; placeholder: string }[] = [
  { key: "name", label: "Título do projeto", placeholder: "Ex.: Pintura da caldeira 2" },
  { key: "client", label: "Cliente", placeholder: "Nome do cliente" },
  { key: "manager", label: "Responsável", placeholder: "Quem conduz o projeto" },
  { key: "budget", label: "Orçamento", placeholder: "Nº do orçamento" },
  { key: "order", label: "Pedido", placeholder: "Nº do pedido" },
];

export function ProjectFormDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
  mode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: ProjectInfo;
  onSubmit: (info: ProjectInfo) => void;
  mode: "create" | "edit";
}) {
  const [info, setInfo] = useState<ProjectInfo>(initial ?? emptyProjectInfo());
  // Reset the form each time the dialog opens (not on every parent render, which would wipe typing).
  useEffect(() => {
    if (open) setInfo(initial ?? emptyProjectInfo());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = Object.fromEntries(
      Object.entries(info).map(([k, v]) => [k, v.trim()]),
    ) as ProjectInfo;
    if (!trimmed.name) return;
    onSubmit(trimmed);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle className="font-display text-3xl font-normal">
              {mode === "create" ? "Novo projeto" : "Dados do projeto"}
            </DialogTitle>
            <DialogDescription>Preencha as informações de cadastro do projeto.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <div key={f.key} className={`space-y-1.5 ${f.key === "name" ? "sm:col-span-2" : ""}`}>
                <Label htmlFor={`project-${f.key}`}>
                  {f.label}
                  {f.key === "name" && <span className="text-destructive"> *</span>}
                </Label>
                <Input
                  id={`project-${f.key}`}
                  value={info[f.key]}
                  placeholder={f.placeholder}
                  required={f.key === "name"}
                  autoFocus={f.key === "name"}
                  onChange={(e) => setInfo({ ...info, [f.key]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!info.name.trim()}>
              {mode === "create" ? "Cadastrar projeto" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export const PROJECT_FIELDS = FIELDS;
