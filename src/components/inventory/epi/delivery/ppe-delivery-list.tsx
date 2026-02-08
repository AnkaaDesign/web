import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useUsers, useItems, useMarkPpeDeliveryAsDelivered, useBatchMarkPpeDeliveriesAsDelivered, useAuth, useBatchApprovePpeDeliveries, useBatchRejectPpeDeliveries, usePpeDeliveryMutations, useBatchDeletePpeDeliveries } from "../../../../hooks";
import type { PpeDelivery } from "../../../../types";
import type { PpeDeliveryGetManyFormData } from "../../../../schemas";
import { routes, PPE_DELIVERY_STATUS, ITEM_CATEGORY_TYPE, SECTOR_PRIVILEGES } from "../../../../constants";
import { hasPrivilege } from "../../../../utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PpeDeliveryTable } from "./ppe-delivery-table";
import { IconSearch, IconFilter } from "@tabler/icons-react";
import { toast } from "sonner";
import { PpeDeliveryFilters } from "./ppe-delivery-filters";
import { FilterIndicators } from "./filter-indicators";
import { extractActiveFilters, createFilterRemover } from "./filter-utils";
import { cn } from "@/lib/utils";
import { ShowSelectedToggle } from "@/components/ui/show-selected-toggle";
import { ColumnVisibilityManager } from "./column-visibility-manager";
import { createPpeDeliveryColumns, getDefaultVisibleColumns } from "./ppe-delivery-table-columns";
import { useColumnVisibility } from "@/hooks/common/use-column-visibility";
import { useTableState } from "@/hooks/common/use-table-state";
import { useBatchResultDialog } from "@/hooks/common/use-batch-result-dialog";
import { BatchOperationResultDialog } from "@/components/ui/batch-operation-result-dialog";
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
  const batchMarkAsDeliveredMutation = useBatchMarkPpeDeliveriesAsDelivered();
  const batchApproveMutation = useBatchApprovePpeDeliveries();
  const batchRejectMutation = useBatchRejectPpeDeliveries();
  const batchDeleteMutation = useBatchDeletePpeDeliveries();
  const { updateAsync } = usePpeDeliveryMutations();
  const { user: currentUser } = useAuth();
  const [deleteDialog, setDeleteDialog] = useState<{ items: PpeDelivery[]; isBulk: boolean } | null>(null);

  // Get table state for selected items functionality - shared with table component via URL
  const { selectionCount, showSelectedOnly, toggleShowSelectedOnly, selectedIds } = useTableState({
    defaultPageSize: DEFAULT_PAGE_SIZE,
    resetSelectionOnPageChange: false,
  });

  // State to hold current page items from the table component
  const [tableData, setTableData] = useState<{
    items: PpeDelivery[];
    totalRecords: number;
  }>({
    items: [],
    totalRecords: 0,
  });

  // Stable callback for table data updates
  const handleTableDataChange = useCallback(
    (data: { items: PpeDelivery[]; totalRecords: number }) => {
      setTableData(data);
    },
    [],
  );

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

  // Handle search input change - receives value directly from custom Input component
  const handleSearchInputChange = useCallback(
    (value: string | number | null) => {
      const stringValue = value?.toString() || "";
      setDisplaySearchText(stringValue); // Immediate UI update
      debouncedSearch(stringValue); // Debounced API call
    },
    [debouncedSearch],
  );

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

    setSearchParams((prevParams) => {
      const newParams = new URLSearchParams(prevParams);

      // Remove all filter-related params first
      newParams.delete("search");
      newParams.delete("itemId");
      newParams.delete("itemIds");
      newParams.delete("userId");
      newParams.delete("userIds");
      newParams.delete("status");
      newParams.delete("scheduledAfter");
      newParams.delete("scheduledBefore");
      newParams.delete("deliveredAfter");
      newParams.delete("deliveredBefore");

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

      return newParams;
    }, { replace: true });
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

  // Context menu handlers - memoized to prevent unnecessary re-renders
  const handleBulkEdit = useCallback((deliveries: PpeDelivery[]) => {
    if (deliveries.length === 1) {
      // Single delivery - navigate to edit page
      navigate(routes.inventory.ppe.deliveries.edit(deliveries[0].id));
    } else {
      // Multiple deliveries - navigate to batch edit page
      const ids = deliveries.map((delivery) => delivery.id).join(",");
      navigate(`/estoque/epi/entregas/editar-lote?ids=${ids}`);
    }
  }, [navigate]);

  const handleBulkApprove = useCallback(async (deliveries: PpeDelivery[]) => {
    // Check permissions - only ADMIN can approve/reject deliveries
    if (!currentUser || !hasPrivilege(currentUser, SECTOR_PRIVILEGES.ADMIN)) {
      toast.error("Você não tem permissão para aprovar entregas");
      return;
    }

    // Filter only deliveries that can be approved (PENDING only)
    // Cannot approve: APPROVED, DELIVERED, REPROVED, CANCELLED
    const deliveriesToApprove = deliveries.filter(
      (d) => d.status === PPE_DELIVERY_STATUS.PENDING
    );

    if (deliveriesToApprove.length === 0) {
      toast.warning("Nenhuma entrega selecionada está pendente. Apenas entregas pendentes podem ser aprovadas.");
      return;
    }

    const toastId = toast.loading(
      `Aprovando ${deliveriesToApprove.length} entrega${deliveriesToApprove.length > 1 ? "s" : ""}...`
    );

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
      } else {
        // Multiple deliveries - use batch operation
        const deliveryIds = deliveriesToApprove.map((d) => d.id);
        await batchApproveMutation.mutateAsync({
          deliveryIds,
          approvedBy: currentUser.id,
        });
      }
      toast.success(
        deliveriesToApprove.length === 1
          ? "Entrega aprovada com sucesso"
          : `${deliveriesToApprove.length} entregas aprovadas com sucesso`,
        { id: toastId }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro ao aprovar entregas";
      toast.error(errorMessage, { id: toastId });
      if (process.env.NODE_ENV !== 'production') {
        console.error("[handleBulkApprove] Error approving deliveries:", error);
      }
    }
  }, [currentUser, updateAsync, batchApproveMutation]);

  const handleBulkDeliver = useCallback(async (deliveries: PpeDelivery[]) => {
    // Check permissions
    if (!currentUser || !hasPrivilege(currentUser, SECTOR_PRIVILEGES.WAREHOUSE)) {
      toast.error("Você não tem permissão para marcar entregas como entregues");
      return;
    }

    // Filter only deliveries that can be marked as delivered (APPROVED status)
    const deliveriesToMark = deliveries.filter((d) => d.status === PPE_DELIVERY_STATUS.APPROVED);

    if (deliveriesToMark.length === 0) {
      toast.warning("Nenhuma entrega selecionada está aprovada. Apenas entregas aprovadas podem ser marcadas como entregues.");
      return;
    }

    // Show loading toast with progress indicator
    const toastId = toast.loading(
      `Processando ${deliveriesToMark.length} entrega${deliveriesToMark.length > 1 ? "s" : ""}...`,
      {
        description: "Marcando como entregue e gerando documento de assinatura",
      }
    );

    try {
      // Use batch endpoint to mark all deliveries as delivered at once
      // This ensures the backend groups deliveries by user and creates a single PDF per user
      const deliveryIds = deliveriesToMark.map((d) => d.id);
      const result = await batchMarkAsDeliveredMutation.mutateAsync({
        deliveryIds,
        deliveryDate: new Date(),
      });

      if (result.success > 0 && result.failed === 0) {
        toast.success(
          result.success === 1
            ? "Entrega processada com sucesso!"
            : `${result.success} entregas processadas com sucesso!`,
          {
            id: toastId,
            description: "Documento de assinatura gerado e enviado para o funcionário",
          }
        );
      } else if (result.success > 0 && result.failed > 0) {
        toast.warning(
          `${result.success} sucesso, ${result.failed} falha${result.failed > 1 ? "s" : ""}`,
          {
            id: toastId,
            description: "Algumas entregas foram processadas, outras falharam",
          }
        );
      } else {
        toast.error("Falha ao processar entregas", {
          id: toastId,
          description: `${result.failed} entrega${result.failed > 1 ? "s" : ""} falhou/falharam`,
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro ao marcar entregas como entregues";
      toast.error("Erro ao processar entregas", {
        id: toastId,
        description: errorMessage,
      });
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error marking deliveries as delivered:", error);
      }
    }
  }, [currentUser, batchMarkAsDeliveredMutation]);

  const handleBulkReject = useCallback(async (deliveries: PpeDelivery[]) => {
    // Check permissions - only ADMIN can approve/reject deliveries
    if (!currentUser || !hasPrivilege(currentUser, SECTOR_PRIVILEGES.ADMIN)) {
      toast.error("Você não tem permissão para reprovar entregas");
      return;
    }

    // Filter only deliveries that can be rejected (PENDING or APPROVED only)
    // Cannot reject: DELIVERED, REPROVED, CANCELLED
    const deliveriesToReject = deliveries.filter(
      (d) =>
        d.status === PPE_DELIVERY_STATUS.PENDING ||
        d.status === PPE_DELIVERY_STATUS.APPROVED
    );

    if (deliveriesToReject.length === 0) {
      toast.warning("Nenhuma entrega selecionada pode ser reprovada. Apenas entregas pendentes ou aprovadas podem ser reprovadas.");
      return;
    }

    const toastId = toast.loading(
      `Reprovando ${deliveriesToReject.length} entrega${deliveriesToReject.length > 1 ? "s" : ""}...`
    );

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
      } else {
        // Multiple deliveries - use batch operation
        const deliveryIds = deliveriesToReject.map((d) => d.id);
        await batchRejectMutation.mutateAsync({
          deliveryIds,
          reviewedBy: currentUser.id,
        });
      }
      toast.success(
        deliveriesToReject.length === 1
          ? "Entrega reprovada com sucesso"
          : `${deliveriesToReject.length} entregas reprovadas com sucesso`,
        { id: toastId }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro ao reprovar entregas";
      toast.error(errorMessage, { id: toastId });
      if (process.env.NODE_ENV !== 'production') {
        console.error("[handleBulkReject] Error rejecting deliveries:", error);
      }
    }
  }, [currentUser, updateAsync, batchRejectMutation]);

  const handleBulkDelete = useCallback((deliveries: PpeDelivery[]) => {
    setDeleteDialog({
      items: deliveries,
      isBulk: deliveries.length > 1,
    });
  }, []);

  const handleBulkRevertToApproved = useCallback(async (deliveries: PpeDelivery[]) => {
    // Check permissions - only WAREHOUSE can revert deliveries
    if (!currentUser || !hasPrivilege(currentUser, SECTOR_PRIVILEGES.WAREHOUSE)) {
      toast.error("Você não tem permissão para reverter entregas");
      return;
    }

    // Filter only deliveries that can be reverted (DELIVERED status)
    const deliveriesToRevert = deliveries.filter((d) => d.status === PPE_DELIVERY_STATUS.DELIVERED);

    if (deliveriesToRevert.length === 0) {
      toast.warning("Nenhuma entrega selecionada está entregue. Apenas entregas já entregues podem ser revertidas.");
      return;
    }

    const toastId = toast.loading(
      `Revertendo ${deliveriesToRevert.length} entrega${deliveriesToRevert.length > 1 ? "s" : ""}...`,
      {
        description: "Restaurando estoque e alterando status para aprovado",
      }
    );

    try {
      // Revert each delivery to APPROVED status
      await Promise.all(
        deliveriesToRevert.map((delivery) =>
          updateAsync({
            id: delivery.id,
            data: {
              status: PPE_DELIVERY_STATUS.APPROVED,
              actualDeliveryDate: null,
            },
          }),
        ),
      );
      toast.success(
        deliveriesToRevert.length === 1
          ? "Entrega revertida para aprovado com sucesso"
          : `${deliveriesToRevert.length} entregas revertidas para aprovado com sucesso`,
        { id: toastId, description: "Estoque restaurado" }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro ao reverter entregas";
      toast.error(errorMessage, { id: toastId });
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error reverting deliveries:", error);
      }
    }
  }, [currentUser, updateAsync]);

  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!deleteDialog) return;

    setIsDeleting(true);
    const toastId = toast.loading(
      `Deletando ${deleteDialog.items.length} entrega${deleteDialog.items.length > 1 ? "s" : ""}...`
    );

    try {
      const ids = deleteDialog.items.map((delivery) => delivery.id);
      await batchDeleteMutation.mutateAsync({ ppeDeliveryIds: ids });
      toast.success(
        deleteDialog.items.length === 1
          ? "Entrega deletada com sucesso"
          : `${deleteDialog.items.length} entregas deletadas com sucesso`,
        { id: toastId }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro ao deletar entregas";
      toast.error(errorMessage, { id: toastId });
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error deleting delivery(ies):", error);
      }
    } finally {
      setIsDeleting(false);
      setDeleteDialog(null);
    }
  };

  return (
    <Card className={cn("flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-4 space-y-4 overflow-hidden">
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
              transparent={true}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <ShowSelectedToggle showSelectedOnly={showSelectedOnly} onToggle={toggleShowSelectedOnly} selectionCount={selectionCount} />
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
        <div className="flex-1 min-h-0 overflow-auto">
          <PpeDeliveryTable
            visibleColumns={visibleColumns}
            onEdit={handleBulkEdit}
            onApprove={handleBulkApprove}
            onReject={handleBulkReject}
            onDeliver={handleBulkDeliver}
            onRevertToApproved={handleBulkRevertToApproved}
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
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deletando..." : "Deletar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
