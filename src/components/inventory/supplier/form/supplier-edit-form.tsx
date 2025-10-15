import React from "react";
import type { Supplier } from "../../../../types";
import { type SupplierUpdateFormData } from "../../../../schemas";
import { SupplierForm } from "./supplier-form";

interface SupplierEditFormProps {
  supplier: Supplier;
  onSubmit: (data: Partial<SupplierUpdateFormData> & { logoFile?: File }) => Promise<void>;
  isSubmitting?: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
  onFormStateChange?: (formState: { isValid: boolean; isDirty: boolean }) => void;
}

export function SupplierEditForm({ supplier, onSubmit, isSubmitting, onDirtyChange, onFormStateChange }: SupplierEditFormProps) {
  // Map API data to form data
  const defaultValues = React.useMemo(
    () => ({
      id: supplier.id, // Include supplier ID for FormData context
      fantasyName: supplier.fantasyName,
      cnpj: supplier.cnpj,
      corporateName: supplier.corporateName,
      email: supplier.email,
      address: supplier.address,
      addressNumber: supplier.addressNumber,
      addressComplement: supplier.addressComplement,
      neighborhood: supplier.neighborhood,
      city: supplier.city,
      state: supplier.state,
      zipCode: supplier.zipCode,
      site: supplier.site,
      phones: supplier.phones || [],
      tags: supplier.tags || [],
      logoId: supplier.logoId,
    }),
    [supplier],
  );

  // Track original values to determine what changed (only set once on mount)
  const originalValuesRef = React.useRef(defaultValues);

  const handleSubmit = async (data: SupplierUpdateFormData & { logoFile?: File } | FormData) => {
    // If data is FormData (file upload), pass it through directly without filtering
    // FormData is already prepared with all necessary fields by SupplierForm
    if (data instanceof FormData) {
      await onSubmit(data as any);
      return;
    }

    // Extract logoFile from data (passed by SupplierForm)
    const { logoFile, ...formData } = data;

    // If there's a logo file, we need to send ALL current form data (not just changes)
    // because FormData requires all fields to be present
    if (logoFile) {
      await onSubmit({
        ...formData,
        logoFile,
      });
      return;
    }

    // No logo file - proceed with change detection as usual
    const changedFields: Partial<SupplierUpdateFormData> = {};
    const original = originalValuesRef.current;

    // Check each field for changes
    Object.keys(formData).forEach((key) => {
      const typedKey = key as keyof SupplierUpdateFormData;

      // Skip fields that don't exist in the form data
      if (!(typedKey in formData)) return;

      const newValue = formData[typedKey];
      const oldValue = typedKey in original ? (original as any)[typedKey] : undefined;

      // Special handling for phones - normalize for comparison
      if (typedKey === "phones") {
        let normalizedNew = newValue;
        let normalizedOld = oldValue;

        // Convert object to array if needed (React Hook Form serialization issue)
        if (normalizedNew && typeof normalizedNew === "object" && !Array.isArray(normalizedNew)) {
          normalizedNew = Object.values(normalizedNew);
        }

        // Ensure both are arrays
        const newPhones = Array.isArray(normalizedNew) ? normalizedNew : [];
        const oldPhones = Array.isArray(normalizedOld) ? normalizedOld : [];

        // Normalize phone numbers by removing all non-numeric characters for comparison
        const cleanNewPhones = newPhones.map((phone) => String(phone).replace(/\D/g, "")).sort();
        const cleanOldPhones = oldPhones.map((phone) => String(phone).replace(/\D/g, "")).sort();

        if (JSON.stringify(cleanNewPhones) !== JSON.stringify(cleanOldPhones)) {
          changedFields[typedKey] = newPhones as any;
        }
      }
      // Special handling for tags array
      else if (typedKey === "tags") {
        let normalizedNew = newValue;
        let normalizedOld = oldValue;

        // Convert object to array if needed (React Hook Form serialization issue)
        if (normalizedNew && typeof normalizedNew === "object" && !Array.isArray(normalizedNew)) {
          normalizedNew = Object.values(normalizedNew);
        }

        // Ensure both are arrays
        const newTags = Array.isArray(normalizedNew) ? normalizedNew : [];
        const oldTags = Array.isArray(normalizedOld) ? normalizedOld : [];

        // Sort and compare
        const sortedNewTags = [...newTags].sort();
        const sortedOldTags = [...oldTags].sort();

        if (JSON.stringify(sortedNewTags) !== JSON.stringify(sortedOldTags)) {
          changedFields[typedKey] = newTags as any;
        }
      }
      // Special handling for CNPJ - normalize for comparison
      else if (typedKey === "cnpj") {
        const cleanNew = newValue ? String(newValue).replace(/\D/g, "") : "";
        const cleanOld = oldValue ? String(oldValue).replace(/\D/g, "") : "";

        if (cleanNew !== cleanOld) {
          changedFields.cnpj = cleanNew === "" ? null : (cleanNew as any);
        }
      }
      // Deep equality check for other arrays
      else if (Array.isArray(newValue) && Array.isArray(oldValue)) {
        if (JSON.stringify(newValue) !== JSON.stringify(oldValue)) {
          changedFields[typedKey] = newValue as any;
        }
      }
      // Simple equality check for other fields
      else if (newValue !== oldValue) {
        changedFields[typedKey] = newValue as any;
      }
    });

    // Only submit if there are changes
    if (Object.keys(changedFields).length > 0) {
      await onSubmit(changedFields);
    }
  };

  return <SupplierForm mode="update" defaultValues={defaultValues} onSubmit={handleSubmit} isSubmitting={isSubmitting} onDirtyChange={onDirtyChange} onFormStateChange={onFormStateChange} />;
}
