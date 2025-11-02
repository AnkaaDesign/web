import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { IconLoader2, IconCheck, IconPackage } from "@tabler/icons-react";
import type { BorrowCreateFormData } from "../../../../schemas";
import { useBorrowBatchMutations, useUsers } from "../../../../hooks";
import { routes, FAVORITE_PAGES, USER_STATUS } from "../../../../constants";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { BorrowItemSelector } from "./borrow-item-selector";
import { useBorrowFormUrlState } from "@/hooks/use-borrow-form-url-state";
import { BorrowBatchResultDialog } from "@/components/ui/batch-operation-result-dialog";
import { useBatchResultDialog } from "@/hooks/use-batch-result-dialog";

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
  .superRefine((data, ctx) => {
    // Additional business validation will be done in onSubmit
    return true;
  });

type BorrowBatchFormData = z.infer<typeof borrowBatchFormSchema>;

export const BorrowBatchCreateForm = () => {
  const navigate = useNavigate();

  console.log("=== BorrowBatchCreateForm rendered ===");

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
    selectionCount,
    clearAllSelections,
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
  console.log("=== Batch Mutations Result ===");
  console.log("batchMutations:", batchMutations);
  console.log("Available methods:", Object.keys(batchMutations));
  console.log("Has batchCreateAsync?", "batchCreateAsync" in batchMutations);

  const { batchCreateAsync, isLoading: isSubmitting } = batchMutations;

  // Only fetch users for the dropdown selector
  const { data: usersResponse } = useUsers({
    statuses: [
      USER_STATUS.EXPERIENCE_PERIOD_1,
      USER_STATUS.EXPERIENCE_PERIOD_2,
      USER_STATUS.CONTRACTED
    ],
    orderBy: { name: "asc" },
    take: 100,
    include: { sector: true },
  });

  const users = usersResponse?.data || [];

  // Batch result dialog
  const { isOpen, result, openDialog, closeDialog } = useBatchResultDialog();

  // Sync URL state with form
  useEffect(() => {
    // Update form items when selections change
    const items = Array.from(selectedItems).map((itemId) => ({
      itemId,
      quantity: quantities[itemId] || 1,
    }));
    form.setValue("items", items, { shouldValidate: true });
  }, [selectedItems, quantities, form]);

  // Sync global user ID with form
  useEffect(() => {
    if (globalUserId) {
      form.setValue("userId", globalUserId, { shouldValidate: true });
    }
  }, [globalUserId, form]);

  // Handle item selection
  const handleSelectItem = useCallback(
    (itemId: string) => {
      toggleItemSelection(itemId);
    },
    [toggleItemSelection],
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
      console.log("=== BATCH FORM SUBMIT ===");
      console.log("Form data:", data);
      console.log("Selected items count:", data.items.length);

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

        console.log("Submitting batch borrows:", borrowsData);

        // Check if batchCreateAsync is available
        if (!batchCreateAsync) {
          console.error("batchCreateAsync is not available!");
          console.log("Available mutations:", batchMutations);

          // Try alternative methods
          if (batchMutations.batchCreate) {
            console.log("Using batchCreate instead");
            batchMutations.batchCreate({ borrows: borrowsData });
            return;
          } else if (batchMutations.batchCreateMutation?.mutateAsync) {
            console.log("Using batchCreateMutation.mutateAsync directly");
            const result = await batchMutations.batchCreateMutation.mutateAsync({ borrows: borrowsData });
            if (result.data) {
              openDialog(result.data);
              clearAllSelections();
              form.reset();
            }
            return;
          } else {
            console.error("No batch create method available!");
            alert("Erro interno: método de criação em lote não disponível");
            return;
          }
        }

        const result = await batchCreateAsync({ borrows: borrowsData });
        console.log("Batch create result:", result);

        if (result.data) {
          // Open dialog to show detailed results
          openDialog(result.data);

          // Clear selections after submission
          clearAllSelections();
          form.reset();
        }
      } catch (error) {
        console.error("=== BATCH CREATE ERROR ===");
        console.error("Full error object:", error);
        console.error("Error message:", (error as any)?.message);
        console.error("Error response:", (error as any)?.response);

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
      <div className="flex flex-col h-full space-y-4">
        <div className="flex-shrink-0">
          <PageHeaderWithFavorite
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
                  console.log("=== BATCH SUBMIT BUTTON CLICKED ===");
                  console.log("Form values:", form.getValues());
                  console.log("Form errors:", form.formState.errors);
                  console.log("Form is valid:", form.formState.isValid);
                  console.log("Selection count:", selectionCount);
                  console.log("Is submitting:", isSubmitting);
                  const handleSubmitFn = form.handleSubmit(onSubmit);
                  handleSubmitFn();
                },
                variant: "default",
                disabled: isSubmitting || selectionCount === 0 || !form.formState.isValid,
                loading: isSubmitting,
              },
            ]}
          />
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 min-h-0 flex flex-col">
            <Card className="flex-1 min-h-0 flex flex-col shadow-sm border border-border">
              <CardContent className="flex-1 flex flex-col p-6 space-y-4 overflow-hidden min-h-0">
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
                <div className="flex-1 min-h-0 overflow-y-auto">
                  <BorrowItemSelector
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
                    // Batch selection function for atomic updates
                    updateSelectedItems={urlState.batchUpdateSelection}
                    className="h-full"
                  />
                </div>
              </CardContent>
            </Card>
          </form>
        </Form>
      </div>

      {/* Batch Result Dialog */}
      <BorrowBatchResultDialog open={isOpen} onOpenChange={closeDialog} result={result} operationType="create" />
    </>
  );
};
