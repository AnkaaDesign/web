import React, { useEffect, useRef, useMemo } from "react";
import { useFieldArray, useFormContext, useWatch } from "react-hook-form";
import { IconTrash, IconPlus } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import { paintFormulaComponentService } from "@/api-client/paint";
import type { Item } from "../../../types";

interface FormulaComponentsEditorProps {
  className?: string;
  availableItems?: Item[];
  formulaPaintId?: string;
}

export function FormulaComponentsEditor({ className, availableItems = [], formulaPaintId }: FormulaComponentsEditorProps) {
  const { control, setValue, watch } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "components",
  });

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const lastRowRef = useRef<HTMLDivElement>(null);
  const lastDeductedWeights = useRef<Record<number, number>>({});

  // Get already selected item IDs to filter them out
  // Use useWatch instead of watch to ensure re-renders on nested changes
  const allComponents = useWatch({ control, name: "components" }) || [];
  const selectedItemIds = useMemo(() => {
    return allComponents.map((comp: { itemId: string }) => comp.itemId).filter(Boolean);
  }, [allComponents]);

  // Filter and sort items by unicode, excluding already selected ones
  const getFilteredItemsForRow = (currentRowIndex: number) => {
    const currentRowItemId = watch(`components.${currentRowIndex}.itemId`);

    return availableItems
      .filter((item) => {
        // Allow current row's selected item
        if (currentRowItemId === item.id) {
          return true;
        }
        // Filter out items selected in other rows
        return !selectedItemIds.includes(item.id);
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
  };

  // Create combobox options with unicode - name format
  const getComboboxOptionsForRow = (currentRowIndex: number): ComboboxOption[] => {
    const filteredItems = getFilteredItemsForRow(currentRowIndex);
    return filteredItems.map((item) => ({
      value: item.id,
      label: item.uniCode ? `${item.uniCode} - ${item.name}` : item.name,
    }));
  };

  // Add initial empty row if no components exist
  useEffect(() => {
    if (fields.length === 0) {
      append({ itemId: "", weightInGrams: 0, rawInput: "" });
    }
  }, []);

  const handleAmountChange = (index: number, value: string, previousValue: string) => {
    // Allow empty string for clearing
    if (value === "") {
      setValue(`components.${index}.weightInGrams`, 0);
      setValue(`components.${index}.rawInput`, "");
      // Reset tracking when input is cleared
      lastDeductedWeights.current[index] = 0;
      return;
    }

    // Store the raw input value for display
    setValue(`components.${index}.rawInput`, value);

    // Check if user just pressed spacebar (value has one more character and it's a space)
    const justPressedSpace = value.length === previousValue.length + 1 && value.endsWith(" ");

    if (justPressedSpace) {
      const trimmedValue = value.trim();
      const parts = trimmedValue.split(/\s+/).filter(Boolean);
      const numbers = parts.map(p => parseFloat(p)).filter(n => !isNaN(n));

      if (numbers.length >= 2) {
        // User pressed space after entering multiple numbers - calculate sum
        const sum = numbers.reduce((acc, num) => acc + num, 0);
        const rounded = Math.round(sum * 100) / 100; // 2 decimal places
        setValue(`components.${index}.weightInGrams`, rounded);
        // Keep the space in rawInput to allow continuing to type
        setValue(`components.${index}.rawInput`, rounded.toString() + " ");

        // Don't move to next row automatically - let user continue adding
      } else if (numbers.length === 1) {
        // Single number followed by space - keep the space to allow adding more
        const rounded = Math.round(numbers[0] * 100) / 100;
        setValue(`components.${index}.weightInGrams`, rounded);
        setValue(`components.${index}.rawInput`, value); // Keep the space
      }
    }
    // Don't do anything else - just keep the raw input as typed
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number, field: "combobox" | "input") => {
    // Handle Enter key - move to next row or create new one
    if (e.key === "Enter") {
      e.preventDefault();

      if (field === "input") {
        if (index === fields.length - 1) {
          // Last row - create new one
          append({ itemId: "", weightInGrams: 0, rawInput: "" });
          setTimeout(() => {
            const comboboxButton = lastRowRef.current?.querySelector('[role="combobox"]') as HTMLButtonElement;
            comboboxButton?.focus();
          }, 100);
        } else {
          // Move to next row's combobox
          const nextCombobox = document.querySelectorAll('[role="combobox"]')[index + 1] as HTMLButtonElement;
          nextCombobox?.focus();
        }
      }
      return;
    }

    // Allow spacebar in input field for calculations
    if (e.key === " " && field === "input") {
      // Don't prevent default - let the space be typed
      return;
    }

    if (e.key === "Tab" && !e.shiftKey && field === "input" && index === fields.length - 1) {
      e.preventDefault();
      append({ itemId: "", weightInGrams: 0, rawInput: "" });
      setTimeout(() => {
        const comboboxButton = lastRowRef.current?.querySelector('[role="combobox"]') as HTMLButtonElement;
        comboboxButton?.focus();
      }, 100);
    }
  };

  const handleItemSelect = (index: number, itemId: string) => {
    setValue(`components.${index}.itemId`, itemId);
    // Focus on quantity input after selection
    setTimeout(() => {
      inputRefs.current[index]?.focus();
    }, 100);
  };

  // Calculate total weight dynamically
  const calculateTotalWeight = (): number => {
    return allComponents.reduce((sum: number, comp: { weightInGrams?: number; rawInput?: string }) => {
      // Use weightInGrams if available, otherwise try to parse rawInput
      const weight = comp?.weightInGrams || parseFloat(comp?.rawInput || "0") || 0;
      return sum + weight;
    }, 0);
  };

  const calculateRatio = (index: number): string => {
    // Use weightInGrams if available, otherwise try to parse rawInput
    const weight = watch(`components.${index}.weightInGrams`) || parseFloat(watch(`components.${index}.rawInput`) || "0") || 0;
    const totalWeight = calculateTotalWeight();
    if (totalWeight === 0 || weight === 0) return "0.00";
    const ratio = (weight / totalWeight) * 100;
    return ratio.toFixed(2);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <div className="grid grid-cols-[1fr_120px_200px_80px] gap-2 text-sm font-medium text-muted-foreground mb-2">
        <div>Componente</div>
        <div>Proporção (%)</div>
        <div>Quantidade (g)</div>
        <div></div>
      </div>

      {fields.map((field, index) => {
        const isLastRow = index === fields.length - 1;

        return (
          <div key={field.id} ref={isLastRow ? lastRowRef : null} className="grid grid-cols-[1fr_120px_200px_80px] gap-2 items-center">
            <Combobox
              options={getComboboxOptionsForRow(index)}
              value={watch(`components.${index}.itemId`)}
              onValueChange={(value) => handleItemSelect(index, value || "")}
              placeholder="Selecione um componente"
              emptyText="Nenhum item disponível"
              searchable={true}
              className="w-full bg-transparent"
            />

            <Input
              type="text"
              value={calculateRatio(index)}
              readOnly
              tabIndex={-1}
              className="text-right bg-transparent pointer-events-none"
            />

            <Input
              ref={(el) => {
                if (el) inputRefs.current[index] = el;
              }}
              type="text"
              placeholder="0"
              value={watch(`components.${index}.rawInput`) || watch(`components.${index}.weightInGrams`) || ""}
              onChange={(value) => {
                // Input component passes value directly, not event object
                const previousValue = watch(`components.${index}.rawInput`) || watch(`components.${index}.weightInGrams`)?.toString() || "";
                handleAmountChange(index, value, previousValue);
              }}
              onKeyDown={(e) => handleKeyDown(e, index, "input")}
              onBlur={async (e: React.FocusEvent<HTMLInputElement>) => {
                // Input component passes event object to onBlur (unlike onChange)
                const trimmedValue = (e.target.value || "").toString().trim();
                if (trimmedValue) {
                  const parts = trimmedValue.split(/\s+/).filter(Boolean);
                  const numbers = parts.map(p => parseFloat(p)).filter(n => !isNaN(n));

                  let finalWeight = 0;
                  if (numbers.length >= 2) {
                    // Multiple numbers - calculate sum
                    const sum = numbers.reduce((acc, num) => acc + num, 0);
                    finalWeight = Math.round(sum * 100) / 100;
                    setValue(`components.${index}.weightInGrams`, finalWeight);
                    setValue(`components.${index}.rawInput`, finalWeight.toString());
                  } else if (numbers.length === 1) {
                    // Single number
                    finalWeight = Math.round(numbers[0] * 100) / 100;
                    setValue(`components.${index}.weightInGrams`, finalWeight);
                    setValue(`components.${index}.rawInput`, finalWeight.toString());
                  }

                  // Call API to deduct inventory if we have a valid weight and item
                  const itemId = watch(`components.${index}.itemId`);
                  if (finalWeight > 0 && itemId) {
                    // Get last deducted weight for this row
                    const lastDeducted = lastDeductedWeights.current[index] || 0;

                    // Calculate weight to deduct
                    let weightToDeduct = 0;
                    if (finalWeight < lastDeducted) {
                      // User cleared and started over - deduct full new amount
                      weightToDeduct = finalWeight;
                      lastDeductedWeights.current[index] = 0; // Reset tracking
                    } else if (finalWeight > lastDeducted) {
                      // User added more - only deduct the difference
                      weightToDeduct = finalWeight - lastDeducted;
                    }
                    // If finalWeight === lastDeducted, no change, don't deduct

                    if (weightToDeduct > 0) {
                      // Only pass formulaPaintId if it's a real UUID (not temp ID)
                      const isRealFormula = formulaPaintId && !formulaPaintId.startsWith('temp-');

                      await paintFormulaComponentService.deductForFormulationTest({
                        itemId,
                        weight: weightToDeduct,
                        ...(isRealFormula && { formulaPaintId }), // Only include if real
                      });

                      // Update tracking after successful deduction
                      lastDeductedWeights.current[index] = finalWeight;
                    }
                  }
                }
              }}
              className="text-right bg-transparent"
            />

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (fields.length > 1) {
                  remove(index);
                  // Clean up tracking for this row
                  delete lastDeductedWeights.current[index];
                } else {
                  // Clear the inputs for the only row instead of removing it
                  setValue(`components.${index}.itemId`, "");
                  setValue(`components.${index}.weightInGrams`, 0);
                  setValue(`components.${index}.rawInput`, "");
                  // Reset tracking for this row
                  lastDeductedWeights.current[index] = 0;
                }
              }}
              className="text-red-600 hover:text-red-700 h-10 w-10 p-0"
            >
              <IconTrash className="h-5 w-5" />
            </Button>
          </div>
        );
      })}

      <Button
        type="button"
        variant="outline"
        onClick={() => {
          append({ itemId: "", weightInGrams: 0, rawInput: "" });
          setTimeout(() => {
            const comboboxButton = lastRowRef.current?.querySelector('[role="combobox"]') as HTMLButtonElement;
            comboboxButton?.focus();
          }, 100);
        }}
        className="w-full h-10 flex items-center justify-center gap-2"
      >
        <IconPlus className="h-5 w-5" />
        <span>Adicionar Componente</span>
      </Button>
    </div>
  );
}
