import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { IconCalendar, IconFilter, IconX, IconTriangleInverted, IconCalendarRepeat } from "@tabler/icons-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

import { SCHEDULE_FREQUENCY, SCHEDULE_FREQUENCY_LABELS } from "../../../../constants";
import type { SCHEDULE_FREQUENCY as SCHEDULE_FREQUENCY_TYPE } from "../../../../constants";

const filtersSchema = z.object({
  isActive: z.boolean().optional(),
  frequency: z.array(z.enum(Object.values(SCHEDULE_FREQUENCY) as [string, ...string[]])).optional(),
  nextRunRange: z
    .object({
      gte: z.date().optional(),
      lte: z.date().optional(),
    })
    .optional(),
});

export type OrderScheduleFiltersFormData = z.infer<typeof filtersSchema>;

interface OrderScheduleFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFiltersChange: (filters: OrderScheduleFiltersFormData) => void;
  initialFilters?: Partial<OrderScheduleFiltersFormData>;
}

export function OrderScheduleFilters({ open, onOpenChange, onFiltersChange, initialFilters = {} }: OrderScheduleFiltersProps) {
  const [localFilters, setLocalFilters] = React.useState<OrderScheduleFiltersFormData>(initialFilters);

  const form = useForm<OrderScheduleFiltersFormData>({
    resolver: zodResolver(filtersSchema),
    defaultValues: {
      isActive: undefined,
      frequency: [],
      nextRunRange: {
        gte: undefined,
        lte: undefined,
      },
      ...initialFilters,
    },
  });

  const watchedValues = form.watch();

  // Sync form values to local filters
  React.useEffect(() => {
    const subscription = form.watch((value) => {
      const cleanValue = {
        ...value,
        frequency: value.frequency?.filter((item): item is string => item !== undefined),
      };
      setLocalFilters(cleanValue);
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const handleReset = () => {
    form.reset({
      isActive: undefined,
      frequency: [],
      nextRunRange: { gte: undefined, lte: undefined },
    });
  };

  const handleApply = () => {
    onFiltersChange(localFilters);
    onOpenChange(false);
  };

  // Count active filters
  const countActiveFilters = () => {
    let count = 0;
    if (typeof watchedValues.isActive === "boolean") count++;
    if (watchedValues.frequency && watchedValues.frequency.length > 0) count++;
    if (watchedValues.nextRunRange?.gte || watchedValues.nextRunRange?.lte) count++;
    return count;
  };

  const activeFilterCount = countActiveFilters();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Filtros de Cronogramas
          </SheetTitle>
          <SheetDescription>
            Configure os filtros para refinar sua busca por cronogramas de pedidos.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <Form {...form}>
            <form className="space-y-6">
              {/* Status Filter */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <IconTriangleInverted className="h-4 w-4" />
                  Status
                </Label>
                <Combobox
                  mode="single"
                  options={[
                    { value: "ambos", label: "Ambos" },
                    { value: "ativo", label: "Ativo" },
                    { value: "inativo", label: "Inativo" },
                  ]}
                  value={
                    watchedValues.isActive === true ? "ativo" :
                    watchedValues.isActive === false ? "inativo" :
                    "ambos"
                  }
                  onValueChange={(value) => {
                    form.setValue("isActive", value === "ativo" ? true : value === "inativo" ? false : undefined);
                  }}
                  placeholder="Selecione..."
                  emptyText="Nenhuma opção encontrada"
                />
              </div>

              {/* Frequency Filter */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <IconCalendarRepeat className="h-4 w-4" />
                  Frequência
                </Label>
                <Combobox
                  mode="multiple"
                  options={Object.values(SCHEDULE_FREQUENCY).map((frequency) => ({
                    value: frequency,
                    label: SCHEDULE_FREQUENCY_LABELS[frequency],
                  }))}
                  value={watchedValues.frequency || []}
                  onValueChange={(value) => {
                    const frequencyValue = value as SCHEDULE_FREQUENCY_TYPE[];
                    form.setValue("frequency", frequencyValue.length > 0 ? frequencyValue : undefined);
                  }}
                  placeholder="Selecione frequências..."
                  emptyText="Nenhuma frequência encontrada"
                  searchPlaceholder="Buscar frequência..."
                />
                {watchedValues.frequency && watchedValues.frequency.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {watchedValues.frequency.length} frequência{watchedValues.frequency.length !== 1 ? "s" : ""} selecionada{watchedValues.frequency.length !== 1 ? "s" : ""}
                  </div>
                )}
              </div>

              {/* Date Range Filters */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <IconCalendar className="h-4 w-4" />
                  Próxima Execução
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">De</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !watchedValues.nextRunRange?.gte && "text-muted-foreground")}>
                          <IconCalendar className="mr-2 h-4 w-4" />
                          {watchedValues.nextRunRange?.gte ? format(watchedValues.nextRunRange.gte, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        {/* @ts-expect-error - react-day-picker prop mismatch */}
                        <Calendar mode="single" selected={watchedValues.nextRunRange?.gte} onSelect={(date: Date | undefined) => form.setValue("nextRunRange.gte", date ?? undefined)} autoFocus />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div>
                    <Label className="text-xs text-muted-foreground">Até</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !watchedValues.nextRunRange?.lte && "text-muted-foreground")}>
                          <IconCalendar className="mr-2 h-4 w-4" />
                          {watchedValues.nextRunRange?.lte ? format(watchedValues.nextRunRange.lte, "dd/MM/yyyy", { locale: ptBR }) : "Selecione"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={watchedValues.nextRunRange?.lte} onSelect={(date: Date | undefined) => form.setValue("nextRunRange.lte", date ?? undefined)} autoFocus {...({} as any)} />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
              </div>
            </form>
          </Form>

          {/* Action Buttons */}
          <div className="flex gap-2 mt-6 pt-4 border-t">
            <Button variant="outline" onClick={handleReset} className="flex-1">
              <IconX className="h-4 w-4 mr-2" />
              Limpar todos
            </Button>
            <Button onClick={handleApply} className="flex-1">
              Aplicar filtros
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
