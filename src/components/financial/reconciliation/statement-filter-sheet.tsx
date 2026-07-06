import { useEffect, useMemo, useState } from "react";
import { FilterDrawer } from "@/components/common/filters/ui/FilterDrawer";
import { Label } from "@/components/ui/label";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { IconFilter, IconCalendar, IconCash } from "@tabler/icons-react";
import { currentPeriod } from "./period-nav";

/**
 * The Extrato "Filtros" sheet — the period (year + selected months) and the
 * price range. Type (Entradas/Saídas) and conciliation status stay as the inline
 * KPI cards, so the sheet holds only the two dimensions that don't fit a card:
 * a multi-month period and a value range. Mirrors the Notas Fiscais filter sheet
 * so both pages share one filter model.
 */
export interface StatementFilters {
  year: number;
  months: string[];
  amountMin?: number;
  amountMax?: number;
}

export function getDefaultStatementFilters(): StatementFilters {
  const p = currentPeriod();
  return { year: p.year, months: p.months };
}

const MONTH_OPTIONS = [
  { value: "01", label: "Janeiro" },
  { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },
  { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  filters: StatementFilters;
  onApply: (f: StatementFilters) => void;
}

export function StatementFilterSheet({ open, onOpenChange, filters, onApply }: Props) {
  const [local, setLocal] = useState<StatementFilters>(filters);

  // Resync the draft whenever the sheet (re)opens so it reflects the live filters.
  useEffect(() => {
    if (open) setLocal(filters);
  }, [open, filters]);

  const yearOptions = useMemo<ComboboxOption[]>(() => {
    const out: ComboboxOption[] = [];
    const currentYear = new Date().getFullYear();
    for (let i = 0; i <= 3; i++) {
      const y = currentYear - i;
      out.push({ value: y.toString(), label: y.toString() });
    }
    return out;
  }, []);

  const activeCount = useMemo(() => {
    const def = getDefaultStatementFilters();
    let c = 0;
    if (local.year !== def.year) c++;
    if (local.months.length !== 1 || local.months[0] !== def.months[0]) c++;
    if (local.amountMin !== undefined) c++;
    if (local.amountMax !== undefined) c++;
    return c;
  }, [local]);

  const handleApply = () => {
    onApply(local);
    onOpenChange(false);
  };

  const handleReset = () => {
    onApply(getDefaultStatementFilters());
    onOpenChange(false);
  };

  return (
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Extrato - Filtros"
      titleIcon={<IconFilter className="h-5 w-5" />}
      description="Refine o extrato por período (um ou mais meses) e faixa de valor."
      activeFilterCount={activeCount}
      onApply={handleApply}
      onReset={handleReset}
      applyLabel="Aplicar Filtros"
      resetLabel="Limpar Filtros"
      contentClassName="space-y-5"
    >
      {/* Período — year + months (multi). The inline stepper drives single-month
          browsing; this is where a multi-month span is chosen. */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <IconCalendar className="h-4 w-4" />
          Período
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-1">
            <Label className="text-xs text-muted-foreground mb-1 block">Ano</Label>
            <Combobox
              value={local.year.toString()}
              onValueChange={value => {
                const year = Array.isArray(value) ? value[0] : value;
                const newYear = year ? parseInt(year) : local.year;
                setLocal(s => ({ ...s, year: newYear }));
              }}
              options={yearOptions}
              placeholder="Ano..."
              searchable={false}
              clearable={false}
            />
          </div>
          <div className="col-span-2">
            <Label className="text-xs text-muted-foreground mb-1 block">Meses</Label>
            <Combobox
              mode="multiple"
              value={local.months}
              onValueChange={value => {
                const months = Array.isArray(value) ? value : value ? [value] : [];
                setLocal(s => ({ ...s, months }));
              }}
              options={MONTH_OPTIONS}
              placeholder="Selecione os meses..."
              searchPlaceholder="Buscar meses..."
              emptyText="Nenhum mês encontrado"
              searchable={true}
              clearable={false}
              hideDefaultBadges={true}
            />
          </div>
        </div>
      </div>

      {/* Faixa de valor — magnitude range applied client-side to the account rows. */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <IconCash className="h-4 w-4" />
          Faixa de valor
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Mínimo</Label>
            <Input
              type="currency"
              value={local.amountMin ?? null}
              onChange={v =>
                setLocal(s => ({ ...s, amountMin: typeof v === "number" ? v : undefined }))
              }
              placeholder="R$ 0,00"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Máximo</Label>
            <Input
              type="currency"
              value={local.amountMax ?? null}
              onChange={v =>
                setLocal(s => ({ ...s, amountMax: typeof v === "number" ? v : undefined }))
              }
              placeholder="R$ 0,00"
            />
          </div>
        </div>
      </div>
    </FilterDrawer>
  );
}
