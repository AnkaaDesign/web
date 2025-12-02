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
import { generatePayrollPDF } from "@/utils/payroll-pdf-generator";
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
        overtime50Amount: 0,
        overtime50Hours: 0,
        overtime100Amount: 0,
        overtime100Hours: 0,
        nightDifferentialAmount: 0,
        nightHours: 0,
        dsrAmount: 0,
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

    // Get Secullum data - overtime and DSR
    const overtime50Amount = getNumericValue(payroll.overtime50Amount);
    const overtime50Hours = getNumericValue(payroll.overtime50Hours);
    const overtime100Amount = getNumericValue(payroll.overtime100Amount);
    const overtime100Hours = getNumericValue(payroll.overtime100Hours);
    const nightDifferentialAmount = getNumericValue(payroll.nightDifferentialAmount);
    const nightHours = getNumericValue(payroll.nightHours);
    const dsrAmount = getNumericValue(payroll.dsrAmount);

    // Total gross includes ALL earnings
    const totalGross = baseRemuneration + bonusAmount + overtime50Amount + overtime100Amount + nightDifferentialAmount + dsrAmount;

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
      overtime50Amount,
      overtime50Hours,
      overtime100Amount,
      overtime100Hours,
      nightDifferentialAmount,
      nightHours,
      dsrAmount,
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
    if (!payroll) return;

    // Collect other discounts
    const otherDiscounts = payroll.discounts
      ?.filter((d: any) =>
        !['INSS', 'IRRF', 'FGTS'].some(type => d.description?.toUpperCase().includes(type))
      )
      .map((d: any) => ({
        description: d.description || 'Desconto',
        amount: getNumericValue(d.amount)
      })) || [];

    // Get INSS and IRRF discounts
    const inssDiscount = payroll.discounts?.find((d: any) =>
      d.description?.toUpperCase().includes('INSS')
    );
    const irrfDiscount = payroll.discounts?.find((d: any) =>
      d.description?.toUpperCase().includes('IRRF')
    );

    // Generate PDF with proper data structure
    generatePayrollPDF({
      // Employee info
      employeeName: payroll.user?.name || 'N/A',
      employeeCPF: payroll.user?.cpf,
      employeePIS: payroll.user?.pis,
      employeePayrollNumber: payroll.user?.payrollNumber,
      position: payroll.position?.name || payroll.user?.position?.name,
      sector: payroll.user?.sector?.name,

      // Period
      month: payroll.month,
      year: payroll.year,

      // Earnings
      baseRemuneration: calculations.baseRemuneration,
      overtime50Hours: calculations.overtime50Hours,
      overtime50Amount: calculations.overtime50Amount,
      overtime100Hours: calculations.overtime100Hours,
      overtime100Amount: calculations.overtime100Amount,
      nightHours: calculations.nightHours,
      nightDifferentialAmount: calculations.nightDifferentialAmount,
      dsrAmount: calculations.dsrAmount,
      bonusAmount: calculations.bonusAmount,

      // Deductions
      inssBase: getNumericValue(payroll.inssBase),
      inssAmount: inssDiscount ? getNumericValue(inssDiscount.amount) : getNumericValue(payroll.inssAmount),
      irrfBase: getNumericValue(payroll.irrfBase),
      irrfAmount: irrfDiscount ? getNumericValue(irrfDiscount.amount) : getNumericValue(payroll.irrfAmount),
      fgtsAmount: getNumericValue(payroll.fgtsAmount),
      absenceHours: getNumericValue(payroll.absenceHours),
      absenceAmount: getNumericValue(payroll.absenceAmount),
      lateArrivalMinutes: getNumericValue(payroll.lateArrivalMinutes),
      lateArrivalAmount: getNumericValue(payroll.lateArrivalAmount),
      otherDiscounts: otherDiscounts,

      // Totals
      grossSalary: calculations.totalGross,
      totalDiscounts: calculations.totalDiscounts,
      netSalary: calculations.totalNet,

      // Company info (you can customize these)
      companyName: 'ANKAA SISTEMAS',
      companyCNPJ: '00.000.000/0000-00', // Replace with actual CNPJ
      companyAddress: 'Endereço da Empresa', // Replace with actual address
    });
  };

  // Helper function to convert decimal hours to HH:MM format
  const formatHoursToHHMM = (decimalHours: number): string => {
    const hours = Math.floor(decimalHours);
    const minutes = Math.round((decimalHours - hours) * 60);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
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

        {/* Info Cards - 1/3 and 2/3 columns */}
        <div className="grid gap-6 md:grid-cols-3">
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
          <Card className="md:col-span-2">
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <IconCurrencyReal className="h-4 w-4" />
                Valores
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-0 font-medium">Descrição</th>
                    <th className="text-left py-2 px-0 font-medium w-24">Ref.</th>
                    <th className="text-right py-2 px-0 font-medium w-32">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Base Remuneration */}
                  <tr className="border-b border-border/50">
                    <td className="py-2 px-0">Salário Base</td>
                    <td className="py-2 px-0 text-left text-muted-foreground text-xs">-</td>
                    <td className="py-2 px-0 text-right font-semibold">{formatAmount(calculations.baseRemuneration)}</td>
                  </tr>

                  {/* Overtime 50% */}
                  {calculations.overtime50Amount > 0 && (
                    <tr className="border-b border-border/50">
                      <td className="py-2 px-0">Horas Extras 50%</td>
                      <td className="py-2 px-0 text-left text-muted-foreground text-xs">{formatHoursToHHMM(calculations.overtime50Hours)}</td>
                      <td className="py-2 px-0 text-right font-semibold text-green-600">{formatAmount(calculations.overtime50Amount)}</td>
                    </tr>
                  )}

                  {/* Overtime 100% */}
                  {calculations.overtime100Amount > 0 && (
                    <tr className="border-b border-border/50">
                      <td className="py-2 px-0">Horas Extras 100%</td>
                      <td className="py-2 px-0 text-left text-muted-foreground text-xs">{formatHoursToHHMM(calculations.overtime100Hours)}</td>
                      <td className="py-2 px-0 text-right font-semibold text-green-600">{formatAmount(calculations.overtime100Amount)}</td>
                    </tr>
                  )}

                  {/* Night Differential */}
                  {calculations.nightDifferentialAmount > 0 && (
                    <tr className="border-b border-border/50">
                      <td className="py-2 px-0">Adicional Noturno</td>
                      <td className="py-2 px-0 text-left text-muted-foreground text-xs">{formatHoursToHHMM(calculations.nightHours)}</td>
                      <td className="py-2 px-0 text-right font-semibold text-green-600">{formatAmount(calculations.nightDifferentialAmount)}</td>
                    </tr>
                  )}

                  {/* DSR */}
                  {calculations.dsrAmount > 0 && (
                    <tr className="border-b border-border/50">
                      <td className="py-2 px-0">DSR Reflexo</td>
                      <td className="py-2 px-0 text-left text-muted-foreground text-xs">{payroll.dsrDays || '-'}</td>
                      <td className="py-2 px-0 text-right font-semibold text-green-600">{formatAmount(calculations.dsrAmount)}</td>
                    </tr>
                  )}

                  {/* Bonus */}
                  {isBonifiable && calculations.bonusAmount > 0 && (
                    <tr className="border-b border-border/50">
                      <td className="py-2 px-0">Bônus</td>
                      <td className="py-2 px-0 text-left text-muted-foreground text-xs">-</td>
                      <td className="py-2 px-0 text-right font-semibold text-green-600">{formatAmount(calculations.bonusAmount)}</td>
                    </tr>
                  )}

                  {/* Discounts */}
                  {hasPayrollDiscounts && payroll.discounts
                    .filter((discount: any) => {
                      // Filter out FGTS since we show it separately
                      const desc = discount.description?.toUpperCase() || "";
                      return !desc.includes("FGTS");
                    })
                    .map((discount: any, index: number) => {
                      const discountValue = getNumericValue(discount.amount) ||
                        getNumericValue(discount.value) ||
                        getNumericValue(discount.fixedValue) ||
                        (calculations.totalGross * (getNumericValue(discount.percentage) / 100));

                      // Use reference for display (clean names like "I.N.S.S.")
                      const displayDescription = discount.reference || discount.description || "Desconto";

                      // Calculate percentage for reference column
                      let referenceText = "-";
                      const desc = discount.description?.toUpperCase() || "";

                      if (desc.includes("INSS") && payroll.inssBase) {
                        const inssBase = getNumericValue(payroll.inssBase);
                        if (inssBase > 0) {
                          const percentage = (discountValue / inssBase) * 100;
                          referenceText = `${percentage.toFixed(2)}%`;
                        }
                      } else if (desc.includes("IRRF") && payroll.irrfBase) {
                        const irrfBase = getNumericValue(payroll.irrfBase);
                        if (irrfBase > 0 && discountValue > 0) {
                          const percentage = (discountValue / irrfBase) * 100;
                          referenceText = `${percentage.toFixed(2)}%`;
                        }
                      } else if (discount.percentage) {
                        referenceText = `${getNumericValue(discount.percentage).toFixed(2)}%`;
                      }

                      return (
                        <tr key={discount.id || index} className="border-b border-border/50">
                          <td className="py-2 px-0">{displayDescription}</td>
                          <td className="py-2 px-0 text-left text-muted-foreground text-xs">{referenceText}</td>
                          <td className="py-2 px-0 text-right font-semibold text-destructive">-{formatAmount(discountValue)}</td>
                        </tr>
                      );
                    })}

                  {/* FGTS Info */}
                  {getNumericValue(payroll.fgtsAmount) > 0 && (
                    <tr className="border-b border-border/50 bg-muted/20">
                      <td className="py-2 px-0 italic">FGTS (Empregador)</td>
                      <td className="py-2 px-0 text-left text-muted-foreground text-xs">8%</td>
                      <td className="py-2 px-0 text-right font-semibold">{formatAmount(getNumericValue(payroll.fgtsAmount))}</td>
                    </tr>
                  )}

                  {/* Totals */}
                  <tr className="border-t-2 border-border">
                    <td className="py-2 px-0 font-semibold" colSpan={2}>Total Bruto</td>
                    <td className="py-2 px-0 text-right font-bold">{formatAmount(calculations.totalGross)}</td>
                  </tr>
                  {calculations.totalDiscounts > 0 && (
                    <tr className="border-b">
                      <td className="py-2 px-0 font-semibold" colSpan={2}>Total Descontos</td>
                      <td className="py-2 px-0 text-right font-bold text-destructive">-{formatAmount(calculations.totalDiscounts)}</td>
                    </tr>
                  )}
                  <tr className="bg-primary text-primary-foreground">
                    <td className="py-3 -ml-6 pl-3 font-bold" colSpan={2}>Total Líquido</td>
                    <td className="py-3 -mr-6 pr-3 text-right font-bold text-lg">{formatAmount(calculations.totalNet)}</td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </div>
    </PrivilegeRoute>
  );
}
