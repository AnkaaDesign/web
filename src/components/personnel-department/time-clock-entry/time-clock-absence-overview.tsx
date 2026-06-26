import { useState, useMemo, useEffect } from "react";
import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  IconCalendarOff,
  IconEdit,
} from "@tabler/icons-react";

import type { SecullumAbsenceDayRow } from "@/types";
import {
  SECULLUM_JUSTIFICATIVAS,
  getJustificativaCategory,
  getJustificativaMeta,
  TONE_CLASSES,
} from "@/constants";
import { useSecullumAbsenceDays, useUsers } from "@/hooks";
import { AbsenceFormDialog } from "@/components/personnel-department/absence/form/absence-form-dialog";
import type { SecullumAggregatedAbsence } from "@/types";
import {
  toAbsenceExportRow,
  TimeClockAbsenceExport,
  type AbsenceExportRow,
} from "./time-clock-absence-export";
import { PeriodControl } from "./period-control";

import { Card, CardContent } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import type { ComboboxOption } from "@/components/ui/combobox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useColumnVisibility } from "@/hooks/common/use-column-visibility";
import { ColumnVisibilityManager } from "@/components/integrations/secullum/calculations/list";
import type { ColumnDef } from "@/components/integrations/secullum/calculations/list";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_USERS = "__ALL__";
const FERIAS_JUSTIFICATIVA_ID = 2;
const WEEKDAY_SHORT_PT = ["Dom.", "Seg.", "Ter.", "Qua.", "Qui.", "Sex.", "Sáb."];

// ─── Types ────────────────────────────────────────────────────────────────────

type AbsenceFilterMode =
  | "TODOS"
  | "FALTA_NAO_JUSTIFICADA"
  | "FALTA"
  | "AUSENCIA"
  | "FERIAS"
  | string; // `JUSTIFICATIVA_${number}` for specific justificativas

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getPayrollPeriod = (month: Date) => ({
  start: new Date(month.getFullYear(), month.getMonth() - 1, 26),
  end: new Date(month.getFullYear(), month.getMonth(), 25),
});

// Default to today's month — matches the other Controle de Ponto views: when
// today is May, the period is 26/04 → 25/05 ("Maio"). (Previously this advanced
// to the cycle CONTAINING today, so on/after the 26th it jumped a month ahead.)
const defaultPeriod = () => {
  const refMonth = new Date();
  return { refMonth, ...getPayrollPeriod(refMonth) };
};

const getPayrollPeriodDisplay = (month: Date) => {
  const start = new Date(month.getFullYear(), month.getMonth() - 1, 26);
  const end = new Date(month.getFullYear(), month.getMonth(), 25);
  return {
    period: `${format(start, "dd/MM", { locale: ptBR })} a ${format(end, "dd/MM/yyyy", { locale: ptBR })}`,
    monthName: format(month, "MMMM yyyy", { locale: ptBR }),
  };
};

const fmtDate = (s: string) => {
  const parts = s.substring(0, 10).split("-");
  if (parts.length !== 3) return s;
  const d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
  return isNaN(d.getTime()) ? s : format(d, "dd/MM/yy", { locale: ptBR });
};

const fmtWeekday = (dateStr: string) => {
  const parts = dateStr.substring(0, 10).split("-");
  if (parts.length !== 3) return "";
  const d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
  return WEEKDAY_SHORT_PT[d.getDay()] ?? "";
};

// ─── Filter options ───────────────────────────────────────────────────────────

// JustificativaIds that already have a dedicated aggregate filter above
// (excluded from the spread to avoid duplicate labels in the combobox).
const AGGREGATE_DUPLICATE_IDS = new Set<number>([
  FERIAS_JUSTIFICATIVA_ID, // matches "FERIAS" aggregate (label: "Férias")
  3, // matches "FALTA_NAO_JUSTIFICADA" aggregate (label: "Falta sem Justificativa")
]);

const ABSENCE_FILTER_OPTIONS: ComboboxOption[] = [
  { value: "TODOS", label: "Todos os registros" },
  { value: "FALTA_NAO_JUSTIFICADA", label: "Faltas Não Justificadas" },
  { value: "FALTA", label: "Todas as Faltas" },
  { value: "AUSENCIA", label: "Ausências" },
  { value: "FERIAS", label: "Férias" },
  ...Object.values(SECULLUM_JUSTIFICATIVAS)
    .filter((j) => !AGGREGATE_DUPLICATE_IDS.has(j.id))
    .map((j) => ({
      value: `JUSTIFICATIVA_${j.id}`,
      label: j.label,
    })),
];

// ─── Tipo label pill (no background, just colored text + dot) ─────────────────

function TipoPill({ justificativaId, descricao }: { justificativaId: number; descricao?: string }) {
  const meta = getJustificativaMeta(justificativaId);
  const label = meta?.label ?? descricao ?? `#${justificativaId}`;
  return (
    <span
      className={cn(
        "text-sm font-medium whitespace-nowrap",
        meta ? TONE_CLASSES[meta.tone].text : "text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

// ─── Absence overview table ───────────────────────────────────────────────────

const ABSENCE_COLUMNS: ColumnDef[] = [
  { key: "data", header: "Data" },
  { key: "colaborador", header: "Colaborador" },
  { key: "faltas", header: "Faltas" },
  { key: "tipo", header: "Tipo" },
  { key: "setor", header: "Setor" },
  { key: "motivo", header: "Motivo" },
];

function AbsenceOverviewTable({
  records,
  isLoading,
  onEdit,
  visibleColumns,
}: {
  records: SecullumAbsenceDayRow[];
  isLoading: boolean;
  onEdit: (r: SecullumAbsenceDayRow) => void;
  visibleColumns: Set<string>;
}) {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    row: SecullumAbsenceDayRow;
  } | null>(null);

  // Close the context menu on any outside click / scroll.
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [contextMenu]);

  const cols = ABSENCE_COLUMNS.filter((c) => visibleColumns.has(c.key));

  if (isLoading) {
    return (
      <Table>
        <TableHeader>
          <TableRow className="bg-muted hover:bg-muted">
            {cols.map((c) => (
              <TableHead
                key={c.key}
                className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted px-4 py-2 border-b border-border"
              >
                {c.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 6 }).map((_, i) => (
            <TableRow key={i}>
              {cols.map((c) => (
                <TableCell key={c.key} className="px-4">
                  <Skeleton className="h-4 w-full" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  }

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
        <IconCalendarOff className="h-8 w-8 opacity-40" />
        <p className="text-sm">Nenhum registro encontrado no período</p>
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader className="sticky top-0 z-10">
          <TableRow className="bg-muted hover:bg-muted">
            {cols.map((c) => (
              <TableHead
                key={c.key}
                className="whitespace-nowrap text-foreground font-bold uppercase text-xs bg-muted px-4 py-2 border-b border-border"
              >
                {c.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {records.map((r, i) => (
            <TableRow
              key={`${r.userId}-${r.date}-${i}`}
              className={cn(
                "transition-colors border-b border-border [&>td]:py-2 cursor-pointer",
                i % 2 === 1 && "bg-muted/10",
                "hover:bg-muted/20",
              )}
              onClick={() => onEdit(r)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setContextMenu({ x: e.clientX, y: e.clientY, row: r });
              }}
            >
              {visibleColumns.has("data") && (
                <TableCell className="tabular-nums px-4 whitespace-nowrap">
                  {fmtDate(r.date)}
                  <span className="ml-1 text-xs text-muted-foreground">{fmtWeekday(r.date)}</span>
                  {r.isPartialDay && (
                    <span className="ml-1.5 text-xs text-amber-600 dark:text-amber-400">(parcial)</span>
                  )}
                </TableCell>
              )}
              {visibleColumns.has("colaborador") && (
                <TableCell className="font-medium px-4 whitespace-nowrap">
                  {r.userName}
                </TableCell>
              )}
              {visibleColumns.has("faltas") && (
                <TableCell className="tabular-nums px-4 whitespace-nowrap text-muted-foreground text-sm">
                  {r.faltas ?? "—"}
                </TableCell>
              )}
              {visibleColumns.has("tipo") && (
                <TableCell className="px-4">
                  <TipoPill justificativaId={r.JustificativaId} descricao={r.JustificativaDescricao} />
                </TableCell>
              )}
              {visibleColumns.has("setor") && (
                <TableCell className="text-muted-foreground px-4 whitespace-nowrap">
                  {r.sectorName ?? "—"}
                </TableCell>
              )}
              {visibleColumns.has("motivo") && (
                <TableCell
                  className="text-muted-foreground px-4 truncate max-w-[260px]"
                  title={r.Motivo ?? ""}
                >
                  {r.Motivo || "—"}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Right-click context menu — anchored at the cursor */}
      {contextMenu && (
        <div className="fixed z-50" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <DropdownMenu open={true} onOpenChange={(o) => !o && setContextMenu(null)}>
            <DropdownMenuTrigger asChild>
              <div className="w-0 h-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem
                onClick={() => {
                  onEdit(contextMenu.row);
                  setContextMenu(null);
                }}
              >
                <IconEdit className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface AbsenceOverviewExportData {
  rows: AbsenceExportRow[];
  startDate: Date;
  endDate: Date;
  filterLabel?: string;
}

interface TimeClockAbsenceOverviewProps {
  className?: string;
  onExportDataChange?: (data: AbsenceOverviewExportData | null) => void;
}

// Adapt SecullumAbsenceDayRow to the shape expected by AbsenceFormDialog
// (which still expects a SecullumAggregatedAbsence for editing).
function rowToAggregated(r: SecullumAbsenceDayRow): SecullumAggregatedAbsence {
  return {
    Id: r.absenceRecordId ?? -(r.FuncionarioId * 1000000 + parseInt(r.date.replace(/-/g, ""), 10)),
    FuncionarioId: r.FuncionarioId,
    Inicio: r.date + "T00:00:00",
    Fim: r.date + "T00:00:00",
    JustificativaId: r.JustificativaId,
    JustificativaDescricao: r.JustificativaDescricao,
    Motivo: r.Motivo,
    userId: r.userId,
    userName: r.userName,
    sectorId: r.sectorId,
    sectorName: r.sectorName,
  };
}

export function TimeClockAbsenceOverview({ className, onExportDataChange }: TimeClockAbsenceOverviewProps) {
  const { refMonth, start, end } = defaultPeriod();
  const [selectedMonth, setSelectedMonth] = useState<Date>(refMonth);
  const [startDate, setStartDate] = useState<Date>(start);
  const [endDate, setEndDate] = useState<Date>(end);
  const [selectedUserId, setSelectedUserId] = useState<string>(ALL_USERS);
  const [filterMode, setFilterMode] = useState<AbsenceFilterMode>("TODOS");
  const [editing, setEditing] = useState<SecullumAggregatedAbsence | null>(null);

  const { visibleColumns, setVisibleColumns } = useColumnVisibility(
    "absence-overview-visible-columns",
    new Set(["data", "colaborador", "faltas", "tipo", "setor", "motivo"]),
  );

  const fetchParams = useMemo(
    () => ({
      startDate: format(startDate, "yyyy-MM-dd"),
      endDate: format(endDate, "yyyy-MM-dd"),
    }),
    [startDate, endDate],
  );

  const { data: absenceDaysData, isLoading: absenceDaysLoading } =
    useSecullumAbsenceDays(fetchParams);

  const { data: usersData } = useUsers({
    isActive: true,
    where: { secullumEmployeeId: { not: null } },
    orderBy: { name: "asc" },
    take: 100,
  });

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const allAbsenceDays = useMemo<SecullumAbsenceDayRow[]>(() => {
    // absenceDaysData.data = HTTP body { success, data: [...] }
    const root = absenceDaysData?.data;
    if (Array.isArray(root)) return root;
    if (root && Array.isArray((root as any).data)) return (root as any).data;
    return [];
  }, [absenceDaysData]);

  const filteredAbsences = useMemo<SecullumAbsenceDayRow[]>(() => {
    return allAbsenceDays.filter((r) => {
      // Exclude today for unjustified — current workday may be unfinished
      if (r.JustificativaId === 3) {
        const d = new Date(r.date);
        d.setHours(0, 0, 0, 0);
        if (d >= today) return false;
      }

      if (selectedUserId !== ALL_USERS && r.userId !== selectedUserId) return false;

      if (filterMode === "TODOS") return true;
      if (filterMode === "FALTA_NAO_JUSTIFICADA") return r.JustificativaId === 3;
      if (filterMode === "FALTA") return getJustificativaCategory(r.JustificativaId) === "FALTA";
      if (filterMode === "AUSENCIA") return getJustificativaCategory(r.JustificativaId) === "AUSENCIA";
      if (filterMode === "FERIAS") return r.JustificativaId === FERIAS_JUSTIFICATIVA_ID;
      if (filterMode.startsWith("JUSTIFICATIVA_")) {
        const id = parseInt(filterMode.replace("JUSTIFICATIVA_", ""), 10);
        return r.JustificativaId === id;
      }
      return true;
    });
  }, [allAbsenceDays, filterMode, selectedUserId, today]);

  const userOptions = useMemo<ComboboxOption[]>(() => {
    const list: any[] = usersData?.data ?? [];
    return [
      { value: ALL_USERS, label: "Todos os colaboradores" },
      ...list.map((u) => ({ value: u.id, label: u.name })),
    ];
  }, [usersData]);

  const handleMonthChange = (month: Date) => {
    const { start: s, end: e } = getPayrollPeriod(month);
    setSelectedMonth(month);
    setStartDate(s);
    setEndDate(e);
  };

  const { period, monthName } = getPayrollPeriodDisplay(selectedMonth);

  // Custom range = the effective dates no longer line up with the selected
  // month's regular 26th→25th payroll bounds.
  const isCustomRange = useMemo(() => {
    const { start: s, end: e } = getPayrollPeriod(selectedMonth);
    return (
      startDate.getTime() !== s.getTime() || endDate.getTime() !== e.getTime()
    );
  }, [selectedMonth, startDate, endDate]);

  const periodTitle = isCustomRange ? "Período personalizado" : monthName;
  const periodSubtitle = isCustomRange
    ? `${format(startDate, "dd/MM/yyyy", { locale: ptBR })} a ${format(endDate, "dd/MM/yyyy", { locale: ptBR })}`
    : period;

  const filterLabel = useMemo(
    () => ABSENCE_FILTER_OPTIONS.find((o) => o.value === filterMode)?.label,
    [filterMode],
  );
  const exportRows = useMemo(
    () => filteredAbsences.map(toAbsenceExportRow),
    [filteredAbsences],
  );

  // Push filtered data up to the parent so the page-header export button
  // can mirror what the user sees on screen.
  useEffect(() => {
    if (!onExportDataChange) return;
    onExportDataChange({
      rows: exportRows,
      startDate,
      endDate,
      filterLabel,
    });
    return () => onExportDataChange(null);
  }, [exportRows, startDate, endDate, filterLabel, onExportDataChange]);

  return (
    <Card className={cn("flex flex-col shadow-sm border border-border", className)}>
      <CardContent className="flex-1 flex flex-col p-4 space-y-4 min-h-0">
        {/* ── Filter bar ── */}
        <div className="flex items-center gap-2">
          {/* Left: colaborador → tipo */}
          <Combobox
            value={selectedUserId}
            onValueChange={(v) =>
              setSelectedUserId(typeof v === "string" ? v : ALL_USERS)
            }
            options={userOptions}
            placeholder="Todos os colaboradores"
            className="w-[260px]"
            searchable
            clearable={false}
          />
          <Combobox
            value={filterMode}
            onValueChange={(v) =>
              setFilterMode((v || "TODOS") as AbsenceFilterMode)
            }
            options={ABSENCE_FILTER_OPTIONS}
            placeholder="Tipo de registro"
            className="w-[260px]"
            searchable
            clearable={false}
          />

          {/* Right: period control + column visibility + export */}
          <div className="flex items-center gap-2 ml-auto">
            <PeriodControl
              variant="range"
              title={periodTitle}
              subtitle={periodSubtitle}
              startDate={startDate}
              endDate={endDate}
              onRangeChange={(s, e) => {
                if (s) setStartDate(s);
                if (e) setEndDate(e);
              }}
              onPrev={() => handleMonthChange(subMonths(selectedMonth, 1))}
              onNext={() => handleMonthChange(addMonths(selectedMonth, 1))}
            />
            <ColumnVisibilityManager
              columns={ABSENCE_COLUMNS}
              visibleColumns={visibleColumns}
              onVisibilityChange={setVisibleColumns}
            />
            <TimeClockAbsenceExport
              currentItems={exportRows}
              startDate={startDate}
              endDate={endDate}
              filterLabel={filterLabel}
            />
          </div>
        </div>

        {/* ── Table ── */}
        <div className="flex-1 min-h-0 overflow-auto rounded-md border border-border">
          <AbsenceOverviewTable
            records={filteredAbsences}
            isLoading={absenceDaysLoading}
            onEdit={(r) => setEditing(rowToAggregated(r))}
            visibleColumns={visibleColumns}
          />
        </div>
      </CardContent>

      {editing && (
        <AbsenceFormDialog
          open
          onOpenChange={(open) => !open && setEditing(null)}
          editing={editing}
        />
      )}
    </Card>
  );
}
