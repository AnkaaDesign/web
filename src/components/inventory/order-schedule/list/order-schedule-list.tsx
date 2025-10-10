import React, { useState, useCallback, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconFilter } from "@tabler/icons-react";
import { OrderScheduleFilters, OrderScheduleTable, type OrderScheduleFiltersFormData } from "./index";

interface OrderScheduleListProps {
  className?: string;
}

export function OrderScheduleList({ className }: OrderScheduleListProps) {
  const [showFilterSheet, setShowFilterSheet] = useState(false);
  const [filters, setFilters] = useState<Partial<OrderScheduleFiltersFormData>>({});

  // Handle filter changes from the sheet
  const handleFilterChange = useCallback((newFilters: OrderScheduleFiltersFormData) => {
    setFilters(newFilters);
  }, []);

  // Calculate if there are active filters
  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.searchingFor) count++;
    if (filters.isActive !== undefined) count++;
    if (filters.frequency?.length) count++;
    if (filters.supplierIds?.length) count++;
    if (filters.categoryIds?.length) count++;
    if (filters.nextRunRange?.gte || filters.nextRunRange?.lte) count++;
    return count;
  };

  const activeFiltersCount = getActiveFiltersCount();
  const hasActiveFilters = activeFiltersCount > 0;

  return (
    <Card className={className}>
      <CardContent className="p-6 space-y-4">
        {/* Header with Filter Button */}
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Cronogramas de Pedidos</h2>
          <Button
            variant={hasActiveFilters ? "default" : "outline"}
            onClick={() => setShowFilterSheet(true)}
          >
            <IconFilter className="h-4 w-4 mr-2" />
            Filtros{hasActiveFilters ? ` (${activeFiltersCount})` : ""}
          </Button>
        </div>

        {/* Table */}
        <OrderScheduleTable
          data={[]} // Replace with actual data from your hook
          isLoading={false}
        />

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
