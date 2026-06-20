import { useMemo } from "react";
import { WarehouseLocationForm } from "./warehouse-location-form";
import type { WarehouseLocation } from "../../../../types";
import type { WarehouseLocationUpdateFormData } from "../../../../schemas";

interface WarehouseLocationEditFormProps {
  warehouseLocation: WarehouseLocation;
  isSubmitting?: boolean;
  onSubmit: (data: WarehouseLocationUpdateFormData) => Promise<void>;
  onFormStateChange?: (formState: { isValid: boolean; isDirty: boolean }) => void;
}

export function WarehouseLocationEditForm({ warehouseLocation, isSubmitting, onSubmit, onFormStateChange }: WarehouseLocationEditFormProps) {
  const defaultValues = useMemo<Partial<WarehouseLocationUpdateFormData>>(
    () => ({
      name: warehouseLocation.name,
      section: warehouseLocation.section,
      code: warehouseLocation.code,
      description: warehouseLocation.description,
      isActive: warehouseLocation.isActive,
    }),
    [warehouseLocation],
  );

  return <WarehouseLocationForm mode="update" defaultValues={defaultValues} onSubmit={onSubmit} isSubmitting={isSubmitting} onFormStateChange={onFormStateChange} />;
}
