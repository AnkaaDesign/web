import { BaseExportPopover, type ExportFormat, type ExportColumn } from "@/components/ui/export-popover";
import { maintenanceService } from "../../../../api-client";
import { formatDate, formatDateTime } from "../../../../utils";
import { MAINTENANCE_STATUS_LABELS } from "../../../../constants";
import type { Maintenance } from "../../../../types";
import type { MaintenanceGetManyFormData } from "../../../../schemas";

interface MaintenanceExportProps {
  className?: string;
  filters?: Partial<MaintenanceGetManyFormData>;
  currentMaintenance?: Maintenance[];
  totalRecords?: number;
  visibleColumns?: Set<string>;
  selectedMaintenance?: Set<string>;
}

// Column configuration for export - matches table columns
const EXPORT_COLUMNS: ExportColumn<Maintenance>[] = [
  { id: "name", label: "Nome", getValue: (maintenance: Maintenance) => maintenance.name },
  { id: "item.name", label: "Item", getValue: (maintenance: Maintenance) => maintenance.item?.name || "" },
  {
    id: "status",
    label: "Status",
    getValue: (maintenance: Maintenance) => {
      return MAINTENANCE_STATUS_LABELS[maintenance.status as keyof typeof MAINTENANCE_STATUS_LABELS] || maintenance.status;
    },
  },
  { id: "scheduledFor", label: "Agendado para", getValue: (maintenance: Maintenance) => (maintenance.scheduledFor ? formatDate(new Date(maintenance.scheduledFor)) : "") },
  { id: "lastRun", label: "Última Execução", getValue: (maintenance: Maintenance) => (maintenance.lastRun ? formatDateTime(new Date(maintenance.lastRun)) : "") },
  { id: "description", label: "Descrição", getValue: (maintenance: Maintenance) => maintenance.description || "" },
  { id: "createdAt", label: "Criado em", getValue: (maintenance: Maintenance) => formatDate(new Date(maintenance.createdAt)) },
  { id: "updatedAt", label: "Atualizado em", getValue: (maintenance: Maintenance) => formatDate(new Date(maintenance.updatedAt)) },
];

// Default visible columns if none specified
const DEFAULT_VISIBLE_COLUMNS = new Set(["name", "item.name", "status", "frequency", "scheduledFor", "nextRun"]);

export function MaintenanceExport({ className, filters, currentMaintenance = [], totalRecords = 0, visibleColumns, selectedMaintenance }: MaintenanceExportProps) {
  const fetchAllMaintenance = async (): Promise<Maintenance[]> => {
    try {
      const allMaintenance: Maintenance[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await maintenanceService.getMaintenances({
          ...filters,
          page,
          limit: 100,
          include: {
            item: true,
            itemsNeeded: {
              include: {
                item: true,
              },
            },
          },
        });

        if (response.data) {
          allMaintenance.push(...response.data);
        }

        hasMore = response.meta?.hasNextPage || false;
        page++;
      }

      return allMaintenance;
    } catch (error) {
      console.error("Error fetching all maintenance:", error);
      throw error;
    }
  };

  const handleExport = async (format: ExportFormat, items: Maintenance[]) => {
    try {
      // The BaseExportPopover component handles the actual export logic
      // including CSV, Excel, and PDF generation// If you need custom export logic, you can implement it here
      // For now, we'll let the BaseExportPopover handle it
    } catch (error) {
      console.error("Export error:", error);
      throw error;
    }
  };

  // Filter items based on selection
  const getItemsToExport = () => {
    if (selectedMaintenance && selectedMaintenance.size > 0) {
      return currentMaintenance.filter((maintenance) => selectedMaintenance.has(maintenance.id));
    }
    return currentMaintenance;
  };

  return (
    <BaseExportPopover
      className={className}
      currentItems={getItemsToExport()}
      totalRecords={totalRecords}
      selectedItems={selectedMaintenance}
      visibleColumns={visibleColumns}
      exportColumns={EXPORT_COLUMNS}
      defaultVisibleColumns={DEFAULT_VISIBLE_COLUMNS}
      onExport={handleExport}
      onFetchAllItems={fetchAllMaintenance}
      entityName="manutenção"
      entityNamePlural="manutenções"
    />
  );
}
