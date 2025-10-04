import { UseFormReturn } from "react-hook-form";
import type { DriverCreateFormData, DriverUpdateFormData } from "../../../../schemas";
import { CNH_CATEGORY, DRIVER_LICENSE_TYPE, BRAZILIAN_STATES } from "../../../../constants";
import { isCNHExpired, isCNHExpiringSoon } from "../../../../utils";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AlertTriangleIcon, InfoIcon } from "@radix-ui/react-icons";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CnhInfoSectionProps {
  form: UseFormReturn<DriverCreateFormData | DriverUpdateFormData>;
}

export function CnhInfoSection({ form }: CnhInfoSectionProps) {
  const cnhExpiryDate = form.watch("cnhExpiryDate");
  const cnhCategory = form.watch("cnhCategory");
  const cnhNumber = form.watch("cnhNumber");

  // Check if CNH is expired or expiring soon
  const isExpired = cnhExpiryDate ? isCNHExpired(cnhExpiryDate) : false;
  const isExpiringSoon = cnhExpiryDate ? isCNHExpiringSoon(cnhExpiryDate) : false;

  // Brazilian states for CNH issuing state
  const brazilianStates = Object.values(BRAZILIAN_STATES);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Informações da CNH
          {isExpired && <Badge variant="destructive">Vencida</Badge>}
          {!isExpired && isExpiringSoon && (
            <Badge variant="outline" className="border-yellow-500 text-yellow-700">
              Vence em breve
            </Badge>
          )}
        </CardTitle>
        <CardDescription>Dados da Carteira Nacional de Habilitação</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Expiry Status Alert */}
        {isExpired && (
          <Alert variant="destructive">
            <AlertTriangleIcon className="h-4 w-4" />
            <AlertDescription>
              <strong>CNH Vencida!</strong> A CNH deste motorista está vencida desde {format(cnhExpiryDate, "dd/MM/yyyy", { locale: ptBR })}. O motorista não pode dirigir até
              renovar a licença.
            </AlertDescription>
          </Alert>
        )}

        {!isExpired && isExpiringSoon && (
          <Alert variant="default" className="border-yellow-500">
            <InfoIcon className="h-4 w-4" />
            <AlertDescription>
              <strong>CNH vencendo em breve!</strong> A CNH vence em {format(cnhExpiryDate, "dd/MM/yyyy", { locale: ptBR })}. Considere renovar com antecedência.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* CNH Number */}
          <FormField
            control={form.control}
            name="cnhNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Número da CNH *</FormLabel>
                <FormControl>
                  <Input placeholder="00000000000" {...field} maxLength={11} />
                </FormControl>
                <FormDescription>Número de 11 dígitos da CNH (sem espaços ou pontos)</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* CNH Category */}
          <FormField
            control={form.control}
            name="cnhCategory"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Categoria da CNH *</FormLabel>
                <FormControl>
                  <Combobox
                    value={field.value}
                    onValueChange={field.onChange}
                    options={[
                      { value: CNH_CATEGORY.A, label: "Categoria A - Motocicletas" },
                      { value: CNH_CATEGORY.B, label: "Categoria B - Veículos até 3.500kg" },
                      { value: CNH_CATEGORY.C, label: "Categoria C - Caminhões até 6.000kg" },
                      { value: CNH_CATEGORY.D, label: "Categoria D - Ônibus e +8 passageiros" },
                      { value: CNH_CATEGORY.E, label: "Categoria E - Caminhões pesados e reboque" },
                      { value: CNH_CATEGORY.AB, label: "Categoria AB - A + B" },
                      { value: CNH_CATEGORY.AC, label: "Categoria AC - A + C" },
                      { value: CNH_CATEGORY.AD, label: "Categoria AD - A + D" },
                      { value: CNH_CATEGORY.AE, label: "Categoria AE - A + E" },
                    ]}
                    placeholder="Selecione a categoria"
                  />
                </FormControl>
                <FormDescription>Categoria determina quais veículos o motorista pode dirigir</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* License Type */}
          <FormField
            control={form.control}
            name="licenseType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo de CNH *</FormLabel>
                <FormControl>
                  <Combobox
                    value={field.value}
                    onValueChange={field.onChange}
                    options={[
                      { value: DRIVER_LICENSE_TYPE.PROVISIONAL, label: "CNH Provisória" },
                      { value: DRIVER_LICENSE_TYPE.DEFINITIVE, label: "CNH Definitiva" },
                      { value: DRIVER_LICENSE_TYPE.DIGITAL, label: "CNH Digital" },
                    ]}
                    placeholder="Selecione o tipo"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Issuing State */}
          <FormField
            control={form.control}
            name="cnhIssuingState"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estado Emissor</FormLabel>
                <FormControl>
                  <Combobox
                    value={field.value || ""}
                    onValueChange={field.onChange}
                    options={brazilianStates.map((state) => ({
                      value: state,
                      label: state,
                    }))}
                    placeholder="Selecione o estado"
                    searchable
                  />
                </FormControl>
                <FormDescription>Estado onde a CNH foi emitida</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Issue Date */}
          <FormField
            control={form.control}
            name="cnhIssueDate"
            render={({ field }) => (
              <DateTimeInput
                field={field}
                label="Data de Emissão"
                description="Data em que a CNH foi emitida"
                constraints={{
                  maxDate: new Date(),
                  minDate: new Date("1970-01-01"),
                }}
                showTodayButton
              />
            )}
          />

          {/* Expiry Date */}
          <FormField
            control={form.control}
            name="cnhExpiryDate"
            render={({ field }) => (
              <DateTimeInput
                field={field}
                label="Data de Vencimento *"
                context="due"
                description="Data em que a CNH vence (obrigatório para validade)"
                constraints={{
                  minDate: new Date("1970-01-01"),
                }}
                required
                className={cn(
                  isExpired && "[&_button]:border-red-500 [&_button]:text-red-600",
                  !isExpired && isExpiringSoon && "[&_button]:border-yellow-500 [&_button]:text-yellow-700",
                )}
              />
            )}
          />
        </div>

        {/* CNH Category Information */}
        {cnhCategory && (
          <Alert>
            <InfoIcon className="h-4 w-4" />
            <AlertDescription>
              <strong>Categoria {cnhCategory}:</strong> {cnhCategory === CNH_CATEGORY.A && "Permite dirigir motocicletas, motonetas e triciclos."}
              {cnhCategory === CNH_CATEGORY.B && "Permite dirigir veículos até 3.500kg e até 8 passageiros."}
              {cnhCategory === CNH_CATEGORY.C && "Permite dirigir veículos da categoria B e caminhões até 6.000kg."}
              {cnhCategory === CNH_CATEGORY.D && "Permite dirigir veículos das categorias B, C e ônibus/micro-ônibus."}
              {cnhCategory === CNH_CATEGORY.E && "Permite dirigir todos os veículos anteriores e com reboque."}
              {cnhCategory.includes("A") && cnhCategory !== CNH_CATEGORY.A && " Inclui também motocicletas."}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
