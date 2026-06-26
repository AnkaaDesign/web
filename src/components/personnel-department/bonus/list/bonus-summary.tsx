import { useMemo, useState } from "react";
import { formatCurrency } from "../../../../utils";
import { IconUsers, IconTrendingUp, IconCheckbox, IconAward, IconChevronUp } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

// Generic bonus item interface that works with both Bonus and BonusRow types
interface BonusItem {
  // User identification - supports both Bonus.userId and BonusRow.oderId
  userId?: string;
  oderId?: string;
  // Position info - supports both Bonus.user?.position and BonusRow.position
  user?: { position?: { bonifiable?: boolean } };
  position?: { bonifiable?: boolean };
  // Performance level - from BonusRow
  performanceLevel?: number;
  // Bonus amount - supports both Bonus.baseBonus and BonusRow.bonusAmount
  baseBonus?: number | { toNumber: () => number };
  bonusAmount?: number;
  // Period-level total weighted tasks (same for all users in a period — they
  // share the same task pool). Comes from BonusRow.totalWeightedTasks or
  // Bonus.weightedTasks. This is the AUTHORITATIVE value for the period total;
  // never reconstruct it from average × users (rounding errors compound).
  totalWeightedTasks?: number | { toNumber: () => number };
  weightedTasks?: number | { toNumber: () => number };
  // Average tasks per user (same for all users in a period)
  averageTasks?: number;
  // Period info
  year: number;
  month: number;
}

interface BonusSummaryProps {
  bonuses: BonusItem[];
  isLoading?: boolean;
}

// Helper to safely convert Decimal to number
const toNumber = (value: number | { toNumber: () => number } | undefined): number => {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return value;
  return value.toNumber();
};

// Helper to format month names
const getMonthName = (month: number): string => {
  const monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  return monthNames[month - 1] || '';
};

export function BonusSummary({ bonuses, isLoading = false }: BonusSummaryProps) {
  // Calculate totals from bonus data
  const calculateTotals = () => {
    let totalBonusAmount = 0;

    // Check if we're in multi-month view
    const uniqueMonths = new Set(bonuses.map(b => `${b.year}-${b.month}`));
    const isMultiMonth = uniqueMonths.size > 1;

    // Track unique users across all months (don't double count)
    const uniqueUserIds = new Set<string>();
    const bonifiableUserIds = new Set<string>();

    // Per-period snapshots — one entry per (year, month). Avoids double-counting
    // when the input contains many bonuses for the same period (one per user).
    // Each period contributes the SAME totalWeightedTasks regardless of how many
    // user rows exist, so we de-dup by month key and read the period total
    // straight from the bonus row.
    const perMonth = new Map<string, { weightedTasks: number; average: number }>();

    bonuses.forEach(bonus => {
      const id = bonus.userId || bonus.oderId || '';
      uniqueUserIds.add(id);

      const isBonifiable = bonus.position?.bonifiable ?? bonus.user?.position?.bonifiable;
      const performanceLevel = bonus.performanceLevel ?? 1;
      const isEligible = isBonifiable !== false && performanceLevel > 0;

      if (isEligible) {
        bonifiableUserIds.add(id);

        const amount = bonus.bonusAmount !== undefined
          ? bonus.bonusAmount
          : toNumber(bonus.baseBonus);
        totalBonusAmount += amount;

        const monthKey = `${bonus.year}-${bonus.month}`;
        if (!perMonth.has(monthKey)) {
          // Authoritative period total — already stored on the bonus row.
          // Reconstructing from average × user count introduces rounding error
          // (2.19 × 16 = 35.04 instead of 35). Use the stored field directly.
          const weightedTasks = bonus.totalWeightedTasks !== undefined
            ? toNumber(bonus.totalWeightedTasks)
            : toNumber(bonus.weightedTasks);
          const average = bonus.averageTasks ?? 0;
          perMonth.set(monthKey, { weightedTasks, average });
        }
      }
    });

    const uniqueUsersCount = uniqueUserIds.size;
    const bonifiableUsersCount = bonifiableUserIds.size;

    // Single-month: the period total is the weighted-task figure.
    // Multi-month: sum the per-period totals.
    let totalTasksCompleted = 0;
    let averageSum = 0;
    for (const m of perMonth.values()) {
      totalTasksCompleted += m.weightedTasks;
      averageSum += m.average;
    }
    const averageTasksPerUser = perMonth.size > 0 ? averageSum / perMonth.size : 0;

    // Calculate averages
    // For multi-month: divide by total bonus entries for eligible users
    // For single-month: divide by number of eligible users
    const bonusEntriesCount = isMultiMonth
      ? bonuses.filter(b => {
          const isBonifiable = b.position?.bonifiable ?? b.user?.position?.bonifiable;
          const performanceLevel = b.performanceLevel ?? 1;
          return isBonifiable !== false && performanceLevel > 0;
        }).length
      : bonifiableUsersCount;

    const averageBonusPerUser = bonusEntriesCount > 0
      ? totalBonusAmount / bonusEntriesCount
      : 0;

    // Get period range for display
    const periods = bonuses.map(b => ({
      year: b.year,
      month: b.month,
      date: new Date(b.year, b.month - 1)
    })).sort((a, b) => a.date.getTime() - b.date.getTime());

    const periodStart = periods.length > 0 ? periods[0] : null;
    const periodEnd = periods.length > 0 ? periods[periods.length - 1] : null;

    let periodDisplay = '';
    if (periodStart && periodEnd) {
      if (isMultiMonth && (periodStart.year !== periodEnd.year || periodStart.month !== periodEnd.month)) {
        periodDisplay = `${getMonthName(periodStart.month)} ${periodStart.year} - ${getMonthName(periodEnd.month)} ${periodEnd.year}`;
      } else {
        periodDisplay = `${getMonthName(periodStart.month)} ${periodStart.year}`;
      }
    }

    return {
      totalBonusAmount,
      totalTasksCompleted,
      averageBonusPerUser,
      averageTasksPerUser,
      bonifiableUsersCount,
      uniqueUsersCount,
      isMultiMonth,
      periodDisplay
    };
  };

  const {
    totalBonusAmount,
    totalTasksCompleted,
    averageBonusPerUser,
    averageTasksPerUser,
    bonifiableUsersCount,
    uniqueUsersCount,
    isMultiMonth,
    periodDisplay: _periodDisplay
  } = useMemo(() => calculateTotals(), [bonuses]);

  const bonusPercentage = uniqueUsersCount > 0
    ? Math.round((bonifiableUsersCount / uniqueUsersCount) * 100)
    : 0;

  // State for minimize/expand - minimized by default
  const [isMinimized, setIsMinimized] = useState(true);

  if (isLoading) {
    return (
      <div className="relative">
        <div className="flex items-center justify-center px-4 py-1.5">
          <div className="h-4 w-32 bg-muted animate-pulse rounded" />
        </div>
        <div className="py-3 pt-1 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex flex-col h-full p-3 bg-card dark:bg-card rounded-lg border border-border">
                <div className="h-4 w-24 bg-muted animate-pulse rounded mb-2" />
                <div className="h-6 w-16 bg-muted animate-pulse rounded mb-1" />
                <div className="h-3 w-20 bg-muted animate-pulse rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Minimized View - Always visible */}
      <div
        className={cn(
          "flex items-center justify-center px-4 py-1.5 cursor-pointer hover:bg-muted/50 transition-colors"
        )}
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Resumo</span>
          <IconChevronUp
            className={cn(
              "h-4 w-4 transition-transform duration-200 ml-1",
              isMinimized && "rotate-180"
            )}
          />
        </div>
      </div>

      {/* Expanded Content */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-300",
          isMinimized ? "max-h-0" : "max-h-[500px]"
        )}
      >
        <div className="py-3 pt-1 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
            {/* Total Bonus Amount */}
            <div className="flex flex-col h-full p-3 bg-card dark:bg-card rounded-lg border border-border">
              <div className="flex items-center gap-2 mb-1">
                <IconTrendingUp className="h-4 w-4 text-green-600 flex-shrink-0" />
                <p className="text-sm font-medium text-muted-foreground line-clamp-2 min-h-[2.5rem] flex items-center">
                  {isMultiMonth ? 'Total Bônus (Soma)' : 'Total Bônus'}
                </p>
              </div>
              <div className="flex-grow flex flex-col justify-between">
                <p className="text-xl font-bold text-green-600">{formatCurrency(totalBonusAmount)}</p>
                <p className="text-xs text-muted-foreground mt-1 min-h-[1rem]">
                  Bonificações pagas
                </p>
              </div>
            </div>

            {/* Users with Bonus */}
            <div className="flex flex-col h-full p-3 bg-card dark:bg-card rounded-lg border border-border">
              <div className="flex items-center gap-2 mb-1">
                <IconUsers className="h-4 w-4 text-blue-600 flex-shrink-0" />
                <p className="text-sm font-medium text-muted-foreground line-clamp-2 min-h-[2.5rem] flex items-center">
                  Funcionários c/ Bônus
                </p>
              </div>
              <div className="flex-grow flex flex-col justify-between">
                <p className="text-xl font-bold text-foreground">{bonifiableUsersCount}</p>
                <p className="text-xs text-muted-foreground mt-1 min-h-[1rem]">
                  {bonusPercentage}% de {uniqueUsersCount}
                </p>
              </div>
            </div>

            {/* Average Bonus per User */}
            <div className="flex flex-col h-full p-3 bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 rounded-lg border border-primary/20">
              <div className="flex items-center gap-2 mb-1">
                <IconAward className="h-4 w-4 text-primary flex-shrink-0" />
                <p className="text-sm font-medium text-primary line-clamp-2 min-h-[2.5rem] flex items-center">
                  {isMultiMonth ? 'Média Mensal/Func.' : 'Média/Funcionário'}
                </p>
              </div>
              <div className="flex-grow flex flex-col justify-between">
                <p className="text-xl font-bold text-primary">{formatCurrency(averageBonusPerUser)}</p>
                <p className="text-xs text-muted-foreground mt-1 min-h-[1rem]">
                  Bônus médio
                </p>
              </div>
            </div>

            {/* Total Tasks Completed */}
            <div className="flex flex-col h-full p-3 bg-card dark:bg-card rounded-lg border border-border">
              <div className="flex items-center gap-2 mb-1">
                <IconCheckbox className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <p className="text-sm font-medium text-muted-foreground line-clamp-2 min-h-[2.5rem] flex items-center">
                  {isMultiMonth ? 'Total Tarefas (Soma)' : 'Total Tarefas'}
                </p>
              </div>
              <div className="flex-grow flex flex-col justify-between">
                <p className="text-xl font-bold text-amber-600">{totalTasksCompleted.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground mt-1 min-h-[1rem]">
                  Tarefas ponderadas
                </p>
              </div>
            </div>

            {/* Average Tasks per User */}
            <div className="flex flex-col h-full p-3 bg-card dark:bg-card rounded-lg border border-border">
              <div className="flex items-center gap-2 mb-1">
                <IconCheckbox className="h-4 w-4 text-purple-600 flex-shrink-0" />
                <p className="text-sm font-medium text-muted-foreground line-clamp-2 min-h-[2.5rem] flex items-center">
                  {isMultiMonth ? 'Média Tarefas/Mês' : 'Média Tarefas/Func.'}
                </p>
              </div>
              <div className="flex-grow flex flex-col justify-between">
                <p className="text-xl font-bold text-purple-600">{averageTasksPerUser.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-1 min-h-[1rem]">
                  Tarefas por funcionário
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
