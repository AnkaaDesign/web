import { useCallback, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { IconLoader2, IconCheck, IconClipboardCheck } from "@tabler/icons-react";
import type { ItemGetManyFormData } from "../../../schemas";
import { ACTIVITY_OPERATION, ACTIVITY_REASON } from "../../../constants";
import { useActivityBatchMutations } from "../../../hooks";
import { routes, FAVORITE_PAGES } from "../../../constants";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ItemSelectorTable } from "@/components/inventory/common/item-selector";
import { useStockBalanceFormUrlState } from "@/hooks/use-stock-balance-form-url-state";
import { StockBalanceBatchResultDialog } from "@/components/inventory/stock-balance/stock-balance-batch-result-dialog";
import { useBatchResultDialog } from "@/hooks/use-batch-result-dialog";

export const StockBalanceCreatePage = () => {
  const navigate = useNavigate();

  // URL state management
  const urlState = useStockBalanceFormUrlState({
    defaultCountedQuantity: 0,
    preserveQuantitiesOnDeselect: true,
    defaultPageSize: 40,
  });

  const {
    selectedItems,
    countedQuantities,
    originalQuantities,
    showSelectedOnly,
    searchTerm,
    showInactive,
    categoryIds,
    brandIds,
    supplierIds,
    page,
    pageSize,
    setPage,
    setPageSize,
    setShowSelectedOnly,
    setSearchTerm,
    setShowInactive,
    setCategoryIds,
    setBrandIds,
    setSupplierIds,
    setItemCountedQuantity,
    selectItemWithOriginalQuantity,
    selectionCount,
    clearAllSelections,
    getItemsWithDifferences,
  } = urlState;

  // Mutations and data
  const { batchCreateAsync, isLoading: isSubmitting } = useActivityBatchMutations();

  // Batch result dialog
  const { isOpen, result, openDialog, closeDialog } = useBatchResultDialog();

  // Consolidate filters for ItemSelectorTable
  const filters = useMemo<Partial<ItemGetManyFormData>>(() => ({
    showInactive,
    categoryIds: categoryIds.length > 0 ? categoryIds : undefined,
    brandIds: brandIds.length > 0 ? brandIds : undefined,
    supplierIds: supplierIds.length > 0 ? supplierIds : undefined,
  }), [showInactive, categoryIds, brandIds, supplierIds]);

  // Handle filter changes from ItemSelectorTable
  const handleFiltersChange = useCallback((newFilters: Partial<ItemGetManyFormData>) => {
    if (newFilters.showInactive !== undefined) setShowInactive(newFilters.showInactive);
    if (newFilters.categoryIds !== undefined) setCategoryIds(newFilters.categoryIds);
    if (newFilters.brandIds !== undefined) setBrandIds(newFilters.brandIds);
    if (newFilters.supplierIds !== undefined) setSupplierIds(newFilters.supplierIds);
  }, [setShowInactive, setCategoryIds, setBrandIds, setSupplierIds]);

  // Handle item selection - store original quantity when selecting
  // Uses atomic function to prevent race conditions
  const handleSelectItem = useCallback(
    (itemId: string, quantity?: number) => {
      // Use atomic selection that updates selectedItems, originalQuantities, and countedQuantities in one call
      selectItemWithOriginalQuantity(itemId, quantity ?? 0);
    },
    [selectItemWithOriginalQuantity],
  );

  // Handle select all (from paginated selector)
  const handleSelectAll = useCallback(() => {
    // This will be handled by the ItemSelector component
  }, []);

  // Handle counted quantity change
  const handleQuantityChange = useCallback(
    (itemId: string, quantity: number | null) => {
      if (quantity !== null && quantity !== undefined) {
        const validQuantity = Math.max(0, Number(quantity));
        setItemCountedQuantity(itemId, validQuantity);
      }
    },
    [setItemCountedQuantity],
  );

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    try {
      const itemsWithDifferences = getItemsWithDifferences();

      if (itemsWithDifferences.length === 0) {
        toast.info("Nenhuma diferenca detectada no balanco de estoque. Ajuste as quantidades contadas.");
        return;
      }

      // Create activities for stock adjustments
      const activities = itemsWithDifferences.map((item) => {
        const operation = item.difference > 0 ? ACTIVITY_OPERATION.INBOUND : ACTIVITY_OPERATION.OUTBOUND;
        const quantity = Math.abs(item.difference);

        return {
          itemId: item.itemId,
          quantity,
          operation,
          reason: ACTIVITY_REASON.INVENTORY_COUNT,
        };
      });

      const result = await batchCreateAsync({ activities });

      if (result.data) {
        // Open dialog to show detailed results
        openDialog(result.data);

        // Clear selections after submission
        clearAllSelections();
      }
    } catch (error) {
      // Error is handled by the mutation hook
    }
  }, [batchCreateAsync, getItemsWithDifferences, openDialog, clearAllSelections]);

  const handleCancel = useCallback(() => {
    navigate(routes.inventory.products.list);
  }, [navigate]);

  // Calculate items with differences for the submit button
  const itemsWithDifferencesCount = useMemo(() => {
    return getItemsWithDifferences().length;
  }, [getItemsWithDifferences]);

  return (
    <>
      <div className="h-full flex flex-col px-4 pt-4">
        <PageHeader
          title="Balanco de Estoque"
          icon={IconClipboardCheck}
          favoritePage={FAVORITE_PAGES.ESTOQUE_PRODUTOS_LISTAR}
          breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "Estoque", href: "/estoque" },
            { label: "Produtos", href: routes.inventory.products.list },
            { label: "Balanco" },
          ]}
          actions={[
            {
              key: "cancel",
              label: "Cancelar",
              onClick: handleCancel,
              variant: "outline",
              disabled: isSubmitting,
            },
            {
              key: "submit",
              label: itemsWithDifferencesCount > 0
                ? `Confirmar ${itemsWithDifferencesCount} Ajuste${itemsWithDifferencesCount === 1 ? "" : "s"}`
                : `Confirmar Balanco (${selectionCount} selecionado${selectionCount === 1 ? "" : "s"})`,
              icon: isSubmitting ? IconLoader2 : IconCheck,
              onClick: handleSubmit,
              variant: "default",
              disabled: isSubmitting || selectionCount === 0,
              loading: isSubmitting,
            },
          ]}
        />
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="mt-4 space-y-4">
            <Card className="flex flex-col shadow-sm border border-border">
              <CardContent className="flex-1 flex flex-col p-4 space-y-4 min-h-0">
                {/* Instructions */}
                <div className="space-y-3 flex-shrink-0">
                  <div className="p-3 bg-muted/50 rounded-lg border border-border">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                      <span className="font-semibold text-sm">Balanco de Estoque</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Selecione os itens que deseja contabilizar e ajuste a quantidade contada. O sistema criara movimentacoes automaticas para corrigir as diferencas.
                    </p>
                  </div>
                </div>

                {/* Paginated Item Selector */}
                <div className="flex-1 min-h-0">
                  <ItemSelectorTable
                    selectedItems={selectedItems}
                    onSelectItem={handleSelectItem}
                    onSelectAll={handleSelectAll}
                    quantities={countedQuantities}
                    onQuantityChange={handleQuantityChange}
                    editableColumns={{
                      showQuantityInput: true,
                    }}
                    fixedColumnsConfig={{
                      fixedColumns: ['name', 'quantity'],
                      fixedReasons: {
                        name: 'Essencial para identificar o item',
                        quantity: 'Referencia para o estoque atual',
                      },
                    }}
                    defaultColumns={['uniCode', 'name', 'category.name', 'brand.name', 'measures', 'quantity']}
                    storageKey="stock-balance-item-selector"
                    page={page}
                    pageSize={pageSize}
                    showSelectedOnly={showSelectedOnly}
                    searchTerm={searchTerm}
                    filters={filters}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                    onShowSelectedOnlyChange={setShowSelectedOnly}
                    onSearchTermChange={setSearchTerm}
                    onFiltersChange={handleFiltersChange}
                    className="h-full"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Batch Result Dialog */}
      <StockBalanceBatchResultDialog open={isOpen} onOpenChange={closeDialog} result={result} />
    </>
  );
};

export default StockBalanceCreatePage;
