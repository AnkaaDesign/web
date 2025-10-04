import { useMemo, useState } from "react";
import { formatCurrency } from "../../../../utils";
import { IconUsers, IconCurrencyDollar, IconTrendingUp, IconReceipt, IconChevronUp } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

// PayrollRow interface matching the one in list.tsx
interface PayrollRow {
  id: string;
  userId: string;
  userName: string;
  userEmail?: string;
  userCpf?: string;
  payrollNumber?: string;
  position?: { id: string; name: string; remuneration?: number; bonifiable?: boolean };
  sector?: { id: string; name: string };
  performanceLevel: number;
  status: string;
  payrollId?: string;
  baseRemuneration: number;
  totalDiscounts: number;
  netSalary: number;
  bonusAmount: number;
  tasksCompleted: number;
  averageTasks: number;
  totalWeightedTasks: number;
  bonusStatus: 'live' | 'saved';
  monthLabel?: string;
  month: number;
  year: number;
}

interface PayrollSummaryProps {
  users: PayrollRow[];
}

export function PayrollSummary({ users }: PayrollSummaryProps) {
  // Calculate totals from the already processed payroll data
  const calculateTotals = () => {
    let totalBonus = 0;
    let totalRemuneration = 0;

    // Check if we're in multi-month view by checking if any monthLabel exists
    const isMultiMonth = users.some(user => user.monthLabel !== undefined) &&
                         new Set(users.map(u => u.monthLabel)).size > 1;

    // Track unique users across all months
    const uniqueUserIds = new Set<string>();
    const uniqueBonusUserIds = new Set<string>();

    // For multi-month view, we need to identify unique users across months
    // The userId field should remain constant across months
    users.forEach(user => {
      uniqueUserIds.add(user.userId);

      // Count users with bonus (bonusAmount > 0)
      // Check eligibility: position.bonifiable AND performanceLevel > 0
      const isEligible = user.position?.bonifiable && user.performanceLevel > 0;
      if (isEligible && user.bonusAmount > 0) {
        uniqueBonusUserIds.add(user.userId);
      }
    });

    const uniqueUsersCount = uniqueUserIds.size;
    const bonusEligibleCount = uniqueBonusUserIds.size;

    // If multi-month, we sum all values; if single month, we deduplicate
    let rowsToProcess: PayrollRow[] = [];

    if (!isMultiMonth) {
      // Single month view - deduplicate by userId (in case there are duplicates)
      const seen = new Set<string>();
      users.forEach(user => {
        if (!seen.has(user.userId)) {
          seen.add(user.userId);
          rowsToProcess.push(user);
        }
      });
    } else {
      // Multi-month view - process all rows for correct totals across months
      rowsToProcess = users;
    }

    // Calculate totals from all rows (sums across months if multi-month)
    rowsToProcess.forEach(user => {
      // Get remuneration from baseRemuneration field
      const remuneration = user.baseRemuneration || 0;
      totalRemuneration += remuneration;

      // Get bonus value from bonusAmount field
      // Only include if user is eligible (position.bonifiable AND performanceLevel > 0)
      const isEligible = user.position?.bonifiable && user.performanceLevel > 0;
      if (isEligible) {
        const userBonusValue = user.bonusAmount || 0;
        totalBonus += userBonusValue;
      }
    });

    const totalEarnings = totalRemuneration + totalBonus;

    // Calculate month count for multi-month views
    const monthCount = isMultiMonth ? new Set(users.map(u => u.monthLabel)).size : 1;

    // For averages:
    // - If multi-month: divide total by (months * users) to get average per user per month
    // - If single-month: divide total by users to get average per user
    const totalUserMonths = isMultiMonth ? rowsToProcess.length : uniqueUsersCount;
    const bonusUserMonths = isMultiMonth
      ? rowsToProcess.filter(u => {
          const isEligible = u.position?.bonifiable && u.performanceLevel > 0;
          return isEligible && u.bonusAmount > 0;
        }).length
      : bonusEligibleCount;

    const averageBonus = bonusUserMonths > 0 ? totalBonus / bonusUserMonths : 0;
    const averagePerUser = totalUserMonths > 0 ? totalEarnings / totalUserMonths : 0;

    return {
      totalBonus,
      totalRemuneration,
      totalEarnings,
      averageBonus,
      averagePerUser,
      bonusEligibleCount,
      uniqueUsersCount,
      isMultiMonth,
      monthCount
    };
  };

  const {
    totalBonus,
    totalRemuneration,
    totalEarnings,
    averageBonus,
    averagePerUser,
    bonusEligibleCount,
    uniqueUsersCount,
    isMultiMonth,
    monthCount
  } = useMemo(() => calculateTotals(), [users]);

  const bonusPercentage = uniqueUsersCount > 0
    ? Math.round((bonusEligibleCount / uniqueUsersCount) * 100)
    : 0;

  // Get month labels for display
  const monthLabels = [...new Set(users.map(u => u.monthLabel).filter(Boolean))];

  // State for minimize/expand
  const [isMinimized, setIsMinimized] = useState(false);

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
          {isMultiMonth && (
            <>
              <span>{monthLabels.join(', ')}</span>
              <span>•</span>
            </>
          )}
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
        <div className="p-3 pt-2 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
          {/* Employees with Bonus */}
          <div className="flex flex-col h-full p-3 bg-card dark:bg-card rounded-lg border border-border/50">
            <div className="flex items-center gap-2 mb-1">
              <IconUsers className="h-4 w-4 text-blue-600 flex-shrink-0" />
              <p className="text-sm font-medium text-muted-foreground line-clamp-2 min-h-[2.5rem] flex items-center">
                Funcionários c/ Bônus
              </p>
            </div>
            <div className="flex-grow flex flex-col justify-between">
              <p className="text-xl font-bold text-foreground">{bonusEligibleCount}</p>
              <p className="text-xs text-muted-foreground mt-1 min-h-[1rem]">
                {bonusPercentage}% de {uniqueUsersCount}
              </p>
            </div>
          </div>

          {/* Total Bonus */}
          <div className="flex flex-col h-full p-3 bg-card dark:bg-card rounded-lg border border-border/50">
            <div className="flex items-center gap-2 mb-1">
              <IconTrendingUp className="h-4 w-4 text-green-600 flex-shrink-0" />
              <p className="text-sm font-medium text-muted-foreground line-clamp-2 min-h-[2.5rem] flex items-center">
                {isMultiMonth ? 'Total Bonificação (Soma)' : 'Total Bonificação'}
              </p>
            </div>
            <div className="flex-grow flex flex-col justify-between">
              <p className="text-xl font-bold text-green-600">{formatCurrency(totalBonus)}</p>
              <p className="text-xs text-muted-foreground mt-1 min-h-[1rem]">
                Média/funcionário: {formatCurrency(averageBonus)}
              </p>
            </div>
          </div>

          {/* Total Remuneration */}
          <div className="flex flex-col h-full p-3 bg-card dark:bg-card rounded-lg border border-border/50">
            <div className="flex items-center gap-2 mb-1">
              <IconCurrencyDollar className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <p className="text-sm font-medium text-muted-foreground line-clamp-2 min-h-[2.5rem] flex items-center">
                {isMultiMonth ? 'Total Remuneração (Soma)' : 'Total Remuneração'}
              </p>
            </div>
            <div className="flex-grow flex flex-col justify-between">
              <p className="text-xl font-bold text-amber-600">{formatCurrency(totalRemuneration)}</p>
              <p className="text-xs text-muted-foreground mt-1 min-h-[1rem]">
                Base salarial
              </p>
            </div>
          </div>

          {/* Total Earnings */}
          <div className="flex flex-col h-full p-3 bg-card dark:bg-card rounded-lg border border-border/50">
            <div className="flex items-center gap-2 mb-1">
              <IconReceipt className="h-4 w-4 text-primary flex-shrink-0" />
              <p className="text-sm font-medium text-muted-foreground line-clamp-2 min-h-[2.5rem] flex items-center">
                {isMultiMonth ? 'Total Geral (Soma)' : 'Total Geral'}
              </p>
            </div>
            <div className="flex-grow flex flex-col justify-between">
              <p className="text-xl font-bold text-primary">{formatCurrency(totalEarnings)}</p>
              <p className="text-xs text-muted-foreground mt-1 min-h-[1rem]">
                Salários + Bônus
              </p>
            </div>
          </div>

          {/* Average per User */}
          <div className="flex flex-col h-full p-3 bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 rounded-lg border border-primary/20">
            <div className="flex items-center gap-2 mb-1">
              <IconTrendingUp className="h-4 w-4 text-primary flex-shrink-0" />
              <p className="text-sm font-medium text-primary line-clamp-2 min-h-[2.5rem] flex items-center">
                {isMultiMonth ? 'Média Mensal/Func.' : 'Média/Funcionário'}
              </p>
            </div>
            <div className="flex-grow flex flex-col justify-between">
              <p className="text-xl font-bold text-primary">{formatCurrency(averagePerUser)}</p>
              <p className="text-xs text-muted-foreground mt-1 min-h-[1rem]">
                Total ÷ {uniqueUsersCount}
              </p>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}