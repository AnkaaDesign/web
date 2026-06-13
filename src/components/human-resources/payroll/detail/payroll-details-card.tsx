import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PayrollUserRow } from "../list/payroll-table-columns";
import { formatCurrency } from "../../../../utils";
import {
  IconCalendar,
  IconUsers,
  IconCurrencyDollar,
  IconTrendingUp,
  IconCalculator,
  IconChartLine
} from "@tabler/icons-react";
import { CONTRACT_TYPE } from "../../../../constants";

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

    // Calculate totals from UNIQUE users only
    uniqueUsers.forEach(user => {
      // Get remuneration from position (once per unique user)
      const remuneration = user.position?.remuneration || 0;
      totalRemuneration += remuneration;

      // Eligible for bonus = the canonical four predicates (must match the API
      // live calc): EFFECTED + bonifiable + performanceLevel > 0 + registered in
      // Secullum. Previously this only checked EFFECTED + bonifiable, inflating
      // the eligible count and skewing the average-bonus denominator.
      const u = user as typeof user & { performanceLevel?: number | null; secullumEmployeeId?: number | null };
      const isEligible =
        u.currentContractType === CONTRACT_TYPE.EFFECTED &&
        u.position?.bonifiable === true &&
        (u.performanceLevel ?? 0) > 0 &&
        u.secullumEmployeeId != null;

      if (isEligible) {
        // Use actual bonus data from API (bonus relation is the source of truth)
        const bonusValue = user.bonus?.baseBonus || user.calculatedBonus || 0;
        totalBonus += bonusValue;
        bonusEligibleCount++;
      }
    });

    const totalEarnings = totalRemuneration + totalBonus;
    const averageBonus = bonusEligibleCount > 0 ? totalBonus / bonusEligibleCount : 0;

    return {
      totalBonus,
      totalRemuneration,
      totalEarnings,
      averageBonus,
      bonusEligibleCount,
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
    <Card className="shadow-sm border border-border">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <IconCalendar className="h-5 w-5 text-muted-foreground" />
          Folha de Pagamento - {monthName} {year}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Header Stats - Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

          {/* Average Tasks Per Employee */}
          <div className="space-y-2 p-4 bg-gradient-to-br from-orange-50 to-orange-25 dark:from-orange-950/20 dark:to-orange-900/10 rounded-lg border border-orange-200/50 dark:border-orange-800/30">
            <div className="flex items-center gap-2">
              <IconChartLine className="h-4 w-4 text-orange-600" />
              <p className="text-sm font-medium text-orange-700 dark:text-orange-300">Média de Tarefas</p>
            </div>
            <p className="text-2xl font-bold text-orange-800 dark:text-orange-200">
              {averageTasksPerEmployee.toFixed(1)}
            </p>
            <p className="text-xs text-orange-600 dark:text-orange-400">
              Tarefas por funcionário no período
            </p>
          </div>
        </div>

        {/* Secondary Stats - Financial Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Total Remuneration */}
          <div className="space-y-2 p-4 bg-card dark:bg-card rounded-lg border border-border">
            <div className="flex items-center gap-2">
              <IconCurrencyDollar className="h-4 w-4 text-amber-600" />
              <p className="text-sm font-medium text-muted-foreground">Total Remuneração</p>
            </div>
            <p className="text-xl font-bold text-amber-600">{formatCurrency(totalRemuneration)}</p>
            <p className="text-xs text-muted-foreground">Base salarial</p>
          </div>

          {/* Total Earnings */}
          <div className="space-y-2 p-4 bg-card dark:bg-card rounded-lg border border-border">
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