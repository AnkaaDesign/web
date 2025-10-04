import React, { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  IconCalculator,
  IconRefresh,
  IconCurrencyReal,
  IconTrendingUp,
  IconTrendingDown,
  IconClock,
  IconUser,
  IconCalendar,
  IconTarget,
  IconClipboardList,
} from "@tabler/icons-react";
import {
  usePayrollLiveCalculation,
  usePayrollByUserPeriod,
  useUsers,
  useTasks
} from "../../../hooks";
import { formatCurrency, formatRelativeTime } from "../../../utils";
import { TASK_STATUS } from "../../../constants";

interface PayrollCalculationProps {
  userId: string;
  year: number;
  month: number;
  className?: string;
}

interface TaskStats {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  weightedCount: number;
}

export function PayrollCalculation({
  userId,
  year,
  month,
  className
}: PayrollCalculationProps) {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showDetails, setShowDetails] = useState(true);

  // Fetch live calculation data
  const {
    data: liveCalculation,
    isLoading: isCalculationLoading,
    error: calculationError,
    refetch: refetchCalculation
  } = usePayrollLiveCalculation(userId, year, month);

  // Fetch current payroll data for comparison
  const {
    data: payrollResponse,
    isLoading: isPayrollLoading,
    refetch: refetchPayroll
  } = usePayrollByUserPeriod(userId, year, month, {
    include: {
      user: {
        include: { position: true, sector: true }
      },
      bonus: true,
      discounts: { orderBy: { calculationOrder: "asc" } },
    }
  });

  // Fetch user data
  const { data: usersResponse } = useUsers({
    where: { id: userId },
    include: { position: true, sector: true }
  });

  // Calculate period dates (26-25 system)
  const periodDates = useMemo(() => {
    const startDate = new Date(year, month - 2, 26); // Previous month, day 26
    const endDate = new Date(year, month - 1, 25);   // Current month, day 25
    return { startDate, endDate };
  }, [year, month]);

  // Fetch tasks for the period to calculate current stats
  const { data: tasksResponse } = useTasks({
    where: {
      userId: userId,
      AND: [
        { finishedAt: { gte: periodDates.startDate } },
        { finishedAt: { lte: periodDates.endDate } }
      ]
    },
    include: {
      services: true,
      customer: true,
    }
  });

  const user = usersResponse?.data?.[0];
  const payroll = payrollResponse?.data;
  const tasks = tasksResponse?.data || [];
  const calculation = liveCalculation?.data;

  // Calculate current task statistics
  const taskStats: TaskStats = useMemo(() => {
    const stats = tasks.reduce((acc, task) => {
      acc.total++;

      switch (task.status) {
        case TASK_STATUS.COMPLETED:
          acc.completed++;
          break;
        case TASK_STATUS.IN_PRODUCTION:
          acc.inProgress++;
          break;
        case TASK_STATUS.PENDING:
          acc.pending++;
          break;
      }

      // Calculate weighted count (this should match bonus calculation logic)
      if (task.status === TASK_STATUS.COMPLETED) {
        const weight = task.services?.reduce((sum, service) =>
          sum + (service.weight || 1), 0) || 1;
        acc.weightedCount += weight;
      }

      return acc;
    }, {
      total: 0,
      completed: 0,
      inProgress: 0,
      pending: 0,
      weightedCount: 0
    });

    return stats;
  }, [tasks]);

  // Live calculation values
  const liveBaseRemuneration = calculation?.baseRemuneration || payroll?.baseRemuneration || 0;
  const liveBonusValue = calculation?.bonusValue || payroll?.bonus?.finalValue || 0;
  const liveGrossSalary = liveBaseRemuneration + liveBonusValue;

  // Calculate live discounts
  const liveDiscounts = calculation?.discounts || payroll?.discounts || [];
  const liveTotalDiscounts = liveDiscounts.reduce((sum, discount) => {
    if (discount.fixedValue) {
      return sum + discount.fixedValue;
    }
    if (discount.percentage) {
      return sum + (liveGrossSalary * discount.percentage / 100);
    }
    return sum;
  }, 0);

  const liveNetSalary = Math.max(0, liveGrossSalary - liveTotalDiscounts);

  // Compare with saved payroll
  const hasChanges = payroll && (
    payroll.baseRemuneration !== liveBaseRemuneration ||
    (payroll.bonus?.finalValue || 0) !== liveBonusValue
  );

  const handleRefresh = () => {
    refetchCalculation();
    refetchPayroll();
  };

  if (isCalculationLoading || isPayrollLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Calculando valores atuais...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Cálculos em Tempo Real</h3>
          <p className="text-sm text-muted-foreground">
            {user?.name} - {month}/{year}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2">
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
            <Label htmlFor="auto-refresh" className="text-sm">
              Atualização automática
            </Label>
          </div>

          <Button variant="outline" size="sm" onClick={handleRefresh}>
            <IconRefresh className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Changes Alert */}
      {hasChanges && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-orange-800">
              <IconClock className="h-5 w-5" />
              <p className="font-medium">Alterações Detectadas</p>
            </div>
            <p className="text-sm text-orange-700 mt-1">
              Os valores calculados são diferentes da folha salva.
              Considere atualizar a folha de pagamento.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left Column - Current Period Stats */}
        <div className="space-y-6">
          {/* Period Information */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <IconCalendar className="h-5 w-5" />
                <CardTitle>Período de Referência</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span>Início:</span>
                  <span>{periodDates.startDate.toLocaleDateString("pt-BR")}</span>
                </div>
                <div className="flex justify-between">
                  <span>Fim:</span>
                  <span>{periodDates.endDate.toLocaleDateString("pt-BR")}</span>
                </div>
                <div className="flex justify-between">
                  <span>Dias restantes:</span>
                  <span>
                    {Math.max(0, Math.ceil((periodDates.endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))} dias
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Task Statistics */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <IconClipboardList className="h-5 w-5" />
                <CardTitle>Performance do Período</CardTitle>
              </div>
              <CardDescription>
                Estatísticas das tarefas no período 26-25
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 grid-cols-2">
                <div className="text-center">
                  <div className="text-2xl font-bold">{taskStats.completed}</div>
                  <p className="text-sm text-muted-foreground">Concluídas</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{taskStats.weightedCount}</div>
                  <p className="text-sm text-muted-foreground">Peso Total</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{taskStats.inProgress}</div>
                  <p className="text-sm text-muted-foreground">Em Andamento</p>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">{taskStats.pending}</div>
                  <p className="text-sm text-muted-foreground">Pendentes</p>
                </div>
              </div>

              <Separator className="my-4" />

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Taxa de conclusão:</span>
                  <span className="font-medium">
                    {taskStats.total > 0 ?
                      `${Math.round((taskStats.completed / taskStats.total) * 100)}%` :
                      "0%"
                    }
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Média de peso/tarefa:</span>
                  <span className="font-medium">
                    {taskStats.completed > 0 ?
                      (taskStats.weightedCount / taskStats.completed).toFixed(2) :
                      "0"
                    }
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Financial Calculations */}
        <div className="space-y-6">
          {/* Live Salary Calculation */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <IconCalculator className="h-5 w-5" />
                <CardTitle>Cálculo Atual</CardTitle>
              </div>
              <CardDescription>
                Valores calculados em tempo real
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span>Salário Base:</span>
                  <span className="font-medium">{formatCurrency(liveBaseRemuneration)}</span>
                </div>

                <div className="flex justify-between">
                  <div className="flex items-center gap-2">
                    <span>Bônus:</span>
                    {calculation?.bonusCalculation && (
                      <Badge variant="secondary" className="text-xs">
                        {calculation.bonusCalculation.weightedTasks} × {calculation.bonusCalculation.multiplier}
                      </Badge>
                    )}
                  </div>
                  <span className="font-medium text-green-600">
                    +{formatCurrency(liveBonusValue)}
                  </span>
                </div>

                <Separator />

                <div className="flex justify-between font-medium">
                  <span>Salário Bruto:</span>
                  <span>{formatCurrency(liveGrossSalary)}</span>
                </div>

                {liveDiscounts.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Descontos:</p>
                      {liveDiscounts.map((discount) => {
                        const discountValue = discount.fixedValue ||
                          (discount.percentage ? (liveGrossSalary * discount.percentage / 100) : 0);

                        return (
                          <div key={discount.id} className="flex justify-between text-sm">
                            <span>{discount.reference}</span>
                            <span className="text-red-600">
                              -{formatCurrency(discountValue)}
                            </span>
                          </div>
                        );
                      })}
                      <div className="flex justify-between text-sm font-medium">
                        <span>Total de descontos:</span>
                        <span className="text-red-600">-{formatCurrency(liveTotalDiscounts)}</span>
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                <div className="flex justify-between text-lg font-bold">
                  <span>Salário Líquido:</span>
                  <span className="text-blue-600">{formatCurrency(liveNetSalary)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Comparison with Saved Payroll */}
          {payroll && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <IconTrendingUp className="h-5 w-5" />
                  <CardTitle>Comparação</CardTitle>
                </div>
                <CardDescription>
                  Diferenças com a folha salva
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span>Salário Base:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{formatCurrency(payroll.baseRemuneration)}</span>
                      {payroll.baseRemuneration !== liveBaseRemuneration ? (
                        <div className="flex items-center gap-1">
                          <IconTrendingUp className="h-3 w-3 text-green-600" />
                          <span className="text-xs text-green-600">
                            {formatCurrency(liveBaseRemuneration - payroll.baseRemuneration)}
                          </span>
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-xs">Igual</Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span>Bônus:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{formatCurrency(payroll.bonus?.finalValue || 0)}</span>
                      {(payroll.bonus?.finalValue || 0) !== liveBonusValue ? (
                        <div className="flex items-center gap-1">
                          {liveBonusValue > (payroll.bonus?.finalValue || 0) ? (
                            <IconTrendingUp className="h-3 w-3 text-green-600" />
                          ) : (
                            <IconTrendingDown className="h-3 w-3 text-red-600" />
                          )}
                          <span className={`text-xs ${
                            liveBonusValue > (payroll.bonus?.finalValue || 0)
                              ? "text-green-600"
                              : "text-red-600"
                          }`}>
                            {formatCurrency(Math.abs(liveBonusValue - (payroll.bonus?.finalValue || 0)))}
                          </span>
                        </div>
                      ) : (
                        <Badge variant="outline" className="text-xs">Igual</Badge>
                      )}
                    </div>
                  </div>
                </div>

                {hasChanges && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-700">
                      <strong>Atualização recomendada:</strong> Os cálculos atuais diferem
                      da folha salva. Considere atualizar a folha de pagamento.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Last Update */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Última atualização:</span>
                <span>{formatRelativeTime(new Date())}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}