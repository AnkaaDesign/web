import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CalendarIcon, User, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { absenceCreateSchema, type AbsenceCreateFormData } from "../../../../schemas";
import { useAbsenceMutations } from "../../../../hooks";
import { UserSelector } from "@/components/administration/user/common/user-selector";
import { toast } from "sonner";

interface AbsenceFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
  defaultUserId?: string;
}

export function AbsenceForm({ onSuccess, onCancel, defaultUserId }: AbsenceFormProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const { create } = useAbsenceMutations();

  const form = useForm<AbsenceCreateFormData>({
    resolver: zodResolver(absenceCreateSchema),
    defaultValues: {
      userId: defaultUserId || "",
      date: new Date(),
      reason: "",
    },
  });

  const watchedDate = form.watch("date");
  const watchedUserId = form.watch("userId");

  // Check if the selected date is in the past (requires justification)
  const isPastDate = () => {
    if (!watchedDate) return false;
    const today = new Date();
    const selectedDate = new Date(watchedDate);
    today.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);
    return selectedDate < today;
  };

  // Check if the selected date is too far in the past or future
  const isDateOutOfRange = () => {
    if (!watchedDate) return false;
    const now = new Date();
    const selectedDate = new Date(watchedDate);
    const maxPastDate = new Date();
    maxPastDate.setDate(now.getDate() - 30); // 30 days ago
    const maxFutureDate = new Date();
    maxFutureDate.setDate(now.getDate() + 7); // 7 days in future

    return selectedDate < maxPastDate || selectedDate > maxFutureDate;
  };

  const onSubmit = async (data: AbsenceCreateFormData) => {
    try {
      await create(data);
      toast.success("Falta registrada com sucesso!");
      form.reset();
      onSuccess?.();
    } catch (error) {
      toast.error("Erro ao registrar falta");
      console.error(error);
    }
  };

  const isSubmitDisabled = !watchedUserId || !watchedDate || isDateOutOfRange();

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Registrar Falta
        </CardTitle>
        <CardDescription>
          Registre uma falta de funcionário com as informações necessárias
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* User Selection */}
            <FormField
              control={form.control}
              name="userId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Funcionário *</FormLabel>
                  <FormControl>
                    <UserSelector
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder="Selecione um funcionário"
                      filter={{
                        status: "ACTIVE",
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Date Selection */}
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data da Falta *</FormLabel>
                  <FormControl>
                    <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !field.value && "text-muted-foreground",
                            isDateOutOfRange() && "border-destructive"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? (
                            format(field.value, "PPP", { locale: ptBR })
                          ) : (
                            "Selecione uma data"
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(date) => {
                            field.onChange(date);
                            setIsCalendarOpen(false);
                          }}
                          locale={ptBR}
                          disabled={(date) => {
                            const now = new Date();
                            const maxPastDate = new Date();
                            maxPastDate.setDate(now.getDate() - 30);
                            const maxFutureDate = new Date();
                            maxFutureDate.setDate(now.getDate() + 7);
                            return date < maxPastDate || date > maxFutureDate;
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </FormControl>
                  <FormMessage />
                  {isDateOutOfRange() && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        A data deve estar entre 30 dias atrás e 7 dias no futuro
                      </AlertDescription>
                    </Alert>
                  )}
                </FormItem>
              )}
            />

            {/* Date Info Alert */}
            {watchedDate && !isDateOutOfRange() && (
              <Alert className={isPastDate() ? "border-amber-200 bg-amber-50" : "border-blue-200 bg-blue-50"}>
                {isPastDate() ? (
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                )}
                <AlertDescription className={isPastDate() ? "text-amber-800" : "text-blue-800"}>
                  {isPastDate()
                    ? "Data passada selecionada - justificativa será obrigatória"
                    : "Data futura selecionada - falta será registrada como prevista"}
                </AlertDescription>
              </Alert>
            )}

            {/* Reason/Justification */}
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {isPastDate() ? "Justificativa *" : "Motivo (opcional)"}
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder={
                        isPastDate()
                          ? "Informe a justificativa para a falta..."
                          : "Informe o motivo da falta (opcional)..."
                      }
                      className="min-h-[100px] resize-none"
                      maxLength={500}
                    />
                  </FormControl>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <FormMessage />
                    <span>{field.value?.length || 0}/500</span>
                  </div>
                  {isPastDate() && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Como a data selecionada está no passado, a justificativa é obrigatória
                      </AlertDescription>
                    </Alert>
                  )}
                </FormItem>
              )}
            />

            {/* Form Actions */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={isSubmitDisabled || create.isPending}
                className="flex-1"
              >
                {create.isPending ? "Registrando..." : "Registrar Falta"}
              </Button>
              {onCancel && (
                <Button type="button" variant="outline" onClick={onCancel}>
                  Cancelar
                </Button>
              )}
            </div>

            {/* Form Validation Summary */}
            {isSubmitDisabled && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {!watchedUserId && "Selecione um funcionário. "}
                  {!watchedDate && "Selecione uma data. "}
                  {isDateOutOfRange() && "A data deve estar dentro do período permitido. "}
                </AlertDescription>
              </Alert>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}