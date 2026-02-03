import React, { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconTruck, IconChevronRight } from "@tabler/icons-react";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { PpeDeliveryTable } from "../../delivery/ppe-delivery-table";
import { ColumnVisibilityManager } from "../../delivery/column-visibility-manager";
import { createPpeDeliveryColumns } from "../../delivery/ppe-delivery-table-columns";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { useTableFilters } from "@/hooks/use-table-filters";
import type { PpeDelivery } from "../../../../../types";
import type { PpeDeliveryGetManyFormData } from "../../../../../schemas";
import { routes } from "../../../../../constants";
import { cn } from "@/lib/utils";

interface PpeScheduleDeliveriesCardProps {
  scheduleId: string;
  className?: string;
}

export function PpeScheduleDeliveriesCard({ scheduleId, className }: PpeScheduleDeliveriesCardProps) {
  const navigate = useNavigate();

  // State to hold current table data
  const [tableData, setTableData] = useState<{ items: PpeDelivery[]; totalRecords: number }>({
    items: [],
    totalRecords: 0,
  });

  // Stable callback for table data updates
  const handleTableDataChange = useCallback((data: { items: PpeDelivery[]; totalRecords: number }) => {
    setTableData(data);
  }, []);

  // Use table filters for search functionality
  const { searchingFor, displaySearchText, setSearch } = useTableFilters<PpeDeliveryGetManyFormData>({
    defaultFilters: {},
    searchDebounceMs: 500,
    searchParamName: "deliverySearch",
  });

  // Visible columns state with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility(
    "ppe-schedule-detail-delivery-visible-columns",
    new Set(["item.uniCode", "item.name", "item.measures", "user.name", "status", "quantity"])
  );

  // Get all available columns for column visibility manager
  const allColumns = useMemo(() => createPpeDeliveryColumns(), []);

  // Filter to only show deliveries from this schedule, with search
  const filters = useMemo(() => {
    return {
      where: {
        ppeScheduleId: scheduleId,
      },
      searchingFor: searchingFor || undefined,
    };
  }, [scheduleId, searchingFor]);

  return (
    <Card className={cn("shadow-sm border border-border", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <IconTruck className="h-5 w-5 text-muted-foreground" />
            Entregas do Agendamento
            {tableData.totalRecords > 0 && (
              <Badge variant="outline" className="font-semibold ml-2">
                {tableData.totalRecords} {tableData.totalRecords === 1 ? "entrega" : "entregas"}
              </Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`${routes.inventory.ppe.deliveries.root}?scheduleId=${scheduleId}`)}
          >
            Ver todas as entregas
            <IconChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Search and Column Visibility Controls */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <TableSearchInput
            value={displaySearchText}
            onChange={(value) => setSearch(value)}
            placeholder="Buscar por item, usuário..."
            isPending={displaySearchText !== searchingFor}
          />
          <div className="flex gap-2">
            <ColumnVisibilityManager
              columns={allColumns}
              visibleColumns={visibleColumns}
              onVisibilityChange={setVisibleColumns}
            />
          </div>
        </div>

        {/* Delivery Table */}
        <div className="pb-6">
          <PpeDeliveryTable
            visibleColumns={visibleColumns}
            filters={filters}
            onDataChange={handleTableDataChange}
          />
        </div>
      </CardContent>
    </Card>
  );
}
