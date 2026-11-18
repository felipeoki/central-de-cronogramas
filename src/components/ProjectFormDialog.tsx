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
import { NumberField } from "@/components/NumberField";

type TextKey = Exclude<keyof ProjectInfo, "orderValue">;

const FIELDS: { key: TextKey; label: string; placeholder: string }[] = [
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
  // `initial` may be a whole Project: keep only the registration fields.
  const pick = (): ProjectInfo => {
    const base = emptyProjectInfo();
    if (!initial) return base;
    return {
      name: initial.name,
      client: initial.client,
      manager: initial.manager,
      budget: initial.budget,
      order: initial.order,
      orderValue: initial.orderValue ?? base.orderValue,
    };
  };
  const [info, setInfo] = useState<ProjectInfo>(pick);
  // Reset the form each time the dialog opens (not on every parent render, which would wipe typing).
  useEffect(() => {
    if (open) setInfo(pick());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed: ProjectInfo = {
      ...info,
      ...Object.fromEntries(FIELDS.map((f) => [f.key, info[f.key].trim()])),
    };
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
            <div className="space-y-1.5">
              <Label htmlFor="project-orderValue">Valor total do pedido (R$)</Label>
              <NumberField
                id="project-orderValue"
                value={info.orderValue}
                onValueChange={(orderValue) => setInfo((cur) => ({ ...cur, orderValue }))}
                placeholder="0,00"
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
              />
            </div>
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
