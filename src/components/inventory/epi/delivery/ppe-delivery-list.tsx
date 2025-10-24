import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useUsers, useItems, useMarkPpeDeliveryAsDelivered, useAuth, useBatchApprovePpeDeliveries, useBatchRejectPpeDeliveries, usePpeDeliveryMutations, useBatchDeletePpeDeliveries } from "../../../../hooks";
import type { PpeDelivery } from "../../../../types";
import type { PpeDeliveryGetManyFormData } from "../../../../schemas";
import { routes, PPE_DELIVERY_STATUS, ITEM_CATEGORY_TYPE, SECTOR_PRIVILEGES } from "../../../../constants";
import { hasPrivilege } from "../../../../utils";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PpeDeliveryTable } from "./ppe-delivery-table";
import { IconSearch, IconFilter } from "@tabler/icons-react";
import { PpeDeliveryFilters } from "./ppe-delivery-filters";
import { FilterIndicators } from "./filter-indicators";
import { extractActiveFilters, createFilterRemover } from "./filter-utils";
import { cn } from "@/lib/utils";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { Badge } from "@/components/ui/badge";
import { ColumnVisibilityManager } from "./column-visibility-manager";
import { createPpeDeliveryColumns, getDefaultVisibleColumns } from "./ppe-delivery-table-columns";
import { useColumnVisibility } from "@/hooks/use-column-visibility";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";

interface PpeDeliveryListProps {
  className?: string;
}

const DEFAULT_PAGE_SIZE = 40;

// Simple debounce utility - moved outside component to avoid initialization issues
function createDebounce<T extends (...args: any[]) => any>(func: T, wait: number) {
  let timeout: NodeJS.Timeout | null = null;
  const debounced = (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
  debounced.cancel = () => {
    if (timeout) clearTimeout(timeout);
  };
  return debounced;
}

export function PpeDeliveryList({ className }: PpeDeliveryListProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const markAsDeliveredMutation = useMarkPpeDeliveryAsDelivered();
  const batchApproveMutation = useBatchApprovePpeDeliveries();
  const batchRejectMutation = useBatchRejectPpeDeliveries();
  const batchDeleteMutation = useBatchDeletePpeDeliveries();
  const { updateAsync } = usePpeDeliveryMutations();
  const { data: currentUser } = useAuth();
  const [deleteDialog, setDeleteDialog] = useState<{ items: PpeDelivery[]; isBulk: boolean } | null>(null);

  // State to hold current page items and table state from the table component
  const [tableData, setTableData] = useState<{
    items: PpeDelivery[];
    totalRecords: number;
    selectionCount: number;
    showSelectedOnly: boolean;
    toggleShowSelectedOnly?: () => void;
  }>({
    items: [],
    totalRecords: 0,
    selectionCount: 0,
    showSelectedOnly: false,
  });

  // Stable callback for table data updates
  const handleTableDataChange = useCallback(
    (data: { items: PpeDelivery[]; totalRecords: number; selectionCount: number; showSelectedOnly: boolean; toggleShowSelectedOnly: () => void }) => {
      setTableData(data);
    },
    [],
  );

  // Track cursor position to maintain it during search operations
  const cursorPositionRef = useRef<number>(0);

  // State from URL params - must be declared before any callbacks that use them
  const [searchingFor, setSearchingFor] = useState(() => searchParams.get("search") || "");
  const [displaySearchText, setDisplaySearchText] = useState(() => searchParams.get("search") || "");

  // Parse filters from URL - needs to be available early
  const getFiltersFromUrl = useCallback((): Partial<PpeDeliveryGetManyFormData> => {
    const filters: Partial<PpeDeliveryGetManyFormData> = {
      limit: DEFAULT_PAGE_SIZE,
    };

    // Parse entity filters
    const itemId = searchParams.get("itemId");
    const itemIds = searchParams.get("itemIds");
    if (itemIds) {
      filters.itemIds = itemIds.split(",");
    } else if (itemId) {
      filters.where = { ...filters.where, itemId };
    }

    const userId = searchParams.get("userId");
    const userIds = searchParams.get("userIds");
    if (userIds) {
      filters.userIds = userIds.split(",");
    } else if (userId) {
      filters.where = { ...filters.where, userId };
    }

    // Parse status filter
    const status = searchParams.get("status");
    if (status) {
      filters.status = status.split(",") as any[];
    }

    // Parse date range filters
    const createdAfter = searchParams.get("createdAfter");
    const createdBefore = searchParams.get("createdBefore");
    if (createdAfter || createdBefore) {
      filters.createdRange = {
        ...(createdAfter && { gte: new Date(createdAfter) }),
        ...(createdBefore && { lte: new Date(createdBefore) }),
      };
    }

    return filters;
  }, [searchParams]);

  // Current filters state - must be declared before any callbacks that use setFilters
  const [filters, setFilters] = useState<Partial<PpeDeliveryGetManyFormData>>(() => getFiltersFromUrl());

  // Debounced search function - defined after state declarations
  const debouncedSearch = useCallback(
    createDebounce((value: string) => {
      // Only update if value actually changed
      setSearchingFor((prev) => {
        if (prev !== value) {
          return value;
        }
        return prev;
      });
    }, 300), // 300ms delay
    [setSearchingFor],
  );

  // Update cursor position when user interacts with search input
  const handleSearchInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const target = e.target;
      cursorPositionRef.current = target.selectionStart || 0;
      setDisplaySearchText(target.value); // Immediate UI update
      debouncedSearch(target.value); // Debounced API call
    },
    [debouncedSearch],
  );

  // Keep focus and cursor position stable during search operations
  useEffect(() => {
    // Only restore cursor position if the search input is currently focused
    if (searchInputRef.current && document.activeElement === searchInputRef.current) {
      // Use requestAnimationFrame to ensure DOM updates are complete
      requestAnimationFrame(() => {
        if (searchInputRef.current && document.activeElement === searchInputRef.current) {
          const input = searchInputRef.current;
          const savedPosition = cursorPositionRef.current;
          // Restore cursor position to where the user was typing
          input.setSelectionRange(savedPosition, savedPosition);
        }
      });
    }
  }, [displaySearchText]); // Depend on display text changes, not table data

  // Load entity data for filter labels
  const { data: usersData } = useUsers({ orderBy: { name: "asc" } });
  const { data: itemsData } = useItems({
    where: {
      category: { type: ITEM_CATEGORY_TYPE.PPE },
    },
    orderBy: { name: "asc" },
  });

  // Note: Table state is managed by the PpeDeliveryTable component itself
  // We'll get selection count from the table data callback

  // Column visibility state with localStorage persistence
  const { visibleColumns, setVisibleColumns } = useColumnVisibility(
    "ppe-delivery-list-visible-columns",
    getDefaultVisibleColumns()
  );
  const columns = createPpeDeliveryColumns();

  const [showFilterModal, setShowFilterModal] = useState(false);

  // Track if filters are being initialized to prevent loops
  const [filtersInitialized, setFiltersInitialized] = useState(false);

  // Initialize filters from URL on mount
  useEffect(() => {
    if (!filtersInitialized) {
      const urlFilters = getFiltersFromUrl();
      setFilters(urlFilters);
      setFiltersInitialized(true);
    }
  }, [getFiltersFromUrl, filtersInitialized]);

  // Update URL when filters or search change
  useEffect(() => {
    if (!filtersInitialized) return;

    const newParams = new URLSearchParams();

    // Add search parameter
    if (searchingFor) {
      newParams.set("search", searchingFor);
    }

    // Add filter parameters
    if (filters.itemIds?.length) {
      newParams.set("itemIds", filters.itemIds.join(","));
    } else if (filters.where?.itemId) {
      newParams.set("itemId", filters.where.itemId);
    }

    if (filters.userIds?.length) {
      newParams.set("userIds", filters.userIds.join(","));
    } else if (filters.where?.userId) {
      newParams.set("userId", filters.where.userId);
    }

    if (filters.status?.length) {
      newParams.set("status", filters.status.join(","));
    }

    if (filters.scheduledDateRange?.gte) {
      newParams.set("scheduledAfter", filters.scheduledDateRange.gte.toISOString());
    }
    if (filters.scheduledDateRange?.lte) {
      newParams.set("scheduledBefore", filters.scheduledDateRange.lte.toISOString());
    }

    if (filters.actualDeliveryDateRange?.gte) {
      newParams.set("deliveredAfter", filters.actualDeliveryDateRange.gte.toISOString());
    }
    if (filters.actualDeliveryDateRange?.lte) {
      newParams.set("deliveredBefore", filters.actualDeliveryDateRange.lte.toISOString());
    }

    setSearchParams(newParams, { replace: true });
  }, [filters, searchingFor, setSearchParams, filtersInitialized]);

  // Query filters to send to API
  const queryFilters = useMemo(() => {
    return {
      ...filters,
      searchingFor: searchingFor || undefined,
    };
  }, [filters, searchingFor]);

  // Handler for filter changes
  const handleFilterChange = useCallback((newFilters: Partial<PpeDeliveryGetManyFormData>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  // Handler to remove specific filter
  const onRemoveFilter = useCallback((filterKey: string, filterValue?: any) => {
    // If removing search filter, also clear the search input states
    if (filterKey === "searchingFor") {
      setSearchingFor("");
      setDisplaySearchText("");
    }
    createFilterRemover(setFilters)(filterKey, filterValue);
  }, []);

  // Handler to clear all filters but keep search
  const handleClearAllFilters = useCallback(() => {
    setFilters({
      limit: DEFAULT_PAGE_SIZE,
    });
  }, []);

  // Compute active filters for UI indicators
  const activeFilters = useMemo(() => {
    const filtersWithSearch = {
      ...filters,
      searchingFor: searchingFor || undefined,
    };

    return extractActiveFilters(filtersWithSearch, onRemoveFilter, {
      items: itemsData?.data,
      users: usersData?.data,
    });
  }, [filters, searchingFor, itemsData?.data, usersData?.data, onRemoveFilter]);

  // Check if there are active filters (excluding search)
  const hasActiveFilters = useMemo(() => {
    return (
      (filters.status?.length || 0) > 0 ||
      (filters.itemIds?.length || 0) > 0 ||
      (filters.userIds?.length || 0) > 0 ||
      !!filters.scheduledDateRange ||
      !!filters.actualDeliveryDateRange
    );
  }, [filters]);

  // Count total active filters
  const filterCount = useMemo(() => {
    let count = 0;
    if (filters.status?.length) count++;
    if (filters.itemIds?.length) count++;
    if (filters.userIds?.length) count++;
    if (filters.scheduledDateRange) count++;
    if (filters.actualDeliveryDateRange) count++;
    return count;
  }, [filters]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debouncedSearch && typeof debouncedSearch.cancel === "function") {
        debouncedSearch.cancel();
      }
    };
  }, [debouncedSearch]);

  // Handle search
  const handleSearch = useCallback(
    (value: string) => {
      setDisplaySearchText(value); // Immediate UI update
      debouncedSearch(value); // Debounced API call
    },
    [debouncedSearch],
  );

  // Context menu handlers
  const handleBulkEdit = (deliveries: PpeDelivery[]) => {
    if (deliveries.length === 1) {
      // Single delivery - navigate to edit page
      navigate(routes.inventory.ppe.deliveries.edit(deliveries[0].id));
    } else {
      // Multiple deliveries - navigate to batch edit page
      const ids = deliveries.map((delivery) => delivery.id).join(",");
      navigate(`/estoque/epi/entregas/editar-lote?ids=${ids}`);
    }
  };

  const handleBulkApprove = async (deliveries: PpeDelivery[]) => {
    // Check permissions
    if (!currentUser || !hasPrivilege(currentUser, SECTOR_PRIVILEGES.WAREHOUSE)) {
      toast.error("Você não tem permissão para aprovar entregas");
      return;
    }

    // Filter only deliveries that can be approved (not already approved or delivered)
    const deliveriesToApprove = deliveries.filter((d) => d.status !== PPE_DELIVERY_STATUS.APPROVED && d.status !== PPE_DELIVERY_STATUS.DELIVERED);

    if (deliveriesToApprove.length === 0) {
      toast.error("Nenhuma entrega está disponível para aprovação");
      return;
    }

    try {
      // Check if single or batch operation
      if (deliveriesToApprove.length === 1) {
        // Single delivery - use single update
        const delivery = deliveriesToApprove[0];
        await updateAsync({
          id: delivery.id,
          data: {
            status: PPE_DELIVERY_STATUS.APPROVED,
            reviewedBy: currentUser.id,
          },
        });
        toast.success("Entrega aprovada com sucesso");
      } else {
        // Multiple deliveries - use batch operation
        const deliveryIds = deliveriesToApprove.map((d) => d.id);
        const result = await batchApproveMutation.mutateAsync({
          deliveryIds,
          approvedBy: currentUser.id,
        });

        if (result.success > 0) {
          toast.success(`${result.success} entregas aprovadas com sucesso`);
        }

        if (result.failed > 0) {
          toast.error(`${result.failed} entregas não puderam ser aprovadas`);
        }
      }
    } catch (error) {
      console.error("Error approving deliveries:", error);
      toast.error("Erro ao aprovar entregas");
    }
  };

  const handleBulkDeliver = async (deliveries: PpeDelivery[]) => {
    // Check permissions
    if (!currentUser || !hasPrivilege(currentUser, SECTOR_PRIVILEGES.WAREHOUSE)) {
      toast.error("Você não tem permissão para marcar entregas como entregues");
      return;
    }

    // Filter only deliveries that can be marked as delivered (APPROVED status)
    const deliveriesToMark = deliveries.filter((d) => d.status === PPE_DELIVERY_STATUS.APPROVED);

    if (deliveriesToMark.length === 0) {
      toast.error("Nenhuma entrega está no status 'Aprovado' para ser marcada como entregue");
      return;
    }

    try {
      // Mark each delivery as delivered
      await Promise.all(
        deliveriesToMark.map((delivery) =>
          markAsDeliveredMutation.mutateAsync({
            id: delivery.id,
            deliveryDate: new Date(),
          }),
        ),
      );

      const count = deliveriesToMark.length;
      toast.success(count === 1 ? "Entrega marcada como entregue com sucesso" : `${count} entregas marcadas como entregues com sucesso`);
    } catch (error) {
      // Error is handled by the API client with detailed message
      console.error("Error marking deliveries as delivered:", error);
    }
  };

  const handleBulkReject = async (deliveries: PpeDelivery[]) => {
    // Check permissions
    if (!currentUser || !hasPrivilege(currentUser, SECTOR_PRIVILEGES.WAREHOUSE)) {
      toast.error("Você não tem permissão para reprovar entregas");
      return;
    }

    // Filter only deliveries that can be rejected (not already delivered or reproved)
    const deliveriesToReject = deliveries.filter((d) => d.status !== PPE_DELIVERY_STATUS.DELIVERED && d.status !== PPE_DELIVERY_STATUS.REPROVED);

    if (deliveriesToReject.length === 0) {
      toast.error("Nenhuma entrega está disponível para reprovação");
      return;
    }

    try {
      // Check if single or batch operation
      if (deliveriesToReject.length === 1) {
        // Single delivery - use single update
        const delivery = deliveriesToReject[0];
        await updateAsync({
          id: delivery.id,
          data: {
            status: PPE_DELIVERY_STATUS.REPROVED,
            reviewedBy: currentUser.id,
          },
        });
        toast.success("Entrega reprovada com sucesso");
      } else {
        // Multiple deliveries - use batch operation
        const deliveryIds = deliveriesToReject.map((d) => d.id);
        const result = await batchRejectMutation.mutateAsync({
          deliveryIds,
          reviewedBy: currentUser.id,
        });

        if (result.success > 0) {
          toast.success(`${result.success} entregas reprovadas com sucesso`);
        }

        if (result.failed > 0) {
          toast.error(`${result.failed} entregas não puderam ser reprovadas`);
        }
      }
    } catch (error) {
      console.error("Error rejecting deliveries:", error);
      toast.error("Erro ao reprovar entregas");
    }
  };

  const handleBulkDelete = (deliveries: PpeDelivery[]) => {
    setDeleteDialog({
      items: deliveries,
      isBulk: deliveries.length > 1,
    });
  };

  const confirmDelete = async () => {
    if (!deleteDialog) return;

    try {
      const ids = deleteDialog.items.map((delivery) => delivery.id);
      await batchDeleteMutation.mutateAsync({ ppeDeliveryIds: ids });

      toast.success(
        deleteDialog.isBulk && deleteDialog.items.length > 1
          ? `${deleteDialog.items.length} entregas deletadas com sucesso`
          : "Entrega deletada com sucesso"
      );
    } catch (error) {
      // Error is handled by the API client with detailed message
      console.error("Error deleting delivery(ies):", error);
    } finally {
      setDeleteDialog(null);
    }
  };

  return (
    <Card className={cn("h-full flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-6 space-y-4 overflow-hidden">
        {/* Search and controls */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex-1 relative">
            <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar por item, usuário, observações..."
              value={displaySearchText}
              onChange={handleSearchInputChange}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <ShowSelectedToggle showSelectedOnly={tableData.showSelectedOnly} onToggle={tableData.toggleShowSelectedOnly || (() => {})} selectionCount={tableData.selectionCount} />
            <Button variant={hasActiveFilters ? "default" : "outline"} size="default" onClick={() => setShowFilterModal(true)}>
              <IconFilter className="h-4 w-4" />
              <span>
                Filtros{hasActiveFilters ? ` (${filterCount})` : ""}
              </span>
            </Button>
            <ColumnVisibilityManager columns={columns} visibleColumns={visibleColumns} onVisibilityChange={setVisibleColumns} />
          </div>
        </div>

        {/* Active Filter Indicators */}
        {activeFilters.length > 0 && <FilterIndicators filters={activeFilters} onClearAll={handleClearAllFilters} className="px-1 py-1" />}

        {/* Paginated table */}
        <div className="flex-1 min-h-0">
          <PpeDeliveryTable
            visibleColumns={visibleColumns}
            onEdit={handleBulkEdit}
            onApprove={handleBulkApprove}
            onReject={handleBulkReject}
            onDeliver={handleBulkDeliver}
            onDelete={handleBulkDelete}
            filters={queryFilters}
            className="h-full"
            onDataChange={handleTableDataChange}
          />
        </div>
      </CardContent>

      {/* Enhanced Filter Modal */}
      <PpeDeliveryFilters open={showFilterModal} onOpenChange={setShowFilterModal} filters={filters} onFilterChange={handleFilterChange} />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteDialog} onOpenChange={(open) => !open && setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteDialog?.isBulk && deleteDialog.items.length > 1
                ? `Tem certeza que deseja deletar ${deleteDialog.items.length} entregas? Esta ação não pode ser desfeita.`
                : `Tem certeza que deseja deletar a entrega do item "${deleteDialog?.items[0]?.item?.name}" para o usuário "${deleteDialog?.items[0]?.user?.name}"? Esta ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
