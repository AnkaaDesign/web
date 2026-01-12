import React from "react";
import type { Supplier } from "../../../../types";
import { type SupplierUpdateFormData } from "../../../../schemas";
import { SupplierForm, type SupplierUpdateSubmitData } from "./supplier-form";

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
      streetType: (supplier as any).streetType || null,
      address: supplier.address,
      addressNumber: supplier.addressNumber,
      addressComplement: supplier.addressComplement,
      neighborhood: supplier.neighborhood,
      city: supplier.city,
      state: supplier.state,
      zipCode: supplier.zipCode,
      site: supplier.site,
      phones: supplier.phones || [],
      pix: supplier.pix,
      tags: supplier.tags || [],
      logoId: supplier.logoId,
    }),
    [supplier],
  );

  // Track original values to determine what changed
  // Use ref but update it when supplier data changes
  const originalValuesRef = React.useRef(defaultValues);

  // Update originalValuesRef when supplier data is loaded/changed
  // This ensures we compare against the actual loaded data, not stale data
  React.useEffect(() => {
    if (supplier.id) {
      originalValuesRef.current = defaultValues;
    }
  }, [supplier.id, defaultValues]);

  const handleSubmit = async (data: SupplierUpdateSubmitData & { logoFile?: File } | FormData) => {
    // If data is FormData (file upload), pass it through directly without filtering
    // FormData is already prepared with all necessary fields by SupplierForm
    if (data instanceof FormData) {
      await onSubmit(data as any);
      return;
    }

    // Extract logoFile and dirtyFields from data (passed by SupplierForm)
    const { logoFile, __dirtyFields, ...formData } = data;

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
    const dirtyFields = __dirtyFields || {};

    // Debug logging to understand what's being submitted
    console.log('[SupplierEditForm] Form data received:', formData);
    console.log('[SupplierEditForm] Dirty fields:', dirtyFields);
    console.log('[SupplierEditForm] Original values:', original);

    // Check each field for changes
    Object.keys(formData).forEach((key) => {
      const typedKey = key as keyof SupplierUpdateFormData;

      // Skip fields that don't exist in the form data
      if (!(typedKey in formData)) return;

      const newValue = formData[typedKey];
      const oldValue = typedKey in original ? (original as any)[typedKey] : undefined;
      const isDirty = dirtyFields[typedKey] === true;

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
      // Special handling for site - protect against accidental clearing
      else if (typedKey === "site") {
        // Treat null, undefined, and empty string as equivalent (no site)
        const normalizedNew = newValue && String(newValue).trim() !== "" ? String(newValue).trim() : null;
        const normalizedOld = oldValue && String(oldValue).trim() !== "" ? String(oldValue).trim() : null;

        if (normalizedNew !== normalizedOld) {
          // If trying to clear site (new is null) but old had a value:
          // ONLY allow if the field was explicitly marked as dirty (user touched it)
          if (normalizedNew === null && normalizedOld !== null && !isDirty) {
            console.warn('[SupplierEditForm] Blocked unintentional site clearing. Field not dirty. Old value:', normalizedOld);
            return; // Skip - user didn't touch this field
          }
          changedFields.site = normalizedNew;
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
    console.log('[SupplierEditForm] Changed fields to submit:', changedFields);

    if (Object.keys(changedFields).length > 0) {
      await onSubmit(changedFields);
    } else {
      console.log('[SupplierEditForm] No changes detected, skipping submit');
    }
  };

  return <SupplierForm mode="update" defaultValues={defaultValues} onSubmit={handleSubmit} isSubmitting={isSubmitting} onDirtyChange={onDirtyChange} onFormStateChange={onFormStateChange} />;
}
