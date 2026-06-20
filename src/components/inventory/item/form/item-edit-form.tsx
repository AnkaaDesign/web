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
      icms: item.icms,
      ipi: item.ipi,
      measures: item.measures || [], // Include measures array
      barcodes: item.barcodes || [],
      shouldAssignToUser: item.shouldAssignToUser,
      // Capability fields — direct reads (an explicit false/0 must survive)
      isBorrowable: item.isBorrowable,
      stockModel: item.stockModel,
      fixedTargetQuantity: item.fixedTargetQuantity,
      abcCategory: item.abcCategory,
      xyzCategory: item.xyzCategory,
      brandIds: item.brands?.map((b) => b.id) ?? [],
      categoryId: item.categoryId,
      supplierId: item.supplierId,
      warehouseLocationId: item.warehouseLocationId,
      estimatedLeadTime: item.estimatedLeadTime,
      isActive: item.isActive,
      price: currentPrice,
      // PPE fields
      ppeType: item.ppeType,
      ppeSize: item.ppeSize,
      ppeCA: item.ppeCA,
      ppeDeliveryMode: item.ppeDeliveryMode,
      ppeStandardQuantity: item.ppeStandardQuantity,
      monthlyConsumptionTrendPercent: item.monthlyConsumptionTrendPercent,
    };
  }, [item]);

  // Memoize the supplier, brand, and category to pass to the form
  const initialSupplier = React.useMemo(() => item.supplier, [item.supplier]);
  const initialWarehouseLocation = React.useMemo(() => item.warehouseLocation, [item.warehouseLocation]);
  const initialBrands = React.useMemo(() => item.brands, [item.brands]);
  const initialCategory = React.useMemo(() => item.category, [item.category]);

  // Track original values to determine what changed
  const originalValuesRef = React.useRef(defaultValues);
  React.useEffect(() => {
    originalValuesRef.current = defaultValues;
  }, [defaultValues]);

  const handleSubmit = async (data: ItemUpdateFormData) => {
    // Compare with original values to find changed fields
    const changedFields: Partial<ItemUpdateFormData> = {};
    const original = originalValuesRef.current;

    // PPE fields that should be sent together when any of them changes
    const ppeFields = ['ppeType', 'ppeSize', 'ppeCA', 'ppeDeliveryMode', 'ppeStandardQuantity', 'measures'] as const;

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

    // If any PPE field changed, include all PPE fields to satisfy API validation
    const hasPpeFieldChanged = ppeFields.some(field => field in changedFields);
    if (hasPpeFieldChanged) {
      ppeFields.forEach(field => {
        if (!(field in changedFields) && field in data) {
          changedFields[field] = (data as any)[field];
        }
      });
    }

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
      itemId={item.id}
      defaultValues={defaultValues}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      onDirtyChange={onDirtyChange}
      onFormStateChange={onFormStateChange}
      initialSupplier={initialSupplier}
      initialWarehouseLocation={initialWarehouseLocation}
      initialBrands={initialBrands}
      initialCategory={initialCategory}
    />
  );
}
