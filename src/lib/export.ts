import { workdaysBetween } from "./calendar";
import {
  PHASES,
  executedValue,
  formatDate,
  invoicedValue,
  measuredPercent,
  measuredValue,
  measurementValue,
  physicalProgress,
  stageValue,
  taskSituation,
  type Project,
} from "./schedule";

/** Number for Excel pt-BR: comma decimals, no thousands separator. */
const n = (v: number, decimals = 2) =>
  v.toLocaleString("pt-BR", { useGrouping: false, maximumFractionDigits: decimals });

/** Escapes one CSV cell (separator ";", as Excel uses in pt-BR). */
export const csvCell = (v: string | number) => {
  const s = String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const row = (cells: (string | number)[]) => cells.map(csvCell).join(";");

/** Project schedule as CSV that Excel (pt-BR) opens directly. */
export function projectCsv(p: Project): string {
  const names = new Map(p.tasks.map((t) => [t.id, t.name || "Sem nome"]));
  const lines = [
    row(["Projeto", p.name]),
    row(["Cliente", p.client]),
    row(["Responsável", p.manager]),
    row(["Orçamento", p.budget]),
    row(["Pedido", p.order]),
    row(["Fase", PHASES[p.phase]]),
    row(["Valor do pedido (R$)", n(p.orderValue)]),
    row(["Avanço físico (%)", n(physicalProgress(p))]),
    row(["Valor executado (R$)", n(executedValue(p))]),
    row(["Valor medido (R$)", n(measuredValue(p))]),
    row(["Valor faturado (R$)", n(invoicedValue(p))]),
    "",
    row([
      "Etapa",
      "Tipo",
      "Responsável",
      "Início",
      "Fim",
      "Dias úteis",
      "Peso (%)",
      "Valor (R$)",
      "Avanço (%)",
      "Valor executado (R$)",
      "Medido (%)",
      "Situação",
      "Início real",
      "Fim real",
      "Linha de base início",
      "Linha de base fim",
      "Predecessoras",
      "Equipe (pessoas)",
      "Equipamentos",
    ]),
    ...p.tasks.map((t) => {
      const value = stageValue(p.orderValue, t.weight);
      return row([
        t.name,
        t.kind === "milestone" ? "Marco" : "Etapa",
        t.owner,
        formatDate(t.start),
        formatDate(t.end),
        t.kind === "milestone" ? 0 : workdaysBetween(t.start, t.end, p.calendar),
        n(t.weight, 4),
        n(value),
        n(t.progress),
        n((value * t.progress) / 100),
        n(measuredPercent(p, t.id)),
        taskSituation(t, p.calendar).label,
        formatDate(t.actualStart),
        formatDate(t.actualEnd),
        formatDate(t.baselineStart),
        formatDate(t.baselineEnd),
        t.predecessors
          .map((id) => names.get(id) ?? "")
          .filter(Boolean)
          .join(", "),
        n(t.crew, 0),
        t.equipment,
      ]);
    }),
  ];
  if (p.measurements.length) {
    lines.push(
      "",
      row(["Medições"]),
      row(["Data", "Etapa", "Medido da etapa (%)", "Valor (R$)", "BM", "NF"]),
    );
    for (const m of p.measurements)
      lines.push(
        row([
          formatDate(m.date),
          names.get(m.taskId) ?? "",
          n(m.percent),
          n(measurementValue(p, m)),
          m.bm,
          m.invoice,
        ]),
      );
  }
  return lines.join("\r\n");
}

/** Downloads the project as a .csv file (UTF-8 with BOM so Excel shows accents correctly). */
export function downloadProjectCsv(p: Project) {
  const blob = new Blob(["﻿" + projectCsv(p)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Cronograma - ${(p.name || "projeto").replace(/[\\/:*?"<>|]/g, "-")}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
