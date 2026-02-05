import React, { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { OrderSchedule } from "../../../../types";
import type { OrderScheduleGetManyFormData } from "../../../../schemas";
import { routes } from "../../../../constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { IconFilter } from "@tabler/icons-react";
import { OrderScheduleFilters, OrderScheduleTable } from "./index";
import { ColumnVisibilityManager } from "./column-visibility-manager";
import { createOrderScheduleColumns, getDefaultVisibleColumns } from "./order-schedule-table-columns";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { cn } from "@/lib/utils";

interface OrderScheduleListProps {
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

export function OrderScheduleList({ className }: OrderScheduleListProps) {
  const navigate = useNavigate();
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [filters, setFilters] = useState<Partial<OrderScheduleGetManyFormData>>({
    limit: DEFAULT_PAGE_SIZE,
  });

  // Column visibility management with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility(
    "order-schedule-table-columns",
    getDefaultVisibleColumns()
  );

  // Get all available columns for column visibility manager
  const allColumns = useMemo(() => createOrderScheduleColumns(), []);

  // Combine search and filters
  const queryFilters = useMemo(() => {
    const combined: Partial<OrderScheduleGetManyFormData> = {
      ...filters,
      limit: DEFAULT_PAGE_SIZE,
    };

    if (searchValue.trim()) {
      combined.searchingFor = searchValue.trim();
    }

    return combined;
  }, [filters, searchValue]);

  // Handle filter changes from the sheet
  const handleFilterChange = useCallback((newFilters: Partial<OrderScheduleGetManyFormData>) => {
    setFilters(newFilters);
  }, []);

  // Calculate if there are active filters
  const hasActiveFilters = useMemo(() => {
    let count = 0;
    if (filters.isActive !== undefined) count++;
    if (filters.frequency?.length) count++;
    if (filters.itemIds?.length) count++;
    if (filters.nextRunRange?.gte || filters.nextRunRange?.lte) count++;
    return count > 0;
  }, [filters]);

  // Calculate active filter count for badge
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.isActive !== undefined) count++;
    if (filters.frequency?.length) count++;
    if (filters.itemIds?.length) count++;
    if (filters.nextRunRange?.gte || filters.nextRunRange?.lte) count++;
    return count;
  }, [filters]);

  const handleEditSchedule = (schedule: OrderSchedule) => {
    navigate(routes.inventory.orders.schedules.edit(schedule.id));
  };

  const handleClearSearch = () => {
    setSearchValue("");
  };

  return (
    <Card className={cn("flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
        {/* Search and controls */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <TableSearchInput
            value={searchValue}
            onChange={setSearchValue}
            onClear={handleClearSearch}
            placeholder="Buscar agendamentos..."
            className="flex-1"
          />
          <div className="flex gap-2">
            <Button
              variant={hasActiveFilters ? "default" : "outline"}
              size="default"
              onClick={() => setShowFilterSheet(true)}
            >
              <IconFilter className="h-4 w-4" />
              <span>
                Filtros
                {hasActiveFilters ? ` (${activeFilterCount})` : ""}
              </span>
            </Button>
            <ColumnVisibilityManager
              columns={allColumns}
              visibleColumns={visibleColumns}
              onVisibilityChange={setVisibleColumns}
            />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 min-h-0 overflow-auto">
          <OrderScheduleTable
            visibleColumns={visibleColumns}
            onEdit={handleEditSchedule}
            filters={queryFilters}
            className="h-full"
          />
        </div>

        {/* Filter Sheet */}
        <OrderScheduleFilters
          open={showFilterSheet}
          onOpenChange={setShowFilterSheet}
          onFiltersChange={handleFilterChange}
          initialFilters={filters}
        />
      </CardContent>
    </Card>
  );
}
