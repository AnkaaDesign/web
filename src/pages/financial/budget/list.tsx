import { useState, useCallback, useMemo } from "react";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { BudgetTable } from "@/components/financial/budget/budget-table";
import { BudgetFilterSheet, defaultBudgetFilters } from "@/components/financial/budget/budget-filter-sheet";
import type { BudgetFilters } from "@/components/financial/budget/budget-filter-sheet";
import { SECTOR_PRIVILEGES, FAVORITE_PAGES, routes } from "@/constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useTableFilters } from "@/hooks/common/use-table-filters";
import { IconFileDescription, IconFilter } from "@tabler/icons-react";

export const BudgetListPage = () => {
  usePageTracker({
    title: "Orçamentos",
    icon: "file-description",
  });

  const {
    searchingFor,
    displaySearchText,
    setSearch,
  } = useTableFilters({
    defaultFilters: {},
    searchDebounceMs: 500,
    searchParamName: "search",
  });

  const [filters, setFilters] = useState<BudgetFilters>(defaultBudgetFilters);
  const [showFilters, setShowFilters] = useState(false);

  const handleFilterApply = useCallback((newFilters: BudgetFilters) => {
    setFilters(newFilters);
  }, []);

  const activeFilterCount = useMemo(() => {
    let c = 0;
    if (filters.finishedFrom) c++;
    if (filters.finishedTo) c++;
    if (filters.customerId) c++;
    return c;
  }, [filters]);

  return (
    <PrivilegeRoute
      requiredPrivilege={[SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.COMMERCIAL]}
    >
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Orçamentos"
          icon={IconFileDescription}
          favoritePage={FAVORITE_PAGES.FINANCEIRO_ORCAMENTO}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Financeiro", href: routes.financial.root },
            { label: "Orçamentos" },
          ]}
          className="flex-shrink-0"
        />

        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <Card className="flex flex-col shadow-sm border border-border h-full">
            <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
              {/* Search and controls */}
              <div className="flex flex-col gap-3 sm:flex-row">
                <TableSearchInput
                  value={displaySearchText}
                  onChange={setSearch}
                  placeholder="Buscar por nome, número de série, placa, cliente..."
                />
                <div className="flex gap-2">
                  <Button
                    variant={activeFilterCount > 0 ? "default" : "outline"}
                    size="default"
                    onClick={() => setShowFilters(true)}
                    className="group"
                  >
                    <IconFilter className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    <span className="text-foreground">
                      Filtros
                      {activeFilterCount > 0
                        ? ` (${activeFilterCount})`
                        : ""}
                    </span>
                  </Button>
                </div>
              </div>

              {/* Table */}
              <BudgetTable
                searchingFor={searchingFor}
                filters={filters}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Filter Sheet */}
      <BudgetFilterSheet
        open={showFilters}
        onOpenChange={setShowFilters}
        filters={filters}
        onApply={handleFilterApply}
      />
    </PrivilegeRoute>
  );
};

export default BudgetListPage;
