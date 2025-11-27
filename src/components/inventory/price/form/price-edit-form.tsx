import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { FormInput } from "@/components/ui/form-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePriceMutations, usePriceDetail } from "../../../../hooks";
import { priceUpdateSchema, type PriceUpdateFormData } from "../../../../schemas";
import { IconCurrencyReal, IconLoader } from "@tabler/icons-react";
import { formatDate } from "../../../../utils";

interface PriceEditFormProps {
  priceId: string;
  onSuccess?: (price: any) => void;
  onCancel?: () => void;
}

export function PriceEditForm({ priceId, onSuccess, onCancel }: PriceEditFormProps) {
  const { update } = usePriceMutations();

  const { data: priceResponse, isLoading } = usePriceDetail(priceId, {
    include: {
      item: true,
    },
  });

  const price = priceResponse?.data;

  const form = useForm<PriceUpdateFormData>({
    resolver: zodResolver(priceUpdateSchema),
    defaultValues: {
      value: price?.value || 0,
    },
  });

  // Update form when price data loads
  React.useEffect(() => {
    if (price) {
      form.reset({
        value: price.value,
      });
    }
  }, [price, form]);

  const onSubmit = async (data: PriceUpdateFormData) => {
    try {
      // Validate that price is positive
      if (data.value && data.value <= 0) {
        toast.error("O valor deve ser maior que zero");
        return;
      }

      const response = await update(priceId, data);

      if (response.success) {
        // Success toast is handled automatically by API client
        onSuccess?.(response.data);
      } else {
        toast.error(response.message || "Erro ao atualizar preço");
      }
    } catch (error: any) {
      console.error("Error updating price:", error);
      const errorMessage = error.response?.data?.message || error.message || "Erro ao atualizar preço";
      toast.error(errorMessage);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <IconLoader className="h-6 w-6 animate-spin" />
          <span className="ml-2">Carregando preço...</span>
        </CardContent>
      </Card>
    );
  }

  if (!price) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">Preço não encontrado</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconCurrencyReal className="h-5 w-5" />
          Editar Preço
        </CardTitle>
        <CardDescription>Atualizar o preço do item {price.item?.name}</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Price Info */}
        <div className="p-4 bg-muted rounded-lg space-y-2 mb-6">
          <h4 className="font-medium">Informações do Preço</h4>
          <p className="text-sm">Item: {price.item?.name}</p>
          {price.item?.uniCode && <p className="text-sm text-muted-foreground">Código: {price.item.uniCode}</p>}
          <p className="text-sm text-muted-foreground">Valor atual: R$ {price.value.toFixed(2).replace(".", ",")}</p>
          <p className="text-sm text-muted-foreground">Criado em: {formatDate(price.createdAt)}</p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Price Value */}
            <FormInput type="currency" name="value" label="Novo Valor do Preço" placeholder="R$ 0,00" required />

            {/* Form Actions */}
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={form.formState.isSubmitting} className="flex-1">
                {form.formState.isSubmitting ? "Atualizando..." : "Atualizar Preço"}
              </Button>
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
                  Cancelar
                </Button>
              )}
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
