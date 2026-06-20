import { useEffect } from "react";
import { useForm, FormProvider } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { FormMoneyInput } from "@/components/ui/form-money-input";
import { IconCash, IconDeviceFloppy, IconLoader2 } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { formatDate } from "../../../../utils";
import type { Termination } from "../../../../types/termination";
import { useTerminationMutations } from "../../../../hooks/personnel-department/use-terminations";
import { isPaymentOverdue } from "../list/termination-table-columns";

interface PaymentFormData {
  paymentDate: Date | null;
  paidAmount: number | null;
}

interface PaymentCardProps {
  termination: Termination;
  /** True when the termination is COMPLETED/CANCELLED — blocks every mutation. */
  disabled?: boolean;
  /** Render without the outer Card chrome — used when embedded in a shared card. */
  bare?: boolean;
  className?: string;
}

export function PaymentCard({ termination, disabled = false, bare = false, className }: PaymentCardProps) {
  const { updateAsync, updateMutation } = useTerminationMutations();
  const overdue = isPaymentOverdue(termination);

  const form = useForm<PaymentFormData>({
    defaultValues: {
      paymentDate: termination.paymentDate ? new Date(termination.paymentDate) : null,
      paidAmount: termination.paidAmount ?? null,
    },
  });

  // Keep the form in sync when the termination is refetched
  useEffect(() => {
    form.reset({
      paymentDate: termination.paymentDate ? new Date(termination.paymentDate) : null,
      paidAmount: termination.paidAmount ?? null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termination.id, termination.paymentDate, termination.paidAmount]);

  const handleSubmit = async (data: PaymentFormData) => {
    try {
      await updateAsync({
        id: termination.id,
        data: {
          paymentDate: data.paymentDate,
          paidAmount: data.paidAmount,
        },
      });
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== "production") {
        console.error("Error saving termination payment:", error);
      }
    }
  };

  const Wrapper = bare ? "div" : Card;

  return (
    <Wrapper className={cn("flex flex-col", !bare && "shadow-sm border border-border", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <IconCash className="h-5 w-5 text-muted-foreground" />
          Pagamento
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-4 flex-1 flex flex-col">
        {/* CLT 477 §8º — overdue payment exposes the company to a fine */}
        {overdue && (
          <Alert variant="destructive">
            <AlertTitle>Pagamento em atraso</AlertTitle>
            <AlertDescription>
              O prazo de 10 dias corridos (CLT 477 §6º) foi ultrapassado. O atraso sujeita a empresa à multa do art. 477 §8º: multa administrativa por
              trabalhador + multa em favor do colaborador no valor equivalente ao seu salário.
            </AlertDescription>
          </Alert>
        )}

        {/* Payment due date */}
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm text-muted-foreground">Prazo de Pagamento (CLT 477 §6º)</span>
          {termination.paymentDueDate ? (
            <span className="inline-flex items-center gap-2 text-sm font-medium">
              <span className={overdue ? "text-destructive" : undefined}>{formatDate(new Date(termination.paymentDueDate))}</span>
              {overdue && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                  Atrasado
                </Badge>
              )}
            </span>
          ) : (
            <span className="text-sm font-medium">-</span>
          )}
        </div>

        <FormProvider {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="paymentDate"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <DateTimeInput
                        mode="date"
                        value={field.value}
                        onChange={(date) => field.onChange(date instanceof Date ? date : null)}
                        label="Data de Pagamento"
                        disabled={disabled || updateMutation.isPending}
                        placeholder="Selecione a data de pagamento"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormMoneyInput<PaymentFormData> name="paidAmount" label="Valor Pago" disabled={disabled || updateMutation.isPending} />
            </div>

            <div className="flex justify-end">
              <Button type="submit" variant="outline" size="sm" disabled={disabled || updateMutation.isPending}>
                {updateMutation.isPending ? <IconLoader2 className="h-4 w-4 mr-2 animate-spin" /> : <IconDeviceFloppy className="h-4 w-4 mr-2" />}
                Salvar pagamento
              </Button>
            </div>
          </form>
        </FormProvider>

        <Alert variant="warning" className="mt-auto">
          <AlertDescription>Ao concluir a rescisão o colaborador será demitido (contrato marcado como Demitido).</AlertDescription>
        </Alert>
      </CardContent>
    </Wrapper>
  );
}
