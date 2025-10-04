import React, { useEffect, useRef, useMemo } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { IconTrash } from "@tabler/icons-react";
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
      append({ itemId: "", ratio: 0 });
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent, index: number, field: "combobox" | "input") => {
    // Handle Enter key - move to next row or create new one
    if (e.key === "Enter") {
      e.preventDefault();

      if (field === "input") {
        if (index === fields.length - 1) {
          // Last row - create new one
          append({ itemId: "", ratio: 0 });
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

    if (e.key === "Tab" && !e.shiftKey && field === "input" && index === fields.length - 1) {
      e.preventDefault();
      append({ itemId: "", ratio: 0 });
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
      <div className="grid grid-cols-[1fr_200px_40px] gap-2 text-sm font-medium text-muted-foreground mb-2">
        <div>Componente</div>
        <div>Proporção (%)</div>
        <div></div>
      </div>

      {fields.map((field, index) => (
        <div key={field.id} ref={index === fields.length - 1 ? lastRowRef : null} className="grid grid-cols-[1fr_200px_40px] gap-2 items-center">
          <Combobox
            options={getComboboxOptionsForRow(index)}
            value={watch(`components.${index}.itemId`)}
            onValueChange={(value) => handleItemSelect(index, value || "")}
            placeholder="Selecione um componente"
            emptyText="Nenhum item disponível"
            searchable={true}
            className="w-full"
          />

          <Input
            ref={(el) => {
              if (el) inputRefs.current[index] = el;
            }}
            type="percentage"
            placeholder="0"
            value={watch(`components.${index}.ratio`) ?? undefined}
            onChange={(value) => {
              if (typeof value === "number") {
                setValue(`components.${index}.ratio`, value);
              }
            }}
            onKeyDown={(e) => handleKeyDown(e, index, "input")}
            className="text-right"
            decimals={1}
          />

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              if (fields.length > 1) {
                remove(index);
              } else {
                // Clear the inputs for the only row instead of removing it
                setValue(`components.${index}.itemId`, "");
                setValue(`components.${index}.ratio`, 0);
              }
            }}
            className="text-red-600 hover:text-red-700 h-10"
          >
            <IconTrash className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
