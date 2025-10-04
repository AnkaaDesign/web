import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useUser } from "../../../hooks";
import { routes, SECTOR_PRIVILEGES, TASK_STATUS, USER_STATUS } from "../../../constants";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { formatCurrency } from "../../../utils";
import {
  IconReceipt,
  IconRefresh,
  IconUser,
  IconCurrencyReal,
  IconClipboardList,
  IconAlertCircle,
  IconBuildingStore,
  IconCalendar,
  IconUsers,
  IconTrendingUp,
  IconCalendarStats,
  IconLayoutList,
  IconLayoutGrid,
} from "@tabler/icons-react";

// Import the detail components
import { PayrollDetailsCard } from "@/components/human-resources/payroll/detail/payroll-details-card";
import { TasksInBonusCard } from "@/components/human-resources/payroll/detail/tasks-in-bonus-card";
import { UsersStatsCard } from "@/components/human-resources/payroll/detail/users-stats-card";
import { RelatedTasksCard } from "@/components/shared/related-tasks-card";

interface PayrollDetailPageParams {
  payrollId: string; // Only payrollId is needed now
}

function getMonthName(month?: number): string {
  if (!month) return "";
  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];
  const monthIndex = month - 1;
  return monthNames[monthIndex] || "";
}

export default function PayrollDetailPage() {
  const { payrollId } = useParams<PayrollDetailPageParams>();
  const navigate = useNavigate();

  // Fetch payroll details including bonuses
  const [payrollData, setPayrollData] = useState<any>(null);
  const [payrollLoading, setPayrollLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  // Track page access
  usePageTracker({
    title: "Detalhes da Folha de Pagamento",
    icon: "receipt",
  });

  useEffect(() => {
    const fetchPayrollDetails = async () => {
      if (!payrollId) {
        setPayrollData(null);
        setPayrollLoading(false);
        return;
      }

      setPayrollLoading(true);
      try {
        const { payrollService, userService } = await import('../../../api-client');

        // Check if it's a composite ID for live calculation (userId_year_month)
        const isCompositeId = payrollId.includes('_');

        if (isCompositeId) {
          // Parse composite ID for live calculation
          const [userId, year, month] = payrollId.split('_');

          // No need to fetch users separately - backend now returns correct participant count

          // Fetch live calculation using the user/year/month endpoint
          const response = await payrollService.getByUserAndMonth(
            userId,
            parseInt(year),
            parseInt(month),
            {
              include: {
                user: {
                  include: {
                    position: true,
                    sector: true,
                  },
                },
                bonus: {
                  include: {
                    tasks: {
                      include: {
                        customer: true,
                        createdBy: true,
                        sector: true,
                        services: true,
                      },
                    },
                    users: true,
                  },
                },
                discounts: true,
              },
            }
          );

          if (response?.data) {
            setPayrollData(response.data);
          }
        } else {
          // Standard fetch by ID for saved payrolls
          const response = await payrollService.getById(payrollId, {
            include: {
              user: {
                include: {
                  position: true,
                  sector: true,
                },
              },
              bonus: {
                include: {
                  tasks: {
                    include: {
                      customer: true,
                      user: true,
                      sector: true,
                      services: true,
                    },
                  },
                  users: true,
                },
              },
              discounts: true,
            },
          });

          if (response?.data?.data) {
            setPayrollData(response.data.data);
          } else if (response?.data) {
            setPayrollData(response.data);
          }
        }
      } catch (error) {
        setPayrollData(null);
      }
      setPayrollLoading(false);
    };

    fetchPayrollDetails();
  }, [payrollId]);

  // Calculate bonus period dates (26th to 25th)
  const getBonusPeriodDates = (year: number, month: number) => {
    if (!year || !month) return { startDate: new Date(), endDate: new Date() };

    const startDate = new Date(year, month - 2, 26, 0, 0, 0); // Previous month, day 26
    const endDate = new Date(year, month - 1, 25, 23, 59, 59); // Current month, day 25

    // If month is January (1), we need to handle year transition
    if (month === 1) {
      startDate.setFullYear(year - 1);
      startDate.setMonth(11); // December
    }

    return { startDate, endDate };
  };

  const { startDate, endDate } = useMemo(() => {
    if (payrollData) {
      return getBonusPeriodDates(payrollData.year, payrollData.month);
    }
    return { startDate: new Date(), endDate: new Date() };
  }, [payrollData]);

  // Detect if month is closed (bonus has been saved/confirmed)
  const isMonthClosed = useMemo(() => {
    return payrollData?.bonus && !payrollData.bonus.isLive;
  }, [payrollData]);

  // Get the correct user data based on whether month is closed or not
  const displayUser = useMemo(() => {
    if (!payrollData?.user) return null;

    // For unclosed months (live data), use current user data
    if (!isMonthClosed) {
      return {
        ...payrollData.user,
        performanceLevel: payrollData.user.performanceLevel, // Use current performance level
        position: payrollData.user.position, // Use current position
      };
    }

    // For closed months, use saved bonus/payroll data
    return {
      ...payrollData.user,
      performanceLevel: payrollData.bonus?.performanceLevel ?? payrollData.user.performanceLevel,
      position: payrollData.position || payrollData.user.position, // Prefer payroll.position if available
    };
  }, [payrollData, isMonthClosed]);

  // Extract statistics from payroll data
  const statistics = useMemo(() => {
    if (!payrollData) {
      return {
        totalParticipants: 0,
        totalTasks: 0,
        totalWeightedTasks: 0,
        averageWeightedTasks: 0,
        averageTasksPerUser: 0,
      };
    }

    const tasks = payrollData.bonus?.tasks || [];
    const users = payrollData.bonus?.users || [];

    // If we have the direct statistics from backend, use them
    if (payrollData.bonus?.totalTasks !== undefined) {
      // Backend now sends correct data with proper filtering (CONTRACTED + bonifiable + performance > 0)
      const averagePerUser = payrollData.bonus.weightedTaskCount || 0;
      const totalTasks = payrollData.bonus.totalTasks;
      const totalParticipants = payrollData.bonus.totalUsers || users.length || 0;

      // Calculate total weighted tasks from average and participant count
      const totalWeightedTasks = averagePerUser * totalParticipants;


      return {
        totalParticipants,
        totalTasks: payrollData.bonus.totalTasks,
        totalWeightedTasks, // Total weighted tasks for the period
        averageWeightedTasks: averagePerUser, // Average per user (from backend)
        averageTasksPerUser: averagePerUser, // Same as averageWeightedTasks
        isLive: !isMonthClosed, // Use the computed isMonthClosed flag
      };
    }

    // Otherwise calculate from tasks (fallback if backend doesn't provide statistics)
    const fullCommissionTasks = tasks.filter((t: any) => t.commission === 'FULL_COMMISSION').length;
    const partialCommissionTasks = tasks.filter((t: any) => t.commission === 'PARTIAL_COMMISSION').length;
    const totalWeightedTasks = fullCommissionTasks + (partialCommissionTasks * 0.5);

    // Use bonus users count or fallback
    const participantCount = payrollData.bonus?.totalUsers || users.length || 0;

    const averageWeightedTasks = participantCount > 0 ? totalWeightedTasks / participantCount : 0;
    const averageTasksPerUser = participantCount > 0 ? tasks.length / participantCount : 0;

    return {
      totalParticipants: participantCount,
      totalTasks: tasks.length,
      totalWeightedTasks,
      averageWeightedTasks, // Average weighted tasks per user
      averageTasksPerUser, // Average total tasks per user
      isLive: !isMonthClosed, // Use the computed isMonthClosed flag
    };
  }, [payrollData, isMonthClosed]);

  // Validation - check if payrollId is provided
  if (!payrollId) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
        <Alert variant="destructive">
          <IconAlertCircle className="h-4 w-4" />
          <AlertDescription>ID da folha de pagamento não fornecido</AlertDescription>
        </Alert>
      </PrivilegeRoute>
    );
  }

  // Show loading state while fetching payroll
  if (payrollLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
        <div className="flex items-center justify-center p-8">
          <Skeleton className="h-32 w-full max-w-lg" />
        </div>
      </PrivilegeRoute>
    );
  }

  // Show error if payroll not found
  if (!payrollData) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
        <Alert variant="destructive">
          <IconAlertCircle className="h-4 w-4" />
          <AlertDescription>Folha de pagamento não encontrada</AlertDescription>
        </Alert>
      </PrivilegeRoute>
    );
  }

  // Extract user and period info from payroll data
  const user = displayUser;
  const userName = user?.name || payrollData?.user?.name || 'Funcionário';
  const monthName = getMonthName(payrollData?.month);
  const year = payrollData?.year || new Date().getFullYear();
  const title = payrollData ? `${userName} - ${monthName} ${year}` : 'Folha de Pagamento';

  const breadcrumbs = [
    { label: "Início", href: routes.home },
    { label: "Recursos Humanos" },
    { label: "Folha de Pagamento", href: routes.humanResources.payroll.root },
    { label: title },
  ];

  const handleRefresh = () => {
    // Re-fetch payroll data
    window.location.reload();
  };

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="flex flex-col h-full space-y-6">
        <PageHeader
          variant="detail"
          title={title}
          icon={IconReceipt}
          breadcrumbs={breadcrumbs}
          actions={[
            {
              key: "refresh",
              label: "Atualizar",
              icon: IconRefresh,
              onClick: handleRefresh,
            },
          ]}
        />

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-6">
            {/* User Payroll Summary and Period Statistics Grid */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* User Payroll Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconCurrencyReal className="h-5 w-5" />
                    Detalhes da Remuneração
                  </CardTitle>
                  <CardDescription>
                    Informações de cargo e remuneração para {monthName} de {year}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Cargo</p>
                      <p className="font-medium">
                        {user?.position?.name || "-"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Setor</p>
                      <p className="font-medium">
                        {user?.sector?.name || "-"}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Nível Performance</p>
                      <Badge variant={(user?.performanceLevel || 0) > 0 ? "default" : "secondary"}>
                        {user?.performanceLevel || "0"}
                      </Badge>
                      {statistics.isLive && (
                        <p className="text-xs text-yellow-600 mt-1">
                          (dados em tempo real)
                        </p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Bonificável</p>
                      <Badge variant={user?.position?.bonifiable ? "success" : "secondary"}>
                        {user?.position?.bonifiable ? "Sim" : "Não"}
                      </Badge>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div className="grid gap-4 grid-cols-1">
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Remuneração Base</p>
                      <p className="text-2xl font-bold text-primary">
                        {formatCurrency(
                          Number(payrollData.baseRemuneration) ||
                          Number(payrollData.user?.position?.baseRemuneration) ||
                          0
                        )}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Bonificação</p>
                      <p className="text-2xl font-bold text-green-600">
                        {formatCurrency(
                          payrollData.bonus ? Number(payrollData.bonus.baseBonus) : 0
                        )}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm text-muted-foreground">Total Bruto</p>
                      <p className="text-2xl font-bold">
                        {formatCurrency(
                          (Number(payrollData.baseRemuneration) ||
                           Number(payrollData.user?.position?.baseRemuneration) ||
                           0) + (payrollData.bonus ? Number(payrollData.bonus.baseBonus) : 0)
                        )}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Period Statistics - Only show if user is eligible */}
              {user?.position?.bonifiable ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <IconCalendarStats className="h-5 w-5" />
                      Estatísticas do Período
                    </CardTitle>
                    <CardDescription>
                      Dados de performance para {monthName} de {year}
                      <span className="text-xs block text-muted-foreground mt-1">
                        Período: {startDate.toLocaleDateString('pt-BR')} a {endDate.toLocaleDateString('pt-BR')}
                      </span>
                      {statistics.isLive && (
                        <span className="text-xs block text-yellow-600 mt-1">
                          ⚠️ Dados calculados em tempo real (bônus ainda não criado)
                        </span>
                      )}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 grid-cols-2">
                      <div className="text-center p-4 rounded-lg bg-muted/50">
                        <IconUsers className="h-8 w-8 text-primary mx-auto mb-2" />
                        <p className="text-2xl font-bold">{statistics.totalParticipants}</p>
                        <p className="text-xs text-muted-foreground">Funcionários com Bônus</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-muted/50">
                        <IconClipboardList className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold">{statistics.totalTasks}</p>
                        <p className="text-xs text-muted-foreground">Total de Tarefas</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-muted/50">
                        <IconTrendingUp className="h-8 w-8 text-green-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold">{statistics.totalWeightedTasks.toFixed(1)}</p>
                        <p className="text-xs text-muted-foreground">Tarefas Ponderadas</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-muted/50">
                        <IconCalendarStats className="h-8 w-8 text-orange-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold">{statistics.averageWeightedTasks.toFixed(1)}</p>
                        <p className="text-xs text-muted-foreground">Média por Funcionário</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <IconCalendarStats className="h-5 w-5" />
                      Estatísticas do Período
                    </CardTitle>
                    <CardDescription>
                      Funcionário não elegível para bonificação
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8">
                      <IconAlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                      <p className="text-muted-foreground">
                        Este funcionário não está elegível para bonificação.
                        <br />
                        As estatísticas de tarefas não são aplicáveis.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

            {/* Tasks Grid - Only show for eligible users */}
            {user?.position?.bonifiable ? (
              <div className="space-y-4">
                <RelatedTasksCard
                  tasks={payrollData?.bonus?.tasks || []}
                  title={`Tarefas de ${user?.name || 'Funcionário'}`}
                  icon={IconClipboardList}
                  showViewToggle={true}
                  defaultView="grid"
                  displayMode="commission"
                  className="h-[800px]"
                />
              </div>
            ) : null}

            {/* Discounts Card */}
            <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconCurrencyReal className="h-5 w-5" />
                    Descontos e Cálculos
                  </CardTitle>
                  <CardDescription>
                    Detalhes da bonificação e descontos aplicados
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {payrollData.bonus ? (
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Bonificação Base</span>
                          <span className="font-medium">{formatCurrency(Number(payrollData.bonus.baseBonus) || 0)}</span>
                        </div>
                        {payrollData.discounts?.length > 0 && (
                          <>
                            <Separator />
                            {payrollData.discounts.map((discount: any) => (
                              <div key={discount.id} className="flex justify-between">
                                <span className="text-sm text-muted-foreground">{discount.reference}</span>
                                <span className="text-sm text-red-600">
                                  -{formatCurrency(
                                    Number(discount.value) ||
                                    Number(discount.fixedValue) ||
                                    ((Number(payrollData.baseRemuneration) || Number(payrollData.user?.position?.baseRemuneration) || 0) * (Number(discount.percentage) || 0) / 100)
                                  )}
                                </span>
                              </div>
                            ))}
                          </>
                        )}
                        <Separator />
                        <div className="flex justify-between">
                          <span className="text-sm font-medium">Total Líquido</span>
                          <span className="font-bold text-lg">
                            {formatCurrency(
                              (Number(payrollData.baseRemuneration) || Number(payrollData.user?.position?.baseRemuneration) || 0) +
                              (payrollData.bonus ? Number(payrollData.bonus.baseBonus) : 0) -
                              (payrollData.discounts?.reduce((sum: number, d: any) =>
                                sum + (Number(d.value) || Number(d.fixedValue) || ((Number(payrollData.baseRemuneration) || Number(payrollData.user?.position?.baseRemuneration) || 0) * (Number(d.percentage) || 0) / 100)), 0
                              ) || 0)
                            )}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <IconCurrencyReal className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                        <p className="text-muted-foreground">Nenhuma bonificação registrada para este período</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </PrivilegeRoute>
  );
}