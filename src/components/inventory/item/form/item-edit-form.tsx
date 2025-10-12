import React from "react";
import type { Item } from "../../../../types";
import { type ItemUpdateFormData } from "../../../../schemas";
import { ItemForm } from "./item-form";

interface ItemEditFormProps {
  item: Item;
  onSubmit: (data: Partial<ItemUpdateFormData>) => Promise<void>;
  isSubmitting?: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
  onFormStateChange?: (formState: { isValid: boolean; isDirty: boolean }) => void;
}

export function ItemEditForm({ item, onSubmit, isSubmitting, onDirtyChange, onFormStateChange }: ItemEditFormProps) {
  // Map API data to form data
  // Memoize to prevent unnecessary re-renders and ensure stable reference
  const defaultValues = React.useMemo(() => {
    // Get the most recent price if available
    const currentPrice =
      item.prices && item.prices.length > 0 ? item.prices.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.value : undefined;

    return {
      name: item.name,
      uniCode: item.uniCode,
      quantity: item.quantity,
      reorderPoint: item.reorderPoint,
      reorderQuantity: item.reorderQuantity,
      maxQuantity: item.maxQuantity,
      boxQuantity: item.boxQuantity,
      tax: item.tax,
      measures: item.measures || [], // Include measures array
      barcodes: item.barcodes || [],
      shouldAssignToUser: item.shouldAssignToUser,
      abcCategory: item.abcCategory,
      xyzCategory: item.xyzCategory,
      brandId: item.brandId,
      categoryId: item.categoryId,
      supplierId: item.supplierId,
      estimatedLeadTime: item.estimatedLeadTime,
      isActive: item.isActive,
      price: currentPrice,
      // PPE fields
      ppeType: item.ppeType,
      ppeSize: item.ppeSize,
      ppeCA: item.ppeCA,
      ppeDeliveryMode: item.ppeDeliveryMode,
      ppeStandardQuantity: item.ppeStandardQuantity,
      ppeAutoOrderMonths: item.ppeAutoOrderMonths,
    };
  }, [item]);

  // Memoize the supplier to pass to the form
  const initialSupplier = React.useMemo(() => item.supplier, [item.supplier]);

  // Track original values to determine what changed (only set once on mount)
  const originalValuesRef = React.useRef(defaultValues);

  const handleSubmit = async (data: ItemUpdateFormData) => {
    // Compare with original values to find changed fields
    const changedFields: Partial<ItemUpdateFormData> = {};
    const original = originalValuesRef.current;

    // Check each field for changes
    Object.keys(data).forEach((key) => {
      const typedKey = key as keyof ItemUpdateFormData;

      // Skip fields that don't exist in the form data
      if (!(typedKey in data)) return;

      const newValue = data[typedKey];
      const oldValue = typedKey in original ? (original as any)[typedKey] : undefined;

      // Deep equality check for arrays
      if (Array.isArray(newValue) && Array.isArray(oldValue)) {
        if (JSON.stringify(newValue) !== JSON.stringify(oldValue)) {
          changedFields[typedKey] = newValue as any;
        }
      } else if (newValue !== oldValue) {
        changedFields[typedKey] = newValue as any;
      }
    });

    // Only submit if there are changes
    if (Object.keys(changedFields).length > 0) {
      await onSubmit(changedFields);
    } else {
      // No changes, do nothing
    }
  };

  return (
    <ItemForm
      mode="update"
      defaultValues={defaultValues}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      onDirtyChange={onDirtyChange}
      onFormStateChange={onFormStateChange}
      initialSupplier={initialSupplier}
    />
  );
}
