import { useState, useMemo } from "react";
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
  IconClock,
  IconCalendar,
  IconClipboardList,
} from "@tabler/icons-react";
import {
  usePayrollByUserAndPeriod,
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
  const [_showDetails, _setShowDetails] = useState(true);

  // Fetch payroll data (API transparently returns live calculation for current period)
  const {
    data: payrollResponse,
    isLoading: isPayrollLoading,
    refetch: refetchPayroll
  } = usePayrollByUserAndPeriod(userId, year, month, {
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
      serviceOrders: true,
      customer: true,
    }
  });

  const user = usersResponse?.data?.[0];
  const payroll = payrollResponse;
  const tasks = tasksResponse?.data || [];

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
        case TASK_STATUS.WAITING_PRODUCTION:
        case TASK_STATUS.PREPARATION:
          acc.pending++;
          break;
      }

      // Calculate weighted count (this should match bonus calculation logic)
      if (task.status === TASK_STATUS.COMPLETED) {
        const weight = task.serviceOrders?.reduce((sum, service) =>
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

  // Current calculation values (API returns live data for current period)
  const baseRemuneration = payroll?.baseRemuneration || 0;
  const bonusValue = payroll?.bonus?.baseBonus || payroll?.bonus?.finalValue || 0;
  const grossSalary = Number(baseRemuneration) + Number(bonusValue);

  // Calculate discounts
  const discounts = payroll?.discounts || [];
  const totalDiscounts = discounts.reduce((sum: number, discount: any) => {
    if (discount.value) {
      return sum + Number(discount.value);
    }
    if (discount.percentage) {
      return sum + (grossSalary * Number(discount.percentage) / 100);
    }
    return sum;
  }, 0);

  const netSalary = Math.max(0, grossSalary - totalDiscounts);

  const handleRefresh = () => {
    refetchPayroll();
  };

  if (isPayrollLoading) {
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

      {/* Info about live calculation */}
      {payroll?.isLive && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-blue-800">
              <IconClock className="h-5 w-5" />
              <p className="font-medium">Cálculo em Tempo Real</p>
            </div>
            <p className="text-sm text-blue-700 mt-1">
              Esta folha ainda não foi salva. Os valores são calculados em tempo real.
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
                  <span className="font-medium">{formatCurrency(baseRemuneration)}</span>
                </div>

                <div className="flex justify-between">
                  <div className="flex items-center gap-2">
                    <span>Bônus:</span>
                    {payroll?.bonus && (
                      <Badge variant="secondary" className="text-xs">
                        {payroll.bonus.taskCount || 0} tarefas
                      </Badge>
                    )}
                  </div>
                  <span className="font-medium text-green-600">
                    +{formatCurrency(bonusValue)}
                  </span>
                </div>

                <Separator />

                <div className="flex justify-between font-medium">
                  <span>Salário Bruto:</span>
                  <span>{formatCurrency(grossSalary)}</span>
                </div>

                {discounts.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Descontos:</p>
                      {discounts.map((discount: any) => {
                        const discountValue = discount.value ||
                          (discount.percentage ? (grossSalary * discount.percentage / 100) : 0);

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
                        <span className="text-red-600">-{formatCurrency(totalDiscounts)}</span>
                      </div>
                    </div>
                  </>
                )}

                <Separator />

                <div className="flex justify-between text-lg font-bold">
                  <span>Salário Líquido:</span>
                  <span className="text-blue-600">{formatCurrency(netSalary)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

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