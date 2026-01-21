import { useWatch } from "react-hook-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { useItems } from "../../../../hooks";

interface MaintenanceItemsManagerProps {
  control: any;
  fieldArray: any;
  disabled?: boolean;
}

export function MaintenanceItemsManager({ control, fieldArray, disabled = false }: MaintenanceItemsManagerProps) {
  const { fields, append, remove } = fieldArray;

  const { data: itemsResponse, isLoading } = useItems({
    take: 50,
    where: {
      isActive: true,
    },
    orderBy: {
      name: "asc",
    },
  });

  const items = itemsResponse?.data || [];
  const itemsNeeded = useWatch({ control, name: "itemsNeeded" }) || [];

  // Get already selected item IDs to filter them out
  const selectedItemIds = itemsNeeded.map((item: any) => item.itemId).filter(Boolean);

  const addItem = () => {
    append({
      itemId: "",
      quantity: 1,
    });
  };

  const removeItem = (index: number) => {
    remove(index);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Itens Necessários</CardTitle>
        <CardDescription>Selecione os itens que serão utilizados nesta manutenção</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.map((field: any, index: number) => {
          // Create options for the combobox, excluding already selected items
          const availableItems = items.filter((item) => !selectedItemIds.includes(item.id) || item.id === itemsNeeded[index]?.itemId);

          const itemOptions = availableItems.map((item) => ({
            value: item.id,
            label: item.name,
            sublabel: item.uniCode ? `Código: ${item.uniCode}` : undefined,
            badge: `Estoque: ${item.quantity || 0}`,
          }));

          return (
            <div key={field.id} className="flex items-end gap-4 p-4 border rounded-lg bg-muted/20">
              {/* Item Selector */}
              <div className="flex-1 min-w-0">
                <FormField
                  control={control}
                  name={`itemsNeeded.${index}.itemId`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Item</FormLabel>
                      <FormControl>
                        <Combobox
                          options={itemOptions}
                          value={field.value || ""}
                          onValueChange={field.onChange}
                          placeholder="Selecione um item"
                          searchable
                          disabled={disabled || isLoading}
                          emptyText={isLoading ? "Carregando..." : "Nenhum item encontrado"}
                          className="w-full"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Quantity Input */}
              <div className="w-32">
                <FormField
                  control={control}
                  name={`itemsNeeded.${index}.quantity`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Quantidade</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          placeholder="Quantidade"
                          disabled={disabled}
                          ref={field.ref}
                          value={field.value || ""}
                          onChange={(value: string) => field.onChange(Number(value) || 1)}
                          onBlur={field.onBlur}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Remove Button */}
              <Button type="button" variant="outline" size="icon" onClick={() => removeItem(index)} disabled={disabled} className="text-destructive hover:text-destructive">
                <IconTrash className="h-4 w-4" />
              </Button>
            </div>
          );
        })}

        {fields.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhum item adicionado</p>
            <p className="text-sm">Clique em "Adicionar Item" para incluir itens necessários para esta manutenção</p>
          </div>
        )}

        <Button type="button" variant="outline" onClick={addItem} disabled={disabled} className="w-full">
          <IconPlus className="mr-2 h-4 w-4" />
          Adicionar Item
        </Button>

        {fields.length > 0 && (
          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">
              <strong>Dica:</strong> Os itens selecionados serão consumidos do estoque quando a manutenção for concluída. Verifique se há quantidade suficiente em estoque antes de
              agendar a manutenção.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
