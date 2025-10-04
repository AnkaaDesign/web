import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconLoader2, IconArrowUp, IconArrowDown, IconCheck, IconPackage } from "@tabler/icons-react";
import type { ActivityCreateFormData } from "../../../../schemas";
import { ACTIVITY_OPERATION, ACTIVITY_REASON, ACTIVITY_REASON_LABELS, USER_STATUS } from "../../../../constants";
import { useActivityBatchMutations, useUsers } from "../../../../hooks";
import { routes, FAVORITE_PAGES } from "../../../../constants";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { ItemSelector } from "./item-selector";
import { useActivityFormUrlState } from "@/hooks/use-activity-form-url-state";
import { ActivityBatchResultDialog } from "@/components/ui/batch-operation-result-dialog";
import { useBatchResultDialog } from "@/hooks/use-batch-result-dialog";

export const ActivityBatchCreateForm = () => {
  const navigate = useNavigate();

  // URL state management
  const {
    selectedItems,
    quantities,
    globalUserId,
    globalOperation,
    showSelectedOnly,
    searchTerm,
    showInactive,
    categoryIds,
    brandIds,
    supplierIds,
    page,
    pageSize,
    totalRecords,
    setPage,
    setPageSize,
    setTotalRecords,
    setShowSelectedOnly,
    setSearchTerm,
    setShowInactive,
    setCategoryIds,
    setBrandIds,
    setSupplierIds,
    toggleItemSelection,
    setItemQuantity,
    updateGlobalUserId,
    updateGlobalOperation,
    selectionCount,
    clearAllSelections,
  } = useActivityFormUrlState({
    defaultQuantity: 1,
    defaultOperation: ACTIVITY_OPERATION.OUTBOUND,
    preserveQuantitiesOnDeselect: false,
    defaultPageSize: 40,
  });

  // Local state for global reason (optional field)
  const [globalReason, setGlobalReason] = useState<ACTIVITY_REASON | undefined>(undefined);

  // Mutations and data
  const { batchCreateAsync, isLoading: isSubmitting } = useActivityBatchMutations();
  const { data: usersResponse } = useUsers({
    where: { status: { not: USER_STATUS.DISMISSED } },
    orderBy: { name: "asc" },
    take: 100,
    include: { position: true },
  });

  const users = usersResponse?.data || [];

  // Batch result dialog
  const { isOpen, result, openDialog, closeDialog } = useBatchResultDialog();

  // Handle item selection
  const handleSelectItem = useCallback(
    (itemId: string) => {
      toggleItemSelection(itemId);
    },
    [toggleItemSelection],
  );

  // Handle select all (from paginated selector)
  const handleSelectAll = useCallback(() => {
    // This will be handled by the ItemSelector component
  }, []);

  // Handle global operation change
  const handleGlobalOperationChange = useCallback(
    (operation: ACTIVITY_OPERATION) => {
      updateGlobalOperation(operation);
    },
    [updateGlobalOperation],
  );

  // Handle global user change
  const handleGlobalUserChange = useCallback(
    (userId: string | undefined) => {
      updateGlobalUserId(userId);
    },
    [updateGlobalUserId],
  );

  // Handle global reason change
  const handleGlobalReasonChange = useCallback((reason: ACTIVITY_REASON | undefined) => {
    setGlobalReason(reason);
  }, []);

  // Handle quantity change
  const handleQuantityChange = useCallback(
    (itemId: string, quantity: number) => {
      const validQuantity = Math.max(0.01, quantity);
      setItemQuantity(itemId, validQuantity);
    },
    [setItemQuantity],
  );

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    try {
      // Validate global operation
      if (!globalOperation) {
        toast.error("Operação deve ser selecionada");
        return;
      }

      const activitiesData: ActivityCreateFormData[] = Array.from(selectedItems).map((itemId) => ({
        itemId,
        quantity: quantities[itemId] || 1,
        operation: globalOperation as ACTIVITY_OPERATION,
        userId: globalUserId || undefined, // Optional for INBOUND operations
        reason: globalReason || undefined, // Optional reason, falls back to automatic determination
      }));

      const result = await batchCreateAsync({ activities: activitiesData });

      if (result.data) {
        // Open dialog to show detailed results
        openDialog(result.data);

        // Clear selections after submission (regardless of success/failure)
        clearAllSelections();
      }
    } catch (error) {
      // Error is handled by the mutation hook
    }
  }, [batchCreateAsync, selectedItems, quantities, globalOperation, globalUserId, globalReason, openDialog, clearAllSelections]);

  const handleCancel = useCallback(() => {
    navigate(routes.inventory.movements.root);
  }, [navigate]);

  return (
    <>
      <div className="flex flex-col h-full space-y-4">
        <div className="flex-shrink-0">
          <PageHeaderWithFavorite
            title="Criar Movimentações"
            icon={IconPackage}
            favoritePage={FAVORITE_PAGES.ESTOQUE_MOVIMENTACOES_CADASTRAR}
            breadcrumbs={[
              { label: "Home", href: "/" },
              { label: "Estoque", href: "/estoque" },
              { label: "Movimentações", href: routes.inventory.movements.list },
              { label: "Criar" },
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
                label: `Criar ${selectionCount} Movimentaç${selectionCount === 1 ? "ão" : "ões"}`,
                icon: isSubmitting ? IconLoader2 : IconCheck,
                onClick: handleSubmit,
                variant: "default",
                disabled: isSubmitting || selectionCount === 0,
                loading: isSubmitting,
              },
            ]}
          />
        </div>

        <Card className="flex-1 min-h-0 flex flex-col shadow-sm border border-border">
          <CardContent className="flex-1 flex flex-col p-6 space-y-4 overflow-hidden min-h-0">
            {/* Configuration Section */}
            <div className="space-y-3 flex-shrink-0">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Global Operation */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Tipo de Operação <span className="text-red-500">*</span>
                  </Label>
                  <Combobox
                    value={globalOperation || ACTIVITY_OPERATION.OUTBOUND}
                    onValueChange={(value) => handleGlobalOperationChange(value as ACTIVITY_OPERATION)}
                    options={[
                      {
                        label: "Saída de Estoque",
                        value: ACTIVITY_OPERATION.OUTBOUND,
                      },
                      {
                        label: "Entrada de Estoque",
                        value: ACTIVITY_OPERATION.INBOUND,
                      },
                    ]}
                    placeholder="Selecione o tipo de operação"
                    className="h-10"
                  />
                </div>

                {/* Global User */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Usuário Responsável <span className="text-gray-500 text-xs ml-1">(opcional)</span>
                  </Label>
                  <Combobox
                    options={users.map((user) => ({
                      value: user.id,
                      label: `${user.name}${user.position ? ` - ${user.position.name}` : ""}`,
                    }))}
                    value={globalUserId}
                    onValueChange={handleGlobalUserChange}
                    placeholder="Selecionar usuário (opcional)"
                    className="h-10"
                    searchable
                    emptyText="Nenhum usuário encontrado"
                  />
                </div>
                {/* Global Reason */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Motivo <span className="text-gray-500 text-xs ml-1">(opcional)</span>
                  </Label>
                  <Combobox
                    value={globalReason || ""}
                    onValueChange={(value) => handleGlobalReasonChange((value as ACTIVITY_REASON) || undefined)}
                    options={[
                      { label: "Sem motivo específico", value: "" },
                      ...Object.values(ACTIVITY_REASON).map((reason) => ({
                        label: ACTIVITY_REASON_LABELS[reason],
                        value: reason,
                      })),
                    ]}
                    placeholder="Selecionar motivo"
                    searchPlaceholder="Buscar motivo..."
                    className="h-10"
                  />
                </div>
              </div>{" "}
            </div>

            {/* Paginated Item Selector */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              <ItemSelector
                selectedItems={selectedItems}
                onSelectItem={handleSelectItem}
                onSelectAll={handleSelectAll}
                onQuantityChange={handleQuantityChange}
                quantities={quantities}
                isSelected={(itemId) => selectedItems.has(itemId)}
                showQuantityInput={true}
                showSelectedOnly={showSelectedOnly}
                searchTerm={searchTerm}
                showInactive={showInactive}
                categoryIds={categoryIds}
                brandIds={brandIds}
                supplierIds={supplierIds}
                onSearchTermChange={setSearchTerm}
                onShowInactiveChange={setShowInactive}
                onCategoryIdsChange={setCategoryIds}
                onBrandIdsChange={setBrandIds}
                onSupplierIdsChange={setSupplierIds}
                onShowSelectedOnlyChange={setShowSelectedOnly}
                // Pagination props
                page={page}
                pageSize={pageSize}
                totalRecords={totalRecords}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                onTotalRecordsChange={setTotalRecords}
                className="h-full"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Batch Result Dialog */}
      <ActivityBatchResultDialog open={isOpen} onOpenChange={closeDialog} result={result} operationType="create" />
    </>
  );
};
