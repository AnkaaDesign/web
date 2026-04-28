import { useCallback, useMemo, useState } from "react";
import {
  IconCalendarDollar,
  IconPlus,
  IconTrash,
  IconUsers,
  IconAlertTriangle,
  IconRefresh,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { routes } from "@/constants";
import { formatCurrency } from "@/utils";
import { getUsers } from "@/api-client";
import { useUsers } from "@/hooks";
import {
  OVERTIME_DAY_TYPE,
  OVERTIME_DAY_TYPE_LABELS,
  OVERTIME_MULTIPLIERS,
  STANDARD_WORKDAY,
  type OvertimeDayType,
} from "@/constants/overtime-multipliers";
import {
  computeOvertimeRowCost,
  computeTotalOvertimeCost,
  getHourlyRate,
  getMonthlyDivisor,
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
  hoursInput: string; // HH:MM
  dayType: OvertimeDayType;
}

const PRICE_DASH = "—";

const newRowKey = () =>
  `row-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// Format a decimal hours number using Brazilian locale, e.g. 262.5 -> "262,5".
const formatDecimal = (value: number, fractionDigits = 1): string =>
  new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);

// Day-type combobox options (with multiplier hint in label)
const DAY_TYPE_OPTIONS: ComboboxOption[] = (
  Object.keys(OVERTIME_DAY_TYPE_LABELS) as OvertimeDayType[]
).map((key) => ({
  value: key,
  label: `${OVERTIME_DAY_TYPE_LABELS[key]} (${formatDecimal(
    OVERTIME_MULTIPLIERS[key],
    2,
  )}×)`,
}));

export function OvertimeCostCalculatorPage() {
  // --- Globals -----------------------------------------------------------
  const [workdayInput, setWorkdayInput] = useState<string>(STANDARD_WORKDAY);
  const workdayDecimal = useMemo(
    () => parseWorkdayHHMM(workdayInput) ?? 0,
    [workdayInput],
  );
  const monthlyDivisor = useMemo(
    () => getMonthlyDivisor(workdayDecimal),
    [workdayDecimal],
  );

  // --- Row state ---------------------------------------------------------
  const [rows, setRows] = useState<OvertimeRow[]>([]);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  // Fetch the user-being-added with full position + monetaryValues so we can
  // snapshot the monthly salary.
  const { data: pendingUserResponse, isFetching: pendingUserLoading } = useUsers(
    {
      where: pendingUserId ? { id: pendingUserId } : undefined,
      include: {
        position: {
          include: {
            monetaryValues: true,
            remunerations: true,
          },
        },
      },
    },
    { enabled: !!pendingUserId },
  );

  // --- Combobox: search users to add -------------------------------------
  const queryUsers = useCallback(
    async (searchTerm: string, page = 1) => {
      try {
        const pageSize = 50;
        const existingIds = new Set(rows.map((r) => r.userId));
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
          data: users
            .filter((u) => !existingIds.has(u.id))
            .map((u) => ({
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
    [rows],
  );

  // When the pending user finishes loading, materialize a row.
  const handleAddPendingUser = () => {
    const user = pendingUserResponse?.data?.[0];
    if (!user) return;

    const monthlySalary = getPositionMonthlySalary(user.position ?? null);

    const row: OvertimeRow = {
      rowKey: newRowKey(),
      userId: user.id,
      userName: user.name,
      positionName: user.position?.name ?? null,
      monthlySalary,
      hoursInput: "",
      dayType: OVERTIME_DAY_TYPE.WEEKDAY,
    };
    setRows((prev) => [...prev, row]);
    setPendingUserId(null);
  };

  const handleRemoveRow = (rowKey: string) =>
    setRows((prev) => prev.filter((r) => r.rowKey !== rowKey));

  const handleHoursChange = (rowKey: string, value: string) => {
    setRows((prev) =>
      prev.map((r) => (r.rowKey === rowKey ? { ...r, hoursInput: value } : r)),
    );
  };

  const handleDayTypeChange = (rowKey: string, value: OvertimeDayType) => {
    setRows((prev) =>
      prev.map((r) => (r.rowKey === rowKey ? { ...r, dayType: value } : r)),
    );
  };

  const handleResetHoursToAll = () => {
    setRows((prev) => prev.map((r) => ({ ...r, hoursInput: "" })));
  };

  const handleClearAll = () => setRows([]);

  // --- Computed totals ---------------------------------------------------
  const rowCosts = useMemo(
    () =>
      rows.map((r) => {
        const hoursDecimal = parseWorkdayHHMM(r.hoursInput);
        if (hoursDecimal == null) return null;
        return computeOvertimeRowCost({
          monthlySalary: r.monthlySalary,
          workdayDecimal,
          hoursDecimal,
          dayType: r.dayType,
        });
      }),
    [rows, workdayDecimal],
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
            subtitle="Cálculo de horas extras por colaborador conforme CLT e CCT dos metalúrgicos"
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
          <div className="mt-4 grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Globals card */}
            <Card className="lg:col-span-2 flex flex-col lg:sticky lg:top-4 self-start w-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Padrões</CardTitle>
                <CardDescription>
                  Jornada padrão usada para calcular o divisor mensal de horas e a
                  taxa horária de cada colaborador.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="overtime-workday">Jornada Padrão (HH:MM)</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          aria-label="Saiba mais sobre a jornada padrão"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <IconInfoCircle className="h-3.5 w-3.5" stroke={1.5} />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        Jornada diária. Divisor mensal = jornada × 30 (CLT Art. 64).
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <Input
                    id="overtime-workday"
                    type="time"
                    value={workdayInput}
                    onChange={(v) => setWorkdayInput(typeof v === "string" ? v : "")}
                    placeholder="08:45"
                  />
                  <div className="flex flex-col gap-0.5 text-xs text-muted-foreground">
                    <span>
                      Divisor mensal:{" "}
                      <span className="font-medium tabular-nums text-foreground">
                        {monthlyDivisor > 0
                          ? `${formatDecimal(monthlyDivisor, 1)} horas`
                          : PRICE_DASH}
                      </span>
                    </span>
                    <span>
                      Custo da hora regular varia por colaborador (salário ÷ divisor).
                    </span>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleResetHoursToAll}
                  disabled={rows.length === 0}
                >
                  <IconRefresh className="h-4 w-4 mr-2" stroke={1.5} />
                  Limpar horas de todos
                </Button>

                <div className="border-t border-border pt-4 space-y-2">
                  <Label>Adicionar colaborador</Label>
                  <div className="flex items-stretch gap-2">
                    <div className="flex-1">
                      <Combobox
                        async
                        queryKey={[
                          "overtime-cost",
                          "user-search",
                          rows.map((r) => r.userId).sort().join(","),
                        ]}
                        queryFn={queryUsers}
                        minSearchLength={0}
                        pageSize={50}
                        debounceMs={300}
                        value={pendingUserId ?? undefined}
                        onValueChange={(v) => {
                          const next = Array.isArray(v) ? v[0] : v;
                          setPendingUserId(next ? String(next) : null);
                        }}
                        placeholder="Buscar colaborador..."
                        emptyText="Nenhum colaborador encontrado"
                        searchable
                        clearable
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={handleAddPendingUser}
                      disabled={!pendingUserId || pendingUserLoading}
                    >
                      <IconPlus className="h-4 w-4 mr-1" stroke={1.5} />
                      Adicionar
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    O salário mensal vigente do cargo é congelado no momento em que o
                    colaborador é adicionado.
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
                      : "Informe as horas extras (HH:MM) e o tipo de dia para cada colaborador."}
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
                          <TableHead className="w-[110px]">Horas Extras</TableHead>
                          <TableHead className="w-[200px]">Tipo de Dia</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                          <TableHead className="w-[60px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((row, idx) => {
                          const cost = rowCosts[idx];
                          const hourly =
                            row.monthlySalary !== null && workdayDecimal > 0
                              ? getHourlyRate(row.monthlySalary, workdayDecimal)
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
                              <TableCell>
                                <Input
                                  type="time"
                                  value={row.hoursInput}
                                  onChange={(v) =>
                                    handleHoursChange(
                                      row.rowKey,
                                      typeof v === "string" ? v : "",
                                    )
                                  }
                                  placeholder="00:00"
                                />
                              </TableCell>
                              <TableCell>
                                <Combobox
                                  options={DAY_TYPE_OPTIONS}
                                  value={row.dayType}
                                  onValueChange={(v) => {
                                    const next = Array.isArray(v) ? v[0] : v;
                                    if (
                                      next === OVERTIME_DAY_TYPE.WEEKDAY ||
                                      next === OVERTIME_DAY_TYPE.SATURDAY ||
                                      next === OVERTIME_DAY_TYPE.SUNDAY_HOLIDAY
                                    ) {
                                      handleDayTypeChange(row.rowKey, next);
                                    }
                                  }}
                                  searchable={false}
                                  clearable={false}
                                />
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
                <div className="flex items-start gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  <IconInfoCircle
                    className="h-4 w-4 mt-0.5 flex-shrink-0"
                    stroke={1.5}
                  />
                  <span>
                    Multiplicadores baseados em CCT dos metalúrgicos: Semana{" "}
                    {formatDecimal(OVERTIME_MULTIPLIERS.WEEKDAY, 2)}× • Sábado{" "}
                    {formatDecimal(OVERTIME_MULTIPLIERS.SATURDAY, 2)}× • Domingo /
                    Feriado {formatDecimal(OVERTIME_MULTIPLIERS.SUNDAY_HOLIDAY, 2)}×.
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
