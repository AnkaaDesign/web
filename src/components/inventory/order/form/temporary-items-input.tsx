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
      icms: 0,
      ipi: 0,
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
      {/* Header Row */}
      {fields.length > 0 && (
        <div className="flex gap-3 items-center text-xs font-medium text-muted-foreground px-1">
          <div className="flex-1">Descrição do Item</div>
          <div className="w-32">Quantidade</div>
          <div className="w-36">Preço Unitário</div>
          <div className="w-28">ICMS (%)</div>
          <div className="w-28">IPI (%)</div>
          <div className="w-10"></div>
        </div>
      )}

      {fields.length > 0 && (
        <div className="space-y-2">
          {fields.map((field, index) => (
            <div
              key={field.id}
              ref={index === fields.length - 1 ? lastRowRef : null}
              className="flex gap-3 items-start"
            >
              {/* Description Field - Takes all available space */}
              <div className="flex-1">
                <FormField
                  control={control}
                  name={`temporaryItems.${index}.temporaryItemDescription`}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          {...field}
                          value={field.value || ""}
                          placeholder="Ex: Parafuso 5mm, Material de consumo"
                          disabled={disabled}
                          transparent
                          className="h-10"
                          maxLength={500}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Quantity Field - Fixed width */}
              <div className="w-32">
                <FormField
                  control={control}
                  name={`temporaryItems.${index}.orderedQuantity`}
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          type="decimal"
                          value={field.value || 1}
                          onChange={(value) => field.onChange(value)}
                          min={0.01}
                          max={999999}
                          placeholder="1"
                          disabled={disabled}
                          transparent
                          className="h-10"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Price Field - Fixed width */}
              <div className="w-36">
                <FormMoneyInput
                  name={`temporaryItems.${index}.price`}
                  label=""
                  placeholder="R$ 0,00"
                  disabled={disabled}
                  align="left"
                />
              </div>

              {/* ICMS Field - Fixed width */}
              <div className="w-28">
                <FormField
                  control={control}
                  name={`temporaryItems.${index}.icms`}
                  render={({ field }) => (
                    <FormItem>
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
                          transparent
                          className="h-10"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* IPI Field - Fixed width */}
              <div className="w-28">
                <FormField
                  control={control}
                  name={`temporaryItems.${index}.ipi`}
                  render={({ field }) => (
                    <FormItem>
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
                          transparent
                          className="h-10"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Trash Button - Fixed width */}
              <div className="w-10 flex items-center justify-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(index)}
                  disabled={disabled || !canRemove}
                  className="h-10 w-10 text-destructive hover:text-destructive hover:bg-destructive/10"
                  title="Remover item"
                >
                  <IconTrash className="h-4 w-4" />
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
