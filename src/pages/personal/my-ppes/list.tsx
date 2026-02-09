import { useState, useMemo, useCallback, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getMyPpeDeliveries } from "@/api-client";
import { useQuery } from "@tanstack/react-query";
import { useDebounce } from "@/hooks/common/use-debounce";
import type { PpeDeliveryGetManyFormData } from "@/schemas";
import { PPE_DELIVERY_STATUS, PPE_DELIVERY_STATUS_LABELS, routes } from "@/constants";
import { formatDateTime } from "@/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/ui/page-header";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FilterIndicators as StandardFilterIndicators } from "@/components/ui/filter-indicator";
import { SimplePaginationAdvanced } from "@/components/ui/pagination-advanced";
import { IconSearch, IconPlus, IconPackage, IconFilter, IconX, IconTruck } from "@tabler/icons-react";
import { useAuth } from "@/contexts/auth-context";

const DEFAULT_PAGE_SIZE = 20;

interface FilterState {
  status?: string[];
}

interface FilterIndicator {
  key: string;
  label: string;
  value: string;
  onRemove: () => void;
}

export const MyPpesPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Search state
  const [displaySearchText, setDisplaySearchText] = useState(() => searchParams.get("search") || "");
  const debouncedSearchText = useDebounce(displaySearchText, 300);

  // Filter state - NO initial status filtering, user sees ALL their deliveries by default
  // User can optionally filter by status using the filter modal
  const [filters, setFilters] = useState<FilterState>(() => {
    const statusParam = searchParams.get("status");
    // Only apply status filter if explicitly set in URL (for shareable links)
    // Otherwise, return empty object = no filtering = show all deliveries
    return statusParam ? { status: statusParam.split(",") } : {};
  });

  // Pagination state
  const [page, setPage] = useState(() => {
    const pageParam = searchParams.get("page");
    return pageParam ? parseInt(pageParam, 10) : 1;
  });
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  // Filter modal state
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [localFilterState, setLocalFilterState] = useState<FilterState>({});

  // Update URL when filters change
  useEffect(() => {
    setSearchParams((prevParams) => {
      const newParams = new URLSearchParams(prevParams);

      // Update search
      if (debouncedSearchText) {
        newParams.set("search", debouncedSearchText);
      } else {
        newParams.delete("search");
      }

      // Update status filter
      if (filters.status && filters.status.length > 0) {
        newParams.set("status", filters.status.join(","));
      } else {
        newParams.delete("status");
      }

      // Update page
      if (page > 1) {
        newParams.set("page", page.toString());
      } else {
        newParams.delete("page");
      }

      return newParams;
    }, { replace: true });
  }, [debouncedSearchText, filters, page, setSearchParams]);

  // Query params - builds the API request
  // Note: The API endpoint /ppe/deliveries/my-requests already filters by the current user's ID
  // This means: user only sees their own deliveries (enforced server-side)
  // Status filter is OPTIONAL - only applied when user explicitly selects statuses
  const queryParams = useMemo<PpeDeliveryGetManyFormData>(() => {
    const params: PpeDeliveryGetManyFormData = {
      include: {
        item: true,
        reviewedByUser: true,
      },
      orderBy: {
        createdAt: "desc",
      },
      limit: pageSize,
      skip: (page - 1) * pageSize,
    };

    // Add search filter (searches item name, user name)
    if (debouncedSearchText) {
      params.searchingFor = debouncedSearchText;
    }

    // Add status filter ONLY if user has selected specific statuses
    // If no status selected, API returns ALL deliveries (no status filtering)
    if (filters.status && filters.status.length > 0) {
      params.status = filters.status as PPE_DELIVERY_STATUS[];
    }

    return params;
  }, [debouncedSearchText, filters, page, pageSize]);

  const { data: deliveriesData, isLoading } = useQuery({
    queryKey: ["ppeDeliveries", "my-requests", queryParams],
    queryFn: () => getMyPpeDeliveries(queryParams),
    staleTime: 1000 * 60 * 5,
  });

  const deliveries = deliveriesData?.data || [];
  const totalRecords = deliveriesData?.meta?.totalRecords || 0;
  const totalPages = Math.ceil(totalRecords / pageSize);

  // Status badge helper
  const getStatusBadge = (status: PPE_DELIVERY_STATUS) => {
    const variants: Record<PPE_DELIVERY_STATUS, "default" | "secondary" | "destructive" | "outline"> = {
      [PPE_DELIVERY_STATUS.PENDING]: "outline",
      [PPE_DELIVERY_STATUS.APPROVED]: "default",
      [PPE_DELIVERY_STATUS.DELIVERED]: "secondary",
      [PPE_DELIVERY_STATUS.REPROVED]: "destructive",
      [PPE_DELIVERY_STATUS.CANCELLED]: "destructive",
    };

    return <Badge variant={variants[status]}>{PPE_DELIVERY_STATUS_LABELS[status]}</Badge>;
  };

  // Filter handlers
  const handleFilterApply = useCallback(() => {
    // Only include status if user selected at least one
    // Empty status array means "show all" = no status filter
    const newFilters: FilterState = {};
    if (localFilterState.status && localFilterState.status.length > 0) {
      newFilters.status = localFilterState.status;
    }
    setFilters(newFilters);
    setPage(1); // Reset to first page when applying filters
    setShowFilterModal(false);
  }, [localFilterState]);

  const handleFilterReset = useCallback(() => {
    // Reset both local and applied filters
    // This returns to showing ALL deliveries (no status filter)
    setLocalFilterState({ status: [] });
    setFilters({});
    setPage(1);
    setShowFilterModal(false);
  }, []);

  const handleRemoveFilter = useCallback((key: string) => {
    if (key === "searchingFor") {
      setDisplaySearchText("");
    } else if (key === "status") {
      setFilters((prev) => {
        const { status, ...rest } = prev;
        return rest;
      });
    }
    setPage(1);
  }, []);

  const handleClearAllFilters = useCallback(() => {
    // Clear all filters - return to showing ALL deliveries
    setFilters({});
    setDisplaySearchText("");
    setPage(1);
  }, []);

  // Initialize local filter state when modal opens
  useEffect(() => {
    if (showFilterModal) {
      // Copy current filters to local state for editing
      // This allows user to modify filters without immediately applying them
      setLocalFilterState({
        status: filters.status || [], // Default to empty array for combobox
      });
    }
  }, [showFilterModal, filters]);

  // Active filters for indicators
  const activeFilters = useMemo<FilterIndicator[]>(() => {
    const indicators: FilterIndicator[] = [];

    if (debouncedSearchText) {
      indicators.push({
        key: "searchingFor",
        label: "Busca",
        value: debouncedSearchText,
        onRemove: () => handleRemoveFilter("searchingFor"),
      });
    }

    if (filters.status && filters.status.length > 0) {
      const labels = filters.status.map(
        (s) => PPE_DELIVERY_STATUS_LABELS[s as PPE_DELIVERY_STATUS] || s
      );
      indicators.push({
        key: "status",
        label: "Status",
        value: labels.join(", "),
        onRemove: () => handleRemoveFilter("status"),
      });
    }

    return indicators;
  }, [debouncedSearchText, filters, handleRemoveFilter]);

  // Filter count for badge
  const filterCount = useMemo(() => {
    let count = 0;
    if (filters.status && filters.status.length > 0) count++;
    return count;
  }, [filters]);

  const hasActiveFilters = filterCount > 0;

  // Status options for filter
  const statusOptions = Object.entries(PPE_DELIVERY_STATUS_LABELS).map(([value, label]) => ({
    value,
    label,
  }));

  if (!user) {
    return (
      <Card className="h-full flex items-center justify-center">
        <CardContent>
          <p className="text-muted-foreground">Faça login para ver seus EPIs</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="h-full flex flex-col px-4 pt-4">
      <div className="flex-shrink-0">
        <PageHeader
          variant="default"
          title="Meus EPIs"
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Pessoal", href: routes.personal.root },
            { label: "Meus EPIs" },
          ]}
          actions={[
            {
              key: "request",
              label: "Solicitar EPI",
              icon: IconPlus,
              onClick: () => navigate(routes.personal.myPpes.request),
              variant: "default",
            },
          ]}
        />
      </div>

      <Card className="flex-1 min-h-0 flex flex-col shadow-sm border border-border mt-4">
        <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden pb-6">
          {/* Search and controls */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1 relative">
              <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                type="text"
                placeholder="Buscar por nome, código ou tipo de EPI..."
                value={displaySearchText}
                onChange={(value) => setDisplaySearchText(typeof value === "string" ? value : "")}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={hasActiveFilters ? "default" : "outline"}
                size="default"
                onClick={() => setShowFilterModal(true)}
              >
                <IconFilter className="h-4 w-4" />
                <span>Filtros{hasActiveFilters ? ` (${filterCount})` : ""}</span>
              </Button>
            </div>
          </div>

          {/* Active Filter Indicators */}
          {activeFilters.length > 0 && (
            <StandardFilterIndicators
              filters={activeFilters}
              onClearAll={handleClearAllFilters}
              className="px-1 py-1"
            />
          )}

          {/* Table */}
          <div className="flex-1 min-h-0 overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>EPI</TableHead>
                  <TableHead>Código</TableHead>
                  <TableHead className="text-center">Quantidade</TableHead>
                  <TableHead>Solicitado em</TableHead>
                  <TableHead>Data Prevista</TableHead>
                  <TableHead>Entregue em</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : deliveries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      {activeFilters.length > 0
                        ? "Nenhum EPI encontrado com os filtros aplicados"
                        : "Nenhum EPI solicitado ainda"}
                    </TableCell>
                  </TableRow>
                ) : (
                  deliveries.map((delivery) => (
                    <TableRow key={delivery.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <IconPackage className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <div>
                              {delivery.item?.name || "EPI desconhecido"}
                              {delivery.item?.ppeSize ? ` • ${delivery.item.ppeSize}` : ""}
                            </div>
                            {delivery.item?.ppeCA && (
                              <div className="text-xs text-muted-foreground">
                                CA: {delivery.item.ppeCA}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {delivery.item?.uniCode || "-"}
                        </code>
                      </TableCell>
                      <TableCell className="text-center">{delivery.quantity}</TableCell>
                      <TableCell>{formatDateTime(delivery.createdAt)}</TableCell>
                      <TableCell>
                        {delivery.scheduledDate ? formatDateTime(delivery.scheduledDate) : "-"}
                      </TableCell>
                      <TableCell>
                        {delivery.actualDeliveryDate
                          ? formatDateTime(delivery.actualDeliveryDate)
                          : "-"}
                      </TableCell>
                      <TableCell>{getStatusBadge(delivery.status)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex-shrink-0 pt-2">
              <SimplePaginationAdvanced
                currentPage={page}
                totalPages={totalPages}
                onPageChange={setPage}
                totalRecords={totalRecords}
                pageSize={pageSize}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
                pageSizeOptions={[20, 40, 60, 100]}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filter Modal */}
      <Sheet open={showFilterModal} onOpenChange={setShowFilterModal}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <IconFilter className="h-5 w-5" />
              Meus EPIs - Filtros
              {filterCount > 0 && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="secondary"
                        className="ml-2 cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
                        onClick={handleFilterReset}
                      >
                        {filterCount}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Clique para limpar todos os filtros</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </SheetTitle>
            <SheetDescription>
              Configure filtros para refinar sua busca de EPIs
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Status Filter */}
            <div className="grid gap-2">
              <Label className="flex items-center gap-2">
                <IconTruck className="h-4 w-4" />
                Status
              </Label>
              <Combobox
                mode="multiple"
                options={statusOptions}
                value={localFilterState.status || []}
                onValueChange={(value) =>
                  setLocalFilterState((prev) => ({ ...prev, status: value }))
                }
                placeholder="Selecione status..."
                emptyText="Nenhum status encontrado"
                searchPlaceholder="Buscar status..."
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 mt-6 pt-4 border-t">
              <Button variant="outline" onClick={handleFilterReset} className="flex-1">
                <IconX className="h-4 w-4 mr-2" />
                Limpar Tudo
              </Button>
              <Button onClick={handleFilterApply} className="flex-1">
                Aplicar
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};
