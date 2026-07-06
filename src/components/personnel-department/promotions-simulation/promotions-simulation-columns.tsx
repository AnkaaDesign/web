import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { IconArrowUpRight, IconArrowDownRight, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "../../../utils";
import type { DataTableColumnDef } from "@/components/ui/datatable";

// ---------------------------------------------------------------------------
// Row model + shared helpers for the promotions simulation. Kept alongside the
// column factory so the interactive table (data building) and the columns
// (rendering) share a single source of truth for the row shape.
// ---------------------------------------------------------------------------

export interface SimulatedUser {
  id: string;
  name: string;
  email: string | null;
  payrollNumber: number | null;
  sectorId: string | null;
  sectorName: string | null;
  // Baselines (current position/remuneration/performance)
  originalPositionId: string | null;
  originalPositionName: string;
  originalRemuneration: number;
  originalPerformanceLevel: number;
  // Bonifiable flag drives bonus eligibility (average-per-user divisor)
  originalBonifiable: boolean;
  // Simulation fields (cargo + performance are editable)
  positionId: string | null;
  positionName: string;
  performanceLevel: number;
  // Derived
  expectedRemuneration: number; // remuneration of the (possibly changed) position
  bonusAtual: number; // bonus at the current position (baseline)
  bonusPrevisto: number; // bonus at the simulated position
}

// Per-row simulation edits (keyed by user id) persisted so the Cargo /
// Performance changes survive navigation. Only the fields the user actually
// touched are stored; everything else is rebuilt from the fresh user fetch.
export type RowOverride = { positionId?: string; performanceLevel?: number };

// Read the current monthly remuneration off a position. Backend populates the
// virtual `remuneration` field from the current MonetaryValue; fall back to the
// newest history row. Performance level never affects base remuneration.
export const getPositionRemuneration = (position?: {
  remuneration?: number;
  remunerations?: Array<{ value: number }>;
} | null): number => {
  return position?.remuneration ?? position?.remunerations?.[0]?.value ?? 0;
};

// Signed currency for delta columns / totals.
export const formatSignedCurrency = (value: number): string => {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatCurrency(Math.abs(value))}`;
};

// A signed-currency delta cell with up/down arrow + color. Padding + right
// alignment come from the DataTable cell (`meta.align`), so this is bare content.
function DeltaCell({ value, zeroThreshold = 0 }: { value: number; zeroThreshold?: number }) {
  if (Math.abs(value) <= zeroThreshold) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
  const positive = value > 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-sm font-medium tabular-nums", positive ? "text-green-600" : "text-red-600")}>
      {positive ? <IconArrowUpRight className="h-3 w-3" /> : <IconArrowDownRight className="h-3 w-3" />}
      {formatSignedCurrency(value)}
    </span>
  );
}

// Performance level selector with chevron buttons (0-5). Mirrors the bonus
// simulation — editing it re-runs /bonus/simulate for the "Bônus Previsto".
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

export interface PromotionsSimulationColumnsParams {
  /** Destination-cargo options (already sorted by hierarchy, then name). */
  positionOptions: Array<{ value: string; label: string }>;
  /** Changing the cargo → recompute expected remuneration + simulated bonus. */
  onPositionChange: (userId: string, positionId: string) => void;
  /** Changing the performance level → recompute simulated bonus (never base pay). */
  onPerformanceLevelChange: (userId: string, level: number) => void;
}

/**
 * The promotions-simulation column set as generic `DataTableColumnDef`s. Cargo and
 * Performance are interactive (Combobox / stepper); the DataTable renders sorting,
 * column visibility/reorder/resize, search and export around them. `meta.exportValue`
 * feeds the spreadsheet/PDF export and the client-side search (interactive cells have
 * no plain text of their own).
 */
export function createPromotionsSimulationColumns({
  positionOptions,
  onPositionChange,
  onPerformanceLevelChange,
}: PromotionsSimulationColumnsParams): DataTableColumnDef<SimulatedUser>[] {
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
      size: 240,
      minSize: 180,
      meta: { align: "left", exportValue: (row) => row.name },
      cell: ({ row }) => <TruncatedTextWithTooltip text={row.original.name} className="text-sm font-medium" />,
    },
    {
      id: "sectorName",
      header: "Setor",
      accessorFn: (row) => row.sectorName || "",
      enableSorting: true,
      size: 150,
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
      id: "positionName",
      header: "Cargo",
      accessorFn: (row) => row.positionName,
      enableSorting: true,
      size: 300,
      minSize: 200,
      meta: { align: "left", exportValue: (row) => row.positionName },
      cell: ({ row }) => {
        const u = row.original;
        const positionChanged = u.positionId !== u.originalPositionId;
        return (
          <Combobox
            mode="single"
            value={u.positionId ?? undefined}
            onValueChange={(value) => {
              if (value && typeof value === "string") onPositionChange(u.id, value);
            }}
            options={positionOptions}
            placeholder="Selecione o cargo"
            emptyText="Nenhum cargo encontrado"
            searchable={true}
            className={cn("w-full", positionChanged && "ring-1 ring-orange-500/50 rounded-md")}
            renderValue={() => <span className={cn("truncate", positionChanged && "text-orange-600 font-medium")}>{u.positionName}</span>}
          />
        );
      },
    },
    {
      id: "performanceLevel",
      header: "Performance",
      accessorFn: (row) => row.performanceLevel,
      enableSorting: true,
      size: 160,
      minSize: 140,
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
      id: "currentRemuneration",
      header: "Remun. Atual",
      accessorFn: (row) => row.originalRemuneration,
      enableSorting: true,
      size: 130,
      minSize: 110,
      meta: { align: "right", exportValue: (row) => row.originalRemuneration },
      cell: ({ row }) => <span className="text-sm text-muted-foreground tabular-nums">{formatCurrency(row.original.originalRemuneration)}</span>,
    },
    {
      id: "expectedRemuneration",
      header: "Remun. Prevista",
      accessorFn: (row) => row.expectedRemuneration,
      enableSorting: true,
      size: 140,
      minSize: 120,
      meta: { align: "right", exportValue: (row) => row.expectedRemuneration },
      cell: ({ row }) => {
        const u = row.original;
        const changed = u.positionId !== u.originalPositionId;
        return <span className={cn("font-semibold tabular-nums", changed ? "text-orange-600" : "text-foreground")}>{formatCurrency(u.expectedRemuneration)}</span>;
      },
    },
    {
      id: "remunerationDiff",
      header: "Dif. Remun.",
      accessorFn: (row) => row.expectedRemuneration - row.originalRemuneration,
      enableSorting: true,
      size: 130,
      minSize: 110,
      meta: { align: "right", exportValue: (row) => row.expectedRemuneration - row.originalRemuneration },
      cell: ({ row }) => <DeltaCell value={row.original.expectedRemuneration - row.original.originalRemuneration} />,
    },
    {
      id: "bonusAtual",
      header: "Bônus Atual",
      accessorFn: (row) => row.bonusAtual,
      enableSorting: true,
      size: 120,
      minSize: 110,
      meta: { align: "right", exportValue: (row) => row.bonusAtual },
      cell: ({ row }) => <span className="text-sm text-muted-foreground tabular-nums">{formatCurrency(row.original.bonusAtual)}</span>,
    },
    {
      id: "bonusPrevisto",
      header: "Bônus Previsto",
      accessorFn: (row) => row.bonusPrevisto,
      enableSorting: true,
      size: 140,
      minSize: 120,
      meta: { align: "right", exportValue: (row) => row.bonusPrevisto },
      cell: ({ row }) => (
        <span className={cn("font-bold tabular-nums", row.original.bonusPrevisto > 0 ? "text-green-600" : "text-muted-foreground")}>
          {formatCurrency(row.original.bonusPrevisto)}
        </span>
      ),
    },
    {
      id: "bonusDiff",
      header: "Dif. Bônus",
      accessorFn: (row) => row.bonusPrevisto - row.bonusAtual,
      enableSorting: true,
      size: 130,
      minSize: 110,
      meta: { align: "right", exportValue: (row) => row.bonusPrevisto - row.bonusAtual },
      cell: ({ row }) => <DeltaCell value={row.original.bonusPrevisto - row.original.bonusAtual} zeroThreshold={0.005} />,
    },
  ];
}
