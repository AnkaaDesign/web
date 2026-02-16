import React from "react";
import type { Customer } from "../../../../types";
import { type CustomerUpdateFormData } from "../../../../schemas";
import { CustomerForm } from "./customer-form";

interface CustomerEditFormProps {
  customer: Customer;
  onSubmit: (data: Partial<CustomerUpdateFormData>) => Promise<void>;
  isSubmitting?: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
  onFormStateChange?: (formState: { isValid: boolean; isDirty: boolean }) => void;
}

export function CustomerEditForm({ customer, onSubmit, isSubmitting, onDirtyChange, onFormStateChange }: CustomerEditFormProps) {
  // Map API data to form data
  const defaultValues = React.useMemo(
    () => ({
      id: customer.id, // Include customer ID for FormData context
      fantasyName: customer.fantasyName,
      cnpj: customer.cnpj,
      cpf: customer.cpf,
      corporateName: customer.corporateName,
      email: customer.email,
      streetType: customer.streetType as any,
      address: customer.address,
      addressNumber: customer.addressNumber,
      addressComplement: customer.addressComplement,
      neighborhood: customer.neighborhood,
      city: customer.city,
      state: customer.state,
      zipCode: customer.zipCode,
      site: customer.site,
      phones: customer.phones || [],
      tags: customer.tags || [],
      logoId: customer.logoId,
      stateRegistration: customer.stateRegistration,
    }),
    [customer],
  );

  // Track original values to determine what changed (only set once on mount)
  const originalValuesRef = React.useRef(defaultValues);

  const handleSubmit = async (data: CustomerUpdateFormData | FormData) => {
    console.log('[CustomerEditForm] handleSubmit called', {
      isFormData: data instanceof FormData,
      dataType: data?.constructor?.name,
    });

    // If data is FormData (file upload), pass it through directly without filtering
    // FormData is already prepared with only the necessary fields by CustomerForm
    if (data instanceof FormData) {
      console.log('[CustomerEditForm] Detected FormData, passing through to onSubmit');
      await onSubmit(data as any);
      console.log('[CustomerEditForm] FormData onSubmit completed');
      return;
    }

    // Compare with original values to find changed fields
    const changedFields: Partial<CustomerUpdateFormData> = {};
    const original = originalValuesRef.current;

    // Check if we have a logo file to upload (always include if present)
    if ((data as any).logoFile) {
      (changedFields as any).logoFile = (data as any).logoFile;
    }

    // Check each field for changes
    Object.keys(data).forEach((key) => {
      const typedKey = key as keyof CustomerUpdateFormData;

      // Skip fields that don't exist in the form data
      if (!(typedKey in data)) return;

      // Skip logoFile as it's already handled above
      if (typedKey === 'logoFile') return;

      const newValue = data[typedKey];
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
        const cleanNewPhones = newPhones.map((phone: any) => String(phone).replace(/\D/g, "")).sort();
        const cleanOldPhones = oldPhones.map((phone: any) => String(phone).replace(/\D/g, "")).sort();

        if (JSON.stringify(cleanNewPhones) !== JSON.stringify(cleanOldPhones)) {
          changedFields[typedKey] = newPhones as any;
        }
      }
      // Special handling for tags - normalize for comparison
      else if (typedKey === "tags") {
        let normalizedNew = newValue;
        let normalizedOld = oldValue;

        // Convert object to array if needed
        if (normalizedNew && typeof normalizedNew === "object" && !Array.isArray(normalizedNew)) {
          normalizedNew = Object.values(normalizedNew);
        }

        // Ensure both are arrays
        const newTags = Array.isArray(normalizedNew) ? normalizedNew : [];
        const oldTags = Array.isArray(normalizedOld) ? normalizedOld : [];

        // Sort for comparison
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
      // Special handling for CPF - normalize for comparison
      else if (typedKey === "cpf") {
        const cleanNew = newValue ? String(newValue).replace(/\D/g, "") : "";
        const cleanOld = oldValue ? String(oldValue).replace(/\D/g, "") : "";

        if (cleanNew !== cleanOld) {
          changedFields.cpf = cleanNew === "" ? null : (cleanNew as any);
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

  return (
    <CustomerForm
      mode="update"
      defaultValues={defaultValues}
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      onDirtyChange={onDirtyChange}
      onFormStateChange={onFormStateChange}
    />
  );
}
