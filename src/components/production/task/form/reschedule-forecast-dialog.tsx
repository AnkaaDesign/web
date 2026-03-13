import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { IconCalendarEvent } from "@tabler/icons-react";
import { taskRescheduleForecastSchema, type TaskRescheduleForecastFormData } from "../../../../schemas";
import { useRescheduleForecast } from "../../../../hooks";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";

interface RescheduleForecastDialogProps {
  taskId: string;
  currentForecastDate: Date | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RescheduleForecastDialog({
  taskId,
  currentForecastDate,
  open,
  onOpenChange,
}: RescheduleForecastDialogProps) {
  const { mutateAsync, isPending } = useRescheduleForecast();

  const form = useForm<TaskRescheduleForecastFormData>({
    resolver: zodResolver(taskRescheduleForecastSchema),
    defaultValues: {
      forecastDate: currentForecastDate ?? undefined,
      reason: "",
    },
  });

  const onSubmit = async (data: TaskRescheduleForecastFormData) => {
    try {
      await mutateAsync({ id: taskId, data });
      toast.success("Previsao de liberacao reagendada com sucesso");
      onOpenChange(false);
      form.reset();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Erro ao reagendar previsao");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconCalendarEvent className="h-5 w-5" />
            Reagendar Previsao de Liberacao
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {currentForecastDate && (
              <div className="text-sm text-muted-foreground">
                Data atual:{" "}
                <span className="font-medium text-foreground">
                  {new Date(currentForecastDate).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            )}

            <FormField
              control={form.control}
              name="forecastDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nova Data de Previsao</FormLabel>
                  <FormControl>
                    <DateTimeInput
                      {...{
                        field: {
                          onChange: (value: Date | null) => field.onChange(value),
                          onBlur: () => field.onBlur(),
                          value: field.value ?? null,
                          name: field.name,
                        },
                        mode: "datetime",
                        context: "start",
                        allowManualInput: true,
                      } as any}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motivo do Reagendamento</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Ex: Solicitacao do cliente, falta de material..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Reagendando..." : "Reagendar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
