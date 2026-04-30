import { useCallback, useMemo, useState } from "react";
import {
  IconCalendarDollar,
  IconTrash,
  IconUsers,
  IconAlertTriangle,
  IconInfoCircle,
} from "@tabler/icons-react";

import { PageHeader } from "@/components/ui/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TooltipProvider } from "@/components/ui/tooltip";
import { routes } from "@/constants";
import { formatCurrency } from "@/utils";
import { getUsers } from "@/api-client";
import {
  OVERTIME_DAY_TYPE,
  OVERTIME_DAY_TYPE_LABELS,
  OVERTIME_MULTIPLIERS,
  STANDARD_MONTHLY_HOURS,
  type OvertimeDayType,
} from "@/constants/overtime-multipliers";
import {
  computeOvertimeRowCost,
  computeTotalOvertimeCost,
  getHourlyRate,
  getPositionMonthlySalary,
  parseWorkdayHHMM,
} from "@/utils/overtime-cost";

interface OvertimeRow {
  // Snapshot at add-time so historical view stays stable
  rowKey: string;
  userId: string;
  userName: string;
  positionName: string | null;
  monthlySalary: number | null; // R$/mês, snapshot
}

const PRICE_DASH = "—";

const newRowKey = () =>
  `row-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// Mask user input as HH:MM. Two paths:
//   1) The value already has a colon (e.g. user edited the hours portion of
//      "08:45" mid-string) — respect their colon position and just clamp each
//      side to two digits. This preserves edit intent: replacing "08" with
//      "02" must yield "02:45", not "04:52".
//   2) No colon yet (typing fresh) — auto-insert after the 2nd digit.
// Used for the hours field which represents a duration of worked hours, not
// a clock time, so HTML5 type="time" (with AM/PM affordances) doesn't fit.
const formatHHMMInput = (raw: string): string => {
  const cleaned = raw.replace(/[^\d:]/g, "");

  if (cleaned.includes(":")) {
    const [h = "", m = ""] = cleaned.split(":");
    const hours = h.replace(/\D/g, "").slice(0, 2);
    const minutes = m.replace(/\D/g, "").slice(0, 2);
    return `${hours}:${minutes}`;
  }

  const digits = cleaned.slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
};

// HH:MM → total minutes. Returns null when the input is incomplete or invalid.
// Accepts hours up to 23 for clock times; the caller decides whether to clamp
// (durations need higher caps but our UI only deals with same-day shifts).
const hhmmToMinutes = (input: string): number | null => {
  const m = input.match(/^(\d{1,2}):([0-5]\d)$/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (!Number.isFinite(h) || !Number.isFinite(min)) return null;
  return h * 60 + min;
};

const minutesToHHMM = (totalMinutes: number): string => {
  const safe = Math.max(0, Math.round(totalMinutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
};

// Convert a multiplier (1.5) to a "+50%" label for display.
const formatBonusPercent = (multiplier: number): string => {
  const pct = Math.round((multiplier - 1) * 100);
  return `+${pct}%`;
};

// Day-type combobox options (with multiplier hint in label)
const DAY_TYPE_OPTIONS: ComboboxOption[] = (
  Object.keys(OVERTIME_DAY_TYPE_LABELS) as OvertimeDayType[]
).map((key) => ({
  value: key,
  label: `${OVERTIME_DAY_TYPE_LABELS[key]} (${formatBonusPercent(
    OVERTIME_MULTIPLIERS[key],
  )})`,
}));

// Hardcoded workday decimal that yields a 220h/month divisor under the
// existing CLT formula (workday × 30). The monthly hours figure is the
// company-standard reference used across payroll calculations.
const HARDCODED_WORKDAY_DECIMAL = STANDARD_MONTHLY_HOURS / 30;

// Standard shift defaults — start/end of the working day and the lunch break,
// all hardcoded per company policy. Duration defaults to (end - start - lunch).
const DEFAULT_START = "07:15";
const DEFAULT_END = "17:30";
const LUNCH_BREAK_MINUTES = 90; // 01:30 — hardcoded

const computeDurationMinutes = (
  start: string,
  end: string,
): number | null => {
  const s = hhmmToMinutes(start);
  const e = hhmmToMinutes(end);
  if (s == null || e == null) return null;
  const raw = e - s - LUNCH_BREAK_MINUTES;
  if (raw <= 0) return 0;
  return raw;
};

export function OvertimeCostCalculatorPage() {
  // --- Globals -----------------------------------------------------------
  const [dayType, setDayType] = useState<OvertimeDayType>(
    OVERTIME_DAY_TYPE.WEEKDAY,
  );

  // Three-way time controls: start, end, duration. Edits to start/end
  // recompute duration; edits to duration recompute end (start + lunch fixed).
  const [startInput, setStartInput] = useState<string>(DEFAULT_START);
  const [endInput, setEndInput] = useState<string>(DEFAULT_END);
  const [hoursInput, setHoursInput] = useState<string>(() => {
    const mins = computeDurationMinutes(DEFAULT_START, DEFAULT_END);
    return mins == null ? "00:00" : minutesToHHMM(mins);
  });

  const hoursDecimal = useMemo(
    () => parseWorkdayHHMM(hoursInput),
    [hoursInput],
  );

  const handleStartChange = (raw: string) => {
    const masked = formatHHMMInput(raw);
    setStartInput(masked);
    const mins = computeDurationMinutes(masked, endInput);
    if (mins != null) setHoursInput(minutesToHHMM(mins));
  };

  const handleEndChange = (raw: string) => {
    const masked = formatHHMMInput(raw);
    setEndInput(masked);
    const mins = computeDurationMinutes(startInput, masked);
    if (mins != null) setHoursInput(minutesToHHMM(mins));
  };

  // Editing duration moves the end time forward (start + lunch are fixed).
  const handleDurationChange = (raw: string) => {
    const masked = formatHHMMInput(raw);
    setHoursInput(masked);
    const dur = hhmmToMinutes(masked);
    const start = hhmmToMinutes(startInput);
    if (dur == null || start == null) return;
    const endMins = start + LUNCH_BREAK_MINUTES + dur;
    // Clamp to same-day to avoid 24h+ wrap; users can override start/end if
    // they need a longer block.
    if (endMins >= 0 && endMins < 24 * 60) {
      setEndInput(minutesToHHMM(endMins));
    }
  };

  // --- Row state ---------------------------------------------------------
  const [rows, setRows] = useState<OvertimeRow[]>([]);

  // --- Combobox: search users (multiselect) ------------------------------
  const queryUsers = useCallback(
    async (searchTerm: string, page = 1) => {
      try {
        const pageSize = 50;
        const response = await getUsers({
          take: pageSize,
          skip: (page - 1) * pageSize,
          where: {
            isActive: true,
            ...(searchTerm
              ? {
                  OR: [
                    { name: { contains: searchTerm, mode: "insensitive" } },
                    { email: { contains: searchTerm, mode: "insensitive" } },
                  ],
                }
              : {}),
          },
          orderBy: { name: "asc" },
          include: {
            position: true,
          },
        });

        const users = response.data ?? [];
        const total = response.meta?.totalRecords ?? 0;
        const hasMore = page * pageSize < total;

        return {
          data: users.map((u) => ({
            value: u.id,
            label: u.name,
            description: u.position?.name ?? "Sem cargo",
          })) as ComboboxOption[],
          hasMore,
          total,
        };
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error("Erro ao buscar usuários:", error);
        }
        return { data: [], hasMore: false };
      }
    },
    [],
  );

  // Reconcile selection diffs from the multiselect combobox: fetch full data
  // for newly-selected users and snapshot their salary; drop rows that are
  // no longer selected.
  const handleSelectionChange = useCallback(
    async (nextIds: string[]) => {
      const currentIds = new Set(rows.map((r) => r.userId));
      const added = nextIds.filter((id) => !currentIds.has(id));
      const removedIds = new Set(
        [...currentIds].filter((id) => !nextIds.includes(id)),
      );

      if (removedIds.size > 0) {
        setRows((prev) => prev.filter((r) => !removedIds.has(r.userId)));
      }

      if (added.length === 0) return;

      try {
        const response = await getUsers({
          where: { id: { in: added } },
          include: {
            position: {
              include: {
                monetaryValues: true,
                remunerations: true,
              },
            },
          },
          take: added.length,
        });
        const fetched = response.data ?? [];
        const newRows: OvertimeRow[] = fetched.map((user) => ({
          rowKey: newRowKey(),
          userId: user.id,
          userName: user.name,
          positionName: user.position?.name ?? null,
          monthlySalary: getPositionMonthlySalary(user.position ?? null),
        }));
        setRows((prev) => [...prev, ...newRows]);
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.error("Erro ao adicionar colaboradores:", error);
        }
      }
    },
    [rows],
  );

  const handleRemoveRow = (rowKey: string) =>
    setRows((prev) => prev.filter((r) => r.rowKey !== rowKey));

  const handleClearAll = () => setRows([]);

  const selectedUserIds = useMemo(() => rows.map((r) => r.userId), [rows]);

  // --- Computed totals ---------------------------------------------------
  const rowCosts = useMemo(
    () =>
      rows.map((r) => {
        if (hoursDecimal == null) return null;
        return computeOvertimeRowCost({
          monthlySalary: r.monthlySalary,
          workdayDecimal: HARDCODED_WORKDAY_DECIMAL,
          hoursDecimal,
          dayType,
        });
      }),
    [rows, dayType, hoursDecimal],
  );

  const totalCost = useMemo(
    () => computeTotalOvertimeCost(rowCosts),
    [rowCosts],
  );

  const validRowCount = rowCosts.filter((c) => c !== null).length;
  const noSalaryCount = rows.filter((r) => r.monthlySalary == null).length;

  // --- Render ------------------------------------------------------------
  return (
    <TooltipProvider>
      <div className="h-full flex flex-col px-4 pt-4">
        <div className="flex-shrink-0">
          <PageHeader
            title="Custo de Horas Extras"
            icon={IconCalendarDollar}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Ferramentas", href: routes.tools.root },
              { label: "Custo de Horas Extras" },
            ]}
            actions={[
              {
                key: "clear",
                label: "Limpar lista",
                icon: IconTrash,
                onClick: handleClearAll,
                disabled: rows.length === 0,
                variant: "outline",
                group: "secondary",
              },
            ]}
          />
        </div>

        <div className="flex-1 overflow-y-auto pb-6">
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-5 gap-4 items-stretch">
            {/* Globals card */}
            <Card className="lg:col-span-2 flex flex-col w-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Padrões</CardTitle>
                <CardDescription>
                  Defina as horas extras e o tipo de dia. Aplicados a todos os
                  colaboradores selecionados.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 flex-1">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="overtime-start">Início</Label>
                    <Input
                      id="overtime-start"
                      type="text"
                      inputMode="numeric"
                      value={startInput}
                      onChange={(v) =>
                        handleStartChange(typeof v === "string" ? v : "")
                      }
                      placeholder="07:15"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="overtime-end">Fim</Label>
                    <Input
                      id="overtime-end"
                      type="text"
                      inputMode="numeric"
                      value={endInput}
                      onChange={(v) =>
                        handleEndChange(typeof v === "string" ? v : "")
                      }
                      placeholder="17:30"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="overtime-hours">Horas Extras</Label>
                    <Input
                      id="overtime-hours"
                      type="text"
                      inputMode="numeric"
                      value={hoursInput}
                      onChange={(v) =>
                        handleDurationChange(typeof v === "string" ? v : "")
                      }
                      placeholder="00:00"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="overtime-day-type">Tipo de Dia</Label>
                  <Combobox
                    options={DAY_TYPE_OPTIONS}
                    value={dayType}
                    onValueChange={(v) => {
                      const next = Array.isArray(v) ? v[0] : v;
                      if (
                        next === OVERTIME_DAY_TYPE.WEEKDAY ||
                        next === OVERTIME_DAY_TYPE.SATURDAY ||
                        next === OVERTIME_DAY_TYPE.SUNDAY_HOLIDAY
                      ) {
                        setDayType(next);
                      }
                    }}
                    searchable={false}
                    clearable={false}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Almoço de 01:30 descontado automaticamente. Editar a duração
                  ajusta o horário de fim mantendo o início.
                </p>
                <div className="space-y-2">
                  <Label>Colaboradores</Label>
                  <Combobox
                    mode="multiple"
                    async
                    queryKey={["overtime-cost", "user-search"]}
                    queryFn={queryUsers}
                    minSearchLength={0}
                    pageSize={50}
                    debounceMs={300}
                    value={selectedUserIds}
                    onValueChange={(v) => {
                      const ids = Array.isArray(v)
                        ? v.map(String)
                        : v != null
                          ? [String(v)]
                          : [];
                      void handleSelectionChange(ids);
                    }}
                    placeholder="Buscar colaboradores..."
                    emptyText="Nenhum colaborador encontrado"
                    searchable
                  />
                  <p className="text-xs text-muted-foreground">
                    O salário mensal vigente do cargo é congelado no momento em
                    que o colaborador é adicionado.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Rows + total */}
            <Card className="lg:col-span-3 flex flex-col">
              <CardHeader className="pb-3 flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <IconUsers className="h-5 w-5" stroke={1.5} />
                    Colaboradores ({rows.length})
                  </CardTitle>
                  <CardDescription>
                    {noSalaryCount > 0
                      ? `${noSalaryCount} colaborador(es) sem salário no cargo — não entram no total.`
                      : "Horas extras e tipo de dia são definidos nos padrões e aplicados a todos os colaboradores."}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {rows.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-2">
                    <IconUsers className="h-12 w-12 opacity-30" stroke={1.5} />
                    <p className="text-sm">
                      Nenhum colaborador adicionado. Use o seletor ao lado para
                      começar.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Colaborador</TableHead>
                          <TableHead>Cargo</TableHead>
                          <TableHead className="text-right">Salário</TableHead>
                          <TableHead className="text-right">Valor/h</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="w-[60px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((row, idx) => {
                          const cost = rowCosts[idx];
                          const hourly =
                            row.monthlySalary !== null
                              ? getHourlyRate(
                                  row.monthlySalary,
                                  HARDCODED_WORKDAY_DECIMAL,
                                )
                              : null;
                          const isInvalid = row.monthlySalary === null;
                          return (
                            <TableRow
                              key={row.rowKey}
                              className={isInvalid ? "bg-destructive/5" : undefined}
                            >
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  {isInvalid && (
                                    <IconAlertTriangle
                                      className="h-4 w-4 text-destructive"
                                      stroke={1.5}
                                    />
                                  )}
                                  {row.userName}
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {row.positionName ?? "Sem cargo"}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {row.monthlySalary !== null
                                  ? formatCurrency(row.monthlySalary)
                                  : PRICE_DASH}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {hourly !== null ? formatCurrency(hourly) : PRICE_DASH}
                              </TableCell>
                              <TableCell className="text-right font-semibold tabular-nums">
                                {cost !== null ? formatCurrency(cost) : PRICE_DASH}
                              </TableCell>
                              <TableCell>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveRow(row.rowKey)}
                                  aria-label="Remover colaborador"
                                >
                                  <IconTrash className="h-4 w-4" stroke={1.5} />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Help line */}
                <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  <IconInfoCircle
                    className="h-4 w-4 flex-shrink-0"
                    stroke={1.5}
                  />
                  <span className="leading-none">
                    Adicional sobre o valor/hora: Semana{" "}
                    {formatBonusPercent(OVERTIME_MULTIPLIERS.WEEKDAY)} • Sábado{" "}
                    {formatBonusPercent(OVERTIME_MULTIPLIERS.SATURDAY)} • Domingo /
                    Feriado {formatBonusPercent(OVERTIME_MULTIPLIERS.SUNDAY_HOLIDAY)}.
                  </span>
                </div>

                {/* Footer total */}
                <div className="border-t border-border pt-4 flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {validRowCount} de {rows.length} colaborador(es) com cálculo
                    válido
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      Custo total estimado
                    </p>
                    <p className="text-2xl font-bold tabular-nums">
                      {formatCurrency(totalCost)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

export default OvertimeCostCalculatorPage;
