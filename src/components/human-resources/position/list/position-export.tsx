import { BaseExportPopover, type ExportFormat, type ExportColumn } from "@/components/ui/export-popover";
import { toast } from "sonner";
import { positionService } from "../../../../api-client";
import { formatDate, formatCurrency } from "../../../../utils";
import type { Position } from "../../../../types";
import type { PositionGetManyFormData } from "../../../../schemas";

interface PositionExportProps {
  className?: string;
  filters?: Partial<PositionGetManyFormData>;
  currentPositions?: Position[];
  totalRecords?: number;
  visibleColumns?: Set<string>;
  selectedPositions?: Set<string>;
}

// Column configuration for export - matches table columns
const EXPORT_COLUMNS: ExportColumn<Position>[] = [
  { id: "name", label: "Nome", getValue: (position: Position) => position.name },
  {
    id: "remuneration",
    label: "Remuneração",
    getValue: (position: Position) => {
      // Use the virtual remuneration field (populated by backend)
      const remuneration = position.remuneration ?? 0;
      return remuneration > 0 ? formatCurrency(remuneration) : "";
    },
  },
  { id: "_count.users", label: "Funcionários", getValue: (position: Position) => (position._count?.users || 0).toString() },
  { id: "createdAt", label: "Criado em", getValue: (position: Position) => formatDate(new Date(position.createdAt)) },
  { id: "updatedAt", label: "Atualizado em", getValue: (position: Position) => formatDate(new Date(position.updatedAt)) },
];

// Default visible columns if none specified
const DEFAULT_VISIBLE_COLUMNS = new Set(["name", "remuneration", "_count.users"]);

export function PositionExport({ className, filters, currentPositions = [], totalRecords = 0, visibleColumns, selectedPositions }: PositionExportProps) {
  const fetchAllPositions = async (): Promise<Position[]> => {
    try {
      const allPositions: Position[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await positionService.getPositions({
          ...filters,
          page,
          limit: 100,
          include: {
            // Fetch monetary values for accurate current remuneration
            monetaryValues: {
              orderBy: { createdAt: "desc" },
              take: 5,
            },
            // Also fetch deprecated remunerations for backwards compatibility
            remunerations: {
              orderBy: { createdAt: "desc" },
              take: 1,
            },
            _count: {
              select: {
                users: true,
              },
            },
          },
        });

        if (response.data) {
          allPositions.push(...response.data);
        }

        hasMore = response.meta?.hasNextPage || false;
        page++;
      }

      return allPositions;
    } catch (error) {
      console.error("Error fetching all positions:", error);
      toast.error("Erro ao buscar cargos para exportação");
      throw error;
    }
  };

  const handleExport = async (_format: ExportFormat, _items: Position[], _columns: ExportColumn<Position>[]) => {
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
    if (selectedPositions && selectedPositions.size > 0) {
      return currentPositions.filter((position) => selectedPositions.has(position.id));
    }
    return currentPositions;
  };

  return (
    <BaseExportPopover
      className={className}
      currentItems={getItemsToExport()}
      totalRecords={totalRecords}
      selectedItems={selectedPositions}
      visibleColumns={visibleColumns}
      exportColumns={EXPORT_COLUMNS}
      defaultVisibleColumns={DEFAULT_VISIBLE_COLUMNS}
      onExport={handleExport}
      onFetchAllItems={fetchAllPositions}
      entityName="cargo"
      entityNamePlural="cargos"
    />
  );
}
