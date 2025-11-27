import React from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconLoader2, IconCheck, IconPackage, IconArrowLeft } from "@tabler/icons-react";
import { toast } from "sonner";

import { borrowCreateSchema, type BorrowCreateFormData } from "../../../../schemas";
import { useBorrowMutations, useItem } from "../../../../hooks";
import { routes, FAVORITE_PAGES } from "../../../../constants";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { Separator } from "@/components/ui/separator";

import { BorrowItemSelector } from "./item-selector";
import { BorrowUserSelector } from "./user-selector";
import { QuantityInput } from "./quantity-input";

export function BorrowCreateForm() {
  const navigate = useNavigate();

  console.log("=== BorrowCreateForm component rendered ===");

  const form = useForm<BorrowCreateFormData>({
    resolver: zodResolver(borrowCreateSchema),
    defaultValues: {
      quantity: 1,
    },
    mode: "onChange", // Add onChange mode for better validation feedback
  });

  const borrowMutations = useBorrowMutations({
    onCreateSuccess: (data, variables) => {
      console.log("=== CREATE SUCCESS ===");
      console.log("Response:", data);
      console.log("Variables:", variables);
      // Success toast is handled automatically by API client
      navigate(routes.inventory.loans.list);
    },
  });

  console.log("=== BORROW MUTATIONS HOOK RESULT ===");
  console.log("borrowMutations:", borrowMutations);
  console.log("Has createAsync?", "createAsync" in borrowMutations);
  console.log("Has create?", "create" in borrowMutations);
  console.log("Has createMutation?", "createMutation" in borrowMutations);
  console.log("Available methods:", Object.keys(borrowMutations));

  const { createAsync, createMutation } = borrowMutations;

  // Watch itemId to get item details for validation
  const selectedItemId = form.watch("itemId");
  const { data: itemResponse } = useItem(selectedItemId || "", {
    enabled: !!selectedItemId,
  });
  const selectedItem = itemResponse?.data;

  const onSubmit = async (data: BorrowCreateFormData) => {
    console.log("=== BORROW FORM SUBMISSION ===");
    console.log("Form data:", data);
    console.log("Selected item:", selectedItem);

    try {
      // Additional validation before submission
      if (!selectedItem) {
        console.error("No selected item found");
        toast.error("Item selecionado não encontrado");
        return;
      }

      // Validate available stock
      if (data.quantity > selectedItem.quantity) {
        console.error(`Insufficient stock. Available: ${selectedItem.quantity}, Requested: ${data.quantity}`);
        toast.error(`Quantidade disponível insuficiente. Máximo: ${selectedItem.quantity}`);
        form.setError("quantity", {
          type: "manual",
          message: `Máximo disponível: ${selectedItem.quantity}`,
        });
        return;
      }

      // Validate minimum quantity
      if (data.quantity <= 0) {
        console.error("Quantity must be greater than zero");
        toast.error("Quantidade deve ser maior que zero");
        form.setError("quantity", {
          type: "manual",
          message: "Quantidade deve ser maior que zero",
        });
        return;
      }

      // Validate if item is a tool (can be borrowed)
      if (selectedItem.itemCategory?.type !== "TOOL") {
        console.error("Item is not a tool:", selectedItem.itemCategory?.type);
        toast.error("Apenas ferramentas podem ser emprestadas");
        form.setError("itemId", {
          type: "manual",
          message: "Apenas ferramentas podem ser emprestadas",
        });
        return;
      }

      // Validate if item is active
      if (!selectedItem.isActive) {
        console.error("Item is inactive");
        toast.error("Item inativo não pode ser emprestado");
        form.setError("itemId", {
          type: "manual",
          message: "Item inativo não pode ser emprestado",
        });
        return;
      }

      // Check if all required fields are present
      if (!data.itemId) {
        console.error("Missing itemId");
        toast.error("Selecione um item");
        return;
      }

      if (!data.userId) {
        console.error("Missing userId");
        toast.error("Selecione um usuário");
        return;
      }

      console.log("All validations passed, calling create function with:", data);

      // Use createAsync if available, otherwise try create
      if (createAsync) {
        console.log("Using createAsync");
        const result = await createAsync(data);
        console.log("Create result:", result);
      } else if (borrowMutations.create) {
        console.log("Using create (no createAsync available)");
        borrowMutations.create(data);
      } else if (createMutation?.mutateAsync) {
        console.log("Using createMutation.mutateAsync directly");
        const result = await createMutation.mutateAsync(data);
        console.log("Create result:", result);
      } else {
        console.error("No create method available!");
        toast.error("Erro interno: método de criação não disponível");
      }
    } catch (error) {
      // Log the full error details
      console.error("=== BORROW CREATE ERROR ===");
      console.error("Full error object:", error);
      console.error("Error message:", (error as any)?.message);
      console.error("Error response:", (error as any)?.response);

      // Show a more detailed error message
      const errorMessage = (error as any)?.response?.data?.message || (error as any)?.message || "Erro ao criar empréstimo";
      toast.error(`Erro: ${errorMessage}`);
    }
  };

  const handleCancel = () => {
    navigate(routes.inventory.loans.list);
  };

  const isSubmitting = createMutation.isPending;

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex-shrink-0">
        <PageHeaderWithFavorite
          title="Criar Empréstimo"
          icon={IconPackage}
          favoritePage={FAVORITE_PAGES.ESTOQUE_EMPRESTIMOS_CADASTRAR}
          breadcrumbs={[{ label: "Início", href: "/" }, { label: "Estoque", href: "/estoque" }, { label: "Empréstimos", href: routes.inventory.loans.list }, { label: "Criar" }]}
          actions={[
            {
              key: "cancel",
              label: "Cancelar",
              icon: IconArrowLeft,
              onClick: handleCancel,
              variant: "outline",
              disabled: isSubmitting,
            },
            {
              key: "submit",
              label: "Criar Empréstimo",
              icon: isSubmitting ? IconLoader2 : IconCheck,
              onClick: () => {
                console.log("=== SUBMIT BUTTON CLICKED ===");
                console.log("Form values:", form.getValues());
                console.log("Form errors:", form.formState.errors);
                console.log("Form is valid:", form.formState.isValid);
                const handleSubmitFn = form.handleSubmit(onSubmit);
                console.log("handleSubmit function created");
                handleSubmitFn();
              },
              variant: "default",
              disabled: isSubmitting,
              loading: isSubmitting,
            },
          ]}
        />
      </div>

      <Card className="flex-1 min-h-0">
        <CardHeader>
          <CardTitle>Novo Empréstimo</CardTitle>
          <CardDescription>Registre um novo empréstimo de ferramenta para um usuário</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {/* Item Selection */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Seleção do Item</h3>
                <BorrowItemSelector control={form.control} selectedItemId={selectedItemId} disabled={isSubmitting} />
              </div>

              <Separator />

              {/* Quantity */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Quantidade</h3>
                <QuantityInput control={form.control} label="Quantidade a emprestar" selectedItemId={selectedItemId} disabled={isSubmitting} />
              </div>

              <Separator />

              {/* User Selection */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Usuário Responsável</h3>
                <BorrowUserSelector control={form.control} disabled={isSubmitting} />
              </div>

              {/* Form validation summary */}
              {selectedItem && (
                <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">Item selecionado:</span> {selectedItem.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">Quantidade disponível:</span> {selectedItem.quantity} {selectedItem.measureUnit || "unidade(s)"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">Categoria:</span> {selectedItem.itemCategory?.name || "N/A"}
                  </p>
                  {selectedItem.itemCategory?.type !== "TOOL" && <p className="text-sm text-destructive">⚠️ Apenas ferramentas podem ser emprestadas</p>}
                </div>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
