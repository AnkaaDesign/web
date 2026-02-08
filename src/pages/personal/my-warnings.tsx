import { useState, useMemo, useCallback } from "react";
import { WarningTable } from "@/components/human-resources/warning/list/warning-table";
import { PageHeader } from "@/components/ui/page-header";
import { FAVORITE_PAGES, routes } from "../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { IconAlertTriangle, IconFilter } from "@tabler/icons-react";
import { useAuth } from "@/contexts/auth-context";
import type { WarningGetManyFormData } from "../../schemas";
import type { Warning } from "../../types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { useTableFilters } from "@/hooks/common/use-table-filters";
import { useTableState } from "@/hooks/common/use-table-state";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { WarningFilters } from "@/components/human-resources/warning/list/warning-filters";

/**
 * My Warnings Page (Minhas Advertências)
 *
 * Displays all warnings for the logged-in user.
 * Uses the /warnings/my-warnings endpoint which automatically filters by authenticated user.
 */
export const MyWarningsPage = () => {
  const { user } = useAuth();
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [tableData, setTableData] = useState<{ warnings: Warning[]; totalRecords: number }>({
    warnings: [],
    totalRecords: 0,
  });

  // Track page access
  usePageTracker({
    title: "Minhas Advertências",
    icon: "alert-triangle",
  });

  // Get table state for selected items functionality
  const { selectionCount, showSelectedOnly, toggleShowSelectedOnly, selectedIds } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // Use the unified table filters hook
  const { filters, setFilters, searchingFor, displaySearchText, setSearch, clearAllFilters, queryFilters: baseQueryFilters, hasActiveFilters } = useTableFilters<WarningGetManyFormData>({
    defaultFilters: {
      limit: 40,
    },
    searchDebounceMs: 300,
    searchParamName: "search",
    excludeFromUrl: ["limit", "orderBy"],
  });

  // Stable callback for table data updates
  const handleTableDataChange = useCallback((data: { warnings: Warning[]; totalRecords: number }) => {
    setTableData(data);
  }, []);

  // Handle filter change from modal
  const handleFilterChange = useCallback(
    (newFilters: Partial<WarningGetManyFormData>) => {
      setFilters(newFilters);
    },
    [setFilters]
  );

  // Build query filters - no need to add user filter since the endpoint handles it
  const queryFilters = useMemo(() => {
    return {
      ...baseQueryFilters,
      include: {
        collaborator: true,
        attachments: true,
      },
      ...(searchingFor && { searchingFor }),
      // Special flag to tell the table to use my-warnings endpoint
      _useMyWarningsEndpoint: true,
    };
  }, [baseQueryFilters, searchingFor]);

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Faça login para ver suas advertências</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <PageHeader
        className="flex-shrink-0"
        variant="default"
        title="Minhas Advertências"
        icon={IconAlertTriangle}
        favoritePage={FAVORITE_PAGES.PESSOAL_MINHAS_ADVERTENCIAS_LISTAR}
        breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Pessoal", href: routes.personal.root }, { label: "Minhas Advertências" }]}
      />

      <Card className="flex-1 flex flex-col shadow-sm border border-border">
        <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden pb-6">
          {/* Search and controls */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <TableSearchInput value={displaySearchText} onChange={(value) => setSearch(value)} placeholder="Buscar advertências..." isPending={displaySearchText !== searchingFor} />
            <div className="flex gap-2">
              <ShowSelectedToggle showSelectedOnly={showSelectedOnly} onToggle={toggleShowSelectedOnly} selectionCount={selectionCount} />
              <Button variant={hasActiveFilters ? "default" : "outline"} size="default" onClick={() => setShowFilterModal(true)} className="group">
                <IconFilter className="h-4 w-4" />
                <span>Filtros</span>
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 min-h-0">
            <WarningTable filters={queryFilters} className="h-full" onDataChange={handleTableDataChange} />
          </div>
        </CardContent>

            {/* Filter Modal */}
            <WarningFilters
              open={showFilterModal}
              onOpenChange={setShowFilterModal}
              onApply={(newFilters) => {
                handleFilterChange({
                  ...filters,
                  where: {
                    ...filters.where,
                    ...(newFilters.severity && { severity: newFilters.severity }),
                    ...(newFilters.category && { category: newFilters.category }),
                    ...(typeof newFilters.isActive === "boolean" && { isActive: newFilters.isActive }),
                  },
                });
                setShowFilterModal(false);
              }}
              currentSeverity={filters.where?.severity}
              currentCategory={filters.where?.category}
              currentIsActive={filters.where?.isActive}
            />
      </Card>
    </div>
  );
};

export default MyWarningsPage;
