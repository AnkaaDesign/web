import type { FieldErrors } from "react-hook-form";
import type { DriverCreateFormData, DriverUpdateFormData } from "../../../../schemas";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangleIcon } from "@radix-ui/react-icons";

interface FormErrorDisplayProps {
  errors: FieldErrors<DriverCreateFormData | DriverUpdateFormData>;
}

export function FormErrorDisplay({ errors }: FormErrorDisplayProps) {
  const errorCount = Object.keys(errors).length;

  if (errorCount === 0) return null;

  return (
    <Card className="border-red-200 bg-red-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-red-800 flex items-center gap-2">
          <AlertTriangleIcon className="h-5 w-5" />
          {errorCount === 1 ? "1 erro encontrado" : `${errorCount} erros encontrados`}
        </CardTitle>
        <CardDescription className="text-red-700">Corrija os erros abaixo antes de continuar:</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {Object.entries(errors).map(([field, error]) => {
          const fieldLabels: Record<string, string> = {
            name: "Nome",
            cpf: "CPF",
            cnhNumber: "Número da CNH",
            cnhCategory: "Categoria da CNH",
            cnhExpiryDate: "Data de vencimento da CNH",
            licenseType: "Tipo de CNH",
            status: "Status",
            rg: "RG",
            birthDate: "Data de nascimento",
            phone: "Telefone",
            email: "E-mail",
            address: "Endereço",
            addressNumber: "Número",
            neighborhood: "Bairro",
            city: "Cidade",
            state: "Estado",
            zipCode: "CEP",
            cnhIssueDate: "Data de emissão da CNH",
            cnhIssuingState: "Estado emissor da CNH",
            emergencyContactName: "Nome do contato de emergência",
            emergencyContactPhone: "Telefone do contato de emergência",
            emergencyContactRelation: "Relação com contato de emergência",
            medicalCertificateExpiry: "Vencimento do atestado médico",
            bloodType: "Tipo sanguíneo",
            allergies: "Alergias",
            medications: "Medicamentos",
            userId: "Usuário vinculado",
            hireDate: "Data de contratação",
            employeeId: "Matrícula",
            notes: "Observações",
          };

          const fieldLabel = fieldLabels[field] || field;
          const errorMessage = error?.message || "Erro de validação";

          return (
            <Alert key={field} variant="destructive" className="py-2">
              <AlertDescription>
                <span className="font-medium">{fieldLabel}:</span> {errorMessage}
              </AlertDescription>
            </Alert>
          );
        })}
      </CardContent>
    </Card>
  );
}
