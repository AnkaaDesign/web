import { BaseExportPopover, type ExportFormat, type ExportColumn } from "@/components/ui/export-popover";
import { toast } from "@/components/ui/sonner";
import { format } from "date-fns";

export interface EditExportRow {
  id: string;
  date: string;
  entry1: string;
  exit1: string;
  entry2: string;
  exit2: string;
  entry3: string;
  exit3: string;
  entry4: string;
  exit4: string;
  entry5: string;
  exit5: string;
  compensated: string;
  neutral: string;
  dayOff: string;
  freeLunch: string;
}

const EXPORT_COLUMNS: ExportColumn<EditExportRow>[] = [
  { id: "date", label: "Data", getValue: (r) => r.date },
  { id: "entry1", label: "Entrada 1", getValue: (r) => r.entry1 || "-" },
  { id: "exit1", label: "Saída 1", getValue: (r) => r.exit1 || "-" },
  { id: "entry2", label: "Entrada 2", getValue: (r) => r.entry2 || "-" },
  { id: "exit2", label: "Saída 2", getValue: (r) => r.exit2 || "-" },
  { id: "entry3", label: "Entrada 3", getValue: (r) => r.entry3 || "-" },
  { id: "exit3", label: "Saída 3", getValue: (r) => r.exit3 || "-" },
  { id: "entry4", label: "Entrada 4", getValue: (r) => r.entry4 || "-" },
  { id: "exit4", label: "Saída 4", getValue: (r) => r.exit4 || "-" },
  { id: "entry5", label: "Entrada 5", getValue: (r) => r.entry5 || "-" },
  { id: "exit5", label: "Saída 5", getValue: (r) => r.exit5 || "-" },
  { id: "compensated", label: "Compensado", getValue: (r) => r.compensated },
  { id: "neutral", label: "Neutro", getValue: (r) => r.neutral },
  { id: "dayOff", label: "Folga", getValue: (r) => r.dayOff },
  { id: "freeLunch", label: "Almoço", getValue: (r) => r.freeLunch },
];

interface TimeClockEntryEditExportProps {
  className?: string;
  currentItems: EditExportRow[];
  visibleColumns?: Set<string>;
  userName?: string | null;
  startDate?: Date | null;
  endDate?: Date | null;
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

function buildPeriodStamp(startDate?: Date | null, endDate?: Date | null): string {
  if (startDate && endDate) {
    return `${format(startDate, "yyyy-MM-dd")}_a_${format(endDate, "yyyy-MM-dd")}`;
  }
  return format(new Date(), "yyyy-MM-dd");
}

function slugify(s: string | null | undefined): string {
  if (!s) return "colaborador";
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function TimeClockEntryEditExport({
  className,
  currentItems,
  visibleColumns,
  userName,
  startDate,
  endDate,
}: TimeClockEntryEditExportProps) {
  const handleExport = async (
    fmt: ExportFormat,
    items: EditExportRow[],
    columns: ExportColumn<EditExportRow>[],
  ) => {
    const periodStamp = buildPeriodStamp(startDate, endDate);
    const userSlug = slugify(userName);
    const headers = columns.map((c) => c.label);
    const rows = items.map((item) => columns.map((c) => c.getValue(item)));
    const baseName = `controle-ponto_${userSlug}_${periodStamp}`;

    if (fmt === "csv" || fmt === "excel") {
      const csv = [headers, ...rows]
        .map((row) => row.map(csvEscape).join(","))
        .join("\n");
      downloadFile(csv, "text/csv;charset=utf-8;", `${baseName}.csv`);
      if (fmt === "excel") {
        toast.info("Formato Excel não disponível — arquivo exportado como CSV");
      } else {
        toast.success("Exportação CSV concluída");
      }
      return;
    }

    const periodLabel =
      startDate && endDate
        ? `${format(startDate, "dd/MM/yyyy")} a ${format(endDate, "dd/MM/yyyy")}`
        : "Período não especificado";
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Controle de Ponto — ${userName ?? ""}</title>
<style>body{font-family:Arial,sans-serif;padding:16px}table{border-collapse:collapse;width:100%;font-size:11px}
th,td{border:1px solid #999;padding:4px 6px;text-align:left}th{background:#eee}h3{margin:0 0 8px 0}</style></head>
<body><h2>Controle de Ponto — ${userName ?? ""}</h2><h3>${periodLabel}</h3>
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
    <BaseExportPopover<EditExportRow>
      className={className}
      currentItems={currentItems}
      totalRecords={currentItems.length}
      visibleColumns={visibleColumns}
      exportColumns={EXPORT_COLUMNS}
      onExport={handleExport}
      entityName="registro de ponto"
      entityNamePlural="registros de ponto"
    />
  );
}
