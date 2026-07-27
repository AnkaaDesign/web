import { useState, useMemo, useEffect } from "react";
import { format, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  IconAlertTriangle,
  IconCalendarOff,
  IconEdit,
} from "@tabler/icons-react";

import type { SecullumAbsenceDayRow } from "@/types";
import {
  CONTRACT_STATUS,
  UNJUSTIFIED_JUSTIFICATIVA_ID,
  getJustificativaCategory,
  isJustificativaJustified,
  mergeJustificativaCatalog,
  TONE_CLASSES,
  type SecullumJustificativaMeta,
} from "@/constants";
import { useSecullumAbsenceDays, useSecullumJustifications, useUsers } from "@/hooks";
import { AbsenceFormDialog } from "@/components/personnel-department/absence/form/absence-form-dialog";
import type { SecullumAggregatedAbsence } from "@/types";
import {
  toAbsenceExportRow,
  TimeClockAbsenceExport,
  type AbsenceExportRow,
} from "./time-clock-absence-export";
import { PeriodControl } from "./period-control";

import { Button } from "@/components/ui/button";
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
const WEEKDAY_SHORT_PT = ["Dom.", "Seg.", "Ter.", "Qua.", "Qui.", "Sex.", "Sáb."];

// ─── Types ────────────────────────────────────────────────────────────────────

// Aggregate filters. NOTE: the old "AUSENCIA" aggregate (JustificativaId whose
// `category` is AUSENCIA) is deliberately gone — on a page called "Ausências" it
// read as "show the justified absences" but actually meant "show scheduled
// leave", so every Atestado Médico / Atestado de Óbito (category FALTA, but very
// much justified) was filtered out. The justified/unjustified axis below is the
// one users mean; per-type options cover the "only férias" style needs.
const FILTER_ALL = "TODOS";
const FILTER_JUSTIFIED = "JUSTIFICADAS";
const FILTER_UNJUSTIFIED = "NAO_JUSTIFICADAS";
const FILTER_FALTA = "FALTA";
const JUSTIFICATIVA_PREFIX = "JUSTIFICATIVA_";

type AbsenceFilterMode = string;

// ─── Helpers ─────────────────────────────────────────────────────────────────

// "YYYY-MM-DD" → Date at LOCAL midnight. `new Date("2026-07-27")` parses as UTC
// midnight, which in UTC-3 lands on the 26th — that off-by-one silently shifted
// every date comparison on this page by a day.
const parseIsoDateLocal = (s: string): Date | null => {
  const parts = s.substring(0, 10).split("-");
  if (parts.length !== 3) return null;
  const d = new Date(+parts[0], +parts[1] - 1, +parts[2]);
  return isNaN(d.getTime()) ? null : d;
};

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
  const d = parseIsoDateLocal(s);
  return d ? format(d, "dd/MM/yy", { locale: ptBR }) : s;
};

const fmtWeekday = (dateStr: string) => {
  const d = parseIsoDateLocal(dateStr);
  return d ? (WEEKDAY_SHORT_PT[d.getDay()] ?? "") : "";
};

// ─── Filter predicate ─────────────────────────────────────────────────────────

const matchesFilterMode = (r: SecullumAbsenceDayRow, mode: AbsenceFilterMode): boolean => {
  if (mode === FILTER_ALL) return true;

  // The API could not read the afastamentos for this employee, so its
  // JustificativaId is a placeholder. It is a missed workday, but we cannot
  // claim it is justified OR unjustified — keep it out of both buckets.
  if (r.justificativaUnavailable) return mode === FILTER_FALTA;

  const { JustificativaId: id } = r;
  if (mode === FILTER_JUSTIFIED) return isJustificativaJustified(id);
  if (mode === FILTER_UNJUSTIFIED) return id === UNJUSTIFIED_JUSTIFICATIVA_ID;
  if (mode === FILTER_FALTA) return getJustificativaCategory(id) === "FALTA";
  if (mode.startsWith(JUSTIFICATIVA_PREFIX)) {
    const wanted = parseInt(mode.slice(JUSTIFICATIVA_PREFIX.length), 10);
    return Number.isFinite(wanted) && id === wanted;
  }
  return true;
};

// ─── Tipo label pill (no background, just colored text + dot) ─────────────────

function TipoPill({ row, catalog }: { row: SecullumAbsenceDayRow; catalog: Map<number, SecullumJustificativaMeta> }) {
  if (row.justificativaUnavailable) {
    return (
      <span
        className="text-sm font-medium whitespace-nowrap text-muted-foreground italic"
        title="Não foi possível ler os afastamentos deste colaborador no Secullum — o tipo desta ausência é desconhecido."
      >
        Justificativa indisponível
      </span>
    );
  }
  const meta = catalog.get(row.JustificativaId);
  const label = meta?.label ?? row.JustificativaDescricao ?? `#${row.JustificativaId}`;
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
  catalog,
  emptyState,
}: {
  records: SecullumAbsenceDayRow[];
  isLoading: boolean;
  onEdit: (r: SecullumAbsenceDayRow) => void;
  visibleColumns: Set<string>;
  catalog: Map<number, SecullumJustificativaMeta>;
  emptyState: { title: string; hint?: string; onClear?: () => void };
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
        <p className="text-sm">{emptyState.title}</p>
        {emptyState.hint && <p className="text-xs opacity-80">{emptyState.hint}</p>}
        {emptyState.onClear && (
          <Button variant="outline" size="sm" className="mt-2" onClick={emptyState.onClear}>
            Limpar filtros
          </Button>
        )}
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
                  <TipoPill row={r} catalog={catalog} />
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
  const [filterMode, setFilterMode] = useState<AbsenceFilterMode>(FILTER_ALL);
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

  // Live justificativa catalog — keeps labels in sync with Secullum and makes
  // sure a code HR adds there is filterable here without a redeploy.
  const { data: justificationsData } = useSecullumJustifications();

  const { data: usersData } = useUsers({
    statuses: [CONTRACT_STATUS.ACTIVE],
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

  // The API answers 200 with whatever it managed to read from Secullum. Without
  // this banner a throttled/failed upstream call looks identical to a genuinely
  // absence-free period.
  const incompleteEmployees = useMemo<string[]>(() => {
    const root: any = absenceDaysData?.data;
    return Array.isArray(root?.incompleteEmployees) ? root.incompleteEmployees : [];
  }, [absenceDaysData]);

  // Merged catalog: static presentation + live Secullum names + any id that
  // actually shows up in the loaded rows. Nothing can be unfilterable.
  const catalogList = useMemo<SecullumJustificativaMeta[]>(() => {
    const live = (justificationsData?.data as any)?.data ?? justificationsData?.data;
    return mergeJustificativaCatalog(
      Array.isArray(live) ? live : [],
      allAbsenceDays.map((r) => r.JustificativaId),
    );
  }, [justificationsData, allAbsenceDays]);

  const catalogById = useMemo(
    () => new Map(catalogList.map((m) => [m.id, m])),
    [catalogList],
  );

  const filterOptions = useMemo<ComboboxOption[]>(
    () => [
      { value: FILTER_ALL, label: "Todos os registros" },
      { value: FILTER_JUSTIFIED, label: "Ausências Justificadas" },
      { value: FILTER_UNJUSTIFIED, label: "Faltas Não Justificadas" },
      { value: FILTER_FALTA, label: "Todas as Faltas" },
      ...catalogList
        // "Falta sem Justificativa" is already the FILTER_UNJUSTIFIED aggregate.
        .filter((m) => m.id !== UNJUSTIFIED_JUSTIFICATIVA_ID)
        .map((m) => ({ value: `${JUSTIFICATIVA_PREFIX}${m.id}`, label: m.label })),
    ],
    [catalogList],
  );

  // Rows in the period, before the type/collaborator filters — the denominator
  // for the result count and the "your filter hid everything" empty state.
  const periodAbsences = useMemo<SecullumAbsenceDayRow[]>(() => {
    return allAbsenceDays.filter((r) => {
      // Exclude today onwards for unjustified — the current workday may still be
      // unfinished, so its Faltas reading is not yet meaningful.
      if (r.JustificativaId === UNJUSTIFIED_JUSTIFICATIVA_ID) {
        const d = parseIsoDateLocal(r.date);
        if (d && d >= today) return false;
      }
      return true;
    });
  }, [allAbsenceDays, today]);

  const filteredAbsences = useMemo<SecullumAbsenceDayRow[]>(() => {
    return periodAbsences.filter((r) => {
      if (selectedUserId !== ALL_USERS && r.userId !== selectedUserId) return false;
      return matchesFilterMode(r, filterMode);
    });
  }, [periodAbsences, filterMode, selectedUserId]);

  const hasActiveFilter = filterMode !== FILTER_ALL || selectedUserId !== ALL_USERS;

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
    () => filterOptions.find((o) => o.value === filterMode)?.label,
    [filterOptions, filterMode],
  );
  const exportRows = useMemo(
    () =>
      filteredAbsences.map((r) =>
        toAbsenceExportRow(r, (id) => catalogById.get(id)?.label),
      ),
    [filteredAbsences, catalogById],
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
            className="w-[360px]"
            searchable
            clearable={false}
          />
          <Combobox
            value={filterMode}
            onValueChange={(v) =>
              setFilterMode((typeof v === "string" && v ? v : FILTER_ALL) as AbsenceFilterMode)
            }
            options={filterOptions}
            placeholder="Tipo de registro"
            className="w-[260px]"
            searchable
            clearable={false}
          />
          <span className="text-xs text-muted-foreground whitespace-nowrap tabular-nums">
            {absenceDaysLoading
              ? "—"
              : hasActiveFilter
                ? `${filteredAbsences.length} de ${periodAbsences.length} registros`
                : `${periodAbsences.length} registros`}
          </span>

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

        {/* ── Partial-data warning ── */}
        {incompleteEmployees.length > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
            <IconAlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>
              O Secullum não respondeu para {incompleteEmployees.length} colaborador(es) —{" "}
              <span className="font-medium">{incompleteEmployees.slice(0, 3).join(", ")}</span>
              {incompleteEmployees.length > 3 && ` e mais ${incompleteEmployees.length - 3}`}. A
              lista abaixo pode estar incompleta; recarregue para tentar novamente.
            </span>
          </div>
        )}

        {/* ── Table ── */}
        <div className="flex-1 min-h-0 overflow-auto rounded-md border border-border">
          <AbsenceOverviewTable
            records={filteredAbsences}
            isLoading={absenceDaysLoading}
            onEdit={(r) => setEditing(rowToAggregated(r))}
            visibleColumns={visibleColumns}
            catalog={catalogById}
            emptyState={
              periodAbsences.length > 0 && hasActiveFilter
                ? {
                    title: "Nenhum registro para os filtros selecionados",
                    hint: `${periodAbsences.length} registro(s) no período foram ocultados pelos filtros.`,
                    onClear: () => {
                      setFilterMode(FILTER_ALL);
                      setSelectedUserId(ALL_USERS);
                    },
                  }
                : { title: "Nenhum registro encontrado no período" }
            }
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
