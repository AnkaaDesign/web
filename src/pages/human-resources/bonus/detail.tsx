import { useState, useMemo, useEffect } from "react";
import { useParams } from "react-router-dom";
import { bonusService } from "../../../api-client";
import { routes, SECTOR_PRIVILEGES } from "../../../constants";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { formatCurrency } from "../../../utils";
import { cn } from "@/lib/utils";
import { BonusTasksList } from "@/components/human-resources/bonus/detail";
import {
  IconCurrencyReal,
  IconAlertCircle,
  IconRefresh,
  IconFileDownload,
  IconUser,
} from "@tabler/icons-react";

interface BonusDetailPageParams {
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

// Info row component for consistent styling
function InfoRow({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3", className)}>
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold text-foreground">{value}</span>
    </div>
  );
}

export default function BonusDetailPage() {
  const { id } = useParams<BonusDetailPageParams>();

  // State for bonus data
  const [bonus, setBonus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track page access
  usePageTracker({
    title: "Detalhes do Bônus",
    icon: "currency-dollar",
  });

  // Fetch bonus data - Backend handles both regular UUIDs and live IDs transparently
  // The data structure is identical regardless of whether bonus is saved or calculated live
  useEffect(() => {
    if (!id) {
      setError('ID do bônus não fornecido');
      setLoading(false);
      return;
    }

    const fetchBonus = async () => {
      setLoading(true);
      setError(null);

      try {
        // Single endpoint handles both live IDs and regular UUIDs
        // Backend's findByIdOrLive parses live IDs and returns consistent data format
        const response = await bonusService.getById(id, {
          include: {
            user: {
              include: {
                position: true,
                sector: true,
              },
            },
            position: true,
            tasks: {
              include: {
                customer: true,
                sector: true,
              },
            },
            bonusDiscounts: true,
            users: true,
          },
        });

        const responseData = response.data;

        if (responseData?.data) {
          setBonus(responseData.data);
        } else if (responseData?.success === false) {
          setError(responseData.message || 'Bônus não encontrado.');
        } else if (responseData && !responseData.success) {
          // Direct bonus object without wrapper
          setBonus(responseData);
        } else {
          setError('Bônus não encontrado.');
        }
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Erro ao carregar bônus.');
      } finally {
        setLoading(false);
      }
    };

    fetchBonus();
  }, [id]);

  // Calculate final bonus amount (after discounts)
  const calculateFinalAmount = useMemo(() => {
    if (!bonus) return 0;

    const baseBonus = typeof bonus.baseBonus === 'number'
      ? bonus.baseBonus
      : (bonus.baseBonus as any)?.toNumber?.() || Number(bonus.baseBonus) || 0;

    if (!bonus.bonusDiscounts || bonus.bonusDiscounts.length === 0) {
      return baseBonus;
    }

    let finalAmount = baseBonus;

    bonus.bonusDiscounts
      .sort((a: any, b: any) => a.calculationOrder - b.calculationOrder)
      .forEach((discount: any) => {
        if (discount.percentage) {
          finalAmount -= finalAmount * (discount.percentage / 100);
        } else if (discount.value) {
          finalAmount -= discount.value;
        }
      });

    return finalAmount;
  }, [bonus]);

  // Get task statistics - use pre-calculated values from API
  // API returns identical structure for live and saved bonuses
  const taskStats = useMemo(() => {
    const tasks = bonus?.tasks || [];
    const users = bonus?.users || [];

    // Total raw tasks count
    const totalRawTasks = tasks.length;

    // Use weightedTasks from API (period total - same for all users)
    const totalPonderedTasks = bonus?.weightedTasks
      ? (typeof bonus.weightedTasks === 'object' && bonus.weightedTasks?.toNumber
        ? bonus.weightedTasks.toNumber()
        : Number(bonus.weightedTasks) || 0)
      : 0;

    // Total collaborators from users relation
    const totalCollaborators = users.length || 1;

    // Use averageTaskPerUser from API (period average - same for all users)
    const averageTasksPerUser = bonus?.averageTaskPerUser
      ? (typeof bonus.averageTaskPerUser === 'object' && bonus.averageTaskPerUser?.toNumber
        ? bonus.averageTaskPerUser.toNumber()
        : Number(bonus.averageTaskPerUser) || 0)
      : 0;

    return {
      totalRawTasks,
      totalPonderedTasks,
      totalCollaborators,
      averageTasksPerUser,
      tasks,
    };
  }, [bonus?.tasks, bonus?.users, bonus?.weightedTasks, bonus?.averageTaskPerUser]);

  // Validation
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

  if (loading) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
        <div className="space-y-6">
          {/* Header skeleton */}
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-48" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>

          {/* Cards skeleton */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* General Info Card skeleton */}
            <Card>
              <CardHeader className="pb-4">
                <Skeleton className="h-5 w-40" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-12 w-full rounded-lg" />
                <Skeleton className="h-12 w-full rounded-lg" />
                <Skeleton className="h-12 w-full rounded-lg" />
                <Skeleton className="h-12 w-full rounded-lg" />
                <Skeleton className="h-12 w-full rounded-lg" />
              </CardContent>
            </Card>

            {/* Financial Card skeleton */}
            <Card>
              <CardHeader className="pb-4">
                <Skeleton className="h-5 w-24" />
              </CardHeader>
              <CardContent className="space-y-2">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Separator className="my-2" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-10 w-full rounded-lg mt-2" />
              </CardContent>
            </Card>
          </div>

          {/* Tasks table skeleton */}
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
        </div>
      </PrivilegeRoute>
    );
  }

  if (error) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
        <Alert variant="destructive">
          <IconAlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </PrivilegeRoute>
    );
  }

  if (!bonus) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
        <Alert variant="destructive">
          <IconAlertCircle className="h-4 w-4" />
          <AlertDescription>Bônus não encontrado</AlertDescription>
        </Alert>
      </PrivilegeRoute>
    );
  }

  // Extract data - use position from bonus if available (saved at bonus creation time)
  const user = bonus.user;
  const userName = user?.name || 'Funcionário';
  const monthName = getMonthName(bonus.month);
  const year = bonus.year || new Date().getFullYear();
  const title = `${userName} - ${monthName} ${year}`;

  // Use position/sector saved at bonus creation, fallback to user's current
  const position = bonus.position || user?.position;
  const sector = user?.sector;

  const breadcrumbs = [
    { label: "Início", href: routes.home },
    { label: "Recursos Humanos" },
    { label: "Bônus", href: routes.humanResources.bonus.root },
    { label: title },
  ];

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleExport = () => {
    window.print();
  };

  const hasDiscounts = bonus.bonusDiscounts && bonus.bonusDiscounts.length > 0;
  const finalBonusValue = calculateFinalAmount;

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="space-y-6">
        <PageHeader
          variant="detail"
          title={title}
          icon={IconCurrencyReal}
          breadcrumbs={breadcrumbs}
          actions={[
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
        <div className="grid gap-6 md:grid-cols-2">
          {/* General Info Card */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <IconUser className="h-4 w-4" />
                Informações Gerais
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <InfoRow label="Colaborador" value={userName} />
              <InfoRow label="Cargo" value={position?.name || "-"} />
              <InfoRow label="Setor" value={sector?.name || "-"} />
              <InfoRow label="Nível de Performance" value={bonus.performanceLevel || 0} />
              <InfoRow label="Período" value={`${monthName}/${year}`} />
            </CardContent>
          </Card>

          {/* Financial Card */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <IconCurrencyReal className="h-4 w-4" />
                Valores
              </CardTitle>
            </CardHeader>
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
              <div className="flex justify-between py-1">
                <span className="text-sm text-muted-foreground">Bônus Base</span>
                <span className="text-sm font-medium">{formatBonusAmount(bonus.baseBonus)}</span>
              </div>
              {hasDiscounts && bonus.bonusDiscounts!.map((discount: any) => {
                const percentageValue = Number(discount.percentage) || 0;
                const hasPercentage = percentageValue > 0;
                return (
                  <div key={discount.id} className="flex justify-between py-1">
                    <span className="text-sm text-muted-foreground">{discount.reference}</span>
                    <span className="text-sm font-medium text-destructive">
                      -{hasPercentage
                        ? `${percentageValue}%`
                        : formatCurrency(Number(discount.value) || 0)}
                    </span>
                  </div>
                );
              })}
              <div className="flex justify-between py-2 bg-green-50 dark:bg-green-950/20 rounded-lg px-3 mt-2">
                <span className="text-sm font-medium text-muted-foreground">Bônus Final</span>
                <span className="text-lg font-bold text-green-600">{formatCurrency(finalBonusValue)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tasks Table - Full featured like customer detail */}
        <BonusTasksList
          tasks={taskStats.tasks}
          title="Tarefas do Período"
        />
      </div>
    </PrivilegeRoute>
  );
}
