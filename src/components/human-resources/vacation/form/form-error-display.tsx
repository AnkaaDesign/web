import { useEffect } from "react";
import type { FieldErrors } from "react-hook-form";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { IconAlertCircle } from "@tabler/icons-react";

interface FormErrorDisplayProps {
  errors: FieldErrors;
  showToast?: boolean;
}

export function FormErrorDisplay({ errors, showToast = false }: FormErrorDisplayProps) {
  const errorEntries = Object.entries(errors);

  useEffect(() => {
    if (showToast && errorEntries.length > 0) {
      toast.error("Por favor, corrija os erros no formulário");
    }
  }, [showToast, errorEntries.length]);

  if (errorEntries.length === 0) {
    return null;
  }

  return (
    <Alert variant="destructive">
      <IconAlertCircle className="h-4 w-4" />
      <AlertDescription>
        <div className="space-y-1">
          <p className="font-medium">Foram encontrados os seguintes erros:</p>
          <ul className="list-disc list-inside space-y-1">
            {errorEntries.map(([field, error]) => (
              <li key={field} className="text-sm">
                <strong>{getFieldLabel(field)}:</strong> {typeof error?.message === "string" ? error.message : "Campo inválido"}
              </li>
            ))}
          </ul>
        </div>
      </AlertDescription>
    </Alert>
  );
}

function getFieldLabel(field: string): string {
  const fieldLabels: Record<string, string> = {
    userId: "Colaborador",
    startAt: "Data de Início",
    endAt: "Data de Término",
    type: "Tipo",
    status: "Status",
    isCollective: "Férias Coletivas",
  };

  return fieldLabels[field] || field;
}
