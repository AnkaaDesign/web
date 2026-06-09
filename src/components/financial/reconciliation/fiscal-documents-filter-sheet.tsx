import { useEffect, useMemo, useState } from "react";
import { FilterDrawer } from "@/components/common/filters/ui/FilterDrawer";
import { Label } from "@/components/ui/label";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import {
  IconFilter,
  IconCalendar,
  IconCash,
  IconBuilding,
} from "@tabler/icons-react";
import type {
  FiscalDocType,
  FiscalDocumentStatus,
  OperationType,
} from "@/types/reconciliation";

export interface FiscalDocumentsFiltersUi {
  docType?: FiscalDocType;
  operationType?: OperationType;
  status?: FiscalDocumentStatus;
  valueMin?: number;
  valueMax?: number;
  emitCnpj?: string;
  destCnpj?: string;
  hasMatch?: boolean;
  /** Period (year + selected months). Mirrors the transactions page. */
  year?: number;
  months?: string[];
}

// Keep a type alias so the page file can stay shorter.
type SubsetFilters = FiscalDocumentsFiltersUi;

/**
 * Default to the current period plus the previous one — the accordion needs a
 * period to enumerate dates against. The period model only spans a single
 * calendar year, so in January (no prior month in the same year) we fall back to
 * the current month.
 */
export function getDefaultFiscalDocumentsFilters(): FiscalDocumentsFiltersUi {
  const now = new Date();
  const currentMonth = now.getMonth() + 1; // 1-12
  const months =
    currentMonth > 1
      ? [String(currentMonth - 1).padStart(2, "0"), String(currentMonth).padStart(2, "0")]
      : [String(currentMonth).padStart(2, "0")];
  return {
    year: now.getFullYear(),
    months,
  };
}

export const defaultFiscalDocumentsFilters: FiscalDocumentsFiltersUi =
  getDefaultFiscalDocumentsFilters();

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

const DOC_TYPE_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "NFE", label: "NF-e" },
  { value: "NFSE", label: "NFS-e" },
  { value: "CTE", label: "CT-e" },
  { value: "NFCE", label: "NFC-e" },
  { value: "CFE", label: "CF-e" },
];

const OPERATION_OPTIONS = [
  { value: "all", label: "Todas" },
  { value: "ENTRADA", label: "Entrada" },
  { value: "SAIDA", label: "Saída" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "AUTHORIZED", label: "Autorizada" },
  { value: "CANCELLED", label: "Cancelada" },
  { value: "DENIED", label: "Denegada" },
  { value: "PENDING", label: "Pendente" },
];

const VINCULADA_OPTIONS = [
  { value: "all", label: "Todas" },
  { value: "yes", label: "Apenas vinculadas" },
  { value: "no", label: "Apenas não vinculadas" },
];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  filters: SubsetFilters;
  onApply: (f: SubsetFilters) => void;
}

export function FiscalDocumentsFilterSheet({ open, onOpenChange, filters, onApply }: Props) {
  const [local, setLocal] = useState<SubsetFilters>(filters);

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
    const def = getDefaultFiscalDocumentsFilters();
    let c = 0;
    if (local.docType) c++;
    if (local.operationType) c++;
    if (local.status) c++;
    if (local.year && local.year !== def.year) c++;
    if (
      local.months &&
      (local.months.length !== 1 || local.months[0] !== def.months?.[0])
    )
      c++;
    if (local.valueMin !== undefined) c++;
    if (local.valueMax !== undefined) c++;
    if (local.emitCnpj) c++;
    if (local.destCnpj) c++;
    if (local.hasMatch !== undefined) c++;
    return c;
  }, [local]);

  const handleApply = () => {
    onApply(local);
    onOpenChange(false);
  };
  const handleReset = () => {
    onApply(getDefaultFiscalDocumentsFilters());
    onOpenChange(false);
  };

  const vinculadaValue =
    local.hasMatch === true ? "yes" : local.hasMatch === false ? "no" : "all";

  return (
    <FilterDrawer
      open={open}
      onOpenChange={onOpenChange}
      title="Notas Fiscais - Filtros"
      titleIcon={<IconFilter className="h-5 w-5" />}
      description="Refine a lista por tipo de documento, operação, status, período, valor e vínculo."
      activeFilterCount={activeCount}
      onApply={handleApply}
      onReset={handleReset}
      applyLabel="Aplicar Filtros"
      resetLabel="Limpar Filtros"
    >
      {/* Period — year + months, same workflow as the transactions page. */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <IconCalendar className="h-4 w-4" />
              Período
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <Label className="text-xs text-muted-foreground mb-1 block">Ano</Label>
                <Combobox
                  value={local.year?.toString() || ""}
                  onValueChange={value => {
                    const year = Array.isArray(value) ? value[0] : value;
                    const newYear = year ? parseInt(year) : undefined;
                    setLocal(s => ({
                      ...s,
                      year: newYear,
                      months: newYear ? s.months : undefined,
                    }));
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
                  value={local.months || []}
                  onValueChange={value => {
                    const months = Array.isArray(value)
                      ? value
                      : value
                        ? [value]
                        : undefined;
                    setLocal(s => ({ ...s, months }));
                  }}
                  options={MONTH_OPTIONS}
                  placeholder={local.year ? "Selecione os meses..." : "Selecione um ano primeiro"}
                  searchPlaceholder="Buscar meses..."
                  emptyText="Nenhum mês encontrado"
                  disabled={!local.year}
                  searchable={true}
                  clearable={false}
                  hideDefaultBadges={true}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Tipo</Label>
              <Combobox
                value={local.docType ?? "all"}
                onValueChange={v =>
                  setLocal(s => ({
                    ...s,
                    docType: v && v !== "all" ? (v as FiscalDocType) : undefined,
                  }))
                }
                options={DOC_TYPE_OPTIONS}
                searchable={false}
                clearable={false}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Operação</Label>
              <Combobox
                value={local.operationType ?? "all"}
                onValueChange={v =>
                  setLocal(s => ({
                    ...s,
                    operationType: v && v !== "all" ? (v as OperationType) : undefined,
                  }))
                }
                options={OPERATION_OPTIONS}
                searchable={false}
                clearable={false}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Status</Label>
              <Combobox
                value={local.status ?? "all"}
                onValueChange={v =>
                  setLocal(s => ({
                    ...s,
                    status: v && v !== "all" ? (v as FiscalDocumentStatus) : undefined,
                  }))
                }
                options={STATUS_OPTIONS}
                searchable={false}
                clearable={false}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Vínculo</Label>
              <Combobox
                value={vinculadaValue}
                onValueChange={v => {
                  const next =
                    v === "yes" ? true : v === "no" ? false : undefined;
                  setLocal(s => ({ ...s, hasMatch: next }));
                }}
                options={VINCULADA_OPTIONS}
                searchable={false}
                clearable={false}
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <IconBuilding className="h-4 w-4" />
              CNPJ
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Emitente</Label>
                <Input
                  value={local.emitCnpj ?? ""}
                  onChange={v =>
                    setLocal(s => ({
                      ...s,
                      emitCnpj: typeof v === "string" && v ? v : undefined,
                    }))
                  }
                  placeholder="Somente dígitos"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Destinatário</Label>
                <Input
                  value={local.destCnpj ?? ""}
                  onChange={v =>
                    setLocal(s => ({
                      ...s,
                      destCnpj: typeof v === "string" && v ? v : undefined,
                    }))
                  }
                  placeholder="Somente dígitos"
                />
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <IconCash className="h-4 w-4" />
              Faixa de valor
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Mínimo</Label>
                <Input
                  type="currency"
                  value={local.valueMin ?? null}
                  onChange={v =>
                    setLocal(s => ({
                      ...s,
                      valueMin: typeof v === "number" ? v : undefined,
                    }))
                  }
                  placeholder="R$ 0,00"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Máximo</Label>
                <Input
                  type="currency"
                  value={local.valueMax ?? null}
                  onChange={v =>
                    setLocal(s => ({
                      ...s,
                      valueMax: typeof v === "number" ? v : undefined,
                    }))
                  }
                  placeholder="R$ 0,00"
                />
              </div>
            </div>
          </div>
    </FilterDrawer>
  );
}
