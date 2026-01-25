import React, { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { OrderSchedule } from "../../../../types";
import type { OrderScheduleGetManyFormData } from "../../../../schemas";
import { routes } from "../../../../constants";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { IconFilter, IconColumns } from "@tabler/icons-react";
import { OrderScheduleFilters, OrderScheduleTable } from "./index";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface OrderScheduleListProps {
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

// Column definitions for visibility management
const AVAILABLE_COLUMNS = [
  { id: "status", label: "Status" },
  { id: "frequency", label: "Frequência" },
  { id: "itemsCount", label: "Itens" },
  { id: "nextRun", label: "Próxima Execução" },
  { id: "lastRun", label: "Última Execução" },
];

export function OrderScheduleList({ className }: OrderScheduleListProps) {
  const navigate = useNavigate();
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  const [filters, setFilters] = useState<Partial<OrderScheduleGetManyFormData>>({
    limit: DEFAULT_PAGE_SIZE,
  });

  // Column visibility management
  const { visibleColumns, toggleColumn, resetColumns } = useColumnVisibility(
    "order-schedule-table-columns",
    new Set(["status", "frequency", "itemsCount", "nextRun", "lastRun"])
  );

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
    if (filters.supplierIds?.length) count++;
    if (filters.itemIds?.length) count++;
    if (filters.specificDateRange?.gte || filters.specificDateRange?.lte) count++;
    return count > 0;
  }, [filters]);

  const handleEditSchedule = (schedule: OrderSchedule) => {
    navigate(routes.inventory.orders.schedules.edit(schedule.id));
  };

  const handleClearSearch = () => {
    setSearchValue("");
  };

  // Count visible columns
  const visibleColumnCount = visibleColumns.size;
  const totalColumnCount = AVAILABLE_COLUMNS.length;

  return (
    <Card className={cn("h-full flex flex-col", className)}>
      <CardContent className="p-4 space-y-4 flex-1 flex flex-col">
        {/* Search and Filters Row */}
        <div className="flex items-center gap-2">
          <TableSearchInput
            value={searchValue}
            onChange={setSearchValue}
            onClear={handleClearSearch}
            placeholder="Pesquisar agendamentos..."
            className="flex-1"
          />

          <Button
            variant={hasActiveFilters ? 'default' : 'outline'}
            onClick={() => setShowFilterSheet(true)}
            size="default"
          >
            <IconFilter className="h-4 w-4 mr-2" />
            Filtros
          </Button>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="default">
                <IconColumns className="h-4 w-4 mr-2" />
                Colunas ({visibleColumnCount}/{totalColumnCount})
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-4" align="end">
              <div className="space-y-3">
                <h4 className="font-medium text-sm mb-3">Colunas Visíveis</h4>
                {AVAILABLE_COLUMNS.map((column) => (
                  <Label
                    key={column.id}
                    className="flex items-center justify-between space-x-3 cursor-pointer"
                    htmlFor={`column-${column.id}`}
                  >
                    <span className="text-sm">{column.label}</span>
                    <Switch
                      id={`column-${column.id}`}
                      checked={visibleColumns.has(column.id)}
                      onCheckedChange={() => toggleColumn(column.id)}
                    />
                  </Label>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* Table */}
        <div className="flex-1 min-h-0">
          <OrderScheduleTable
            visibleColumns={visibleColumns}
            onEdit={handleEditSchedule}
            filters={queryFilters}
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
