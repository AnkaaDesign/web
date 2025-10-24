import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useFieldArray, useWatch } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { IconPlus, IconTrash } from "@tabler/icons-react";
import { Input } from "@/components/ui/input";
import { FormMoneyInput } from "@/components/ui/form-money-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { NaturalFloatInput } from "@/components/ui/natural-float-input";

interface TemporaryItemsInputProps {
  control: any;
  disabled?: boolean;
  onItemCountChange?: (count: number) => void;
}

export interface TemporaryItemsInputRef {
  addItem: () => void;
}

export const TemporaryItemsInput = forwardRef<
  TemporaryItemsInputRef,
  TemporaryItemsInputProps
>(({ control, disabled, onItemCountChange }, ref) => {
  const [initialized, setInitialized] = useState(false);
  const lastRowRef = useRef<HTMLDivElement>(null);

  const { fields, append, remove } = useFieldArray({
    control,
    name: "temporaryItems",
  });

  // Watch temporary items values to check for incomplete entries
  const temporaryItemsValues = useWatch({
    control,
    name: "temporaryItems",
  });

  // Check if any temporary item is incomplete
  const hasIncompleteItems = useMemo(() => {
    if (!temporaryItemsValues || temporaryItemsValues.length === 0) return false;
    return temporaryItemsValues.some((item: any) =>
      !item.temporaryItemDescription || item.temporaryItemDescription.trim() === "" ||
      !item.orderedQuantity || item.orderedQuantity <= 0 ||
      item.price === undefined || item.price === null || item.price < 0
    );
  }, [temporaryItemsValues]);

  // Initialize with no rows by default (optional field)
  useEffect(() => {
    if (!initialized) {
      setInitialized(true);
    }
  }, [initialized]);

  // Notify parent about count changes
  useEffect(() => {
    if (onItemCountChange) {
      onItemCountChange(fields.length);
    }
  }, [fields.length, onItemCountChange]);

  const handleAddItem = useCallback(() => {
    append({
      temporaryItemDescription: "",
      orderedQuantity: 1,
      price: null,
      tax: 0,
    });

    // Focus on the new input after adding
    setTimeout(() => {
      const descriptionInput = lastRowRef.current?.querySelector(
        'input[name^="temporaryItems."][name$=".temporaryItemDescription"]',
      ) as HTMLInputElement;
      descriptionInput?.focus();
    }, 100);
  }, [append]);

  // Expose methods via ref
  useImperativeHandle(
    ref,
    () => ({
      addItem: handleAddItem,
    }),
    [handleAddItem],
  );

  const canRemove = fields.length > 0;

  return (
    <div className="space-y-4">
      {fields.length > 0 && (
        <div className="space-y-3">
          {fields.map((field, index) => (
            <div
              key={field.id}
              ref={index === fields.length - 1 ? lastRowRef : null}
              className="border rounded-lg p-4 space-y-4"
            >
              {/* Description Field - Full Width */}
              <FormField
                control={control}
                name={`temporaryItems.${index}.temporaryItemDescription`}
                render={({ field }) => (
                  <FormItem>
                    {index === 0 && <FormLabel>Descrição do Item</FormLabel>}
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value || ""}
                        placeholder="Ex: Parafuso 5mm, Material de consumo"
                        disabled={disabled}
                        className="bg-transparent"
                        maxLength={500}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Quantity, Price, and Tax in Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Quantity Field */}
                <FormField
                  control={control}
                  name={`temporaryItems.${index}.orderedQuantity`}
                  render={({ field }) => (
                    <FormItem>
                      {index === 0 && <FormLabel>Quantidade</FormLabel>}
                      <FormControl>
                        <NaturalFloatInput
                          {...field}
                          value={field.value || 1}
                          onChange={(value) => field.onChange(value)}
                          min={0.01}
                          max={999999}
                          step={0.01}
                          placeholder="1"
                          disabled={disabled}
                          className="bg-transparent"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Price Field */}
                <FormMoneyInput
                  name={`temporaryItems.${index}.price`}
                  {...(index === 0 ? { label: "Preço Unitário" } : { label: "" })}
                  placeholder="R$ 0,00"
                  disabled={disabled}
                />

                {/* Tax Field */}
                <FormField
                  control={control}
                  name={`temporaryItems.${index}.tax`}
                  render={({ field }) => (
                    <FormItem>
                      {index === 0 && <FormLabel>Imposto (%)</FormLabel>}
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          value={field.value ?? 0}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          min={0}
                          max={100}
                          step={0.01}
                          placeholder="0"
                          disabled={disabled}
                          className="bg-transparent"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Remove Button */}
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(index)}
                  disabled={disabled || !canRemove}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <IconTrash className="h-4 w-4 mr-2" />
                  Remover Item
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Button */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAddItem}
        disabled={disabled}
        className="w-full"
      >
        <IconPlus className="h-4 w-4 mr-2" />
        Adicionar Item Temporário
      </Button>

      {/* Warning for incomplete items */}
      {hasIncompleteItems && (
        <Alert variant="destructive">
          <AlertDescription>
            Há itens temporários incompletos. Preencha todos os campos obrigatórios (descrição, quantidade e preço).
          </AlertDescription>
        </Alert>
      )}

      {/* Help Text */}
      {fields.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Adicione itens temporários para compras únicas que não precisam estar no inventário.
        </p>
      )}
    </div>
  );
});

TemporaryItemsInput.displayName = "TemporaryItemsInput";
