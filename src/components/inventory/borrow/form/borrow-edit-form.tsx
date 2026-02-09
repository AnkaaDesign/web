import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconLoader2, IconCheck, IconPackage, IconArrowLeft } from "@tabler/icons-react";
import { toast } from "sonner";

import { borrowUpdateSchema, type BorrowUpdateFormData, mapBorrowToFormData } from "../../../../schemas";
import { useBorrowMutations, useItem } from "../../../../hooks";
import { routes, FAVORITE_PAGES, BORROW_STATUS } from "../../../../constants";
import { formatDateTime } from "../../../../utils";
import type { Borrow } from "../../../../types";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { PageHeader } from "@/components/ui/page-header";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

import { BorrowItemSelector } from "./item-selector";
import { BorrowUserSelector } from "./user-selector";
import { QuantityInput } from "./quantity-input";
import { ReturnDateInput } from "./return-date-input";

interface BorrowEditFormProps {
  borrow: Borrow & {
    item?: { name: string; uniCode?: string; quantity: number; measureUnit?: string; isActive: boolean; itemCategory?: { name: string; type: string } };
    user?: { name: string; email?: string; status: string };
  };
}

export function BorrowEditForm({ borrow }: BorrowEditFormProps) {
  const navigate = useNavigate();

  const form = useForm<BorrowUpdateFormData>({
    resolver: zodResolver(borrowUpdateSchema),
    defaultValues: mapBorrowToFormData(borrow),
  });

  const { updateAsync, updateMutation } = useBorrowMutations({
    onUpdateSuccess: () => {
      // Success toast is handled automatically by API client
      navigate(routes.inventory.loans.details(borrow.id));
    },
  });

  // Watch itemId to get item details for validation
  const selectedItemId = form.watch("itemId") || borrow.itemId;
  const { data: itemResponse } = useItem(selectedItemId, {
    enabled: !!selectedItemId,
  });
  const selectedItem = itemResponse?.data;

  const onSubmit = async (data: BorrowUpdateFormData) => {
    try {
      // Additional validation before submission
      if (data.itemId && selectedItem) {
        // Validate available stock (considering current borrowed quantity)
        const availableQuantity = selectedItem.quantity + borrow.quantity;
        if (data.quantity && data.quantity > availableQuantity) {
          toast.error(`Quantidade disponível insuficiente. Máximo: ${availableQuantity}`);
          form.setError("quantity", {
            type: "manual",
            message: `Máximo disponível: ${availableQuantity}`,
          });
          return;
        }

        // Validate minimum quantity
        if (data.quantity && data.quantity <= 0) {
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
      }

      // Validate return date
      if (data.returnedAt) {
        const returnDate = new Date(data.returnedAt);
        const borrowDate = new Date(borrow.createdAt);

        if (returnDate < borrowDate) {
          toast.error("Data de devolução não pode ser anterior à data do empréstimo");
          form.setError("returnedAt", {
            type: "manual",
            message: "Data não pode ser anterior à data do empréstimo",
          });
          return;
        }

        if (returnDate > new Date()) {
          toast.error("Data de devolução não pode ser no futuro");
          form.setError("returnedAt", {
            type: "manual",
            message: "Data não pode ser no futuro",
          });
          return;
        }
      }

      await updateAsync({ id: borrow.id, data });
    } catch (error) {
      // Error is handled by the mutation hook
      if (process.env.NODE_ENV !== "production") {
        console.error("Error updating borrow:", error);
      }
    }
  };

  const handleCancel = () => {
    navigate(routes.inventory.loans.details(borrow.id));
  };

  const isSubmitting = updateMutation.isPending;
  const isReturned = borrow.status === BORROW_STATUS.RETURNED || borrow.returnedAt !== null;

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex-shrink-0">
        <PageHeader
          title="Editar Empréstimo"
          icon={IconPackage}
          favoritePage={FAVORITE_PAGES.ESTOQUE_EMPRESTIMOS_CADASTRAR}
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Estoque", href: "/estoque" },
            { label: "Empréstimos", href: routes.inventory.loans.list },
            { label: "Detalhes", href: routes.inventory.loans.details(borrow.id) },
            { label: "Editar" },
          ]}
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
              label: "Salvar Alterações",
              icon: isSubmitting ? IconLoader2 : IconCheck,
              onClick: form.handleSubmit(onSubmit),
              variant: "default",
              disabled: isSubmitting,
              loading: isSubmitting,
            },
          ]}
        />
      </div>

      <Card className="flex-1 min-h-0">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Editar Empréstimo</CardTitle>
              <CardDescription>Empréstimo criado em {formatDateTime(borrow.createdAt)}</CardDescription>
            </div>
            <Badge variant={isReturned ? "secondary" : "default"}>{isReturned ? "Devolvido" : "Ativo"}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              {/* Item Selection */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Item</h3>
                <BorrowItemSelector control={form.control} selectedItemId={selectedItemId} disabled={isSubmitting || isReturned} />
              </div>

              <Separator />

              {/* Quantity */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Quantidade</h3>
                <QuantityInput
                  control={form.control}
                  label="Quantidade emprestada"
                  selectedItemId={selectedItemId}
                  currentQuantity={borrow.quantity}
                  disabled={isSubmitting || isReturned}
                />
              </div>

              <Separator />

              {/* User Selection */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Usuário Responsável</h3>
                <BorrowUserSelector control={form.control} disabled={isSubmitting || isReturned} />
              </div>

              <Separator />

              {/* Return Date */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Data de Devolução</h3>
                <ReturnDateInput control={form.control} disabled={isSubmitting} />
              </div>

              {/* Form validation summary */}
              {selectedItem && (
                <div className="rounded-lg bg-muted/50 p-4 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">Item selecionado:</span> {selectedItem.name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">Quantidade disponível:</span> {selectedItem.quantity + borrow.quantity} {selectedItem.measureUnit || "unidade(s)"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">Categoria:</span> {selectedItem.itemCategory?.name || "N/A"}
                  </p>
                  {selectedItem.itemCategory?.type !== "TOOL" && <p className="text-sm text-destructive">⚠️ Apenas ferramentas podem ser emprestadas</p>}
                  {isReturned && <p className="text-sm text-green-600">✓ Este empréstimo foi devolvido em {formatDateTime(borrow.returnedAt!)}</p>}
                </div>
              )}

              {isReturned && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                  <p className="text-sm text-amber-800">
                    <span className="font-medium">Aviso:</span> Este empréstimo já foi devolvido. Algumas alterações podem não ser permitidas.
                  </p>
                </div>
              )}
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
