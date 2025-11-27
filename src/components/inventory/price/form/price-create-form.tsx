import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { FormInput } from "@/components/ui/form-input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { usePriceMutations } from "../../../../hooks";
import { useItemList } from "../../../../hooks";
import { priceCreateSchema, type PriceCreateFormData } from "../../../../schemas";
import { IconCurrencyReal, IconPackage } from "@tabler/icons-react";
import type { Item } from "../../../../types";

interface PriceCreateFormProps {
  itemId?: string;
  onSuccess?: (price: any) => void;
  onCancel?: () => void;
}

export function PriceCreateForm({ itemId, onSuccess, onCancel }: PriceCreateFormProps) {
  const { create } = usePriceMutations();

  // Fetch items for selection if no itemId provided
  const { data: itemsResponse } = useItemList(
    {
      orderBy: { name: "asc" },
      where: { status: { equals: "ACTIVE" } },
    },
    {
      enabled: !itemId,
    },
  );

  const items = itemsResponse?.data || [];

  const form = useForm<PriceCreateFormData>({
    resolver: zodResolver(priceCreateSchema),
    defaultValues: {
      itemId: itemId || "",
      value: 0,
    },
  });

  const selectedItemId = form.watch("itemId");
  const selectedItem = items.find((item: Item) => item.id === selectedItemId);

  const onSubmit = async (data: PriceCreateFormData) => {
    try {
      // Validate item selection
      if (!data.itemId) {
        toast.error("Selecione um item");
        return;
      }

      const response = await create(data);

      if (response.success) {
        // Success toast is handled automatically by API client
        form.reset();
        onSuccess?.(response.data);
      } else {
        toast.error(response.message || "Erro ao criar preço");
      }
    } catch (error: any) {
      console.error("Error creating price:", error);
      const errorMessage = error.response?.data?.message || error.message || "Erro ao criar preço";
      toast.error(errorMessage);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconCurrencyReal className="h-5 w-5" />
          Novo Preço
        </CardTitle>
        <CardDescription>{itemId ? "Adicionar novo preço para o item selecionado" : "Adicionar novo preço para um item"}</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Item Selection - only show if itemId not provided */}
            {!itemId && (
              <FormField
                control={form.control}
                name="itemId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <IconPackage className="h-4 w-4 text-muted-foreground" />
                      Item
                      <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Combobox
                        options={items.map((item: Item) => ({
                          value: item.id,
                          label: `${item.name}${item.uniCode ? ` (${item.uniCode})` : ""}`,
                          description: item.description || undefined,
                        }))}
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="Selecionar item..."
                        searchable
                        emptyText="Nenhum item encontrado"
                        className="w-full"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Current Price Display */}
            {selectedItem && (
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <h4 className="font-medium">Item Selecionado</h4>
                <p className="text-sm">{selectedItem.name}</p>
                {selectedItem.uniCode && <p className="text-sm text-muted-foreground">Código: {selectedItem.uniCode}</p>}
                {selectedItem.prices && selectedItem.prices.length > 0 && (
                  <p className="text-sm text-muted-foreground">Preço atual: R$ {selectedItem.prices[0].value.toFixed(2).replace(".", ",")}</p>
                )}
              </div>
            )}

            {/* Price Value */}
            <FormInput name="value" type="currency" label="Valor do Preço" placeholder="R$ 0,00" required />

            {/* Form Actions */}
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={form.formState.isSubmitting} className="flex-1">
                {form.formState.isSubmitting ? "Criando..." : "Criar Preço"}
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
