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
import { IconFilter, IconX, IconCalendar } from "@tabler/icons-react";
import type {
  BankStatementImportStatus,
  BankStatementSource,
  StatementFilters,
} from "@/types/reconciliation";

export const defaultStatementsFilters: Pick<StatementFilters, "status" | "source" | "dateFrom" | "dateTo"> = {};

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "PENDING", label: "Aguardando" },
  { value: "PARSING", label: "Processando" },
  { value: "MATCHING", label: "Pareando" },
  { value: "COMPLETED", label: "Concluído" },
  { value: "FAILED", label: "Erro" },
];

const SOURCE_OPTIONS = [
  { value: "all", label: "Todas" },
  { value: "OFX_SICREDI", label: "OFX (Sicredi)" },
  { value: "MANUAL", label: "Manual" },
];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  filters: Pick<StatementFilters, "status" | "source" | "dateFrom" | "dateTo">;
  onApply: (f: Pick<StatementFilters, "status" | "source" | "dateFrom" | "dateTo">) => void;
}

export function StatementsFilterSheet({ open, onOpenChange, filters, onApply }: Props) {
  const [local, setLocal] = useState(filters);

  useEffect(() => {
    if (open) setLocal(filters);
  }, [open, filters]);

  const activeCount = useMemo(() => {
    let c = 0;
    if (local.status) c++;
    if (local.source) c++;
    if (local.dateFrom) c++;
    if (local.dateTo) c++;
    return c;
  }, [local]);

  const handleApply = () => {
    onApply(local);
    onOpenChange(false);
  };
  const handleReset = () => {
    onApply(defaultStatementsFilters);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Extratos - Filtros
            {activeCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeCount}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            Refine a lista de extratos bancários por status, origem ou período.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Status</Label>
            <Combobox
              value={local.status ?? "all"}
              onValueChange={v =>
                setLocal(s => ({
                  ...s,
                  status:
                    v && v !== "all" ? (v as BankStatementImportStatus) : undefined,
                }))
              }
              options={STATUS_OPTIONS}
              placeholder="Selecione..."
              searchable={false}
              clearable={false}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Origem</Label>
            <Combobox
              value={local.source ?? "all"}
              onValueChange={v =>
                setLocal(s => ({
                  ...s,
                  source: v && v !== "all" ? (v as BankStatementSource) : undefined,
                }))
              }
              options={SOURCE_OPTIONS}
              placeholder="Selecione..."
              searchable={false}
              clearable={false}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <IconCalendar className="h-4 w-4" />
              Período do extrato
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
