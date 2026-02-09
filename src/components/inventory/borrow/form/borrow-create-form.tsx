import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconLoader2, IconCheck, IconPackage, IconArrowLeft } from "@tabler/icons-react";
import { toast } from "sonner";

import { borrowCreateSchema, type BorrowCreateFormData } from "../../../../schemas";
import { useBorrowMutations, useItem } from "../../../../hooks";
import { routes, FAVORITE_PAGES } from "../../../../constants";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { Separator } from "@/components/ui/separator";

import { BorrowItemSelector } from "./item-selector";
import { BorrowUserSelector } from "./user-selector";
import { QuantityInput } from "./quantity-input";

export function BorrowCreateForm() {
  const navigate = useNavigate();

  const form = useForm<BorrowCreateFormData>({
    resolver: zodResolver(borrowCreateSchema),
    defaultValues: {
      quantity: 1,
    },
    mode: "onChange", // Add onChange mode for better validation feedback
  });

  const borrowMutations = useBorrowMutations({
    onCreateSuccess: (_data, _variables) => {
      // Success toast is handled automatically by API client
      navigate(routes.inventory.loans.list);
    },
  });

  const { createAsync, createMutation } = borrowMutations;

  // Watch itemId to get item details for validation
  const selectedItemId = form.watch("itemId");
  const { data: itemResponse } = useItem(selectedItemId || "", {
    enabled: !!selectedItemId,
  });
  const selectedItem = itemResponse?.data;

  const onSubmit = async (data: BorrowCreateFormData) => {
    try {
      // Additional validation before submission
      if (!selectedItem) {
        toast.error("Item selecionado não encontrado");
        return;
      }

      // Validate available stock
      if (data.quantity > selectedItem.quantity) {
        toast.error(`Quantidade disponível insuficiente. Máximo: ${selectedItem.quantity}`);
        form.setError("quantity", {
          type: "manual",
          message: `Máximo disponível: ${selectedItem.quantity}`,
        });
        return;
      }

      // Validate minimum quantity
      if (data.quantity <= 0) {
        toast.error("Quantidade deve ser maior que zero");
        form.setError("quantity", {
          type: "manual",
          message: "Quantidade deve ser maior que zero",
        });
        return;
      }

      // Validate if item is a tool (can be borrowed)
      if (selectedItem.itemCategory?.type !== "TOOL") {
        toast.error("Apenas ferramentas podem ser emprestadas");
        form.setError("itemId", {
          type: "manual",
          message: "Apenas ferramentas podem ser emprestadas",
        });
        return;
      }

      // Validate if item is active
      if (!selectedItem.isActive) {
        toast.error("Item inativo não pode ser emprestado");
        form.setError("itemId", {
          type: "manual",
          message: "Item inativo não pode ser emprestado",
        });
        return;
      }

      // Check if all required fields are present
      if (!data.itemId) {
        toast.error("Selecione um item");
        return;
      }

      if (!data.userId) {
        toast.error("Selecione um usuário");
        return;
      }

      // Use createAsync if available, otherwise try create
      if (createAsync) {
        await createAsync(data);
      } else if (borrowMutations.create) {
        borrowMutations.create(data);
      } else if (createMutation?.mutateAsync) {
        await createMutation.mutateAsync(data);
      } else {
        toast.error("Erro interno: método de criação não disponível");
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Borrow create error:", error);
        console.error("Error message:", (error as any)?.message);
        console.error("Error response:", (error as any)?.response);
      }

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
        <PageHeader
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
                const handleSubmitFn = form.handleSubmit(onSubmit);
                handleSubmitFn();
              },
              variant: "default",
              disabled: isSubmitting,
              loading: isSubmitting,
            },
          ]}
        />
      </div>

      <Card className="flex-1 min-h-0 flex flex-col">
        <CardHeader className="flex-shrink-0">
          <CardTitle>Novo Empréstimo</CardTitle>
          <CardDescription>Registre um novo empréstimo de ferramenta para um usuário</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col space-y-6 overflow-y-auto min-h-0">
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
