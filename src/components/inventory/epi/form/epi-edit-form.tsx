import React from "react";
import type { Item } from "../../../../types";
import { type ItemUpdateFormData } from "../../../../schemas";
import { EpiForm } from "./epi-form";

interface EpiEditFormProps {
  item: Item;
  onSubmit: (data: Partial<ItemUpdateFormData>) => Promise<void>;
  isSubmitting?: boolean;
}

export function EpiEditForm({ item, onSubmit, isSubmitting }: EpiEditFormProps) {
  // Map API data to form data
  const getDefaultValues = React.useCallback(() => {
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
      isManualMaxQuantity: item.isManualMaxQuantity || false,
      boxQuantity: item.boxQuantity,
      icms: item.icms,
      ipi: item.ipi,
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
    };
  }, [item]);

  // Track original values to determine what changed
  const originalValues = React.useRef(getDefaultValues());

  const handleSubmit = async (data: ItemUpdateFormData) => {
    // Compare with original values to find changed fields
    const changedFields: Partial<ItemUpdateFormData> = {};
    const original = originalValues.current;

    // Check each field for changes
    Object.keys(data).forEach((key) => {
      const typedKey = key as keyof ItemUpdateFormData;

      // Skip fields that don't exist in the form data
      if (!(typedKey in data)) return;

      const newValue = data[typedKey];
      const oldValue = (original as Record<string, any>)[typedKey];

      // Deep equality check for arrays
      if (Array.isArray(newValue) && Array.isArray(oldValue)) {
        if (JSON.stringify(newValue) !== JSON.stringify(oldValue)) {
          (changedFields as Record<string, any>)[typedKey] = newValue;
        }
      } else if (newValue !== oldValue) {
        (changedFields as Record<string, any>)[typedKey] = newValue;
      }
    });

    // Only submit if there are changes
    if (Object.keys(changedFields).length > 0) {
      await onSubmit(changedFields);
    } else {
      // No changes, do nothing
    }
  };

  return <EpiForm mode="update" defaultValues={getDefaultValues()} onSubmit={handleSubmit} isSubmitting={isSubmitting} />;
}
