import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "../../../utils";
import type { DataTableColumnDef } from "@/components/ui/datatable";

// ---------------------------------------------------------------------------
// Row model + column factory for the bonus simulation. Same split as the
// promotions simulation: the interactive table owns the data, this file owns
// the rendering, and both share one source of truth for the row shape.
// ---------------------------------------------------------------------------

export interface SimulatedUser {
  id: string;
  name: string;
  email: string;
  payrollNumber: number | null;
  originalPosition: string;
  originalPerformanceLevel: number;
  sectorId: string | null;
  sectorName: string | null;
  // Simulation fields
  position: string;
  performanceLevel: number;
  bonusAmount: number;
  /**
   * Peso de elegibilidade do período (0–1), vindo do MESMO cadastro que a folha
   * usa. 1 = período inteiro. Menor que 1 = entrou, saiu ou esteve afastado no
   * meio do período — e o valor exibido já vem prorrateado por ele.
   */
  eligibilityWeight: number;
  /** Rótulo do motivo do peso parcial, para a tela explicar o número. */
  eligibilityReason: string;
}

// Per-row simulation edits (keyed by user id) persisted so the Cargo /
// Performance changes survive navigation. Only touched fields are stored.
export type RowOverride = { position?: string; performanceLevel?: number };

// Performance level selector with chevron buttons (0-5). O número fica laranja
// quando difere do cadastro — é o único aviso de que aquela linha é hipótese.
interface PerformanceLevelSelectorProps {
  value: number;
  onChange: (value: number) => void;
  isModified?: boolean;
  disabled?: boolean;
}

function PerformanceLevelSelector({ value, onChange, isModified, disabled }: PerformanceLevelSelectorProps) {
  const handleDecrease = () => {
    const newValue = Math.max(0, value - 1);
    if (newValue !== value) onChange(newValue);
  };
  const handleIncrease = () => {
    const newValue = Math.min(5, value + 1);
    if (newValue !== value) onChange(newValue);
  };

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleDecrease}
        disabled={disabled || value <= 0}
        className="h-7 w-7 p-0 hover:bg-muted"
        title="Diminuir nível"
      >
        <IconChevronLeft className="h-4 w-4" />
      </Button>
      <div
        className={cn(
          "flex items-center justify-center w-8 h-7 font-semibold text-sm",
          isModified ? "text-orange-600" : "text-foreground",
          disabled && "opacity-50",
        )}
        title={`Nível de desempenho: ${value} (0-5)`}
      >
        {value}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleIncrease}
        disabled={disabled || value >= 5}
        className="h-7 w-7 p-0 hover:bg-muted"
        title="Aumentar nível"
      >
        <IconChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

export interface BonusSimulationColumnsParams {
  /** Cargos bonificáveis (nomes), já ordenados por hierarquia. */
  positionOptions: string[];
  /** Trocar o cargo → recalcula o bônus via /bonus/simulate. */
  onPositionChange: (userId: string, position: string) => void;
  /** Trocar o nível → recalcula o bônus via /bonus/simulate. */
  onPerformanceLevelChange: (userId: string, level: number) => void;
}

/**
 * Colunas da simulação de bônus como `DataTableColumnDef`s. Cargo e Performance
 * são interativos (Combobox / stepper); busca, ordenação, layout de colunas e
 * exportação vêm do DataTable. `meta.exportValue` alimenta a planilha/PDF e a
 * busca (as células interativas não têm texto próprio para casar).
 */
export function createBonusSimulationColumns({
  positionOptions,
  onPositionChange,
  onPerformanceLevelChange,
}: BonusSimulationColumnsParams): DataTableColumnDef<SimulatedUser>[] {
  return [
    {
      id: "payrollNumber",
      header: "Nº Folha",
      accessorFn: (row) => row.payrollNumber ?? -1,
      enableSorting: true,
      size: 96,
      minSize: 80,
      meta: { align: "left", exportValue: (row) => row.payrollNumber ?? "" },
      cell: ({ row }) => <span className="text-sm font-medium text-muted-foreground">{row.original.payrollNumber || "-"}</span>,
    },
    {
      id: "name",
      header: "Nome",
      accessorFn: (row) => row.name,
      enableSorting: true,
      size: 260,
      minSize: 180,
      meta: { align: "left", exportValue: (row) => row.name },
      cell: ({ row }) => {
        const u = row.original;
        return (
          <div className="flex min-w-0 items-baseline gap-1.5">
            <TruncatedTextWithTooltip text={u.name} className="text-sm font-medium" />
            {/* Peso parcial precisa aparecer: sem isto, um valor prorrateado
                parece erro de cálculo. */}
            {u.eligibilityWeight < 1 && (
              <span className="shrink-0 text-xs text-muted-foreground" title={u.eligibilityReason}>
                ({Math.round(u.eligibilityWeight * 100)}% do período)
              </span>
            )}
          </div>
        );
      },
    },
    {
      id: "sectorName",
      header: "Setor",
      accessorFn: (row) => row.sectorName || "",
      enableSorting: true,
      size: 160,
      minSize: 120,
      meta: { align: "left", exportValue: (row) => row.sectorName || "" },
      cell: ({ row }) =>
        row.original.sectorName ? (
          <TruncatedTextWithTooltip text={row.original.sectorName} className="text-sm text-muted-foreground" />
        ) : (
          <span className="text-sm text-muted-foreground">-</span>
        ),
    },
    {
      id: "position",
      header: "Cargo",
      accessorFn: (row) => row.position,
      enableSorting: true,
      size: 220,
      minSize: 170,
      meta: { align: "left", exportValue: (row) => row.position },
      cell: ({ row }) => {
        const u = row.original;
        const positionChanged = u.position !== u.originalPosition;
        return (
          <Combobox
            mode="single"
            value={u.position}
            onValueChange={(value) => {
              if (value && typeof value === "string") onPositionChange(u.id, value);
            }}
            options={positionOptions.map((pos) => ({ value: pos, label: pos }))}
            placeholder="Selecione o cargo"
            emptyText="Nenhum cargo encontrado"
            searchable={true}
            className={cn("w-full", positionChanged && "ring-1 ring-orange-500/50 rounded-md")}
            renderValue={() => <span className={cn("truncate", positionChanged && "text-orange-600 font-medium")}>{u.position}</span>}
          />
        );
      },
    },
    {
      id: "performanceLevel",
      header: "Performance",
      accessorFn: (row) => row.performanceLevel,
      enableSorting: true,
      size: 150,
      minSize: 130,
      meta: { align: "center", exportValue: (row) => row.performanceLevel },
      cell: ({ row }) => {
        const u = row.original;
        return (
          <div className="flex w-full items-center justify-center">
            <PerformanceLevelSelector
              value={u.performanceLevel}
              onChange={(level) => onPerformanceLevelChange(u.id, level)}
              isModified={u.performanceLevel !== u.originalPerformanceLevel}
            />
          </div>
        );
      },
    },
    {
      id: "bonusAmount",
      header: "Bônus",
      accessorFn: (row) => row.bonusAmount,
      enableSorting: true,
      size: 140,
      minSize: 120,
      meta: { align: "right", exportValue: (row) => formatCurrency(row.bonusAmount) },
      cell: ({ row }) => (
        <span className={cn("font-bold tabular-nums", row.original.bonusAmount > 0 ? "text-green-600" : "text-muted-foreground")}>
          {formatCurrency(row.original.bonusAmount)}
        </span>
      ),
    },
  ];
}
