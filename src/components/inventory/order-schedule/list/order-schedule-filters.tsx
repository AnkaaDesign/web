import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { IconCalendar, IconFilter, IconX, IconSearch } from "@tabler/icons-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

import { SCHEDULE_FREQUENCY, SCHEDULE_FREQUENCY_LABELS } from "../../../../constants";
import type { SCHEDULE_FREQUENCY as SCHEDULE_FREQUENCY_TYPE } from "../../../../constants";

const filtersSchema = z.object({
  searchingFor: z.string().optional(),
  isActive: z.boolean().optional(),
  frequency: z.array(z.enum(Object.values(SCHEDULE_FREQUENCY) as [string, ...string[]])).optional(),
  supplierIds: z.array(z.string()).optional(),
  categoryIds: z.array(z.string()).optional(),
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
      searchingFor: "",
      isActive: undefined,
      frequency: [],
      supplierIds: [],
      categoryIds: [],
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
        categoryIds: value.categoryIds?.filter((item): item is string => item !== undefined),
        supplierIds: value.supplierIds?.filter((item): item is string => item !== undefined),
      };
      setLocalFilters(cleanValue);
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const handleReset = () => {
    form.reset({
      searchingFor: "",
      isActive: undefined,
      frequency: [],
      supplierIds: [],
      categoryIds: [],
      nextRunRange: { gte: undefined, lte: undefined },
    });
  };

  const handleApply = () => {
    onFiltersChange(localFilters);
    onOpenChange(false);
  };

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
            <form className="space-y-8">
              {/* Search */}
              <div className="space-y-2">
                <Label htmlFor="searchingFor">Buscar</Label>
                <div className="relative">
                  <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input {...form.register("searchingFor")} placeholder="Buscar por fornecedor, categoria..." className="pl-9" />
                </div>
              </div>

              {/* Active Status Toggle */}
              <div className="flex items-center justify-between">
                <Label htmlFor="isActive">Apenas cronogramas ativos</Label>
                <Switch id="isActive" checked={watchedValues.isActive === true} onCheckedChange={(checked) => form.setValue("isActive", checked ? true : undefined)} />
              </div>

              {/* Frequency Filter */}
              <div className="space-y-2">
                <Label>Frequência</Label>
                <Combobox
                  value=""
                  onChange={(value) => {
                    const currentFrequency = watchedValues.frequency || [];
                    if (value && !currentFrequency.includes(value as SCHEDULE_FREQUENCY)) {
                      form.setValue("frequency", [...currentFrequency, value as SCHEDULE_FREQUENCY]);
                    }
                  }}
                  options={Object.values(SCHEDULE_FREQUENCY).map((frequency) => ({
                    value: frequency,
                    label: SCHEDULE_FREQUENCY_LABELS[frequency],
                  }))}
                  placeholder="Adicionar frequência"
                />

                {watchedValues.frequency && watchedValues.frequency.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {watchedValues.frequency.map((freq) => (
                      <Badge key={freq} variant="secondary" className="text-xs">
                        {SCHEDULE_FREQUENCY_LABELS[freq as SCHEDULE_FREQUENCY_TYPE]}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-auto p-0 ml-1 text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            const newFrequency = watchedValues.frequency!.filter((f) => f !== freq);
                            form.setValue("frequency", newFrequency);
                          }}
                        >
                          <IconX className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Date Range Filters */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Próxima execução - De</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !watchedValues.nextRunRange?.gte && "text-muted-foreground")}>
                        <IconCalendar className="mr-2 h-4 w-4" />
                        {watchedValues.nextRunRange?.gte ? format(watchedValues.nextRunRange.gte, "PPP", { locale: ptBR }) : "Selecione a data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={watchedValues.nextRunRange?.gte} onSelect={(date) => form.setValue("nextRunRange.gte", date)} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="space-y-2">
                  <Label>Próxima execução - Até</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !watchedValues.nextRunRange?.lte && "text-muted-foreground")}>
                        <IconCalendar className="mr-2 h-4 w-4" />
                        {watchedValues.nextRunRange?.lte ? format(watchedValues.nextRunRange.lte, "PPP", { locale: ptBR }) : "Selecione a data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={watchedValues.nextRunRange?.lte} onSelect={(date) => form.setValue("nextRunRange.lte", date)} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </form>
          </Form>

          {/* Action Buttons */}
          <div className="flex gap-2 mt-6 pt-4 border-t">
            <Button variant="outline" onClick={handleReset} className="flex-1">
              <IconX className="h-4 w-4 mr-2" />
              Limpar
            </Button>
            <Button onClick={handleApply} className="flex-1">
              Aplicar Filtros
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
