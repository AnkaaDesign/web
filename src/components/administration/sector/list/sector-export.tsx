import { BaseExportPopover, type ExportFormat, type ExportColumn } from "@/components/ui/export-popover";
import { toast } from "@/components/ui/sonner";
import { sectorService } from "../../../../api-client";
import { formatDate } from "../../../../utils";
import { SECTOR_PRIVILEGES_LABELS } from "../../../../constants";
import type { Sector } from "../../../../types";
import type { SectorGetManyFormData } from "../../../../schemas";

interface SectorExportProps {
  className?: string;
  filters?: Partial<SectorGetManyFormData>;
  currentSectors?: Sector[];
  totalRecords?: number;
  visibleColumns?: Set<string>;
  selectedSectors?: Set<string>;
}

// Column configuration for export - matches table columns
const EXPORT_COLUMNS: ExportColumn<Sector>[] = [
  { id: "name", label: "Nome", getValue: (sector: Sector) => sector.name },
  { id: "privileges", label: "Privilégios", getValue: (sector: Sector) => SECTOR_PRIVILEGES_LABELS[sector.privileges] || sector.privileges },
  { id: "_count.users", label: "Usuários", getValue: (sector: Sector) => (sector._count?.users || 0).toString() },
  { id: "createdAt", label: "Criado em", getValue: (sector: Sector) => formatDate(new Date(sector.createdAt)) },
  { id: "updatedAt", label: "Atualizado em", getValue: (sector: Sector) => formatDate(new Date(sector.updatedAt)) },
];

// Default visible columns if none specified
const DEFAULT_VISIBLE_COLUMNS = new Set(["name", "privileges", "_count.users"]);

export function SectorExport({ className, filters, currentSectors = [], totalRecords = 0, visibleColumns, selectedSectors }: SectorExportProps) {
  const fetchAllSectors = async (): Promise<Sector[]> => {
    try {
      const allSectors: Sector[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await sectorService.getSectors({
          ...filters,
          page,
          limit: 100,
          include: {
            _count: {
              select: {
                users: true,
              },
            },
          },
        });

        if (response.data) {
          allSectors.push(...response.data);
        }

        hasMore = response.meta?.hasNextPage || false;
        page++;
      }

      return allSectors;
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error fetching all sectors:", error);
      }
      toast.error("Erro ao buscar setores para exportação");
      throw error;
    }
  };

  const handleExport = async (_format: ExportFormat, _items: Sector[]) => {
    try {
      // The BaseExportPopover component handles the actual export logic
      // including CSV, Excel, and PDF generation// If you need custom export logic, you can implement it here
      // For now, we'll let the BaseExportPopover handle it
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Export error:", error);
      }
      toast.error("Erro ao exportar dados");
      throw error;
    }
  };

  // Filter items based on selection
  const getItemsToExport = () => {
    if (selectedSectors && selectedSectors.size > 0) {
      return currentSectors.filter((sector) => selectedSectors.has(sector.id));
    }
    return currentSectors;
  };

  return (
    <BaseExportPopover
      className={className}
      currentItems={getItemsToExport()}
      totalRecords={totalRecords}
      selectedItems={selectedSectors}
      visibleColumns={visibleColumns}
      exportColumns={EXPORT_COLUMNS}
      defaultVisibleColumns={DEFAULT_VISIBLE_COLUMNS}
      onExport={handleExport}
      onFetchAllItems={fetchAllSectors}
      entityName="setor"
      entityNamePlural="setores"
    />
  );
}
