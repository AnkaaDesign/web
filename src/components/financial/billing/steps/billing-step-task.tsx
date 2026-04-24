import { useFormContext } from "react-hook-form";
import {
  IconTruck,
  IconBox,
  IconHash,
  IconNotes,
  IconCalendar,
  IconId,
  IconClipboardList,
} from "@tabler/icons-react";
import {
  TRUCK_CATEGORY,
  IMPLEMENT_TYPE,
  TRUCK_CATEGORY_LABELS,
  IMPLEMENT_TYPE_LABELS,
} from "@/constants";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { CustomerSelector } from "@/components/production/task/form/customer-selector";
import { BillingStepInfo } from "./billing-step-info";

interface BillingStepTaskProps {
  disabled?: boolean;
  customersCache: React.MutableRefObject<Map<string, any>>;
  initialCustomer?: any;
}

export function BillingStepTask({
  disabled,
  customersCache,
  initialCustomer,
}: BillingStepTaskProps) {
  const { control } = useFormContext();

  return (
    <div className="space-y-4">
      {/* Billing-relevant task fields */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <IconTruck className="h-4 w-4 text-muted-foreground" />
            Dados da Tarefa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Logomarca + Razão Social (customer) in a row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <IconClipboardList className="h-4 w-4" />
                    Logomarca
                  </FormLabel>
                  <FormControl>
                    <Input
                      value={field.value || ""}
                      onChange={(e) => field.onChange(e.target.value)}
                      placeholder="Ex: Pintura completa do caminhão"
                      disabled={disabled}
                      className="bg-transparent"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <CustomerSelector control={control} disabled={disabled} initialCustomer={initialCustomer} />
          </div>

          {/* Category + Implement Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={control}
              name="category"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="flex items-center gap-2">
                    <IconTruck className="h-4 w-4" />
                    Categoria do Caminhão
                  </FormLabel>
                  <Combobox
                    value={field.value || ""}
                    onValueChange={field.onChange}
                    options={[
                      { value: "", label: "Nenhuma" },
                      ...Object.values(TRUCK_CATEGORY).map((cat) => ({
                        value: cat,
                        label: TRUCK_CATEGORY_LABELS[cat],
                      })),
                    ]}
                    placeholder="Selecione a categoria"
                    searchPlaceholder="Buscar categoria..."
                    emptyText="Nenhuma categoria encontrada"
                    disabled={disabled}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="implementType"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="flex items-center gap-2">
                    <IconBox className="h-4 w-4" />
                    Tipo de Implemento
                  </FormLabel>
                  <Combobox
                    value={field.value || ""}
                    onValueChange={field.onChange}
                    options={[
                      { value: "", label: "Nenhum" },
                      ...Object.values(IMPLEMENT_TYPE).map((type) => ({
                        value: type,
                        label: IMPLEMENT_TYPE_LABELS[type],
                      })),
                    ]}
                    placeholder="Selecione o tipo de implemento"
                    searchPlaceholder="Buscar tipo..."
                    emptyText="Nenhum tipo encontrado"
                    disabled={disabled}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Serial Number + Plate + Chassi */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField
              control={control}
              name="serialNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <IconHash className="h-4 w-4" />
                    Número de Série
                  </FormLabel>
                  <FormControl>
                    <Input
                      value={field.value || ""}
                      onChange={(e) => field.onChange(e.target.value)}
                      placeholder="Ex: ABC-123"
                      disabled={disabled}
                      className="bg-transparent"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="plate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <IconTruck className="h-4 w-4" />
                    Placa
                  </FormLabel>
                  <FormControl>
                    <Input
                      value={field.value || ""}
                      onChange={(e) => field.onChange(e.target.value)}
                      placeholder="Ex: ABC-1234"
                      disabled={disabled}
                      className="bg-transparent"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="chassisNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <IconId className="h-4 w-4" />
                    Chassi
                  </FormLabel>
                  <FormControl>
                    <Input
                      value={field.value || ""}
                      onChange={(e) => field.onChange(e.target.value)}
                      placeholder="Ex: 9BW..."
                      disabled={disabled}
                      className="bg-transparent font-mono"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Finished At — read-only, never sent in update payload */}
          <FormField
            control={control}
            name="finishedAt"
            render={({ field }) => (
              <DateTimeInput
                {...{
                  onChange: field.onChange,
                  onBlur: field.onBlur,
                  value: field.value ?? null,
                }}
                mode="datetime"
                label={
                  <span className="flex items-center gap-2">
                    <IconCalendar className="h-4 w-4" />
                    Finalizado em
                  </span>
                }
                disabled={true}
              />
            )}
          />

          {/* Details */}
          <FormField
            control={control}
            name="details"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <IconNotes className="h-4 w-4" />
                  Detalhes
                </FormLabel>
                <FormControl>
                  <Textarea
                    value={field.value || ""}
                    onChange={(e) => field.onChange(e.target.value)}
                    placeholder="Detalhes adicionais sobre a tarefa..."
                    rows={3}
                    disabled={disabled}
                    className="bg-transparent"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      {/* Faturar Para — customer selector for invoicing */}
      <BillingStepInfo disabled={disabled} customersCache={customersCache} />
    </div>
  );
}
