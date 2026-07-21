import { useMemo, useState } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { bonusService } from "../../../api-client";
import { routes, SECTOR_PRIVILEGES } from "../../../constants";
import { bonusKeys } from "@/hooks/common/query-keys";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { formatCurrency } from "../../../utils";
import { cn } from "@/lib/utils";
import { BonusTasksList } from "@/components/personnel-department/bonus/detail";
import { BonusRulesModal } from "@/components/personnel-department/bonus/bonus-rules-modal";
import {
  IconCurrencyReal,
  IconAlertCircle,
  IconRefresh,
  IconFileDownload,
  IconUser,
  IconInfoCircle,
} from "@tabler/icons-react";

interface BonusDetailPageParams extends Record<string, string | undefined> {
  id: string;
}

// Month names in Portuguese
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

function getMonthName(month?: number): string {
  if (!month) return "";
  const monthIndex = month - 1;
  return MONTH_NAMES[monthIndex] || "";
}

// Helper to format decimal values
const formatDecimal = (value: any): string => {
  if (value === null || value === undefined) return '0.00';
  if (typeof value === 'number') return value.toFixed(2);
  if (typeof value === 'string') return parseFloat(value).toFixed(2);
  if (value?.toNumber) return value.toNumber().toFixed(2);
  return '0.00';
};

// Helper to format bonus amount (handles Decimal type)
const formatBonusAmount = (amount: any): string => {
  if (amount === null || amount === undefined) return formatCurrency(0);
  if (typeof amount === 'number') return formatCurrency(amount);
  if (typeof amount === 'string') return formatCurrency(parseFloat(amount) || 0);
  if (amount?.toNumber) return formatCurrency(amount.toNumber());
  return formatCurrency(0);
};

// Parses "Label (total) — dd/mm (hh:mm), dd/mm (hh:mm)" into { label, dates }
function parseDiscountReference(reference: string): { label: string; dates: string[] } {
  const parts = reference.split(" — ");
  if (parts.length < 2) return { label: reference, dates: [] };
  const label = parts[0];
  const dates = parts[1].split(", ").map((d) => d.trim()).filter(Boolean);
  return { label, dates };
}

// Formats a structured absence day { date: 'YYYY-MM-DD', hours } → "DD/MM (H:MM)".
function formatAbsenceDate(iso: string, hours?: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  const ddmm = m ? `${m[3]}/${m[2]}` : iso;
  if (hours && hours > 0) {
    const h = Math.floor(hours);
    const min = Math.round((hours - h) * 60);
    return `${ddmm} (${h}:${String(min).padStart(2, "0")})`;
  }
  return ddmm;
}

// Info row component for consistent styling
function InfoRow({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3", className)}>
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

// Attempts to recover a cached bonus summary from list queries so the header
// can render instantly (stage 1) without waiting for any network call.
function findCachedBonusFromLists(queryClient: ReturnType<typeof useQueryClient>, id: string): any | null {
  const cache = queryClient.getQueryCache();
  // Look across any cached bonuses list/payroll queries for a matching id.
  const queries = cache.findAll({ queryKey: bonusKeys.all });
  for (const q of queries) {
    const state = q.state.data as any;
    if (!state) continue;
    // Shape 1: paginated list { data: [...] }
    const candidates: any[] = Array.isArray(state?.data)
      ? state.data
      : Array.isArray(state)
      ? state
      : Array.isArray(state?.bonuses)
      ? state.bonuses
      : [];
    const found = candidates.find((b) => b?.id === id || b?.userId === id);
    if (found) return found;
  }
  return null;
}

export default function BonusDetailPage() {
  const { id } = useParams<BonusDetailPageParams>();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [rulesHighlightRef, setRulesHighlightRef] = useState<string | undefined>();

  const openRulesModal = (reference?: string) => {
    setRulesHighlightRef(reference);
    setRulesModalOpen(true);
  };

  // Deep-link an absence day into that collaborator's "Espelho de Ponto".
  // Accepts either a structured { date: 'YYYY-MM-DD' } or a legacy "DD/MM (h:mm)"
  // display string (persisted rows without structured dates). The espelho page
  // reads ?userId= and ?month= (yyyy-MM-01), where `month` is the PAYROLL month
  // (26th→25th period) that contains the date: day ≥ 26 → next calendar month.
  const goToAbsenceDay = (opts: { iso?: string; display?: string }) => {
    const userId = activeBonus?.userId as string | undefined;
    if (!userId) return;
    let day: number | undefined;
    let cMonth: number | undefined; // 1-12
    let cYear: number | undefined;
    if (opts.iso) {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(opts.iso);
      if (m) {
        cYear = parseInt(m[1], 10);
        cMonth = parseInt(m[2], 10);
        day = parseInt(m[3], 10);
      }
    } else if (opts.display) {
      const m = /(\d{1,2})\/(\d{1,2})/.exec(opts.display);
      if (m) {
        day = parseInt(m[1], 10);
        cMonth = parseInt(m[2], 10);
        cYear = (activeBonus?.year as number | undefined) ?? new Date().getFullYear();
      }
    }
    if (!day || !cMonth || !cYear) return;
    let pMonth = cMonth;
    let pYear = cYear;
    if (day >= 26) {
      pMonth += 1;
      if (pMonth > 12) {
        pMonth = 1;
        pYear += 1;
      }
    }
    const monthParam = `${pYear}-${String(pMonth).padStart(2, "0")}-01`;
    const qs = new URLSearchParams({ userId, month: monthParam }).toString();
    navigate(`${routes.personnelDepartment.timeClock.colaborador}?${qs}`);
  };

  // Track page access
  usePageTracker({
    title: "Detalhes do Bônus",
    icon: "currency-dollar",
  });

  // =====================================================
  // Stage 1 — instant header from cache / route state
  // =====================================================
  // Look for a previously fetched bonus in react-query cache (list page) or
  // rely on route state passed via navigate(..., { state: {...} }).
  const routeStateBonus = (location.state as any)?.bonus ?? null;
  const cachedBonus = useMemo(() => {
    if (!id) return null;
    if (routeStateBonus && (routeStateBonus.id === id || routeStateBonus.userId === id)) {
      return routeStateBonus;
    }
    return findCachedBonusFromLists(queryClient, id);
  }, [id, routeStateBonus, queryClient]);

  // =====================================================
  // Stage 3 — full live calculation via getById
  // =====================================================
  const {
    data: bonus,
    isLoading: isBonusLoading,
    error: bonusError,
  } = useQuery<any>({
    queryKey: bonusKeys.detail(id || "", { full: true }),
    enabled: !!id,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const response = await bonusService.getById(id!, {
        include: {
          user: {
            include: {
              position: true,
              sector: true,
            },
          },
          tasks: {
            include: {
              customer: true,
              sector: true,
            },
          },
          bonusDiscounts: true,
          bonusExtras: true,
          users: true,
        },
      });
      const responseData = response.data as any;
      return responseData?.data ?? responseData;
    },
  });

  // Use the live bonus once available; otherwise fall back to the cached one
  // so header/financial summary can render earlier.
  const activeBonus: any = bonus ?? cachedBonus;

  // Derive year/month early for stage 2 — prefer live data, fall back to cache.
  const year = activeBonus?.year as number | undefined;
  const month = activeBonus?.month as number | undefined;

  // =====================================================
  // Stage 2 — cheap period stats (no Secullum)
  // =====================================================
  const { data: periodStats } = useQuery<any>({
    queryKey: ["bonus", "period-stats", year, month],
    enabled: !!year && !!month,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const response = await bonusService.getPeriodTaskStats(year!, month!);
      const responseData = response.data as any;
      return responseData?.data ?? responseData;
    },
  });

  const errorMessage: string | null = useMemo(() => {
    if (!id) return 'ID do bônus não fornecido';
    if (bonusError) {
      return (bonusError as any)?.response?.data?.message || 'Erro ao carregar bônus.';
    }
    if (!isBonusLoading && !bonus && !cachedBonus) {
      return null; // will fall through to "not found" below once load settles
    }
    return null;
  }, [id, bonusError, isBonusLoading, bonus, cachedBonus]);

  // Final bonus amount = the server's authoritative `netBonus`. The API
  // (recalculateNetBonus) is the single source of truth: it applies extras,
  // then the discount cascade in calculationOrder (percentage = % of running
  // value, fixed = min(value, running), each step floored at 0) and rounds
  // once at the end. We must NOT re-derive that cascade on the client — doing
  // so previously dropped the fixed-discount min/floor clamps and the single
  // final round, drifting from the saved value.
  const calculateFinalAmount = useMemo(() => {
    if (!bonus) return 0;
    const toNum = (v: any): number =>
      typeof v === 'number' ? v : v?.toNumber?.() ?? Number(v) ?? 0;
    const netBonus = (bonus as any).netBonus;
    if (netBonus !== null && netBonus !== undefined) {
      return toNum(netBonus);
    }
    // Fallback only when the server omitted netBonus: show the base bonus
    // (no client-side cascade re-derivation).
    return toNum(bonus.baseBonus);
  }, [bonus]);

  // Get task statistics - prefer full bonus data, otherwise use cheap periodStats.
  const taskStats = useMemo(() => {
    const tasks = bonus?.tasks || [];
    const users = bonus?.users || [];

    const totalRawTasksFromBonus = tasks.length;
    const totalRawTasks = bonus
      ? totalRawTasksFromBonus
      : (periodStats?.totalRawTasks ?? periodStats?.totalTasks ?? 0);

    const totalPonderedTasksFromBonus = bonus?.weightedTasks
      ? (typeof bonus.weightedTasks === 'object' && bonus.weightedTasks?.toNumber
        ? bonus.weightedTasks.toNumber()
        : Number(bonus.weightedTasks) || 0)
      : 0;
    const totalPonderedTasks = bonus
      ? totalPonderedTasksFromBonus
      : (periodStats?.weightedTasks ?? periodStats?.totalPonderedTasks ?? 0);

    // Saved bonus.users may include stale entries (users connected before the
    // perf>0 filter was added to the save path). The list endpoint already
    // returns a fresh eligible-only list, but getById returns the raw relation.
    // Filter to perf>0 here so detail count matches both the list table and
    // the divisor that was actually used for averageTaskPerUser.
    const eligibleUsersFromBonus = users.filter(
      (u: any) => (u?.performanceLevel ?? 0) > 0,
    ).length;
    const totalCollaboratorsFromBonus = eligibleUsersFromBonus || users.length || 1;
    const totalCollaborators = bonus
      ? totalCollaboratorsFromBonus
      : (periodStats?.eligibleUsers ?? periodStats?.totalCollaborators ?? periodStats?.totalEligibleUsers ?? 0);

    const averageTasksPerUserFromBonus = bonus?.averageTaskPerUser
      ? (typeof bonus.averageTaskPerUser === 'object' && bonus.averageTaskPerUser?.toNumber
        ? bonus.averageTaskPerUser.toNumber()
        : Number(bonus.averageTaskPerUser) || 0)
      : 0;
    const averageTasksPerUser = bonus
      ? averageTasksPerUserFromBonus
      : (periodStats?.averageTasksPerUser ?? periodStats?.averageTaskPerUser ?? 0);

    return {
      totalRawTasks,
      totalPonderedTasks,
      totalCollaborators,
      averageTasksPerUser,
      tasks,
    };
  }, [bonus, periodStats]);

  // Validation — hard error out only when we truly have no id.
  if (!id) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.ACCOUNTING]}>
        <Alert variant="destructive">
          <IconAlertCircle className="h-4 w-4" />
          <AlertDescription>ID do bônus não fornecido</AlertDescription>
        </Alert>
      </PrivilegeRoute>
    );
  }

  // Hard error only when the live fetch explicitly failed AND we have no cache.
  if (bonusError && !cachedBonus) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.ACCOUNTING]}>
        <Alert variant="destructive">
          <IconAlertCircle className="h-4 w-4" />
          <AlertDescription>{errorMessage || 'Erro ao carregar bônus.'}</AlertDescription>
        </Alert>
      </PrivilegeRoute>
    );
  }

  // Not found only after load completed with nothing returned.
  if (!isBonusLoading && !bonus && !cachedBonus) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.ACCOUNTING]}>
        <Alert variant="destructive">
          <IconAlertCircle className="h-4 w-4" />
          <AlertDescription>Bônus não encontrado</AlertDescription>
        </Alert>
      </PrivilegeRoute>
    );
  }

  // =====================================================
  // Header data — use best available (cached or live)
  // =====================================================
  const user = activeBonus?.user;
  const userName = user?.name || activeBonus?.userName || 'Funcionário';
  const monthName = getMonthName(activeBonus?.month);
  const displayYear = activeBonus?.year || new Date().getFullYear();
  const title = activeBonus
    ? `${userName} - ${monthName} ${displayYear}`
    : 'Carregando bônus…';

  const position = activeBonus?.position || user?.position;
  const sector = user?.sector;

  const breadcrumbs = [
    { label: "Início", href: routes.home },
    { label: "Departamento Pessoal", href: routes.personnelDepartment.root },
    { label: "Bônus", href: routes.personnelDepartment.bonus.root },
    { label: activeBonus ? title : 'Detalhes' },
  ];

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleExport = () => {
    window.print();
  };

  const hasExtras = !!(bonus?.bonusExtras && bonus.bonusExtras.length > 0);
  const hasDiscounts = !!(bonus?.bonusDiscounts && bonus.bonusDiscounts.length > 0);
  const finalBonusValue = calculateFinalAmount;

  // The server flags this when the response came from the stale SWR tier.
  const isStale = !!bonus?.isStale;

  // Wave 2-H: live bonus endpoints expose Secullum integration health flags.
  // When `secullumAvailable === false`, atestado/falta penalty calculations
  // could not run — warn admins that the displayed values may be stale.
  const secullumAvailable: boolean | undefined = bonus?.secullumAvailable;
  const secullumSyncError: string | null | undefined = bonus?.secullumSyncError;
  const showSecullumWarning = secullumAvailable === false;

  // Skeleton blocks used while stage 3 is still loading.
  const financialSkeleton = (
    <CardContent className="space-y-2">
      <Skeleton className="h-6 w-full" />
      <Skeleton className="h-6 w-full" />
      <Skeleton className="h-6 w-full" />
      <Skeleton className="h-6 w-full" />
      <Separator className="my-2" />
      <Skeleton className="h-6 w-full" />
      <Skeleton className="h-10 w-full rounded-lg mt-2" />
    </CardContent>
  );

  const tasksSkeleton = (
    <Card>
      <CardHeader className="pb-4">
        <Skeleton className="h-5 w-40" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.ACCOUNTING]}>
      <div className="p-4 space-y-4 relative">
        {/* Freshness indicator — amber "atualizando…" when served from the stale
            SWR tier, otherwise a subtle "Atualizado às HH:mm" whenever we know
            when the calc was produced. Helps admins trust the number on screen. */}
        {(isStale || bonus?.lastCalculatedAt) && (
          <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
            {isStale ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-300">
                <IconRefresh className="h-3 w-3 animate-spin" />
                atualizando…
              </span>
            ) : bonus?.lastCalculatedAt ? (
              <span
                className="text-xs text-muted-foreground"
                title={new Date(bonus.lastCalculatedAt).toLocaleString("pt-BR")}
              >
                Atualizado às{" "}
                {new Date(bonus.lastCalculatedAt).toLocaleTimeString("pt-BR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            ) : null}
          </div>
        )}

        <PageHeader
          variant="detail"
          title={title}
          breadcrumbs={breadcrumbs}
          actions={[
            {
              key: "rules",
              label: "Regras",
              icon: IconInfoCircle,
              onClick: () => openRulesModal(),
              variant: "outline",
            },
            {
              key: "refresh",
              label: "Atualizar",
              icon: IconRefresh,
              onClick: handleRefresh,
            },
            {
              key: "export",
              label: "Exportar",
              icon: IconFileDownload,
              onClick: handleExport,
            },
          ]}
        />

        {showSecullumWarning && (
          <Alert variant="warning">
            <AlertTitle>Integração Secullum indisponível</AlertTitle>
            <AlertDescription>
              <p>
                Os descontos de atestado e falta não puderam ser calculados. Os valores exibidos
                podem estar desatualizados. Tente novamente em alguns minutos.
              </p>
              {secullumSyncError && (
                <p className="mt-1 text-xs opacity-80">{secullumSyncError}</p>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Info Cards - 2 columns */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* General Info Card — stage 1: render immediately from cached user */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <IconUser className="h-4 w-4" />
                Informações Gerais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeBonus ? (
                <>
                  <InfoRow label="Colaborador" value={userName} />
                  <InfoRow label="Cargo" value={position?.name || "-"} />
                  <InfoRow label="Setor" value={sector?.name || "-"} />
                  <InfoRow label="Nível de Performance" value={activeBonus.performanceLevel || 0} />
                  <InfoRow label="Período" value={`${monthName}/${displayYear}`} />
                </>
              ) : (
                <>
                  <Skeleton className="h-12 w-full rounded-lg" />
                  <Skeleton className="h-12 w-full rounded-lg" />
                  <Skeleton className="h-12 w-full rounded-lg" />
                  <Skeleton className="h-12 w-full rounded-lg" />
                  <Skeleton className="h-12 w-full rounded-lg" />
                </>
              )}
            </CardContent>
          </Card>

          {/* Financial Card — stage 2 populates counts, stage 3 populates values */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <IconCurrencyReal className="h-4 w-4" />
                Valores
              </CardTitle>
            </CardHeader>
            {isBonusLoading && !bonus && !periodStats ? (
              financialSkeleton
            ) : (
              <CardContent className="space-y-2">
                <div className="flex justify-between py-1">
                  <span className="text-sm text-muted-foreground">Total de Tarefas</span>
                  <span className="text-sm font-medium">{taskStats.totalRawTasks}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-sm text-muted-foreground">Tarefas Ponderadas</span>
                  <span className="text-sm font-medium">{formatDecimal(taskStats.totalPonderedTasks)}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-sm text-muted-foreground">Colaboradores</span>
                  <span className="text-sm font-medium">{taskStats.totalCollaborators}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-sm text-muted-foreground">Média por Colaborador</span>
                  <span className="text-sm font-medium">{formatDecimal(taskStats.averageTasksPerUser)}</span>
                </div>
                <Separator className="my-2" />
                {bonus ? (
                  <>
                    <div className="flex justify-between py-1">
                      <span className="text-sm text-muted-foreground">Bônus Base</span>
                      <span className="text-sm font-medium">{formatBonusAmount(bonus.baseBonus)}</span>
                    </div>
                    {hasExtras && bonus.bonusExtras!.map((extra: any) => {
                      const percentageValue = Number(extra.percentage) || 0;
                      const hasPercentage = percentageValue > 0;
                      return (
                        <button
                          key={extra.id}
                          type="button"
                          onClick={() => openRulesModal(extra.ruleReference || extra.reference)}
                          className="flex justify-between py-1 w-full text-left rounded hover:bg-muted/60 px-1 -mx-1 transition-colors group"
                          title="Ver regra"
                        >
                          <span className="text-sm text-muted-foreground group-hover:text-foreground flex items-center gap-1">
                            {extra.reference}
                            <IconInfoCircle className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                          </span>
                          <span className="text-sm font-medium text-emerald-600">
                            +{hasPercentage
                              ? `${percentageValue}%`
                              : formatCurrency(Number(extra.value) || 0)}
                          </span>
                        </button>
                      );
                    })}
                    {hasDiscounts && bonus.bonusDiscounts!.map((discount: any) => {
                      const percentageValue = Number(discount.percentage) || 0;
                      const hasPercentage = percentageValue > 0;
                      const valueAmount = Number(discount.value) || 0;
                      const hasValue = valueAmount > 0;
                      // A justified line with no discount (atestado forgiven or
                      // below threshold): show WHY instead of a bogus "-0%".
                      // Live rows carry an explicit note; persisted rows (no such
                      // column) derive "sem desconto" from the atestado label.
                      const noDiscountNote: string | undefined =
                        !hasPercentage && !hasValue
                          ? discount.noDiscountNote ??
                            (String(discount.ruleReference || discount.reference || "").startsWith(
                              "Faltas - Atestado",
                            )
                              ? "sem desconto"
                              : undefined)
                          : undefined;
                      // Prefer the structured data (live bonuses); fall back to
                      // parsing the reference string (persisted rows).
                      const parsed = parseDiscountReference(discount.reference || "");
                      const label = discount.ruleReference || parsed.label;
                      const ruleRef = discount.ruleReference || discount.reference;
                      const structuredDates: Array<{ date: string; hours?: number }> | undefined =
                        Array.isArray(discount.dates) && discount.dates.length > 0
                          ? discount.dates
                          : undefined;
                      // Renderable chips: { text, iso?, display? } — iso drives
                      // navigation for structured dates, display for legacy strings.
                      const dateChips: Array<{ text: string; iso?: string; display?: string }> =
                        structuredDates
                          ? structuredDates.map((d) => ({
                              text: formatAbsenceDate(d.date, d.hours),
                              iso: d.date,
                            }))
                          : parsed.dates.map((d) => ({ text: d, display: d }));
                      return (
                        <div key={discount.id} className="w-full py-1 px-1 -mx-1">
                          <div className="flex justify-between items-start gap-2">
                            {/* Label — the ONLY element that opens the rule modal */}
                            <button
                              type="button"
                              onClick={() => openRulesModal(ruleRef)}
                              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 text-left rounded group"
                              title="Ver regra"
                            >
                              {label}
                              <IconInfoCircle className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-50 transition-opacity" />
                            </button>
                            {noDiscountNote ? (
                              <span className="text-xs text-emerald-700 dark:text-emerald-400 italic shrink-0">
                                {noDiscountNote}
                              </span>
                            ) : (
                              <span className="text-sm font-medium text-destructive shrink-0">
                                -{hasPercentage ? `${percentageValue}%` : formatCurrency(valueAmount)}
                              </span>
                            )}
                          </div>
                          {/* Dates — ONE card wrapping every date (all in the same
                              period); the whole card navigates to that period's
                              Espelho de Ponto. */}
                          {dateChips.length > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                goToAbsenceDay({
                                  iso: dateChips[0].iso,
                                  display: dateChips[0].display,
                                })
                              }
                              className="mt-1 w-full flex flex-wrap gap-x-3 gap-y-1 text-left text-sm rounded-md bg-muted/60 hover:bg-muted px-2.5 py-1.5 text-muted-foreground hover:text-primary transition-colors"
                              title="Ver no Espelho de Ponto"
                            >
                              {dateChips.map((chip, i) => (
                                <span key={i}>{chip.text}</span>
                              ))}
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {/* (Atestado forgiveness is now shown inline on the
                        "Faltas - Atestado" line via its noDiscountNote, with the
                        justified days listed — no separate row needed.) */}
                    <div className="flex justify-between py-2 bg-green-50 dark:bg-green-950/20 rounded-lg px-3 mt-2">
                      <span className="text-sm font-medium text-muted-foreground">Bônus Final</span>
                      <span className="text-lg font-bold text-green-600">{formatCurrency(finalBonusValue)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-6 w-full" />
                    <Skeleton className="h-10 w-full rounded-lg mt-2" />
                  </>
                )}
              </CardContent>
            )}
          </Card>
        </div>

        {/* Tasks Table — stage 3 only */}
        {bonus ? (
          <BonusTasksList
            tasks={taskStats.tasks}
            title="Tarefas do Período"
          />
        ) : (
          tasksSkeleton
        )}
      </div>

      <BonusRulesModal
        open={rulesModalOpen}
        onClose={() => setRulesModalOpen(false)}
        highlightReference={rulesHighlightRef}
      />
    </PrivilegeRoute>
  );
}
