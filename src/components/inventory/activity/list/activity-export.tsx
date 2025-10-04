import { BaseExportPopover, type ExportFormat, type ExportColumn } from "@/components/ui/export-popover";
import { toast } from "@/components/ui/sonner";
import { activityService } from "../../../../api-client";
import { formatDateTime } from "../../../../utils";
import { ACTIVITY_REASON_LABELS, ACTIVITY_OPERATION_LABELS, ACTIVITY_OPERATION } from "../../../../constants";
import type { Activity } from "../../../../types";
import type { ActivityGetManyFormData } from "../../../../schemas";

interface ActivityExportProps {
  className?: string;
  filters?: Partial<ActivityGetManyFormData>;
  currentActivities?: Activity[];
  totalRecords?: number;
  visibleColumns?: Set<string>;
  selectedActivities?: Set<string>;
}

// Format quantity with 2 decimals only if needed
function formatQuantity(value: number): string {
  // Check if the number has decimals
  if (value % 1 === 0) {
    return value.toString();
  }
  // Format with 2 decimals and use pt-BR locale
  return value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const EXPORT_COLUMNS: ExportColumn<Activity>[] = [
  { id: "item.uniCode", label: "Código", getValue: (activity: Activity) => activity.item?.uniCode || "" },
  { id: "item.name", label: "Item", getValue: (activity: Activity) => activity.item?.name || "" },
  { id: "operation", label: "Operação", getValue: (activity: Activity) => (activity.operation ? ACTIVITY_OPERATION_LABELS[activity.operation] : "") },
  {
    id: "quantity",
    label: "Quantidade",
    getValue: (activity: Activity) => {
      const sign = activity.operation === ACTIVITY_OPERATION.INBOUND ? "+" : "-";
      return sign + formatQuantity(Math.abs(activity.quantity));
    },
  },
  { id: "reason", label: "Motivo", getValue: (activity: Activity) => (activity.reason ? ACTIVITY_REASON_LABELS[activity.reason] : "") },
  { id: "user.name", label: "Usuário", getValue: (activity: Activity) => activity.user?.name || "" },
  { id: "order.id", label: "Pedido", getValue: (activity: Activity) => activity.order?.id || "" },
  { id: "createdAt", label: "Data/Hora", getValue: (activity: Activity) => formatDateTime(new Date(activity.createdAt)) },
];

const DEFAULT_VISIBLE_COLUMNS = new Set(["item.uniCode", "item.name", "operation", "quantity", "reason", "user.name", "createdAt"]);

export function ActivityExport({ className, filters, currentActivities = [], totalRecords = 0, visibleColumns, selectedActivities }: ActivityExportProps) {
  const fetchAllActivities = async (): Promise<Activity[]> => {
    try {
      const allActivities: Activity[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await activityService.getActivities({
          ...filters,
          page,
          limit: 100,
          include: {
            item: true,
            user: true,
            order: true,
          },
        });

        if (response.data) {
          allActivities.push(...response.data);
        }

        hasMore = response.meta?.hasNextPage || false;
        page++;
      }

      return allActivities;
    } catch (error) {
      console.error("Error fetching all activities:", error);
      toast.error("Erro ao buscar atividades para exportação");
      throw error;
    }
  };

  const handleExport = async (format: ExportFormat, items: Activity[], _columns: ExportColumn<Activity>[]) => {
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
    if (selectedActivities && selectedActivities.size > 0) {
      return currentActivities.filter((activity) => selectedActivities.has(activity.id));
    }
    return currentActivities;
  };

  return (
    <BaseExportPopover
      className={className}
      currentItems={getItemsToExport()}
      totalRecords={totalRecords}
      selectedItems={selectedActivities}
      visibleColumns={visibleColumns}
      exportColumns={EXPORT_COLUMNS}
      defaultVisibleColumns={DEFAULT_VISIBLE_COLUMNS}
      onExport={handleExport}
      onFetchAllItems={fetchAllActivities}
      entityName="atividade"
      entityNamePlural="atividades"
    />
  );
}
