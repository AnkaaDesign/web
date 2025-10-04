import { ServiceList } from "@/components/production/service/list/service-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { IconTool, IconPlus, IconFilter } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { useServices } from "../../../hooks";
import { LoadingSpinner } from "@/components/ui/loading";
import { TableSearchInput } from "@/components/ui/table-search-input";
import { Button } from "@/components/ui/button";
import { ServiceFilters } from "@/components/production/service/filter/service-filters";
import { ServiceFilterIndicator } from "@/components/production/service/filter/service-filter-indicator";
import { useTableFilters } from "@/hooks/use-table-filters";
import { useState, useMemo } from "react";
import type { ServiceGetManyFormData } from "../../../schemas";

export const ServicesListPage = () => {
  const navigate = useNavigate();
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Table filters hook for managing search and filters
  const { filters, setFilters, searchingFor, displaySearchText, setSearch, clearAllFilters, hasActiveFilters, queryFilters } = useTableFilters<ServiceGetManyFormData>({
    defaultFilters: {
      orderBy: { description: "asc" },
      take: 20,
    },
    searchDebounceMs: 300,
  });

  // Build query for services
  const servicesQuery = useMemo(() => {
    return {
      ...queryFilters,
      orderBy: queryFilters.orderBy || { description: "asc" },
    };
  }, [queryFilters]);

  // Fetch services with filters
  const { data: servicesResponse, isLoading, refetch } = useServices(servicesQuery);

  // Track page access
  usePageTracker({
    title: "Lista de Serviços",
    icon: "tool",
  });

  // Handle filter changes
  const handleFilterChange = (newFilters: Partial<ServiceGetManyFormData>) => {
    setFilters(newFilters);
  };

  // Handle filter removal for ServiceFilterIndicator
  const handleRemoveFilter = (newFilters: Partial<ServiceGetManyFormData>, newSearchingFor?: string) => {
    setFilters(newFilters);
    if (newSearchingFor !== undefined) {
      setSearch(newSearchingFor);
    }
  };

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.PRODUCTION}>
      <div className="flex flex-col h-full space-y-4">
        <PageHeaderWithFavorite
          title="Serviços"
          icon={IconTool}
          favoritePage={FAVORITE_PAGES.PRODUCAO_SERVICOS_LISTAR}
          breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Produção", href: routes.production.root }, { label: "Serviços" }]}
          actions={[
            {
              key: "create",
              label: "Novo Serviço",
              icon: IconPlus,
              onClick: () => navigate(routes.production.services.create),
              variant: "default",
            },
          ]}
        />

        {/* Search and Filter Controls */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <TableSearchInput value={displaySearchText} onChange={setSearch} placeholder="Buscar serviços por descrição..." isPending={displaySearchText !== searchingFor} />
          <div className="flex gap-2">
            <Button variant="outline" size="default" onClick={() => setShowFilterModal(true)} className="group">
              <IconFilter className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              <span className="text-foreground">Filtros</span>
            </Button>
          </div>
        </div>

        {/* Active Filter Indicators */}
        {hasActiveFilters && <ServiceFilterIndicator filters={filters} searchingFor={searchingFor} onRemoveFilter={handleRemoveFilter} />}

        {/* Service List */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <LoadingSpinner />
          </div>
        ) : (
          <ServiceList services={servicesResponse?.data || []} onServiceUpdate={refetch} />
        )}

        {/* Filter Modal */}
        <ServiceFilters open={showFilterModal} onOpenChange={setShowFilterModal} filters={filters} onFilterChange={handleFilterChange} />
      </div>
    </PrivilegeRoute>
  );
};
