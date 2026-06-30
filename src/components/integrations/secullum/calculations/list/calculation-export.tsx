import { BaseExportPopover, type ExportFormat, type ExportColumn } from "@/components/ui/export-popover";
import { toast } from "@/components/ui/sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { secullumService } from "@/api-client";
import {
  parseSecullumCalculations,
  fetchHorarioForUser,
} from "@/components/personnel-department/time-clock-entry/time-clock-entry-edit-export";
import { createEspelhoRenderer } from "@/utils/espelho-ponto-pdf-generator";

interface CalculationRow {
  id: string;
  date: string;
  entrada1?: string;
  saida1?: string;
  entrada2?: string;
  saida2?: string;
  entrada3?: string;
  saida3?: string;
  normais?: string;
  faltas?: string;
  ex50?: string;
  ex100?: string;
  ex150?: string;
  dsr?: string;
  dsrDeb?: string;
  not?: string;
  exNot?: string;
  ajuste?: string;
  abono2?: string;
  abono3?: string;
  abono4?: string;
  atras?: string;
  adian?: string;
  folga?: string;
  carga?: string;
  justPa?: string;
  tPlusMinus?: string;
  exInt?: string;
  notTot?: string;
  refeicao?: string;
}

interface CalculationExportProps {
  className?: string;
  filters: any;
  currentItems: CalculationRow[];
  totalRecords: number;
  visibleColumns: Set<string>;
  selectedItems?: Set<string>;
}

// Column configuration for export
const EXPORT_COLUMNS: ExportColumn<CalculationRow>[] = [
  { id: "date", label: "Data", getValue: (row: CalculationRow) => row.date || "" },
  { id: "entrada1", label: "Entrada 1", getValue: (row: CalculationRow) => row.entrada1 || "" },
  { id: "saida1", label: "Saída 1", getValue: (row: CalculationRow) => row.saida1 || "" },
  { id: "entrada2", label: "Entrada 2", getValue: (row: CalculationRow) => row.entrada2 || "" },
  { id: "saida2", label: "Saída 2", getValue: (row: CalculationRow) => row.saida2 || "" },
  { id: "entrada3", label: "Entrada 3", getValue: (row: CalculationRow) => row.entrada3 || "" },
  { id: "saida3", label: "Saída 3", getValue: (row: CalculationRow) => row.saida3 || "" },
  { id: "normais", label: "Normal", getValue: (row: CalculationRow) => row.normais || "" },
  { id: "faltas", label: "Faltas", getValue: (row: CalculationRow) => row.faltas || "" },
  { id: "ex50", label: "Ex50%", getValue: (row: CalculationRow) => row.ex50 || "" },
  { id: "ex100", label: "Ex100%", getValue: (row: CalculationRow) => row.ex100 || "" },
  { id: "ex150", label: "Ex150%", getValue: (row: CalculationRow) => row.ex150 || "" },
  { id: "dsr", label: "DSR", getValue: (row: CalculationRow) => row.dsr || "" },
  { id: "dsrDeb", label: "DSR.Deb", getValue: (row: CalculationRow) => row.dsrDeb || "" },
  { id: "not", label: "Not.", getValue: (row: CalculationRow) => row.not || "" },
  { id: "exNot", label: "ExNot", getValue: (row: CalculationRow) => row.exNot || "" },
  { id: "ajuste", label: "Ajuste", getValue: (row: CalculationRow) => row.ajuste || "" },
  { id: "abono2", label: "Abono2", getValue: (row: CalculationRow) => row.abono2 || "" },
  { id: "abono3", label: "Abono3", getValue: (row: CalculationRow) => row.abono3 || "" },
  { id: "abono4", label: "Abono4", getValue: (row: CalculationRow) => row.abono4 || "" },
  { id: "atras", label: "Atraso", getValue: (row: CalculationRow) => row.atras || "" },
  { id: "adian", label: "Adiant.", getValue: (row: CalculationRow) => row.adian || "" },
  { id: "folga", label: "Folga", getValue: (row: CalculationRow) => row.folga || "" },
  { id: "carga", label: "Carga", getValue: (row: CalculationRow) => row.carga || "" },
  { id: "justPa", label: "JustPa.", getValue: (row: CalculationRow) => row.justPa || "" },
  { id: "tPlusMinus", label: "T+/-", getValue: (row: CalculationRow) => row.tPlusMinus || "" },
  { id: "exInt", label: "ExInt", getValue: (row: CalculationRow) => row.exInt || "" },
  { id: "notTot", label: "Not.Tot.", getValue: (row: CalculationRow) => row.notTot || "" },
  { id: "refeicao", label: "Refeição", getValue: (row: CalculationRow) => row.refeicao || "" },
];

// Default columns if none are specified
const DEFAULT_VISIBLE_COLUMNS = new Set(["date", "entrada1", "saida1", "entrada2", "saida2", "normais", "ex50", "ex100", "dsr", "ajuste"]);

export function CalculationExport({
  className,
  filters,
  currentItems,
  totalRecords,
  visibleColumns,
  selectedItems
}: CalculationExportProps) {
  const handleExport = async (format: ExportFormat, items: CalculationRow[], columns: ExportColumn<CalculationRow>[]) => {
    // Clean up the values before exporting
    const cleanedItems = items.map(item => ({
      ...item,
      ...Object.keys(item).reduce((acc, key) => {
        const value = (item as any)[key];
        if (!value || value === "" || value === "null") {
          (acc as any)[key] = "-";
        } else if (typeof value === "string" && value.includes("Day Off")) {
          (acc as any)[key] = "Folga";
        } else {
          (acc as any)[key] = value;
        }
        return acc;
      }, {})
    }));

    // Generate export based on format
    switch (format) {
      case "csv":
        await exportToCSV(cleanedItems, columns);
        toast.success("Exportação CSV concluída com sucesso!");
        break;
      case "excel":
        await exportToExcel(cleanedItems, columns);
        break;
      case "pdf":
        await exportToPDF();
        break;
    }
  };

  const fetchAllItems = async (): Promise<CalculationRow[]> => {
    // For calculations, we only have current page data
    // Could be enhanced later to fetch all data from Secullum API
    return currentItems;
  };

  const exportToCSV = async (items: CalculationRow[], columns: ExportColumn<CalculationRow>[]) => {
    // CSV headers from visible columns
    const headers = columns.map((col) => col.label);

    // Convert items to CSV rows with only visible columns
    const rows = items.map((item) => columns.map((col) => col.getValue(item)));

    // Create CSV content
    const csvContent = [headers, ...rows].map((row) =>
      row.map((field) => `"${String(field).replace(/"/g, '""')}"`).join(",")
    ).join("\n");

    // Create and download the CSV
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);

    const timestamp = format(new Date(), "yyyy-MM-dd_HH-mm-ss");
    const monthLabel = filters.selectedMonth
      ? format(filters.selectedMonth, "MMMM-yyyy", { locale: ptBR })
      : "sem-periodo";

    link.setAttribute("download", `calculos-secullum_${monthLabel}_${timestamp}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToExcel = async (items: CalculationRow[], columns: ExportColumn<CalculationRow>[]) => {
    // For now, just export as CSV since Excel requires additional libraries
    await exportToCSV(items, columns);
    toast.info("Formato Excel não disponível - arquivo exportado como CSV");
  };

  const exportToPDF = async () => {
    const userId = filters.userId as string | undefined;
    const startDate = filters.customStartDate as Date | null;
    const endDate = filters.customEndDate as Date | null;
    const user = filters.selectedUser ?? null;

    if (!userId || !startDate || !endDate) {
      toast.error("Selecione um colaborador e o período antes de exportar o PDF");
      return;
    }

    const loadingId = toast.loading("Gerando espelho de ponto…");
    try {
      const startStr = format(startDate, "yyyy-MM-dd");
      const endStr = format(endDate, "yyyy-MM-dd");

      const [calcResp, horario] = await Promise.all([
        secullumService.getCalculations({ userId, startDate: startStr, endDate: endStr, page: 1, take: 100 }),
        fetchHorarioForUser(user),
      ]);

      const { rows, totals } = parseSecullumCalculations(calcResp?.data);

      if (!rows.length) {
        toast.dismiss(loadingId);
        toast.error("Nenhum registro encontrado para o período selecionado");
        return;
      }

      // Vector PDF (real, selectable text) — the SAME generator the Fechamento
      // "Exportar Espelho" uses, so both pages produce an identical document.
      const renderer = await createEspelhoRenderer();
      const doc = renderer.newDoc();
      renderer.drawPage(doc, { user, startDate, endDate, rows, totals, horario });

      const safeName =
        (user?.name ?? "colaborador")
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[\\/:*?"<>|]+/g, "")
          .replace(/\s+/g, " ")
          .trim() || "colaborador";
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Espelho de Ponto - ${safeName} - ${startStr}_a_${endStr}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.dismiss(loadingId);
      toast.success("Espelho de ponto gerado");
    } catch (err) {
      toast.dismiss(loadingId);
      const message =
        (err as any)?.response?.data?.message ||
        (err as any)?.message ||
        "Erro ao gerar o espelho de ponto";
      toast.error(message);
    }
  };

  return (
    <BaseExportPopover<CalculationRow>
      className={className}
      currentItems={currentItems}
      totalRecords={totalRecords}
      selectedItems={selectedItems}
      visibleColumns={visibleColumns}
      exportColumns={EXPORT_COLUMNS}
      defaultVisibleColumns={DEFAULT_VISIBLE_COLUMNS}
      onExport={handleExport}
      onFetchAllItems={fetchAllItems}
      entityName="cálculo"
      entityNamePlural="cálculos"
    />
  );
}