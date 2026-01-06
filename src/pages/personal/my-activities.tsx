import { useState, useMemo, useCallback } from "react";
import { ActivityTable } from "@/components/inventory/activity/list/activity-table";
import { PageHeader } from "@/components/ui/page-header";
import { FAVORITE_PAGES, routes } from "../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { IconArrowsExchange, IconFilter } from "@tabler/icons-react";
import { useAuth } from "@/contexts/auth-context";
import type { ActivityGetManyFormData } from "../../schemas";
import type { Activity } from "../../types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { useTableFilters } from "@/hooks/use-table-filters";
import { useTableState } from "@/hooks/use-table-state";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { ActivityFilters } from "@/components/inventory/activity/list/activity-filters";
import { ActivityExport } from "@/components/inventory/activity/list/activity-export";
import { ColumnVisibilityManager } from "@/components/inventory/activity/list/column-visibility-manager";
import { getActivityColumns, getDefaultVisibleColumns } from "@/components/inventory/activity/list/activity-table-columns";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { DETAIL_PAGE_SPACING } from "@/lib/layout-constants";
import { cn } from "@/lib/utils";

/**
 * My Activities Page
 *
 * Displays all inventory activities (movements) created by the logged-in user.
 * Uses the ActivityTable component with a filter to show only activities where
 * the user is the creator.
 */
export const MyActivitiesPage = () => {
  const { user } = useAuth();
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [tableData, setTableData] = useState<{ activities: Activity[]; totalRecords: number }>({
    activities: [],
    totalRecords: 0,
  });

  // Track page access
  usePageTracker({
    title: "Minhas Atividades",
    icon: "arrows-exchange",
  });

  // Get table state for selected items functionality
  const { selectionCount, showSelectedOnly, toggleShowSelectedOnly, selectedIds } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // Visible columns state with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility("my-activities-visible-columns", getDefaultVisibleColumns());

  // Get columns for the visibility manager
  const allColumns = useMemo(() => getActivityColumns(), []);

  // Use the unified table filters hook
  const { filters, setFilters, searchingFor, displaySearchText, setSearch, clearAllFilters, queryFilters: baseQueryFilters, hasActiveFilters } = useTableFilters<ActivityGetManyFormData>({
    defaultFilters: {
      limit: 40,
    },
    searchDebounceMs: 300,
    searchParamName: "search",
    excludeFromUrl: ["limit", "orderBy"],
  });

  // Stable callback for table data updates
  const handleTableDataChange = useCallback((data: { activities: Activity[]; totalRecords: number }) => {
    setTableData(data);
  }, []);

  // Handle filter change from modal
  const handleFilterChange = useCallback(
    (newFilters: Partial<ActivityGetManyFormData>) => {
      setFilters(newFilters);
    },
    [setFilters]
  );

  // Build query filters with user-specific filter
  const queryFilters = useMemo(() => {
    if (!user?.id) return baseQueryFilters;

    return {
      ...baseQueryFilters,
      where: {
        ...baseQueryFilters.where,
        userId: user.id,
      },
      include: {
        item: {
          include: {
            brand: true,
            category: true,
          },
        },
        user: {
          include: {
            position: true,
          },
        },
      },
      ...(searchingFor && { searchingFor }),
    };
  }, [baseQueryFilters, searchingFor, user?.id]);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Faça login para ver suas atividades</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4 pb-4">
      <PageHeader
        className="flex-shrink-0"
        variant="default"
        title="Minhas Atividades"
        icon={IconArrowsExchange}
        favoritePage={FAVORITE_PAGES.PESSOAL_MINHAS_ATIVIDADES_LISTAR}
        breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Pessoal", href: routes.personal.root }, { label: "Minhas Atividades" }]}
      />

      <Card className="flex-1 flex flex-col shadow-sm border border-border min-h-0">
        <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
          {/* Search and controls */}
          <div className="flex flex-col gap-3 sm:flex-row flex-shrink-0">
            <TableSearchInput value={displaySearchText} onChange={(value) => setSearch(value)} placeholder="Buscar por item, descrição..." isPending={displaySearchText !== searchingFor} />
            <div className="flex gap-2">
              <ShowSelectedToggle showSelectedOnly={showSelectedOnly} onToggle={toggleShowSelectedOnly} selectionCount={selectionCount} />
              <Button variant={hasActiveFilters ? "default" : "outline"} size="default" onClick={() => setShowFilterModal(true)} className="group">
                <IconFilter className="h-4 w-4" />
                <span>Filtros</span>
              </Button>
              <ColumnVisibilityManager columns={allColumns} visibleColumns={visibleColumns} onVisibilityChange={setVisibleColumns} />
              <ActivityExport
                filters={queryFilters}
                currentActivities={tableData.activities}
                totalRecords={tableData.totalRecords}
                visibleColumns={visibleColumns}
                selectedActivities={selectionCount > 0 ? new Set(selectedIds.map(String)) : undefined}
              />
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 min-h-0">
            <ActivityTable visibleColumns={visibleColumns} filters={queryFilters} className="h-full" onDataChange={handleTableDataChange} />
          </div>
        </CardContent>

        {/* Filter Modal */}
        <ActivityFilters open={showFilterModal} onOpenChange={setShowFilterModal} filters={filters} onApply={handleFilterChange} onReset={clearAllFilters} />
      </Card>
    </div>
  );
};
