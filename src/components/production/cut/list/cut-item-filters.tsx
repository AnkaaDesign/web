import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CUT_STATUS, CUT_TYPE } from "../../../../constants";
import { CUT_STATUS_LABELS, CUT_TYPE_LABELS } from "../../../../constants";
import type { CutGetManyFormData } from "../../../../schemas";

const filterSchema = z.object({
  status: z.array(z.nativeEnum(CUT_STATUS)).optional(),
  type: z.array(z.nativeEnum(CUT_TYPE)).optional(),
  sourceType: z.enum(["plan", "request", "all"]).optional(),
  dateRange: z
    .object({
      from: z.date().optional(),
      to: z.date().optional(),
    })
    .optional(),
});

type FilterFormData = z.infer<typeof filterSchema>;

interface CutItemFiltersProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Partial<CutGetManyFormData>;
  onFilterChange: (filters: Partial<CutGetManyFormData>) => void;
}

export function CutItemFilters({ open, onOpenChange, filters, onFilterChange }: CutItemFiltersProps) {
  const form = useForm<FilterFormData>({
    resolver: zodResolver(filterSchema),
    defaultValues: {
      status: (filters.where as any)?.status ? [(filters.where as any).status] : [],
      type: (filters.where as any)?.type ? [(filters.where as any).type] : [],
      sourceType: (filters.where as any)?.origin === "PLAN" ? "plan" : (filters.where as any)?.origin === "REQUEST" ? "request" : "all",
      dateRange: filters.createdAt
        ? {
            from: filters.createdAt.gte,
            to: filters.createdAt.lte,
          }
        : undefined,
    },
  });

  const handleSubmit = (data: FilterFormData) => {
    const newFilters: Partial<CutGetManyFormData> = {
      ...filters,
      where: {
        ...filters.where,
      },
    };

    // Clear existing filters
    if (newFilters.where) {
      delete newFilters.where.status;
      delete newFilters.where.type;
      delete (newFilters.where as any).origin;
    }

    if (data.status && data.status.length > 0) {
      newFilters.where = { ...newFilters.where, status: { in: data.status } };
    }

    if (data.type && data.type.length > 0) {
      newFilters.where = { ...newFilters.where, type: { in: data.type } };
    }

    if (data.sourceType && data.sourceType !== "all") {
      if (data.sourceType === "plan") {
        (newFilters.where as any) = { ...newFilters.where, origin: "PLAN" };
      } else if (data.sourceType === "request") {
        (newFilters.where as any) = { ...newFilters.where, origin: "REQUEST" };
      }
    }

    if (data.dateRange?.from || data.dateRange?.to) {
      newFilters.createdAt = {
        ...(data.dateRange.from && { gte: data.dateRange.from }),
        ...(data.dateRange.to && { lte: data.dateRange.to }),
      };
    } else {
      delete newFilters.createdAt;
    }

    onFilterChange(newFilters);
    onOpenChange(false);
  };

  const handleClear = () => {
    form.reset({
      status: [],
      type: [],
      sourceType: "all",
      dateRange: undefined,
    });
    onFilterChange({});
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Filtros</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      {Object.entries(CUT_STATUS_LABELS).map(([value, label]) => (
                        <div key={value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`status-${value}`}
                            checked={field.value?.includes(value as CUT_STATUS)}
                            onCheckedChange={(checked: boolean) => {
                              const current = field.value || [];
                              if (checked) {
                                field.onChange([...current, value]);
                              } else {
                                field.onChange(current.filter((s: string) => s !== value));
                              }
                            }}
                          />
                          <Label htmlFor={`status-${value}`} className="text-sm font-normal cursor-pointer">
                            {label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de Corte</FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      {Object.entries(CUT_TYPE_LABELS).map(([value, label]) => (
                        <div key={value} className="flex items-center space-x-2">
                          <Checkbox
                            id={`type-${value}`}
                            checked={field.value?.includes(value as CUT_TYPE)}
                            onCheckedChange={(checked: boolean) => {
                              const current = field.value || [];
                              if (checked) {
                                field.onChange([...current, value]);
                              } else {
                                field.onChange(current.filter((t: string) => t !== value));
                              }
                            }}
                          />
                          <Label htmlFor={`type-${value}`} className="text-sm font-normal cursor-pointer">
                            {label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sourceType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Origem</FormLabel>
                  <FormControl>
                    <Combobox
                      value={field.value || "all"}
                      onValueChange={field.onChange}
                      options={[
                        { value: "all", label: "Todas" },
                        { value: "plan", label: "Plano de Corte" },
                        { value: "request", label: "Solicitação" },
                      ]}
                      placeholder="Todas as origens"
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dateRange"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Período de Criação</FormLabel>
                  <FormControl>
                    <DateTimeInput
                      mode="date-range"
                      value={
                        field.value?.from
                          ? {
                              from: field.value.from,
                              to: field.value.to,
                            }
                          : undefined
                      }
                      onChange={(range) => field.onChange(range)}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClear}>
                Limpar
              </Button>
              <Button type="submit">Aplicar</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
