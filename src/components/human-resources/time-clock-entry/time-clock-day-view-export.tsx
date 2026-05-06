import { BaseExportPopover, type ExportFormat, type ExportColumn } from "@/components/ui/export-popover";
import { toast } from "@/components/ui/sonner";
import { format } from "date-fns";

export interface DayExportRow {
  id: string;
  userName: string;
  sectorName: string;
  entrada1: string;
  saida1: string;
  entrada2: string;
  saida2: string;
  entrada3: string;
  saida3: string;
  entrada4: string;
  saida4: string;
  entrada5: string;
  saida5: string;
  normais: string;
  faltas: string;
  ex50: string;
  ex100: string;
  ex150: string;
  dsr: string;
  dsrDeb: string;
  ajuste: string;
  atras: string;
  adian: string;
  compensated: string;
  neutral: string;
  dayOff: string;
  freeLunch: string;
}

const EXPORT_COLUMNS: ExportColumn<DayExportRow>[] = [
  { id: "userName", label: "Colaborador", getValue: (r) => r.userName },
  { id: "sectorName", label: "Setor", getValue: (r) => r.sectorName || "-" },
  { id: "entrada1", label: "Entrada 1", getValue: (r) => r.entrada1 || "-" },
  { id: "saida1", label: "Saída 1", getValue: (r) => r.saida1 || "-" },
  { id: "entrada2", label: "Entrada 2", getValue: (r) => r.entrada2 || "-" },
  { id: "saida2", label: "Saída 2", getValue: (r) => r.saida2 || "-" },
  { id: "entrada3", label: "Entrada 3", getValue: (r) => r.entrada3 || "-" },
  { id: "saida3", label: "Saída 3", getValue: (r) => r.saida3 || "-" },
  { id: "entrada4", label: "Entrada 4", getValue: (r) => r.entrada4 || "-" },
  { id: "saida4", label: "Saída 4", getValue: (r) => r.saida4 || "-" },
  { id: "entrada5", label: "Entrada 5", getValue: (r) => r.entrada5 || "-" },
  { id: "saida5", label: "Saída 5", getValue: (r) => r.saida5 || "-" },
  { id: "normais", label: "Normal", getValue: (r) => r.normais || "-" },
  { id: "faltas", label: "Faltas", getValue: (r) => r.faltas || "-" },
  { id: "ex50", label: "EX50%", getValue: (r) => r.ex50 || "-" },
  { id: "ex100", label: "EX100%", getValue: (r) => r.ex100 || "-" },
  { id: "ex150", label: "EX150%", getValue: (r) => r.ex150 || "-" },
  { id: "dsr", label: "DSR", getValue: (r) => r.dsr || "-" },
  { id: "dsrDeb", label: "DSR.Deb", getValue: (r) => r.dsrDeb || "-" },
  { id: "ajuste", label: "Ajuste", getValue: (r) => r.ajuste || "-" },
  { id: "atras", label: "Atraso", getValue: (r) => r.atras || "-" },
  { id: "adian", label: "Adiant.", getValue: (r) => r.adian || "-" },
  { id: "compensated", label: "Compensado", getValue: (r) => r.compensated },
  { id: "neutral", label: "Neutro", getValue: (r) => r.neutral },
  { id: "dayOff", label: "Folga", getValue: (r) => r.dayOff },
  { id: "freeLunch", label: "Almoço", getValue: (r) => r.freeLunch },
];

interface TimeClockDayViewExportProps {
  className?: string;
  currentItems: DayExportRow[];
  visibleColumns?: Set<string>;
  date: Date;
}

function csvEscape(field: string): string {
  return `"${String(field).replace(/"/g, '""')}"`;
}

function downloadFile(content: string, mime: string, filename: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function TimeClockDayViewExport({
  className,
  currentItems,
  visibleColumns,
  date,
}: TimeClockDayViewExportProps) {
  const handleExport = async (
    fmt: ExportFormat,
    items: DayExportRow[],
    columns: ExportColumn<DayExportRow>[],
  ) => {
    const dateStamp = format(date, "yyyy-MM-dd");
    const headers = columns.map((c) => c.label);
    const rows = items.map((item) => columns.map((c) => c.getValue(item)));

    if (fmt === "csv" || fmt === "excel") {
      const csv = [headers, ...rows]
        .map((row) => row.map(csvEscape).join(","))
        .join("\n");
      downloadFile(csv, "text/csv;charset=utf-8;", `controle-ponto-dia_${dateStamp}.csv`);
      if (fmt === "excel") {
        toast.info("Formato Excel não disponível — arquivo exportado como CSV");
      } else {
        toast.success("Exportação CSV concluída");
      }
      return;
    }

    // Minimal HTML print fallback for PDF — opens print dialog targeting the
    // browser's "Save as PDF" handler. Mirrors the calculation export.
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Controle de Ponto — Dia ${dateStamp}</title>
<style>body{font-family:Arial,sans-serif;padding:16px}table{border-collapse:collapse;width:100%;font-size:11px}
th,td{border:1px solid #999;padding:4px 6px;text-align:left}th{background:#eee}</style></head>
<body><h2>Controle de Ponto — Dia ${dateStamp}</h2>
<table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
<tbody>${rows
      .map((row) => `<tr>${row.map((c) => `<td>${c}</td>`).join("")}</tr>`)
      .join("")}</tbody></table></body></html>`;
    const win = window.open("", "_blank");
    if (!win) {
      toast.error("Bloqueador de pop-up impediu a exportação");
      return;
    }
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
    toast.success("Exportação PDF aberta para impressão");
  };

  return (
    <BaseExportPopover<DayExportRow>
      className={className}
      currentItems={currentItems}
      totalRecords={currentItems.length}
      visibleColumns={visibleColumns}
      exportColumns={EXPORT_COLUMNS}
      onExport={handleExport}
      entityName="registro do dia"
      entityNamePlural="registros do dia"
    />
  );
}
