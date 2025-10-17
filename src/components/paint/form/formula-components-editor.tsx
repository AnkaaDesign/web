import React, { useEffect, useRef, useMemo } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { IconTrash, IconPlus } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { cn } from "@/lib/utils";
import type { Item } from "../../../types";

interface FormulaComponentsEditorProps {
  className?: string;
  availableItems?: Item[];
}

export function FormulaComponentsEditor({ className, availableItems = [] }: FormulaComponentsEditorProps) {
  const { control, setValue, watch } = useFormContext();
  const { fields, append, remove } = useFieldArray({
    control,
    name: "components",
  });

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const lastRowRef = useRef<HTMLDivElement>(null);

  // Get already selected item IDs to filter them out
  const allComponents = watch("components") || [];
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

  return (
    <div className={cn("space-y-2", className)}>
      <div className="grid grid-cols-[1fr_200px_80px] gap-2 text-sm font-medium text-muted-foreground mb-2">
        <div>Componente</div>
        <div>Quantidade (g)</div>
        <div></div>
      </div>

      {fields.map((field, index) => {
        const isLastRow = index === fields.length - 1;
        const isRowFilled = watch(`components.${index}.itemId`) && watch(`components.${index}.weightInGrams`) > 0;

        return (
          <div key={field.id} ref={isLastRow ? lastRowRef : null} className="grid grid-cols-[1fr_200px_80px] gap-2 items-center">
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
              ref={(el) => {
                if (el) inputRefs.current[index] = el;
              }}
              type="text"
              placeholder="0"
              value={watch(`components.${index}.rawInput`) || watch(`components.${index}.weightInGrams`) || ""}
              onChange={(e) => {
                const previousValue = watch(`components.${index}.rawInput`) || watch(`components.${index}.weightInGrams`)?.toString() || "";
                handleAmountChange(index, e.target.value, previousValue);
              }}
              onKeyDown={(e) => handleKeyDown(e, index, "input")}
              onBlur={(e) => {
                // Finalize the value on blur
                const value = e.target.value.trim();
                if (value) {
                  const parts = value.split(/\s+/).filter(Boolean);
                  const numbers = parts.map(p => parseFloat(p)).filter(n => !isNaN(n));

                  if (numbers.length >= 2) {
                    // Multiple numbers - calculate sum
                    const sum = numbers.reduce((acc, num) => acc + num, 0);
                    const rounded = Math.round(sum * 100) / 100;
                    setValue(`components.${index}.weightInGrams`, rounded);
                    setValue(`components.${index}.rawInput`, rounded.toString());
                  } else if (numbers.length === 1) {
                    // Single number
                    const rounded = Math.round(numbers[0] * 100) / 100;
                    setValue(`components.${index}.weightInGrams`, rounded);
                    setValue(`components.${index}.rawInput`, rounded.toString());
                  }
                }
              }}
              className="text-right bg-transparent"
            />

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  if (fields.length > 1) {
                    remove(index);
                  } else {
                    // Clear the inputs for the only row instead of removing it
                    setValue(`components.${index}.itemId`, "");
                    setValue(`components.${index}.weightInGrams`, 0);
                    setValue(`components.${index}.rawInput`, "");
                  }
                }}
                className="text-red-600 hover:text-red-700 h-10 w-10 p-0"
              >
                <IconTrash className="h-5 w-5" />
              </Button>

              {isLastRow && isRowFilled && (
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
                  className="h-10 w-10 p-0"
                >
                  <IconPlus className="h-5 w-5" />
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
