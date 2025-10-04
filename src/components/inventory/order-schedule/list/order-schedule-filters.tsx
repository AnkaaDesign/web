import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { IconCalendar, IconFilter, IconX, IconSearch, IconRotate } from "@tabler/icons-react";
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
  onFiltersChange: (filters: OrderScheduleFiltersFormData) => void;
  initialFilters?: Partial<OrderScheduleFiltersFormData>;
  className?: string;
}

export function OrderScheduleFilters({ onFiltersChange, initialFilters = {}, className }: OrderScheduleFiltersProps) {
  const [showAdvancedFilters, setShowAdvancedFilters] = React.useState(false);

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

  React.useEffect(() => {
    const subscription = form.watch((value) => {
      // Filter out undefined values from arrays
      const cleanValue = {
        ...value,
        frequency: value.frequency?.filter((item): item is string => item !== undefined),
        categoryIds: value.categoryIds?.filter((item): item is string => item !== undefined),
        supplierIds: value.supplierIds?.filter((item): item is string => item !== undefined),
      };
      onFiltersChange(cleanValue);
    });
    return () => subscription.unsubscribe();
  }, [form, onFiltersChange]);

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

  const getActiveFiltersCount = () => {
    let count = 0;
    if (watchedValues.searchingFor) count++;
    if (watchedValues.isActive !== undefined) count++;
    if (watchedValues.frequency?.length) count++;
    if (watchedValues.supplierIds?.length) count++;
    if (watchedValues.categoryIds?.length) count++;
    if (watchedValues.nextRunRange?.gte || watchedValues.nextRunRange?.lte) count++;
    return count;
  };

  const activeFiltersCount = getActiveFiltersCount();

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <IconFilter className="h-4 w-4" />
              Filtros
            </CardTitle>
            {activeFiltersCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {activeFiltersCount}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}>
              {showAdvancedFilters ? "Filtros Simples" : "Filtros Avançados"}
            </Button>

            {activeFiltersCount > 0 && (
              <Button variant="ghost" size="sm" onClick={handleReset} className="text-muted-foreground">
                <IconRotate className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            )}
          </div>
        </div>
        <CardDescription>Filtre os cronogramas por status, frequência, fornecedor e outros critérios</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <Form {...form}>
          <form className="space-y-4">
            {/* Search */}
            <div className="relative">
              <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input {...form.register("searchingFor")} placeholder="Buscar por fornecedor, categoria..." transparent={true} className="pl-9" />
            </div>

            {/* Active Status Toggle */}
            <div className="flex items-center justify-between">
              <Label htmlFor="isActive">Apenas cronogramas ativos</Label>
              <Switch id="isActive" checked={watchedValues.isActive === true} onCheckedChange={(checked) => form.setValue("isActive", checked ? true : undefined)} />
            </div>

            {/* Basic Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            </div>

            {/* Advanced Filters */}
            {showAdvancedFilters && (
              <div className="space-y-4 pt-4 border-t">
                {/* Date Range Filter */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Próxima execução - De</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("justify-start text-left font-normal", !watchedValues.nextRunRange?.gte && "text-muted-foreground")}>
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
                        <Button variant="outline" className={cn("justify-start text-left font-normal", !watchedValues.nextRunRange?.lte && "text-muted-foreground")}>
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
              </div>
            )}
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
