import { useState } from "react";
import { type Supplier } from "../../../../types";
import { type SupplierUpdateFormData } from "../../../../schemas";
import { SupplierForm } from "./supplier-form-custom";
import { cleanCNPJ } from "../../../../utils";
import { toast } from "sonner";

interface SupplierEditFormProps {
  supplier: Supplier;
  onDirtyChange?: (isDirty: boolean) => void;
  onSubmit?: (changedFields: Partial<SupplierUpdateFormData>) => Promise<void>;
  isSubmitting?: boolean;
}

export function SupplierEditForm({ supplier, onDirtyChange, onSubmit, isSubmitting: externalIsSubmitting }: SupplierEditFormProps) {
  const [internalIsSubmitting, setInternalIsSubmitting] = useState(false);
  const isSubmitting = externalIsSubmitting ?? internalIsSubmitting;

  const handleSubmit = async (formData: SupplierUpdateFormData) => {
    setInternalIsSubmitting(true);

    try {
      // Calculate changed fields
      const changedFields: Partial<SupplierUpdateFormData> = {};

      // Compare each field with original
      Object.keys(formData).forEach((key) => {
        const typedKey = key as keyof SupplierUpdateFormData;
        const newValue = formData[typedKey];
        const oldValue = (supplier as any)[typedKey];

        // Special handling for phones - normalize for comparison
        if (typedKey === "phones") {
          const newPhones = Array.isArray(newValue) ? newValue : [];
          const oldPhones = Array.isArray(oldValue) ? oldValue : []; // Clean phone numbers for comparison
          const cleanNewPhones = newPhones.map((phone) => String(phone).replace(/\D/g, "")).sort();
          const cleanOldPhones = oldPhones.map((phone) => String(phone).replace(/\D/g, "")).sort();
          if (JSON.stringify(cleanNewPhones) !== JSON.stringify(cleanOldPhones)) {
            changedFields[typedKey] = newPhones as any;
          } else {
          }
        }
        // Special handling for CNPJ - normalize for comparison
        else if (typedKey === "cnpj") {
          const cleanedNew = newValue ? cleanCNPJ(String(newValue)) : null;
          const cleanedOld = oldValue ? cleanCNPJ(String(oldValue)) : null;

          if (cleanedNew !== cleanedOld) {
            changedFields[typedKey] = Array.isArray(newValue) ? newValue[0] : newValue === null ? undefined : newValue;
          }
        }
        // Regular comparison for other fields
        else if (newValue !== oldValue) {
          // Handle null/undefined/empty string as equivalent
          const normalizedNew = newValue === "" ? null : newValue;
          const normalizedOld = oldValue === "" ? null : oldValue;

          if (normalizedNew !== normalizedOld) {
            const value = Array.isArray(newValue) ? newValue[0] : newValue === null ? undefined : newValue;
            changedFields[typedKey] = value as any;
          }
        }
      }); // If no changes, inform user
      if (Object.keys(changedFields).length === 0) {
        toast.info("Nenhuma alteração detectada");
        setInternalIsSubmitting(false);
        return;
      } // Call the provided onSubmit handler or log warning
      if (onSubmit) {
        await onSubmit(changedFields);
      } else {
        console.warn("No onSubmit handler provided to SupplierEditForm");
        toast.error("Erro: Handler de submit não configurado");
      }
    } catch (error) {
      console.error("Failed to update supplier:", error);
      toast.error("Erro ao atualizar fornecedor");
    } finally {
      setInternalIsSubmitting(false);
    }
  };

  // Prepare default values from supplier
  const defaultValues: Partial<SupplierUpdateFormData> = {
    fantasyName: supplier.fantasyName,
    corporateName: supplier.corporateName,
    cnpj: supplier.cnpj,
    email: supplier.email,
    site: supplier.site,
    phones: supplier.phones || [],
    address: supplier.address,
    addressNumber: supplier.addressNumber,
    addressComplement: supplier.addressComplement,
    neighborhood: supplier.neighborhood,
    city: supplier.city,
    state: supplier.state,
    zipCode: supplier.zipCode,
    logoId: supplier.logoId,
  };

  return <SupplierForm mode="update" defaultValues={defaultValues} onSubmit={handleSubmit} isSubmitting={isSubmitting} onDirtyChange={onDirtyChange} />;
}
