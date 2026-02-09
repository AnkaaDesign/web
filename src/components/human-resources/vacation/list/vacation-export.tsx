import { BaseExportPopover, type ExportFormat, type ExportColumn } from "@/components/ui/export-popover";
import { toast } from "sonner";
import { vacationService } from "../../../../api-client";
import { formatDate } from "../../../../utils";
import { VACATION_STATUS_LABELS, VACATION_TYPE_LABELS } from "../../../../constants";
import type { Vacation } from "../../../../types";
import type { VacationGetManyFormData } from "../../../../schemas";

interface VacationExportProps {
  className?: string;
  filters?: Partial<VacationGetManyFormData>;
  currentVacations?: Vacation[];
  totalRecords?: number;
  visibleColumns?: Set<string>;
  selectedVacations?: Set<string>;
}

// Column configuration for export - matches table columns
const EXPORT_COLUMNS: ExportColumn<Vacation>[] = [
  { id: "user.name", label: "Funcionário", getValue: (vacation: Vacation) => vacation.user?.name || "" },
  { id: "startAt", label: "Data Início", getValue: (vacation: Vacation) => (vacation.startAt ? formatDate(new Date(vacation.startAt)) : "") },
  { id: "endAt", label: "Data Fim", getValue: (vacation: Vacation) => (vacation.endAt ? formatDate(new Date(vacation.endAt)) : "") },
  {
    id: "daysRequested",
    label: "Dias Solicitados",
    getValue: (vacation: Vacation) => {
      if (vacation.startAt && vacation.endAt) {
        const startDate = new Date(vacation.startAt);
        const endDate = new Date(vacation.endAt);
        const timeDiff = endDate.getTime() - startDate.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // +1 to include both start and end dates
        return daysDiff.toString();
      }
      return "0";
    },
  },
  { id: "status", label: "Status", getValue: (vacation: Vacation) => VACATION_STATUS_LABELS[vacation.status] || vacation.status },
  { id: "type", label: "Tipo", getValue: (vacation: Vacation) => VACATION_TYPE_LABELS[vacation.type] || vacation.type },
  { id: "isCollective", label: "Coletivas", getValue: (vacation: Vacation) => (vacation.isCollective ? "Sim" : "Não") },
  { id: "user.position.name", label: "Cargo", getValue: (vacation: Vacation) => vacation.user?.position?.name || "" },
  { id: "user.sector.name", label: "Setor", getValue: (vacation: Vacation) => vacation.user?.sector?.name || "" },
  { id: "createdAt", label: "Solicitado em", getValue: (vacation: Vacation) => formatDate(new Date(vacation.createdAt)) },
  { id: "updatedAt", label: "Atualizado em", getValue: (vacation: Vacation) => formatDate(new Date(vacation.updatedAt)) },
];

// Default visible columns if none specified
const DEFAULT_VISIBLE_COLUMNS = new Set(["user.name", "startAt", "endAt", "daysRequested", "status", "type"]);

export function VacationExport({ className, filters, currentVacations = [], totalRecords = 0, visibleColumns, selectedVacations }: VacationExportProps) {
  const fetchAllVacations = async (): Promise<Vacation[]> => {
    try {
      const allVacations: Vacation[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await vacationService.getVacations({
          ...filters,
          page,
          limit: 100,
          include: {
            user: {
              include: {
                position: true,
                sector: true,
              },
            },
          },
        });

        if (response.data) {
          allVacations.push(...response.data);
        }

        hasMore = response.meta?.hasNextPage || false;
        page++;
      }

      return allVacations;
    } catch (error) {
      console.error("Error fetching all vacations:", error);
      toast.error("Erro ao buscar férias para exportação");
      throw error;
    }
  };

  const handleExport = async (_format: ExportFormat, _items: Vacation[]) => {
    try {
      // The BaseExportPopover component handles the actual export logic
      // including CSV, Excel, and PDF generation// If you need custom export logic, you can implement it here
      // For now, we'll let the BaseExportPopover handle it
    } catch (error) {
      console.error("Export error:", error);
      toast.error("Erro ao exportar dados");
      throw error;
    }
  };

  // Filter items based on selection
  const getItemsToExport = () => {
    if (selectedVacations && selectedVacations.size > 0) {
      return currentVacations.filter((vacation) => selectedVacations.has(vacation.id));
    }
    return currentVacations;
  };

  return (
    <BaseExportPopover
      className={className}
      currentItems={getItemsToExport()}
      totalRecords={totalRecords}
      selectedItems={selectedVacations}
      visibleColumns={visibleColumns}
      exportColumns={EXPORT_COLUMNS}
      defaultVisibleColumns={DEFAULT_VISIBLE_COLUMNS}
      onExport={handleExport}
      onFetchAllItems={fetchAllVacations}
      entityName="férias"
      entityNamePlural="férias"
    />
  );
}
