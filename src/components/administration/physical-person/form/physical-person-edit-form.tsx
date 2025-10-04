import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { PhysicalPersonForm } from "./physical-person-form";
import type { Customer } from "../../../../types";
import type { PhysicalPersonUpdateFormData } from "../../../../schemas";
import { mapPhysicalPersonToFormData } from "../../../../schemas";

interface PhysicalPersonEditFormProps {
  physicalPerson: Customer;
  onUpdate: (data: PhysicalPersonUpdateFormData) => Promise<void>;
  isSubmitting?: boolean;
  onDirtyChange?: (isDirty: boolean) => void;
}

export function PhysicalPersonEditForm({ physicalPerson, onUpdate, isSubmitting = false, onDirtyChange }: PhysicalPersonEditFormProps) {
  const [defaultValues, setDefaultValues] = useState<PhysicalPersonUpdateFormData | null>(null);

  // Prepare default values from the physical person data
  useEffect(() => {
    if (physicalPerson) {
      try {
        const formData = mapPhysicalPersonToFormData(physicalPerson);
        setDefaultValues(formData);
      } catch (error) {
        console.error("Error mapping physical person to form data:", error);
        toast.error("Erro ao carregar dados da pessoa física");
      }
    }
  }, [physicalPerson]);

  const handleSubmit = useCallback(
    async (data: PhysicalPersonUpdateFormData) => {
      try {
        await onUpdate(data);
        // Success toast is handled automatically by API client
      } catch (error) {
        // Error handling is done by the parent component or API client
        console.error("Error updating physical person:", error);
      }
    },
    [onUpdate],
  );

  // Don't render until we have default values
  if (!defaultValues) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-muted-foreground">Carregando dados da pessoa física...</p>
        </div>
      </div>
    );
  }

  return <PhysicalPersonForm mode="update" defaultValues={defaultValues} onSubmit={handleSubmit} isSubmitting={isSubmitting} onDirtyChange={onDirtyChange} />;
}
