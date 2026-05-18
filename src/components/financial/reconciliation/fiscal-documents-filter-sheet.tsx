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
  IconBuilding,
} from "@tabler/icons-react";
import type {
  FiscalDocType,
  FiscalDocumentStatus,
  OperationType,
  FiscalDocumentFilters,
} from "@/types/reconciliation";

type SubsetFilters = Pick<
  FiscalDocumentFilters,
  | "docType"
  | "operationType"
  | "status"
  | "dateFrom"
  | "dateTo"
  | "valueMin"
  | "valueMax"
  | "emitCnpj"
  | "destCnpj"
  | "hasMatch"
>;

export const defaultFiscalDocumentsFilters: SubsetFilters = {};

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

  const activeCount = useMemo(() => {
    let c = 0;
    if (local.docType) c++;
    if (local.operationType) c++;
    if (local.status) c++;
    if (local.dateFrom) c++;
    if (local.dateTo) c++;
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
    onApply(defaultFiscalDocumentsFilters);
    onOpenChange(false);
  };

  const vinculadaValue =
    local.hasMatch === true ? "yes" : local.hasMatch === false ? "no" : "all";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <IconFilter className="h-5 w-5" />
            Notas Fiscais - Filtros
            {activeCount > 0 && (
              <Badge variant="secondary" className="ml-2">
                {activeCount}
              </Badge>
            )}
          </SheetTitle>
          <SheetDescription>
            Refine a lista por tipo de documento, operação, status, período, valor e vínculo.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
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
              <IconCalendar className="h-4 w-4" />
              Período de emissão
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
