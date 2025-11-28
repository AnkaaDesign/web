import { useState, useMemo, useEffect } from "react";
import { useParams } from "react-router-dom";
import { payrollService } from "../../../api-client";
import { routes, SECTOR_PRIVILEGES } from "../../../constants";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { formatCurrency } from "../../../utils";
import { formatCPF, formatPIS } from "../../../utils/formatters";
import { cn } from "@/lib/utils";
import {
  IconReceipt,
  IconAlertCircle,
  IconRefresh,
  IconFileDownload,
  IconUser,
  IconCurrencyReal,
} from "@tabler/icons-react";

interface PayrollDetailPageParams {
  payrollId: string;
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

// Helper to format currency amount (handles Decimal type)
const formatAmount = (amount: any): string => {
  if (amount === null || amount === undefined) return formatCurrency(0);
  if (typeof amount === 'number') return formatCurrency(amount);
  if (typeof amount === 'string') return formatCurrency(parseFloat(amount) || 0);
  if (amount?.toNumber) return formatCurrency(amount.toNumber());
  return formatCurrency(0);
};

// Helper to get numeric value from any type
const getNumericValue = (value: any): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return parseFloat(value) || 0;
  if (value?.toNumber) return value.toNumber();
  return 0;
};

// Helper to check if ID is a live payroll ID
function isLivePayrollId(id: string): boolean {
  return id.startsWith('live-');
}

// Helper to parse live payroll ID (format: live-{userId}-{year}-{month})
function parseLivePayrollId(id: string): { userId: string; year: number; month: number } | null {
  if (!isLivePayrollId(id)) return null;

  const parts = id.replace('live-', '').split('-');
  if (parts.length < 7) return null; // UUID has 5 parts + year + month = 7

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

export default function PayrollDetailPage() {
  const { payrollId } = useParams<PayrollDetailPageParams>();

  // State for payroll data
  const [payroll, setPayroll] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track page access
  usePageTracker({
    title: "Detalhes da Folha de Pagamento",
    icon: "receipt",
  });

  // Determine if this is a live payroll ID (used for fetching)
  const isLiveId = payrollId ? isLivePayrollId(payrollId) : false;
  const liveParams = payrollId && isLiveId ? parseLivePayrollId(payrollId) : null;

  // Fetch payroll data
  useEffect(() => {
    if (!payrollId) {
      setError('ID da folha de pagamento não fornecido');
      setLoading(false);
      return;
    }

    const fetchPayroll = async () => {
      setLoading(true);
      setError(null);

      try {
        if (isLiveId && liveParams) {
          // Live calculation - fetch by user/year/month
          const response = await payrollService.getByUserAndMonth(
            liveParams.userId,
            liveParams.year,
            liveParams.month,
            {
              include: {
                user: {
                  include: {
                    position: true,
                    sector: true,
                  },
                },
                position: true,
                bonus: {
                  include: {
                    bonusDiscounts: true,
                    position: true,
                  },
                },
                discounts: true,
              },
            }
          );

          if (response.data?.data) {
            setPayroll(response.data.data);
          } else {
            setError('Folha de pagamento não encontrada para este período.');
          }
        } else {
          // Saved payroll - fetch by ID
          const response = await payrollService.getById(payrollId, {
            include: {
              user: {
                include: {
                  position: true,
                  sector: true,
                },
              },
              position: true,
              bonus: {
                include: {
                  bonusDiscounts: true,
                  position: true,
                },
              },
              discounts: true,
            },
          });

          if (response.data?.data) {
            setPayroll(response.data.data);
          } else if (response.data) {
            setPayroll(response.data);
          } else {
            setError('Folha de pagamento não encontrada.');
          }
        }
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Erro ao carregar folha de pagamento.');
      } finally {
        setLoading(false);
      }
    };

    fetchPayroll();
  }, [payrollId, isLiveId, liveParams?.userId, liveParams?.year, liveParams?.month]);

  // Calculate values
  const calculations = useMemo(() => {
    if (!payroll) {
      return {
        baseRemuneration: 0,
        bonusAmount: 0,
        totalGross: 0,
        totalDiscounts: 0,
        totalNet: 0,
      };
    }

    const baseRemuneration = getNumericValue(payroll.baseRemuneration) ||
      getNumericValue(payroll.position?.baseRemuneration) ||
      getNumericValue(payroll.user?.position?.baseRemuneration) ||
      0;

    const bonusAmount = payroll.bonus ? getNumericValue(payroll.bonus.baseBonus) : 0;
    const totalGross = baseRemuneration + bonusAmount;

    // Calculate discounts
    let totalDiscounts = 0;
    if (payroll.discounts && payroll.discounts.length > 0) {
      payroll.discounts.forEach((discount: any) => {
        const fixedValue = getNumericValue(discount.value) || getNumericValue(discount.fixedValue);
        if (fixedValue > 0) {
          totalDiscounts += fixedValue;
        } else if (discount.percentage) {
          totalDiscounts += totalGross * (getNumericValue(discount.percentage) / 100);
        }
      });
    }

    // Calculate bonus discounts
    let bonusDiscounts = 0;
    if (payroll.bonus?.bonusDiscounts && payroll.bonus.bonusDiscounts.length > 0) {
      let currentBonusAmount = bonusAmount;
      payroll.bonus.bonusDiscounts
        .sort((a: any, b: any) => (a.calculationOrder || 0) - (b.calculationOrder || 0))
        .forEach((discount: any) => {
          if (discount.percentage) {
            const discountValue = currentBonusAmount * (getNumericValue(discount.percentage) / 100);
            bonusDiscounts += discountValue;
            currentBonusAmount -= discountValue;
          } else if (discount.value) {
            bonusDiscounts += getNumericValue(discount.value);
            currentBonusAmount -= getNumericValue(discount.value);
          }
        });
    }

    const totalNet = totalGross - totalDiscounts - bonusDiscounts;

    return {
      baseRemuneration,
      bonusAmount,
      totalGross,
      totalDiscounts: totalDiscounts + bonusDiscounts,
      totalNet,
    };
  }, [payroll]);

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

  if (loading) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
        <div className="flex items-center justify-center p-8">
          <Skeleton className="h-32 w-full max-w-lg" />
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

  if (!payroll) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
        <Alert variant="destructive">
          <IconAlertCircle className="h-4 w-4" />
          <AlertDescription>Folha de pagamento não encontrada</AlertDescription>
        </Alert>
      </PrivilegeRoute>
    );
  }

  // Extract data
  const user = payroll.user;
  const userName = user?.name || 'Funcionário';
  const monthName = getMonthName(payroll.month);
  const year = payroll.year || new Date().getFullYear();
  const title = `${userName} - ${monthName} ${year}`;

  // Use position saved at payroll creation, fallback to user's current
  const position = payroll.position || payroll.bonus?.position || user?.position;
  const sector = user?.sector;
  const isBonifiable = position?.bonifiable ?? false;

  const breadcrumbs = [
    { label: "Início", href: routes.home },
    { label: "Recursos Humanos" },
    { label: "Folha de Pagamento", href: routes.humanResources.payroll.root },
    { label: title },
  ];

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleExport = () => {
    window.print();
  };

  const hasPayrollDiscounts = payroll.discounts && payroll.discounts.length > 0;
  const hasBonusDiscounts = payroll.bonus?.bonusDiscounts && payroll.bonus.bonusDiscounts.length > 0;

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="space-y-6">
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
              <InfoRow label="Nº Folha" value={user?.payrollNumber || "-"} />
              <InfoRow label="Colaborador" value={userName} />
              <InfoRow label="CPF" value={user?.cpf ? formatCPF(user.cpf) : "-"} />
              <InfoRow label="PIS" value={user?.pis ? formatPIS(user.pis) : "-"} />
              <InfoRow label="Cargo" value={position?.name || "-"} />
              <InfoRow label="Setor" value={sector?.name || "-"} />
              <InfoRow label="Bonificável" value={isBonifiable ? "Sim" : "Não"} />
              {isBonifiable && (
                <InfoRow
                  label="Nível de Performance"
                  value={payroll.bonus?.performanceLevel || user?.performanceLevel || 0}
                />
              )}
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
                <span className="text-sm text-muted-foreground">Remuneração Base</span>
                <span className="text-sm font-medium">{formatAmount(calculations.baseRemuneration)}</span>
              </div>

              {isBonifiable && calculations.bonusAmount > 0 && (
                <>
                  <Separator className="my-2" />
                  <div className="flex justify-between py-1">
                    <span className="text-sm text-muted-foreground">Bônus</span>
                    <span className="text-sm font-medium">{formatAmount(calculations.bonusAmount)}</span>
                  </div>
                  {hasBonusDiscounts && payroll.bonus.bonusDiscounts.map((discount: any) => (
                    <div key={discount.id} className="flex justify-between py-1">
                      <span className="text-sm text-muted-foreground">Desconto: {discount.reference}</span>
                      <span className="text-sm font-medium text-destructive">-{discount.percentage}%</span>
                    </div>
                  ))}
                </>
              )}

              {hasPayrollDiscounts && (
                <>
                  <Separator className="my-2" />
                  {payroll.discounts.map((discount: any) => {
                    const discountValue = getNumericValue(discount.value) ||
                      getNumericValue(discount.fixedValue) ||
                      (calculations.totalGross * (getNumericValue(discount.percentage) / 100));
                    return (
                      <div key={discount.id} className="flex justify-between py-1">
                        <span className="text-sm text-muted-foreground">{discount.reference || "Desconto"}</span>
                        <span className="text-sm font-medium text-destructive">-{formatAmount(discountValue)}</span>
                      </div>
                    );
                  })}
                </>
              )}

              <Separator className="my-2" />
              <div className="flex justify-between py-1">
                <span className="text-sm text-muted-foreground">Total Bruto</span>
                <span className="text-sm font-medium">{formatAmount(calculations.totalGross)}</span>
              </div>
              {calculations.totalDiscounts > 0 && (
                <div className="flex justify-between py-1">
                  <span className="text-sm text-muted-foreground">Total Descontos</span>
                  <span className="text-sm font-medium text-destructive">-{formatAmount(calculations.totalDiscounts)}</span>
                </div>
              )}
              <div className="flex justify-between py-2 bg-green-50 dark:bg-green-950/20 rounded-lg px-3 mt-2">
                <span className="text-sm font-medium text-muted-foreground">Total Líquido</span>
                <span className="text-lg font-bold text-green-600">{formatAmount(calculations.totalNet)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PrivilegeRoute>
  );
}
