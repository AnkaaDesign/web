import React, { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  IconTruck,
  IconChevronRight,
  IconAlertCircle,
  IconClock,
  IconCircleCheck,
  IconX,
  IconCheck,
} from "@tabler/icons-react";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { PpeDeliveryTable } from "../../delivery/ppe-delivery-table";
import { ColumnVisibilityManager } from "../../delivery/column-visibility-manager";
import { createPpeDeliveryColumns, getDefaultVisibleColumns } from "../../delivery/ppe-delivery-table-columns";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { useTableFilters } from "@/hooks/use-table-filters";
import { usePpeDeliveries } from "../../../../../hooks";
import type { PpeDelivery } from "../../../../../types";
import type { PpeDeliveryGetManyFormData } from "../../../../../schemas";
import { PPE_DELIVERY_STATUS } from "../../../../../constants";
import { routes } from "../../../../../constants";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

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
    searchDebounceMs: 300,
    searchParamName: "deliverySearch",
  });

  // Visible columns state with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility(
    "ppe-schedule-detail-delivery-visible-columns",
    new Set(["item.uniCode", "item.name", "item.measures", "user.name", "status", "quantity"])
  );

  // Get all available columns for column visibility manager
  const allColumns = useMemo(() => createPpeDeliveryColumns(), []);

  // Fetch all deliveries for statistics (without pagination)
  const { data: statsData, isLoading: isLoadingStats } = usePpeDeliveries({
    where: {
      ppeScheduleId: scheduleId,
    },
    limit: 1000, // Get all for statistics
  });

  // Calculate statistics
  const stats = useMemo(() => {
    const allDeliveries = statsData?.data || [];
    const total = allDeliveries.length;
    const pending = allDeliveries.filter((d) => d.status === PPE_DELIVERY_STATUS.PENDING).length;
    const approved = allDeliveries.filter((d) => d.status === PPE_DELIVERY_STATUS.APPROVED).length;
    const delivered = allDeliveries.filter(
      (d) => d.status === PPE_DELIVERY_STATUS.DELIVERED || d.status === PPE_DELIVERY_STATUS.COMPLETED
    ).length;
    const cancelled = allDeliveries.filter(
      (d) => d.status === PPE_DELIVERY_STATUS.CANCELLED || d.status === PPE_DELIVERY_STATUS.REPROVED
    ).length;

    return { total, pending, approved, delivered, cancelled };
  }, [statsData]);

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
            {stats.total > 0 && (
              <Badge variant="outline" className="font-semibold ml-2">
                {stats.total} {stats.total === 1 ? "entrega" : "entregas"}
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
        {isLoadingStats ? (
          <div className="space-y-4">
            {/* Stats skeleton */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
            {/* Table skeleton */}
            <Skeleton className="h-64 rounded-lg" />
          </div>
        ) : stats.total === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <IconAlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm font-medium">Nenhuma entrega gerada ainda</p>
            <p className="text-xs mt-1">As entregas aparecerão aqui quando forem criadas pelo agendamento</p>
          </div>
        ) : (
          <>
            {/* Statistics Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Pending */}
              <div className="p-3 rounded-lg bg-muted/50 border border-border">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <IconClock className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">Pendentes</span>
                </div>
                <p className="text-2xl font-bold mt-1">{stats.pending}</p>
              </div>

              {/* Approved */}
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30">
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                  <IconCircleCheck className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">Aprovadas</span>
                </div>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">{stats.approved}</p>
              </div>

              {/* Delivered */}
              <div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/30">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <IconCheck className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">Entregues</span>
                </div>
                <p className="text-2xl font-bold text-green-700 dark:text-green-300 mt-1">{stats.delivered}</p>
              </div>

              {/* Cancelled */}
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30">
                <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <IconX className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">Canceladas</span>
                </div>
                <p className="text-2xl font-bold text-red-700 dark:text-red-300 mt-1">{stats.cancelled}</p>
              </div>
            </div>

            {/* Search and Column Visibility Controls */}
            <div className="flex flex-col gap-3 sm:flex-row pt-2">
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
            <div style={{ minHeight: "300px", maxHeight: "500px" }}>
              <PpeDeliveryTable
                visibleColumns={visibleColumns}
                filters={filters}
                onDataChange={handleTableDataChange}
              />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
