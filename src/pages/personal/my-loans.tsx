import { useState, useMemo, useCallback } from "react";
import { BorrowTable } from "@/components/inventory/borrow/list/borrow-table";
import { PageHeader } from "@/components/ui/page-header";
import { FAVORITE_PAGES, routes } from "../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { IconPackageExport, IconFilter } from "@tabler/icons-react";
import { useAuth } from "@/contexts/auth-context";
import type { BorrowGetManyFormData } from "../../schemas";
import type { Borrow } from "../../types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { useTableFilters } from "@/hooks/common/use-table-filters";
import { useTableState } from "@/hooks/common/use-table-state";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { BorrowFilters } from "@/components/inventory/borrow/list/borrow-filters";
import { BorrowExport } from "@/components/inventory/borrow/list/borrow-export";
import { ColumnVisibilityManager } from "@/components/inventory/borrow/list/column-visibility-manager";
import { useColumnVisibility } from "@/hooks/common/use-column-visibility";

/**
 * My Loans Page (Meus Empréstimos)
 *
 * Displays all borrows/loans for the logged-in user.
 * Uses the BorrowTable component with a filter to show only borrows where
 * the user is the borrower.
 */
export const MyLoansPage = () => {
  const { user } = useAuth();
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [tableData, setTableData] = useState<{ items: Borrow[]; totalRecords: number }>({
    items: [],
    totalRecords: 0,
  });

  // Track page access
  usePageTracker({
    title: "Meus Empréstimos",
    icon: "package-export",
  });

  // Get table state for selected items functionality
  const { selectionCount, showSelectedOnly, toggleShowSelectedOnly, selectedIds: _selectedIds } = useTableState({
    defaultPageSize: 40,
    resetSelectionOnPageChange: false,
  });

  // Visible columns state with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility(
    "my-loans-visible-columns",
    new Set(["item.uniCode", "item.name", "quantity", "status", "createdAt", "returnedAt"])
  );

  // Use the unified table filters hook
  const { filters, setFilters, searchingFor, displaySearchText, setSearch, clearAllFilters: _clearAllFilters, queryFilters: baseQueryFilters, hasActiveFilters } = useTableFilters<BorrowGetManyFormData>({
    defaultFilters: {
      limit: 40,
    },
    searchDebounceMs: 300,
    searchParamName: "search",
    excludeFromUrl: ["limit", "orderBy"],
  });

  // Stable callback for table data updates
  const handleTableDataChange = useCallback((data: { items: Borrow[]; totalRecords: number }) => {
    setTableData(data);
  }, []);

  // Handle filter change from modal
  const handleFilterChange = useCallback(
    (newFilters: Partial<BorrowGetManyFormData>) => {
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
        <p className="text-muted-foreground">Faça login para ver seus empréstimos</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <PageHeader
        className="flex-shrink-0"
        variant="default"
        title="Meus Empréstimos"
        icon={IconPackageExport}
        favoritePage={FAVORITE_PAGES.PESSOAL_MEUS_EMPRESTIMOS_LISTAR}
        breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Pessoal", href: routes.personal.root }, { label: "Meus Empréstimos" }]}
      />

      <Card className="flex-1 flex flex-col shadow-sm border border-border">
        <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden pb-6">
          {/* Search and controls */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <TableSearchInput value={displaySearchText} onChange={(value) => setSearch(value)} placeholder="Buscar por item..." isPending={displaySearchText !== searchingFor} />
            <div className="flex gap-2">
              <ShowSelectedToggle showSelectedOnly={showSelectedOnly} onToggle={toggleShowSelectedOnly} selectionCount={selectionCount} />
              <Button variant={hasActiveFilters ? "default" : "outline"} size="default" onClick={() => setShowFilterModal(true)} className="group">
                <IconFilter className="h-4 w-4" />
                <span>Filtros</span>
              </Button>
              <ColumnVisibilityManager visibleColumns={visibleColumns} onVisibilityChange={setVisibleColumns} />
              <BorrowExport filters={queryFilters} currentItems={tableData.items} totalRecords={tableData.totalRecords} visibleColumns={visibleColumns} />
            </div>
          </div>

          {/* Table */}
          <div className="flex-1 min-h-0">
            <BorrowTable visibleColumns={visibleColumns} filters={queryFilters} className="h-full" onDataChange={handleTableDataChange} />
          </div>
        </CardContent>

        {/* Filter Modal */}
        <BorrowFilters open={showFilterModal} onOpenChange={setShowFilterModal} filters={filters} onFilterChange={handleFilterChange} />
      </Card>
    </div>
  );
};
