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
import { IconCalculator, IconScale, IconPlus, IconX, IconAlertCircle, IconPercentage } from "@tabler/icons-react";
import { measureUtils } from "../../../utils";
import { MEASURE_UNIT } from "../../../constants";
import type { PaintFormulaComponent, Item } from "../../../types";
import { Alert, AlertDescription } from "@/components/ui/alert";

// Enhanced form validation schema that matches the server-side schema
const componentFormSchema = z.object({
  itemId: z.string().uuid("ID do item inválido").min(1, "Selecione um item"),
  ratio: z
    .number()
    .positive("Proporção deve ser positiva")
    .min(0.1, "Proporção mínima é 0.1%")
    .max(100, "Proporção máxima é 100%")
    .refine((value) => Number.isFinite(value) && value > 0, {
      message: "Proporção deve ser um número válido maior que zero",
    }),
  weightInGrams: z
    .number()
    .min(0.1, "Peso mínimo é 0.1 gramas")
    .max(10000, "Peso máximo é 10kg")
    .refine((value) => Number.isFinite(value) && value > 0, {
      message: "Peso deve ser um número válido maior que zero",
    })
    .optional(), // This is used for reference but ratio is the primary field
});

type ComponentFormData = z.infer<typeof componentFormSchema>;

interface ComponentFormProps {
  component?: PaintFormulaComponent;
  availableItems: Item[];
  onSubmit: (data: ComponentFormData) => void;
  onCancel: () => void;
  isEditing?: boolean;
  selectedComponentIds?: string[]; // IDs of items already selected as components
  existingComponents?: PaintFormulaComponent[]; // For ratio validation
  totalFormulaDensity?: number; // For weight calculations
}

export function ComponentForm({
  component,
  availableItems = [],
  onSubmit,
  onCancel,
  isEditing = false,
  selectedComponentIds = [],
  existingComponents = [],
  totalFormulaDensity = 1.0,
}: ComponentFormProps) {
  const form = useForm<ComponentFormData>({
    resolver: zodResolver(componentFormSchema),
    defaultValues: {
      itemId: component?.itemId || "",
      ratio: component?.ratio || 10, // Default 10% for new components
      weightInGrams: component ? component.ratio * 10 : 100, // Default 100g for new components
    },
  });

  const selectedItem = availableItems.find((item) => item.id === form.watch("itemId"));
  const weightInGrams = form.watch("weightInGrams");
  const ratio = form.watch("ratio");

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

  // Calculate remaining ratio available
  const remainingRatio = useMemo(() => {
    const usedRatio = existingComponents.filter((comp) => !isEditing || comp.id !== component?.id).reduce((sum, comp) => sum + (comp.ratio || 0), 0);
    return 100 - usedRatio;
  }, [existingComponents, isEditing, component?.id]);

  // Calculate estimated weight from ratio
  const estimatedWeight = useMemo(() => {
    if (!ratio || ratio <= 0) return 0;
    // Assume 1L base volume for calculation (1000ml * density * ratio%)
    return (1000 * totalFormulaDensity * ratio) / 100;
  }, [ratio, totalFormulaDensity]);

  const handleItemSelect = (itemId: string) => {
    const item = availableItems.find((i) => i.id === itemId);
    form.setValue("itemId", itemId);

    // Pre-fill ratio based on item's characteristics or keep current ratio
    if (item && !isEditing) {
      // For new components, suggest a reasonable ratio
      const suggestedRatio = Math.min(remainingRatio, 15); // Suggest up to 15% or remaining
      if (suggestedRatio > 0) {
        form.setValue("ratio", suggestedRatio);
      }
    }
  };

  const handleRatioChange = (value: number) => {
    if (!value || value === 0) {
      form.setValue("ratio", 0);
      form.setValue("weightInGrams", 0);
      return;
    }
    form.setValue("ratio", value);
    // Update estimated weight based on ratio
    const estimatedWeight = (1000 * totalFormulaDensity * value) / 100;
    form.setValue("weightInGrams", estimatedWeight);
  };

  const handleSubmit = (data: ComponentFormData) => {
    // Ensure we're sending the ratio as the primary data
    const submitData = {
      itemId: data.itemId,
      ratio: data.ratio,
      weightInGrams: estimatedWeight, // Include calculated weight for reference
    };
    onSubmit(submitData);
  };

  // Validation warnings
  const validationWarnings = useMemo(() => {
    const warnings: string[] = [];

    if (selectedItem && !selectedItem.quantity) {
      warnings.push("Item não tem estoque registrado");
    }

    if (selectedItem && selectedItem.quantity && selectedItem.quantity <= 0) {
      warnings.push("Item está sem estoque");
    }

    if (ratio && ratio > remainingRatio) {
      warnings.push(`Proporção excede o disponível. Máximo: ${remainingRatio.toFixed(1)}%`);
    }

    if (ratio && ratio < 0.1) {
      warnings.push("Proporção muito baixa. Mínimo: 0.1%");
    }

    if (estimatedWeight > 5000) {
      warnings.push("Peso estimado muito alto - verifique a proporção");
    }

    return warnings;
  }, [selectedItem, ratio, remainingRatio, estimatedWeight]);

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
        <CardDescription>Informe a proporção do componente na fórmula (% em peso)</CardDescription>
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
                  <FormLabel>
                    Item
                    <span className="text-destructive ml-1">*</span>
                  </FormLabel>
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

            {/* Ratio Input */}
            <FormField
              control={form.control}
              name="ratio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <IconPercentage className="h-4 w-4" />
                    Proporção na Fórmula
                    <span className="text-destructive ml-1">*</span>
                  </FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <Input
                        type="decimal"
                        value={field.value}
                        onChange={(value) => {
                          field.onChange(value);
                          handleRatioChange(value);
                        }}
                        placeholder="Ex: 15,5"
                        className="flex-1"
                      />
                      <div className="px-3 py-2 bg-muted rounded-md text-sm">%</div>
                    </div>
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground mt-1">Disponível: {remainingRatio.toFixed(1).replace(".", ",")}% | A proporção representa o percentual em peso na fórmula final</p>
                </FormItem>
              )}
            />

            {/* Estimated Weight Display */}
            {ratio && ratio > 0 && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="text-sm font-medium mb-2 text-blue-900">Peso Estimado (para 1L de fórmula):</div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    <IconScale className="h-3 w-3 mr-1" />
                    {measureUtils.formatMeasure({
                      value: estimatedWeight,
                      unit: MEASURE_UNIT.GRAM,
                    })}
                  </Badge>
                  {estimatedWeight >= 1000 && <Badge variant="outline">({(estimatedWeight / 1000).toFixed(2)} kg)</Badge>}
                </div>
                <p className="text-xs text-blue-700 mt-1">Este é o peso estimado do componente para produzir 1 litro da fórmula</p>
              </div>
            )}

            {/* Validation Warnings */}
            {validationWarnings.length > 0 && (
              <Alert>
                <IconAlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <ul className="list-disc list-inside space-y-1">
                    {validationWarnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            {/* Form Actions */}
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={!form.formState.isValid || ratio > remainingRatio || ratio < 0.1}>
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
