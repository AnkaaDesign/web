import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { IconCalculator, IconScale, IconPlus, IconX } from "@tabler/icons-react";
import { measureUtils } from "../../../utils";
import { MEASURE_UNIT } from "../../../constants";
import type { PaintFormulaComponent, Item } from "../../../types";

// Form validation schema
const componentFormSchema = z.object({
  itemId: z.string().min(1, "Selecione um item"),
  weightInGrams: z
    .number()
    .min(0.1, "Peso mínimo é 0.1 gramas")
    .max(10000, "Peso máximo é 10kg")
    .refine((value) => Number.isFinite(value) && value > 0, {
      message: "Peso deve ser um número válido maior que zero",
    }),
});

type ComponentFormData = z.infer<typeof componentFormSchema>;

interface ComponentFormProps {
  component?: PaintFormulaComponent;
  availableItems: Item[];
  onSubmit: (data: ComponentFormData) => void;
  onCancel: () => void;
  isEditing?: boolean;
  selectedComponentIds?: string[]; // IDs of items already selected as components
}

export function ComponentForm({ component, availableItems = [], onSubmit, onCancel, isEditing = false, selectedComponentIds = [] }: ComponentFormProps) {
  const form = useForm<ComponentFormData>({
    resolver: zodResolver(componentFormSchema),
    defaultValues: {
      itemId: component?.itemId || "",
      weightInGrams: component ? component.ratio * 10 : 100, // Default 100g for new components
    },
  });

  const selectedItem = availableItems.find((item) => item.id === form.watch("itemId"));
  const weightInGrams = form.watch("weightInGrams");

  // Filter out already selected items (except current component being edited) and sort by unicode
  const filteredAndSortedItems = useMemo(() => {
    return availableItems
      .filter((item) => {
        // If editing, allow the current component's item to be selectable
        if (isEditing && component?.itemId === item.id) {
          return true;
        }
        // Filter out items that are already selected as components
        return !selectedComponentIds.includes(item.id);
      })
      .sort((a, b) => {
        // Sort by unicode first, then by name if unicode is not available
        const aUnicode = a.uniCode || "";
        const bUnicode = b.uniCode || "";

        if (aUnicode && bUnicode) {
          return aUnicode.localeCompare(bUnicode);
        }
        if (aUnicode && !bUnicode) return -1;
        if (!aUnicode && bUnicode) return 1;

        // If both don't have unicode, sort by name
        return a.name.localeCompare(b.name);
      });
  }, [availableItems, selectedComponentIds, isEditing, component?.itemId]);

  // Create combobox options with unicode - name format
  const comboboxOptions: ComboboxOption[] = useMemo(() => {
    return filteredAndSortedItems.map((item) => ({
      value: item.id,
      label: item.uniCode ? `${item.uniCode} - ${item.name}` : item.name,
    }));
  }, [filteredAndSortedItems]);

  const handleItemSelect = (itemId: string) => {
    const item = availableItems.find((i) => i.id === itemId);
    form.setValue("itemId", itemId);

    // Pre-fill weight based on item's measure unit
    if (item) {
      const weightMeasure = item.measures?.find((m) => m.measureType === "WEIGHT" && m.unit === MEASURE_UNIT.GRAM);
      if (weightMeasure) {
        // Default to a reasonable amount based on the item's unit weight
        form.setValue("weightInGrams", Math.min(weightMeasure.value || 0, 1000)); // Max 1kg default
      }
    }
  };

  const handleSubmit = (data: ComponentFormData) => {
    onSubmit(data);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isEditing ? (
            <>
              <IconCalculator className="h-5 w-5" />
              Editar Componente
            </>
          ) : (
            <>
              <IconPlus className="h-5 w-5" />
              Adicionar Componente
            </>
          )}
        </CardTitle>
        <CardDescription>Informe o peso do componente em gramas</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Item Selection */}
            <FormField
              control={form.control}
              name="itemId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Item</FormLabel>
                  <FormControl>
                    <Combobox
                      options={comboboxOptions}
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value || "");
                        if (value) {
                          handleItemSelect(value);
                        }
                      }}
                      placeholder="Selecione um item..."
                      emptyText="Nenhum item disponível"
                      searchable={true}
                      disabled={comboboxOptions.length === 0}
                    />
                  </FormControl>
                  <FormMessage />
                  {comboboxOptions.length === 0 && <p className="text-xs text-muted-foreground mt-1">Todos os itens disponíveis já foram adicionados como componentes</p>}
                </FormItem>
              )}
            />

            {/* Selected Item Info */}
            {selectedItem && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-sm">
                  <strong>Item selecionado:</strong> {selectedItem.uniCode && <span className="font-mono text-blue-600">[{selectedItem.uniCode}]</span>} {selectedItem.name}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Estoque: {selectedItem.quantity} {selectedItem.measures?.[0]?.unit || "un"}
                  {selectedItem.measures?.find((m) => m.measureType === "WEIGHT") && (
                    <span className="ml-2">
                      <span className="font-enhanced-unicode">•</span> Peso por unidade: {selectedItem.measures.find((m) => m.measureType === "WEIGHT")?.value}g
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Weight Input */}
            <FormField
              control={form.control}
              name="weightInGrams"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <IconScale className="h-4 w-4" />
                    Peso em Gramas
                    <span className="text-destructive ml-1">*</span>
                  </FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="10000"
                        {...field}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                          const value = e.target.value;
                          if (value === "") {
                            field.onChange("");
                            return;
                          }
                          const numValue = Number(value);
                          if (!isNaN(numValue)) {
                            field.onChange(numValue);
                          }
                        }}
                        placeholder="Ex: 250"
                        className="flex-1"
                      />
                      <div className="px-3 py-2 bg-muted rounded-md text-sm">g</div>
                    </div>
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground mt-1">O sistema calculará automaticamente a proporção deste componente na fórmula</p>
                </FormItem>
              )}
            />

            {/* Weight Summary */}
            {weightInGrams && weightInGrams > 0 && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-sm font-medium mb-2">Resumo:</div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    <IconScale className="h-3 w-3 mr-1" />
                    {measureUtils.formatMeasure({
                      value: weightInGrams,
                      unit: MEASURE_UNIT.GRAM,
                    })}
                  </Badge>
                  {weightInGrams >= 1000 && <Badge variant="outline">({(weightInGrams / 1000).toFixed(2)} kg)</Badge>}
                </div>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">
                {isEditing ? "Salvar Alterações" : "Adicionar Componente"}
              </Button>
              <Button type="button" variant="outline" onClick={onCancel}>
                <IconX className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
