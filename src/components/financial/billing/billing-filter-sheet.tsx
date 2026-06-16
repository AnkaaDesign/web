import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { FilterDrawer } from "@/components/common/filters/ui/FilterDrawer";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { IconFilter, IconCalendar, IconBuilding } from "@tabler/icons-react";
import { getCustomers } from "@/api-client/customer";
import { CustomerLogoDisplay } from "@/components/ui/avatar-display";

// Billing-relevant statuses (only PENDING excluded from default view)
const QUOTE_STATUS_OPTIONS = [
  { value: "BUDGET_APPROVED", label: "Orçamento Aprovado" },
  { value: "BILLING_APPROVED", label: "Faturamento Aprovado" },
  { value: "UPCOMING", label: "A Vencer" },
  { value: "DUE", label: "Vencido" },
  { value: "PARTIAL", label: "Parcial" },
  { value: "SETTLED", label: "Liquidado" },
];

export interface BillingFilters {
  finishedFrom: Date | undefined;
  finishedTo: Date | undefined;
  quoteStatuses: string[];
  customerIds: string[];
}

export const defaultBillingFilters: BillingFilters = {
  finishedFrom: undefined,
  finishedTo: undefined,
  quoteStatuses: [],
  customerIds: [],
};

interface BillingFilterSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: BillingFilters;
  onApply: (filters: BillingFilters) => void;
}

export function BillingFilterSheet({
  open,
  onOpenChange,
  filters,
  onApply,
}: BillingFilterSheetProps) {
  const [local, setLocal] = useState<BillingFilters>(filters);
  const customerCacheRef = useRef<Map<string, { id: string; name: string; logo?: any }>>(new Map());

  useEffect(() => {
    if (open) setLocal(filters);
  }, [open, filters]);

  // Async customer search matching the pattern used in task-preparation-filters
  const searchCustomers = useCallback(
    async (search?: string, page: number = 1): Promise<{ data: any[]; hasMore: boolean }> => {
      const params: any = {
        orderBy: { fantasyName: "asc" },
        page,
        take: 50,
        include: { logo: true },
      };
      if (search && search.trim()) {
        params.searchingFor = search.trim();
      }
      try {
        const response = await getCustomers(params);
        const customers = response.data || [];
        const hasMore = response.meta?.hasNextPage || false;
        customers.forEach((c: any) => {
          customerCacheRef.current.set(c.id, {
            id: c.id,
            name: c.corporateName || c.fantasyName,
            logo: c.logo,
          });
        });
        return { data: customers, hasMore };
      } catch {
        return { data: [], hasMore: false };
      }
    },
    [],
  );

  const activeCount = useMemo(() => {
    let c = 0;
    if (local.finishedFrom) c++;
    if (local.finishedTo) c++;
    if (local.quoteStatuses && local.quoteStatuses.length > 0) c++;
    if (local.customerIds && local.customerIds.length > 0) c++;
    return c;
  }, [local]);

  const handleApply = () => {
    onApply(local);
    onOpenChange(false);
  };

  const handleReset = () => {
    onApply(defaultBillingFilters);
    onOpenChange(false);
  };

  return (
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Faturamento - Filtros"
      titleIcon={<IconFilter className="h-5 w-5" />}
      description="Configure filtros para refinar a consulta de tarefas"
      activeFilterCount={activeCount}
      onApply={handleApply}
      onReset={handleReset}
      applyLabel="Aplicar Filtros"
      resetLabel="Limpar Filtros"
    >
      {/* Quote Status */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Status Faturamento</Label>
            <Combobox
              mode="multiple"
              value={local.quoteStatuses || []}
              onValueChange={(v) =>
                setLocal((prev) => ({
                  ...prev,
                  quoteStatuses: Array.isArray(v) ? v : [],
                }))
              }
              options={QUOTE_STATUS_OPTIONS}
              placeholder="Selecione o status..."
              searchable={false}
              clearable
            />
          </div>

          {/* Customer */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <IconBuilding className="h-4 w-4" />
              Faturar Para (Cliente)
            </Label>
            <Combobox<any>
              mode="multiple"
              placeholder="Buscar cliente..."
              emptyText="Nenhum cliente encontrado"
              value={local.customerIds || []}
              onValueChange={(v) =>
                setLocal((prev) => ({
                  ...prev,
                  customerIds: Array.isArray(v) ? v : [],
                }))
              }
              async={true}
              queryKey={["customers-billing-filter"]}
              queryFn={searchCustomers}
              minSearchLength={0}
              clearable
              getOptionValue={(customer: any) => customer.id}
              getOptionLabel={(customer: any) => customer.corporateName || customer.fantasyName}
              renderOption={(customer: any) => (
                <div className="flex items-center gap-3 w-full">
                  <CustomerLogoDisplay
                    logo={customer.logo}
                    customerName={customer.fantasyName || customer.corporateName}
                    size="sm"
                    shape="rounded"
                    className="flex-shrink-0"
                  />
                  <div className="flex flex-col gap-1 min-w-0 flex-1">
                    <div className="font-medium truncate">{customer.corporateName || customer.fantasyName}</div>
                  </div>
                </div>
              )}
            />
          </div>

          {/* Finished Date Range */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <IconCalendar className="h-4 w-4" />
              Período de Finalização
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
                <DateTimeInput
                  mode="date"
                  value={local.finishedFrom}
                  onChange={(dateOrRange) => {
                    const date = dateOrRange && typeof dateOrRange === "object" && "from" in dateOrRange ? dateOrRange.from : dateOrRange;
                    setLocal((prev) => ({
                      ...prev,
                      finishedFrom: date || undefined,
                    }));
                  }}
                  hideLabel
                  placeholder="Selecionar data inicial..."
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
                <DateTimeInput
                  mode="date"
                  value={local.finishedTo}
                  onChange={(dateOrRange) => {
                    const date = dateOrRange && typeof dateOrRange === "object" && "from" in dateOrRange ? dateOrRange.to : dateOrRange;
                    setLocal((prev) => ({
                      ...prev,
                      finishedTo: date || undefined,
                    }));
                  }}
                  hideLabel
                  placeholder="Selecionar data final..."
                />
              </div>
            </div>
          </div>
    </FilterDrawer>
  );
}
