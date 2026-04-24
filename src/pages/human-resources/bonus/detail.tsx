import { useMemo, useState } from "react";
import { useParams, useLocation } from "react-router-dom";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { bonusService } from "../../../api-client";
import { routes, SECTOR_PRIVILEGES } from "../../../constants";
import { bonusKeys } from "@/hooks/common/query-keys";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { formatCurrency } from "../../../utils";
import { cn } from "@/lib/utils";
import { BonusTasksList } from "@/components/human-resources/bonus/detail";
import { BonusRulesModal } from "@/components/human-resources/bonus/bonus-rules-modal";
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
  const queryClient = useQueryClient();
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [rulesHighlightRef, setRulesHighlightRef] = useState<string | undefined>();

  const openRulesModal = (reference?: string) => {
    setRulesHighlightRef(reference);
    setRulesModalOpen(true);
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

  // Calculate final bonus amount (extras + base - discounts)
  const calculateFinalAmount = useMemo(() => {
    if (!bonus) return 0;

    const baseBonus = typeof bonus.baseBonus === 'number'
      ? bonus.baseBonus
      : (bonus.baseBonus as any)?.toNumber?.() || Number(bonus.baseBonus) || 0;

    // Apply extras first
    let totalExtras = 0;
    if (bonus.bonusExtras && bonus.bonusExtras.length > 0) {
      bonus.bonusExtras.forEach((extra: any) => {
        if (extra.value) {
          totalExtras += Number(extra.value);
        } else if (extra.percentage) {
          totalExtras += baseBonus * (Number(extra.percentage) / 100);
        }
      });
    }

    let finalAmount = baseBonus + totalExtras;

    if (bonus.bonusDiscounts && bonus.bonusDiscounts.length > 0) {
      bonus.bonusDiscounts
        .sort((a: any, b: any) => a.calculationOrder - b.calculationOrder)
        .forEach((discount: any) => {
          if (discount.percentage) {
            finalAmount -= finalAmount * (Number(discount.percentage) / 100);
          } else if (discount.value) {
            finalAmount -= Number(discount.value);
          }
        });
    }

    return Math.max(0, finalAmount);
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

    const totalCollaboratorsFromBonus = users.length || 1;
    const totalCollaborators = bonus
      ? totalCollaboratorsFromBonus
      : (periodStats?.totalCollaborators ?? periodStats?.totalEligibleUsers ?? 0);

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
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
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
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
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
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
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
    { label: "Recursos Humanos" },
    { label: "Bônus", href: routes.humanResources.bonus.root },
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
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
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
                          onClick={() => openRulesModal(extra.reference)}
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
                      const { label, dates } = parseDiscountReference(discount.reference || "");
                      return (
                        <button
                          key={discount.id}
                          type="button"
                          onClick={() => openRulesModal(discount.reference)}
                          className="w-full text-left rounded hover:bg-muted/60 px-1 -mx-1 py-1 transition-colors group"
                          title="Ver regra"
                        >
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-sm text-muted-foreground group-hover:text-foreground flex items-center gap-1">
                              {label}
                              <IconInfoCircle className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-50 transition-opacity" />
                            </span>
                            <span className="text-sm font-medium text-destructive shrink-0">
                              -{hasPercentage
                                ? `${percentageValue}%`
                                : formatCurrency(Number(discount.value) || 0)}
                            </span>
                          </div>
                          {dates.length > 0 && (
                            <div className="mt-0.5 pl-0.5 flex flex-col gap-0.5">
                              {dates.map((date, i) => (
                                <span key={i} className="text-xs text-muted-foreground/70">
                                  {date}
                                </span>
                              ))}
                            </div>
                          )}
                        </button>
                      );
                    })}
                    {/* Atestado forgiveness — when the user had atestado in this period but
                        no prior atestado in the rolling 90 days, we waive the penalty.
                        Show this as an informational row (no discount %) so the bonus is
                        traceable in review. */}
                    {bonus?.atestadoForgiven && (
                      <div className="flex justify-between py-1">
                        <span className="text-sm text-emerald-700 dark:text-emerald-400">
                          Atestado{" "}
                          {bonus?.secullumAnalysis?.atestadoTierLabel
                            ? `(${bonus.secullumAnalysis.atestadoTierLabel})`
                            : ""}{" "}
                          — perdoado
                        </span>
                        <span className="text-xs text-muted-foreground italic">sem desconto</span>
                      </div>
                    )}
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
