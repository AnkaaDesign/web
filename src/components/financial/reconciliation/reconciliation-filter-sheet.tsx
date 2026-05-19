import { useEffect, useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { IconFilter, IconX, IconCalendar, IconCash } from "@tabler/icons-react";
import type {
  BankTransactionSubtype,
  MatchStatus,
  MatchType,
  TransactionType,
} from "@/types/reconciliation";

export interface ReconciliationFilters {
  matchStatus?: MatchStatus;
  matchType?: MatchType;
  type?: TransactionType;
  subtype?: BankTransactionSubtype;
  /** Period filter (year + selected months) — same workflow as Bônus. */
  year?: number;
  months?: string[];
  amountMin?: number;
  amountMax?: number;
  /** Kept as a URL/query option for deep links but no longer surfaced in the
   *  filter sheet — the page-level search input already covers it. */
  counterparty?: string;
}

/**
 * Default to the current period. The accordion view always needs a period to
 * enumerate dates against — empty period defaults are meaningless here.
 */
export function getDefaultReconciliationFilters(): ReconciliationFilters {
  const now = new Date();
  return {
    type: "DEBIT",
    year: now.getFullYear(),
    months: [String(now.getMonth() + 1).padStart(2, "0")],
  };
}

export const defaultReconciliationFilters: ReconciliationFilters = getDefaultReconciliationFilters();

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "UNMATCHED", label: "Não conciliado" },
  { value: "AUTO_MATCHED", label: "Conciliado (auto)" },
  { value: "MANUAL_MATCHED", label: "Conciliado" },
  { value: "PARTIAL", label: "Parcial" },
  { value: "IGNORED", label: "Ignorado" },
  { value: "DISPUTED", label: "Em disputa" },
];

const TYPE_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "CREDIT", label: "Crédito" },
  { value: "DEBIT", label: "Débito" },
];

const SUBTYPE_OPTIONS = [
  { value: "all", label: "Todas" },
  { value: "PIX", label: "PIX" },
  { value: "TED", label: "TED" },
  { value: "DOC", label: "DOC" },
  { value: "BOLETO", label: "Boleto" },
  { value: "TARIFA", label: "Tarifa" },
  { value: "IOF", label: "IOF" },
  { value: "CARTAO", label: "Cartão" },
  { value: "TRANSFERENCIA", label: "Transferência" },
  { value: "ESTORNO", label: "Estorno" },
  { value: "RENDIMENTO", label: "Rendimento" },
  { value: "OUTROS", label: "Outros" },
];

const MATCH_TYPE_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "EXACT", label: "Exato" },
  { value: "VALUE_DATE", label: "Valor e data" },
  { value: "FUZZY", label: "Aproximado" },
  { value: "MANUAL", label: "Manual" },
  { value: "BANK_SLIP_BRIDGE", label: "Via boleto" },
];

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
  filters: ReconciliationFilters;
  onApply: (f: ReconciliationFilters) => void;
}

export function ReconciliationFilterSheet({ open, onOpenChange, filters, onApply }: Props) {
  const [local, setLocal] = useState<ReconciliationFilters>(filters);

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
    const def = getDefaultReconciliationFilters();
    let c = 0;
    if (local.matchStatus) c++;
    if (local.matchType) c++;
    if (local.type && local.type !== def.type) c++;
    if (local.subtype) c++;
    if (local.year && local.year !== def.year) c++;
    if (
      local.months &&
      (local.months.length !== 1 || local.months[0] !== def.months?.[0])
    )
      c++;
    if (local.amountMin !== undefined) c++;
    if (local.amountMax !== undefined) c++;
    if (local.counterparty) c++;
    return c;
  }, [local]);

  const handleApply = () => {
    onApply(local);
    onOpenChange(false);
  };

  const handleReset = () => {
    onApply(getDefaultReconciliationFilters());
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Transações - Filtros
            {activeCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeCount}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            Refine a lista de transações bancárias por período, status, tipo e valor.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* Period — year + months side by side (this is the only horizontal pair
              kept besides date range and amount range). */}
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

          {/* Stacked single-column filter fields */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Status</Label>
            <Combobox
              value={local.matchStatus ?? "all"}
              onValueChange={v =>
                setLocal(s => ({
                  ...s,
                  matchStatus: v && v !== "all" ? (v as MatchStatus) : undefined,
                }))
              }
              options={STATUS_OPTIONS}
              placeholder="Selecione o status..."
              searchable={false}
              clearable={false}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Origem do pareamento</Label>
            <Combobox
              value={local.matchType ?? "all"}
              onValueChange={v =>
                setLocal(s => ({
                  ...s,
                  matchType: v && v !== "all" ? (v as MatchType) : undefined,
                }))
              }
              options={MATCH_TYPE_OPTIONS}
              placeholder="Como foi conciliado"
              searchable={false}
              clearable={false}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Tipo</Label>
            <Combobox
              value={local.type ?? "all"}
              onValueChange={v =>
                setLocal(s => ({
                  ...s,
                  type: v && v !== "all" ? (v as TransactionType) : undefined,
                }))
              }
              options={TYPE_OPTIONS}
              placeholder="Crédito ou Débito"
              searchable={false}
              clearable={false}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Forma</Label>
            <Combobox
              value={local.subtype ?? "all"}
              onValueChange={v =>
                setLocal(s => ({
                  ...s,
                  subtype: v && v !== "all" ? (v as BankTransactionSubtype) : undefined,
                }))
              }
              options={SUBTYPE_OPTIONS}
              placeholder="PIX, TED, Boleto..."
              searchable={false}
              clearable={false}
            />
          </div>

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
                    setLocal(s => ({
                      ...s,
                      amountMin: typeof v === "number" ? v : undefined,
                    }))
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
                    setLocal(s => ({
                      ...s,
                      amountMax: typeof v === "number" ? v : undefined,
                    }))
                  }
                  placeholder="R$ 0,00"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 mt-6 pt-4 border-t">
            <Button variant="outline" onClick={handleReset} className="flex-1">
              <IconX className="h-4 w-4 mr-2" />
              Limpar Filtros
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
