import { FieldErrors } from "react-hook-form";
import { ExpenseCreateFormData, ExpenseUpdateFormData } from "../../../../schemas";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { IconAlertCircle, IconLoader2 } from "@tabler/icons-react";

interface FormErrorDisplayProps {
  errors: FieldErrors<ExpenseCreateFormData | ExpenseUpdateFormData>;
  isSubmitting: boolean;
}

export function FormErrorDisplay({ errors, isSubmitting }: FormErrorDisplayProps) {
  const hasErrors = Object.keys(errors).length > 0;

  if (!hasErrors && !isSubmitting) {
    return null;
  }

  if (isSubmitting) {
    return (
      <Alert>
        <IconLoader2 className="h-4 w-4 animate-spin" />
        <AlertDescription>
          Salvando despesa...
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="destructive">
      <IconAlertCircle className="h-4 w-4" />
      <AlertDescription>
        Por favor, corrija os seguintes erros:
        <ul className="mt-2 list-disc list-inside space-y-1">
          {Object.entries(errors).map(([field, error]) => (
            <li key={field} className="text-sm">
              <strong>{getFieldLabel(field)}:</strong> {error?.message}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

function getFieldLabel(fieldName: string): string {
  const labels: Record<string, string> = {
    description: "Descrição",
    amount: "Valor",
    expenseDate: "Data da Despesa",
    category: "Categoria",
    paymentMethod: "Método de Pagamento",
    receiptNumber: "Número do Recibo",
    vendor: "Fornecedor",
    notes: "Observações",
  };

  return labels[fieldName] || fieldName;
}