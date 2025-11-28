import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PayrollUserRow } from "../list/payroll-table-columns";
import { formatCurrency } from "../../../../utils";
import {
  IconCalendar,
  IconUsers,
  IconCurrencyDollar,
  IconTrendingUp,
  IconCalculator,
  IconChecklist,
  IconChartLine
} from "@tabler/icons-react";
import { COMMISSION_STATUS, USER_STATUS } from "../../../../constants";

interface PayrollDetailsCardProps {
  users: PayrollUserRow[];
  year: number;
  month: number;
}

export function PayrollDetailsCard({ users, year, month }: PayrollDetailsCardProps) {
  // Calculate summary statistics from the payroll data
  const calculateSummaryStats = () => {
    let totalBonus = 0;
    let totalRemuneration = 0;
    let bonusEligibleCount = 0;
    let performanceUsersCount = 0;

    // Use the first user's average if available (all users have the same avg)
    const averageTasksPerEmployee = users[0]?.averageTasksPerEmployee || 0;

    // Process unique users (in case of duplicate entries)
    const uniqueUserIds = new Set<string>();
    const uniqueUsers: PayrollUserRow[] = [];

    users.forEach(user => {
      const baseUserId = user.id.includes('-') ? user.id.split('-')[0] : user.id;
      if (!uniqueUserIds.has(baseUserId)) {
        uniqueUserIds.add(baseUserId);
        uniqueUsers.push(user);
      }
    });

    // Calculate GLOBAL task counts by deduplicating taskIds across ALL users (matching backend)
    const allCommissions: any[] = [];
    users.forEach(user => {
      if (user.monthCommissions) {
        allCommissions.push(...user.monthCommissions);
      }
    });

    // Deduplicate by taskId (same logic as backend BonusCalculationService)
    const processedTasks = new Set<string>();
    let totalFullTasks = 0;
    let totalPartialTasks = 0;
    let totalTasksWeighted = 0;

    allCommissions.forEach(commission => {
      const taskId = commission.taskId;
      if (processedTasks.has(taskId)) return; // Skip if task already processed
      processedTasks.add(taskId);

      if (commission.status === COMMISSION_STATUS.FULL_COMMISSION) {
        totalFullTasks++;
        totalTasksWeighted += 1;
      } else if (commission.status === COMMISSION_STATUS.PARTIAL_COMMISSION) {
        totalPartialTasks++;
        totalTasksWeighted += 0.5;
      }
      // NO_COMMISSION and SUSPENDED_COMMISSION don't count
    });

    // Calculate totals from UNIQUE users only
    uniqueUsers.forEach(user => {
      // Get remuneration from position (once per unique user)
      const remuneration = user.position?.remuneration || 0;
      totalRemuneration += remuneration;

      // Check if user is eligible for bonus:
      // 1. User must be EFFECTED (not experience period or dismissed)
      // 2. Position must be bonifiable
      const isEligible =
        user.status === USER_STATUS.EFFECTED &&
        user.position?.bonifiable === true;

      if (isEligible) {
        // Use actual bonus data from API
        const bonusValue = user.bonusAmount || user.calculatedBonus || user.bonus?.baseBonus || 0;
        totalBonus += bonusValue;
        bonusEligibleCount++;
      }
    });

    const totalEarnings = totalRemuneration + totalBonus;
    const averageBonus = bonusEligibleCount > 0 ? totalBonus / bonusEligibleCount : 0;
    const realTotalTasks = totalFullTasks + totalPartialTasks; // For display purposes

    return {
      totalBonus,
      totalRemuneration,
      totalEarnings,
      averageBonus,
      bonusEligibleCount,
      totalFullTasks,
      totalPartialTasks,
      totalTasks: realTotalTasks,
      averageTasksPerPerformanceUser: totalTasksWeighted / Math.max(performanceUsersCount, 1), // Use weighted tasks for average
      performanceUsersCount,
      uniqueUsersCount: uniqueUsers.length,
      averageTasksPerEmployee
    };
  };

  const {
    totalBonus,
    totalRemuneration,
    totalEarnings,
    averageBonus,
    bonusEligibleCount,
    totalFullTasks,
    totalPartialTasks,
    totalTasks,
    averageTasksPerPerformanceUser,
    performanceUsersCount,
    uniqueUsersCount,
    averageTasksPerEmployee
  } = calculateSummaryStats();

  const bonusPercentage = uniqueUsersCount > 0
    ? Math.round((bonusEligibleCount / uniqueUsersCount) * 100)
    : 0;

  // Format month name
  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  const monthName = monthNames[month - 1] || "Mês";

  return (
    <Card className="shadow-sm border border-border" level={1}>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <IconCalendar className="h-5 w-5 text-muted-foreground" />
          Folha de Pagamento - {monthName} {year}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Header Stats - Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total Employees */}
          <div className="space-y-2 p-4 bg-gradient-to-br from-blue-50 to-blue-25 dark:from-blue-950/20 dark:to-blue-900/10 rounded-lg border border-blue-200/50 dark:border-blue-800/30">
            <div className="flex items-center gap-2">
              <IconUsers className="h-4 w-4 text-blue-600" />
              <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Funcionários</p>
            </div>
            <p className="text-2xl font-bold text-blue-800 dark:text-blue-200">{uniqueUsersCount}</p>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              {bonusEligibleCount} elegíveis para bonus ({bonusPercentage}%)
            </p>
          </div>

          {/* Total Bonus Count and Value */}
          <div className="space-y-2 p-4 bg-gradient-to-br from-green-50 to-green-25 dark:from-green-950/20 dark:to-green-900/10 rounded-lg border border-green-200/50 dark:border-green-800/30">
            <div className="flex items-center gap-2">
              <IconTrendingUp className="h-4 w-4 text-green-600" />
              <p className="text-sm font-medium text-green-700 dark:text-green-300">Total Bonificação</p>
            </div>
            <p className="text-2xl font-bold text-green-800 dark:text-green-200">{formatCurrency(totalBonus)}</p>
            <p className="text-xs text-green-600 dark:text-green-400">
              {bonusEligibleCount} bonificações • Média: {formatCurrency(averageBonus)}
            </p>
          </div>

          {/* Total Tasks */}
          <div className="space-y-2 p-4 bg-gradient-to-br from-purple-50 to-purple-25 dark:from-purple-950/20 dark:to-purple-900/10 rounded-lg border border-purple-200/50 dark:border-purple-800/30">
            <div className="flex items-center gap-2">
              <IconChecklist className="h-4 w-4 text-purple-600" />
              <p className="text-sm font-medium text-purple-700 dark:text-purple-300">Total Tarefas</p>
            </div>
            <p className="text-2xl font-bold text-purple-800 dark:text-purple-200">{totalTasks}</p>
            <p className="text-xs text-purple-600 dark:text-purple-400">
              {totalFullTasks} completas • {totalPartialTasks} parciais
            </p>
          </div>

          {/* Average Tasks Per User (Weighted) */}
          <div className="space-y-2 p-4 bg-gradient-to-br from-orange-50 to-orange-25 dark:from-orange-950/20 dark:to-orange-900/10 rounded-lg border border-orange-200/50 dark:border-orange-800/30">
            <div className="flex items-center gap-2">
              <IconChartLine className="h-4 w-4 text-orange-600" />
              <p className="text-sm font-medium text-orange-700 dark:text-orange-300">Média por Usuário</p>
            </div>
            <p className="text-2xl font-bold text-orange-800 dark:text-orange-200">
              {averageTasksPerPerformanceUser.toFixed(1)}
            </p>
            <p className="text-xs text-orange-600 dark:text-orange-400">
              {performanceUsersCount} usuários ativos • Base: {averageTasksPerEmployee.toFixed(1)}
            </p>
          </div>
        </div>

        {/* Secondary Stats - Financial Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total Remuneration */}
          <div className="space-y-2 p-4 bg-card dark:bg-card rounded-lg border border-border/50">
            <div className="flex items-center gap-2">
              <IconCurrencyDollar className="h-4 w-4 text-amber-600" />
              <p className="text-sm font-medium text-muted-foreground">Total Remuneração</p>
            </div>
            <p className="text-xl font-bold text-amber-600">{formatCurrency(totalRemuneration)}</p>
            <p className="text-xs text-muted-foreground">Base salarial</p>
          </div>

          {/* Total Earnings */}
          <div className="space-y-2 p-4 bg-card dark:bg-card rounded-lg border border-border/50">
            <div className="flex items-center gap-2">
              <IconCalculator className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium text-muted-foreground">Total Geral</p>
            </div>
            <p className="text-xl font-bold text-primary">{formatCurrency(totalEarnings)}</p>
            <p className="text-xs text-muted-foreground">Salários + Bonificações</p>
          </div>

          {/* Average per Employee */}
          <div className="space-y-2 p-4 bg-gradient-to-br from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10 rounded-lg border border-primary/20">
            <div className="flex items-center gap-2">
              <IconUsers className="h-4 w-4 text-primary" />
              <p className="text-sm font-medium text-primary">Média por Funcionário</p>
            </div>
            <p className="text-xl font-bold text-primary">
              {formatCurrency(uniqueUsersCount > 0 ? totalEarnings / uniqueUsersCount : 0)}
            </p>
            <p className="text-xs text-muted-foreground">
              Total ÷ {uniqueUsersCount} funcionários
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}