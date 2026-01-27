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

  // Fetch payroll data - Backend handles both regular UUIDs and live IDs (live-{userId}-{year}-{month})
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
        // Single endpoint handles both live IDs and regular UUIDs
        // Backend's findByIdOrLive parses live IDs and returns consistent data format
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
                bonusExtras: true,
                position: true,
              },
            },
            discounts: true,
          },
        });

        const responseData = response.data;

        // Backend returns consistent format: { success, message, data: payroll }
        // Both live and saved payrolls have the same structure
        // Payroll object includes bonus as a relation (not separate)
        if (responseData?.success && responseData?.data) {
          setPayroll(responseData.data);
        } else if (responseData?.success === false) {
          setError(responseData.message || 'Folha de pagamento não encontrada.');
        } else {
          setError('Folha de pagamento não encontrada.');
        }
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Erro ao carregar folha de pagamento.');
      } finally {
        setLoading(false);
      }
    };

    fetchPayroll();
  }, [payrollId]);

  // Calculate values
  const calculations = useMemo(() => {
    if (!payroll) {
      return {
        baseRemuneration: 0,
        bonusAmount: 0,
        netBonusAmount: 0,
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

    // Use base bonus for display, net bonus for totals calculation
    const bonusAmount = payroll.bonus ? getNumericValue(payroll.bonus.baseBonus) : 0;
    const netBonusAmount = payroll.bonus ? (getNumericValue(payroll.bonus.netBonus) || bonusAmount) : 0;

    // Get Secullum data - overtime and DSR
    const overtime50Amount = getNumericValue(payroll.overtime50Amount);
    const overtime50Hours = getNumericValue(payroll.overtime50Hours);
    const overtime100Amount = getNumericValue(payroll.overtime100Amount);
    const overtime100Hours = getNumericValue(payroll.overtime100Hours);
    const nightDifferentialAmount = getNumericValue(payroll.nightDifferentialAmount);
    const nightHours = getNumericValue(payroll.nightHours);
    const dsrAmount = getNumericValue(payroll.dsrAmount);

    // Total gross includes ALL earnings (use netBonusAmount since bonus discounts are internal to the bonus)
    const totalGross = baseRemuneration + netBonusAmount + overtime50Amount + overtime100Amount + nightDifferentialAmount + dsrAmount;

    // Calculate discounts
    let totalDiscounts = 0;
    if (payroll.discounts && payroll.discounts.length > 0) {
      payroll.discounts.forEach((discount: any) => {
        const discountVal = getNumericValue(discount.value);
        if (discountVal > 0) {
          totalDiscounts += discountVal;
        } else if (discount.percentage) {
          totalDiscounts += totalGross * (getNumericValue(discount.percentage) / 100);
        }
      });
    }

    // Bonus discounts are already factored into netBonusAmount, so we don't need to calculate them separately
    const totalNet = totalGross - totalDiscounts;

    return {
      baseRemuneration,
      bonusAmount,
      netBonusAmount,
      overtime50Amount,
      overtime50Hours,
      overtime100Amount,
      overtime100Hours,
      nightDifferentialAmount,
      nightHours,
      dsrAmount,
      totalGross,
      totalDiscounts,
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
        <div className="space-y-6">
          {/* Page Header Skeleton */}
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <div className="flex gap-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-24" />
              <Skeleton className="h-9 w-24" />
            </div>
          </div>

          {/* Info Cards Skeleton - 1/3 and 2/3 columns */}
          <div className="grid gap-6 md:grid-cols-3">
            {/* General Info Card Skeleton */}
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-5 w-40" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {[...Array(9)].map((_, i) => (
                  <div key={i} className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-3">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Financial Card Skeleton */}
            <Card className="md:col-span-2">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-4 w-4" />
                  <Skeleton className="h-5 w-24" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-0">
                  {/* Table Header */}
                  <div className="flex border-b py-2">
                    <Skeleton className="h-4 w-32 flex-1" />
                    <Skeleton className="h-4 w-16 mx-4" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  {/* Table Rows */}
                  {[...Array(8)].map((_, i) => (
                    <div key={i} className="flex border-b border-border/50 py-3">
                      <Skeleton className="h-4 w-40 flex-1" />
                      <Skeleton className="h-4 w-12 mx-4" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  ))}
                  {/* Totals */}
                  <div className="flex border-t-2 py-3">
                    <Skeleton className="h-5 w-28 flex-1" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                  <div className="flex py-3">
                    <Skeleton className="h-5 w-32 flex-1" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                  <div className="flex bg-primary/10 rounded py-3 px-3 -mx-3">
                    <Skeleton className="h-6 w-32 flex-1" />
                    <Skeleton className="h-6 w-28" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
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
      <div className="p-4 space-y-4">
        <PageHeader
          variant="detail"
          title={title}
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
        <div className="grid gap-4 md:grid-cols-3">
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
              <InfoRow label="Colaborador" value={<span className="block truncate max-w-[160px]" title={userName}>{userName}</span>} />
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
                      <td className="py-2 px-0">Reflexo Extras DSR</td>
                      <td className="py-2 px-0 text-left text-muted-foreground text-xs">{payroll.dsrDays || '-'}</td>
                      <td className="py-2 px-0 text-right font-semibold text-green-600">{formatAmount(calculations.dsrAmount)}</td>
                    </tr>
                  )}

                  {/* Bonus - Base, Discounts, Net */}
                  {isBonifiable && calculations.bonusAmount > 0 && (
                    <>
                      {/* Base Bonus */}
                      <tr className="border-b border-border/50">
                        <td className="py-2 px-0">Bônus</td>
                        <td className="py-2 px-0 text-left text-muted-foreground text-xs">
                          {payroll.bonus?.weightedTasks !== undefined
                            ? Number(payroll.bonus.weightedTasks).toFixed(1)
                            : "-"}
                        </td>
                        <td className="py-2 px-0 text-right font-semibold text-green-600">{formatAmount(calculations.bonusAmount)}</td>
                      </tr>
                      {/* Bonus Extras */}
                      {payroll.bonus?.bonusExtras && payroll.bonus.bonusExtras.map((extra: any, index: number) => {
                        const extraValue = extra.percentage
                          ? calculations.bonusAmount * (getNumericValue(extra.percentage) / 100)
                          : getNumericValue(extra.value);
                        return (
                          <tr key={extra.id || `bonus-extra-${index}`} className="border-b border-border/50">
                            <td className="py-2 px-0 pl-4 text-muted-foreground">{extra.reference || 'Extra Bônus'}</td>
                            <td className="py-2 px-0 text-left text-muted-foreground text-xs">
                              {extra.percentage ? `${getNumericValue(extra.percentage).toFixed(2)}%` : '-'}
                            </td>
                            <td className="py-2 px-0 text-right font-semibold text-emerald-600">+{formatAmount(extraValue)}</td>
                          </tr>
                        );
                      })}
                      {/* Bonus Discounts */}
                      {hasBonusDiscounts && payroll.bonus.bonusDiscounts.map((discount: any, index: number) => {
                        const discountValue = discount.percentage
                          ? calculations.bonusAmount * (getNumericValue(discount.percentage) / 100)
                          : getNumericValue(discount.value);
                        return (
                          <tr key={discount.id || `bonus-discount-${index}`} className="border-b border-border/50">
                            <td className="py-2 px-0 pl-4 text-muted-foreground">{discount.reference || 'Desconto Bônus'}</td>
                            <td className="py-2 px-0 text-left text-muted-foreground text-xs">
                              {discount.percentage ? `${getNumericValue(discount.percentage).toFixed(2)}%` : '-'}
                            </td>
                            <td className="py-2 px-0 text-right font-semibold text-destructive">-{formatAmount(discountValue)}</td>
                          </tr>
                        );
                      })}
                      {/* Net Bonus (only if there are discounts) */}
                      {hasBonusDiscounts && (
                        <tr className="border-b border-border/50 bg-muted/30">
                          <td className="py-2 px-0 pl-4 font-medium">Bônus Líquido</td>
                          <td className="py-2 px-0 text-left text-muted-foreground text-xs">-</td>
                          <td className="py-2 px-0 text-right font-semibold text-green-600">
                            {formatAmount(getNumericValue(payroll.bonus.netBonus) || (calculations.bonusAmount - (payroll.bonus.bonusDiscounts || []).reduce((sum: number, d: any) => {
                              return sum + (d.percentage ? calculations.bonusAmount * (getNumericValue(d.percentage) / 100) : getNumericValue(d.value));
                            }, 0)))}
                          </td>
                        </tr>
                      )}
                    </>
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
                        (calculations.totalGross * (getNumericValue(discount.percentage) / 100));

                      // Use reference for display (clean names like "I.N.S.S.")
                      const displayDescription = discount.reference || discount.description || "Desconto";

                      // Calculate reference text based on discount type
                      let referenceText = "-";
                      const desc = discount.description?.toUpperCase() || "";
                      const ref = discount.reference?.toUpperCase() || "";
                      const discountType = discount.discountType;

                      // Helper to format decimal hours to HH:MM
                      const formatHoursToHHMM = (decimalHours: number): string => {
                        const hours = Math.floor(decimalHours);
                        const minutes = Math.round((decimalHours - hours) * 60);
                        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
                      };

                      if (discountType === 'ABSENCE') {
                        // Show hours in HH:MM format - prefer baseValue, fallback to payroll.absenceHours
                        const hoursValue = getNumericValue(discount.baseValue) || getNumericValue(payroll.absenceHours);
                        if (hoursValue > 0) {
                          referenceText = formatHoursToHHMM(hoursValue);
                        }
                      } else if (discountType === 'LATE_ARRIVAL') {
                        // Show hours in HH:MM format from baseValue
                        const hoursValue = getNumericValue(discount.baseValue);
                        if (hoursValue > 0) {
                          referenceText = formatHoursToHHMM(hoursValue);
                        }
                      } else if (desc.includes("INSS") || ref.includes("INSS")) {
                        // Use percentage field if available, otherwise calculate from base
                        if (discount.percentage) {
                          referenceText = `${getNumericValue(discount.percentage).toFixed(2)}%`;
                        } else if (payroll.inssBase) {
                          const inssBase = getNumericValue(payroll.inssBase);
                          if (inssBase > 0) {
                            const percentage = (discountValue / inssBase) * 100;
                            referenceText = `${percentage.toFixed(2)}%`;
                          }
                        }
                      } else if (desc.includes("IRRF") || ref.includes("IRRF")) {
                        // Use percentage field if available, otherwise calculate from base
                        if (discount.percentage) {
                          referenceText = `${getNumericValue(discount.percentage).toFixed(2)}%`;
                        } else if (payroll.irrfBase) {
                          const irrfBase = getNumericValue(payroll.irrfBase);
                          if (irrfBase > 0 && discountValue > 0) {
                            const percentage = (discountValue / irrfBase) * 100;
                            referenceText = `${percentage.toFixed(2)}%`;
                          }
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
