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
import { Combobox } from "@/components/ui/combobox";
import { DateTimeInput } from "@/components/ui/date-time-input";
import { Input } from "@/components/ui/input";
import {
  IconFilter,
  IconX,
  IconCalendar,
  IconCash,
  IconUser,
} from "@tabler/icons-react";
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
  dateFrom?: string;
  dateTo?: string;
  amountMin?: number;
  amountMax?: number;
  counterparty?: string;
  statementId?: string;
}

export const defaultReconciliationFilters: ReconciliationFilters = {};

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

  const activeCount = useMemo(() => {
    let c = 0;
    if (local.matchStatus) c++;
    if (local.matchType) c++;
    if (local.type) c++;
    if (local.subtype) c++;
    if (local.dateFrom) c++;
    if (local.dateTo) c++;
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
    onApply(defaultReconciliationFilters);
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
            Refine a lista de transações bancárias por status, tipo, data e valor.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-3">
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
          </div>

          <div className="grid grid-cols-2 gap-3">
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
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <IconUser className="h-4 w-4" />
              Contraparte
            </div>
            <Input
              value={local.counterparty ?? ""}
              onChange={v =>
                setLocal(s => ({
                  ...s,
                  counterparty: typeof v === "string" && v ? v : undefined,
                }))
              }
              placeholder="Nome ou CNPJ/CPF"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <IconCalendar className="h-4 w-4" />
              Período
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">De</Label>
                <DateTimeInput
                  mode="date"
                  value={local.dateFrom ? new Date(local.dateFrom) : undefined}
                  onChange={d => {
                    const date = d && typeof d === "object" && "from" in d ? d.from : (d as Date | undefined);
                    setLocal(s => ({
                      ...s,
                      dateFrom: date ? date.toISOString().slice(0, 10) : undefined,
                    }));
                  }}
                  hideLabel
                  placeholder="Data inicial..."
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Até</Label>
                <DateTimeInput
                  mode="date"
                  value={local.dateTo ? new Date(local.dateTo) : undefined}
                  onChange={d => {
                    const date = d && typeof d === "object" && "from" in d ? d.to : (d as Date | undefined);
                    setLocal(s => ({
                      ...s,
                      dateTo: date ? date.toISOString().slice(0, 10) : undefined,
                    }));
                  }}
                  hideLabel
                  placeholder="Data final..."
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
