import { useState, useMemo, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useBonusDetail } from "../../../hooks";
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
import { calculatePonderedTasks } from "../../../utils/bonus";
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

// Helper to check if ID is a live bonus ID
function isLiveBonusId(id: string): boolean {
  return id.startsWith('live-');
}

// Helper to parse live bonus ID
function parseLiveBonusId(id: string): { userId: string; year: number; month: number } | null {
  if (!isLiveBonusId(id)) return null;

  const parts = id.replace('live-', '').split('-');
  if (parts.length < 7) return null;

  const month = parseInt(parts[parts.length - 1]);
  const year = parseInt(parts[parts.length - 2]);
  const userId = parts.slice(0, -2).join('-');

  if (isNaN(year) || isNaN(month)) return null;

  return { userId, year, month };
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

export default function BonusDetailPage() {
  const { id } = useParams<BonusDetailPageParams>();

  // State for live bonus data
  const [liveBonus, setLiveBonus] = useState<any>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);

  // Track page access
  usePageTracker({
    title: "Detalhes do Bônus",
    icon: "currency-dollar",
  });

  // Determine if this is a live bonus
  const isLive = id ? isLiveBonusId(id) : false;
  const liveParams = id && isLive ? parseLiveBonusId(id) : null;

  // Fetch saved bonus details (only for non-live IDs)
  const { data: bonusResponse, isLoading: savedBonusLoading } = useBonusDetail(id || '', {
    include: {
      user: {
        include: {
          position: true,
          sector: true,
        },
      },
      position: true, // Include position saved at the time of bonus creation
      tasks: {
        include: {
          customer: true,
          sector: true,
        },
      },
      bonusDiscounts: true,
      users: true,
    },
  }, {
    enabled: !!id && !isLive,
  });

  // Fetch live bonus data
  useEffect(() => {
    if (!liveParams) return;

    const fetchLiveBonus = async () => {
      setLiveLoading(true);
      setLiveError(null);

      try {
        const response = await bonusService.getByUserAndMonth(
          liveParams.userId,
          liveParams.year,
          liveParams.month
        );

        if (response.data?.data && response.data.data.length > 0) {
          const userBonus = response.data.data.find(
            (b: any) => b.userId === liveParams.userId
          );
          if (userBonus) {
            setLiveBonus(userBonus);
          } else {
            setLiveError('Bônus não encontrado para este usuário no período.');
          }
        } else {
          setLiveError('Nenhum bônus encontrado para este período.');
        }
      } catch (error: any) {
        setLiveError(error?.response?.data?.message || 'Erro ao carregar bônus ao vivo.');
      } finally {
        setLiveLoading(false);
      }
    };

    fetchLiveBonus();
  }, [liveParams?.userId, liveParams?.year, liveParams?.month]);

  // Get the bonus data (either saved or live)
  const bonus = isLive ? liveBonus : bonusResponse?.data;
  const bonusLoading = isLive ? liveLoading : savedBonusLoading;

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

  // Calculate task statistics
  const taskStats = useMemo(() => {
    const tasks = bonus?.tasks || [];
    const users = bonus?.users || [];

    const totalRawTasks = tasks.length;
    const totalPonderedTasks = calculatePonderedTasks(tasks);
    const totalCollaborators = users.length || 1;
    const averageTasksPerUser = totalCollaborators > 0 ? totalPonderedTasks / totalCollaborators : 0;

    return {
      totalRawTasks,
      totalPonderedTasks,
      totalCollaborators,
      averageTasksPerUser,
      tasks,
    };
  }, [bonus?.tasks, bonus?.users]);

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

  if (bonusLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
        <div className="flex items-center justify-center p-8">
          <Skeleton className="h-32 w-full max-w-lg" />
        </div>
      </PrivilegeRoute>
    );
  }

  if (isLive && liveError) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
        <Alert variant="destructive">
          <IconAlertCircle className="h-4 w-4" />
          <AlertDescription>{liveError}</AlertDescription>
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

        {/* Live calculation indicator */}
        {isLive && (
          <Alert>
            <IconAlertCircle className="h-4 w-4" />
            <AlertDescription>
              Este é um cálculo em tempo real. O bônus ainda não foi salvo no sistema.
            </AlertDescription>
          </Alert>
        )}

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
              {hasDiscounts && bonus.bonusDiscounts!.map((discount: any) => (
                <div key={discount.id} className="flex justify-between py-1">
                  <span className="text-sm text-muted-foreground">Desconto: {discount.reference}</span>
                  <span className="text-sm font-medium text-destructive">-{discount.percentage}%</span>
                </div>
              ))}
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
