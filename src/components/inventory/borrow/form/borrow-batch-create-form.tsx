import { useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { IconLoader2, IconCheck, IconPackage } from "@tabler/icons-react";
import type { BorrowCreateFormData, ItemGetManyFormData } from "../../../../schemas";
import { useBorrowBatchMutations, useUsers } from "../../../../hooks";
import { routes, FAVORITE_PAGES, USER_STATUS } from "../../../../constants";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { PageHeader } from "@/components/ui/page-header";
import { ItemSelectorTable } from "@/components/inventory/common/item-selector";
import { useBorrowFormUrlState } from "@/hooks/inventory/use-borrow-form-url-state";
import { BorrowBatchResultDialog } from "@/components/ui/batch-operation-result-dialog";
import { useBatchResultDialog } from "@/hooks/common/use-batch-result-dialog";

// Form schema for batch borrow creation
const borrowBatchFormSchema = z
  .object({
    userId: z
      .string({
        required_error: "Usuário responsável é obrigatório",
      })
      .uuid("Usuário inválido"),
    items: z
      .array(
        z.object({
          itemId: z.string().uuid(),
          quantity: z.number().int("Quantidade deve ser um número inteiro").positive("Quantidade deve ser maior que zero"),
        }),
      )
      .min(1, "Pelo menos um item deve ser selecionado")
      .max(50, "Máximo de 50 itens permitido por lote"),
  })
  .superRefine((_data, _ctx) => {
    // Additional business validation will be done in onSubmit
    return true;
  });

type BorrowBatchFormData = z.infer<typeof borrowBatchFormSchema>;

export const BorrowBatchCreateForm = () => {
  const navigate = useNavigate();

  // URL state management
  const urlState = useBorrowFormUrlState({
    defaultQuantity: 1,
    preserveQuantitiesOnDeselect: false,
    defaultPageSize: 40,
  });

  const {
    selectedItems,
    quantities,
    globalUserId,
    showSelectedOnly,
    searchTerm,
    showInactive,
    categoryIds,
    brandIds,
    supplierIds,
    page,
    pageSize,
    totalRecords: _totalRecords,
    setPage,
    setPageSize,
    setTotalRecords: _setTotalRecords,
    setShowSelectedOnly,
    setSearchTerm,
    setShowInactive,
    setCategoryIds,
    setBrandIds,
    setSupplierIds,
    toggleItemSelection,
    setItemQuantity,
    updateGlobalUserId,
    selectionCount,
    clearAllSelections,
    batchUpdateSelection,
  } = urlState;

  // Form setup with validation
  const form = useForm<BorrowBatchFormData>({
    resolver: zodResolver(borrowBatchFormSchema),
    mode: "onChange",
    defaultValues: {
      userId: globalUserId || undefined,
      items: [],
    },
  });

  // Mutations and data
  const batchMutations = useBorrowBatchMutations();

  const { batchCreateAsync, isLoading: isSubmitting } = batchMutations;

  // Only fetch users for the dropdown selector
  const { data: usersResponse } = useUsers({
    statuses: [
      USER_STATUS.EXPERIENCE_PERIOD_1,
      USER_STATUS.EXPERIENCE_PERIOD_2,
      USER_STATUS.EFFECTED
    ],
    orderBy: { name: "asc" },
    take: 100,
    include: { sector: true },
  });

  const users = usersResponse?.data || [];

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

  // Sync URL state with form
  useEffect(() => {
    // Update form items when selections change
    const items = Array.from(selectedItems).map((itemId) => ({
      itemId,
      quantity: quantities[itemId] || 1,
    }));
    form.setValue("items", items, { shouldValidate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItems, quantities]);

  // Sync global user ID with form
  useEffect(() => {
    if (globalUserId) {
      form.setValue("userId", globalUserId, { shouldValidate: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalUserId]);

  // Handle item selection
  const handleSelectItem = useCallback(
    (itemId: string, _quantity?: number, _price?: number, _icms?: number, _ipi?: number) => {
      // Borrow form only uses quantity, but accept all params for compatibility
      toggleItemSelection(itemId);
    },
    [toggleItemSelection],
  );

  // Handle batch selection for shift-click range selection
  const handleBatchSelectItems = useCallback(
    (itemIds: string[], itemData: Record<string, { quantity?: number; price?: number; icms?: number; ipi?: number }>) => {
      // Build the new selection state
      const newSelected = new Set(selectedItems);
      const newQuantities = { ...quantities };

      itemIds.forEach((itemId) => {
        if (!newSelected.has(itemId)) {
          newSelected.add(itemId);
          newQuantities[itemId] = itemData[itemId]?.quantity || 1;
        }
      });

      // Batch update using the batch update function from URL state
      batchUpdateSelection(newSelected, newQuantities);
    },
    [selectedItems, quantities, batchUpdateSelection],
  );

  // Handle select all (from paginated selector)
  const handleSelectAll = useCallback(() => {
    // This will be handled by the BorrowItemSelector component
  }, []);

  // Handle global user change
  const handleGlobalUserChange = useCallback(
    (userId: string | undefined) => {
      updateGlobalUserId(userId);
      form.setValue("userId", userId || "", { shouldValidate: true });
    },
    [updateGlobalUserId, form],
  );

  // Handle quantity change
  const handleQuantityChange = useCallback(
    (itemId: string, quantity: number) => {
      // Ensure quantity is an integer >= 1
      const validQuantity = Math.max(1, Math.floor(quantity));
      setItemQuantity(itemId, validQuantity);
    },
    [setItemQuantity],
  );

  // Handle form submission
  const onSubmit = useCallback(
    async (data: BorrowBatchFormData) => {

      try {
        // Basic frontend validation - just check if required fields are present
        if (!data.userId) {
          form.setError("userId", {
            type: "manual",
            message: "Usuário é obrigatório",
          });
          return;
        }

        if (!data.items || data.items.length === 0) {
          alert("Selecione pelo menos um item");
          return;
        }

        const borrowsData: BorrowCreateFormData[] = data.items.map((item) => ({
          itemId: item.itemId,
          quantity: item.quantity,
          userId: data.userId,
        }));

        // Check if batchCreateAsync is available
        if (!batchCreateAsync) {
          if (process.env.NODE_ENV !== 'production') {
            console.error("batchCreateAsync is not available!");
          }

          // Try alternative methods
          if (batchMutations.batchCreate) {
            
            batchMutations.batchCreate({ borrows: borrowsData });
            return;
          } else if (batchMutations.batchCreateMutation?.mutateAsync) {
            
            const result = await batchMutations.batchCreateMutation.mutateAsync({ borrows: borrowsData });
            if (result.data) {
              openDialog(result.data);
              clearAllSelections();
              form.reset();
            }
            return;
          } else {
            if (process.env.NODE_ENV !== 'production') {
              console.error("No batch create method available!");
            }
            alert("Erro interno: método de criação em lote não disponível");
            return;
          }
        }

        const result = await batchCreateAsync({ borrows: borrowsData });

        if (result.data) {
          // Open dialog to show detailed results
          openDialog(result.data);

          // Clear selections after submission
          clearAllSelections();
          form.reset();
        }
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.error("=== BATCH CREATE ERROR ===");
          console.error("Full error object:", error);
          console.error("Error message:", (error as any)?.message);
          console.error("Error response:", (error as any)?.response);
        }

        // Show a more detailed error message
        const errorMessage = (error as any)?.response?.data?.message || (error as any)?.message || "Erro ao criar empréstimos em lote";
        alert(`Erro: ${errorMessage}`);
      }
    },
    [batchCreateAsync, batchMutations, openDialog, clearAllSelections, form],
  );

  const handleCancel = useCallback(() => {
    navigate(routes.inventory.loans.root);
  }, [navigate]);

  return (
    <>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          title="Criar Empréstimos"
          icon={IconPackage}
          favoritePage={FAVORITE_PAGES.ESTOQUE_EMPRESTIMOS_CADASTRAR}
          breadcrumbs={[{ label: "Início", href: "/" }, { label: "Estoque", href: "/estoque" }, { label: "Empréstimos", href: routes.inventory.loans.list }, { label: "Criar" }]}
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
              label: `Criar ${selectionCount} Empréstimo${selectionCount === 1 ? "" : "s"}`,
              icon: isSubmitting ? IconLoader2 : IconCheck,
              onClick: () => {

                const handleSubmitFn = form.handleSubmit(onSubmit);
                handleSubmitFn();
              },
              variant: "default",
              disabled: isSubmitting || selectionCount === 0 || !form.formState.isValid,
              loading: isSubmitting,
            },
          ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 overflow-y-auto pb-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
              <Card className="flex flex-col shadow-sm border border-border h-full">
                <CardContent className="flex flex-col p-6 space-y-4 overflow-hidden min-h-0 flex-1">
                  {/* Configuration Section */}
                  <div className="space-y-3 flex-shrink-0">
                    <div className="grid grid-cols-1 gap-4">
                      {/* Global User - Full width */}
                      <FormField
                        control={form.control}
                        name="userId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Usuário Responsável <span className="text-destructive">*</span>
                            </FormLabel>
                            <FormControl>
                              <Combobox
                                options={users.map((user) => ({
                                  value: user.id,
                                  label: `${user.name}${user.sector ? ` - ${user.sector.name}` : ""}`,
                                }))}
                                value={field.value}
                                onValueChange={(value) => {
                                  field.onChange(value);
                                  handleGlobalUserChange(value);
                                }}
                                placeholder="Selecionar usuário"
                                className="h-10"
                                searchable
                                emptyText="Nenhum usuário encontrado"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  {/* Paginated Item Selector */}
                  <div className="flex-1 min-h-0">
                    <ItemSelectorTable
                      selectedItems={selectedItems}
                      onSelectItem={handleSelectItem}
                      onSelectAll={handleSelectAll}
                      onBatchSelectItems={handleBatchSelectItems}
                      quantities={quantities}
                      onQuantityChange={handleQuantityChange}
                      editableColumns={{
                        showQuantityInput: true,
                      }}
                      fixedColumnsConfig={{
                        fixedColumns: ['name', 'quantity'],
                        fixedReasons: {
                          name: 'Essencial para identificar o item',
                          quantity: 'Necessário para verificar estoque disponível e evitar empréstimos acima do estoque',
                        },
                      }}
                      defaultColumns={['uniCode', 'name', 'category.name', 'brand.name', 'measures', 'quantity']}
                      storageKey="borrow-item-selector"
                      additionalFilters={{
                        where: {
                          category: {
                            type: 'TOOL',
                          },
                        },
                      }}
                      // URL state management
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
            </form>
          </Form>
        </div>
      </div>

      {/* Batch Result Dialog */}
      <BorrowBatchResultDialog open={isOpen} onOpenChange={closeDialog} result={result} operationType="create" />
    </>
  );
};
