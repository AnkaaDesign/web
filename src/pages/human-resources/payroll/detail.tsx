import { Fragment, useState, useMemo, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { payrollService } from "../../../api-client";
import { routes, SECTOR_PRIVILEGES } from "../../../constants";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { formatCurrency } from "../../../utils";
import { formatCPF, formatPIS } from "../../../utils/formatters";
import { cn } from "@/lib/utils";
import { generatePayrollPDF } from "@/utils/payroll-pdf-generator";
import { HoleriteBreakdownCard } from "@/components/human-resources/payroll/detail/holerite-breakdown-card";
import type { CompletePayrollCalculation } from "../../../types/payroll";
import {
  IconAlertCircle,
  IconRefresh,
  IconFileDownload,
  IconUser,
  IconCurrencyReal,
} from "@tabler/icons-react";

interface PayrollDetailPageParams extends Record<string, string | undefined> {
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

// FGTS is an EMPLOYER contribution: it must never be summed into the
// employee's discounts. Saved payrolls carry an informational FGTS discount
// row ("FGTS (Empregador)"); live payrolls don't.
const isFgtsDiscount = (discount: any): boolean => {
  if (discount?.discountType === 'FGTS') return true;
  const text = `${discount?.reference || ''} ${discount?.description || ''}`.toUpperCase();
  return text.includes('FGTS');
};

// Discounts that actually reduce the employee's net salary
const isEmployeeDiscount = (discount: any): boolean => {
  if (!discount) return false;
  if (discount.isActive === false) return false;
  return !isFgtsDiscount(discount);
};

// Grouping of PayrollDiscountType values for display
const DISCOUNT_GROUPS: Array<{ key: string; label: string; types: string[] }> = [
  { key: 'taxes', label: 'Impostos', types: ['INSS', 'IRRF'] },
  {
    key: 'absences',
    label: 'Faltas e Atrasos',
    types: ['ABSENCE', 'PARTIAL_ABSENCE', 'DSR_ABSENCE', 'LATE_ARRIVAL', 'SICK_LEAVE'],
  },
  {
    key: 'benefits',
    label: 'Benefícios',
    types: ['HEALTH_INSURANCE', 'DENTAL_INSURANCE', 'MEAL_VOUCHER', 'TRANSPORT_VOUCHER'],
  },
  { key: 'loans', label: 'Empréstimos e Adiantamentos', types: ['LOAN', 'ADVANCE'] },
  {
    key: 'others',
    label: 'Outros Descontos',
    types: ['UNION', 'ALIMONY', 'GARNISHMENT', 'AUTHORIZED_DISCOUNT', 'CUSTOM'],
  },
];

const getDiscountGroupKey = (discount: any): string => {
  const type = discount?.discountType;
  if (type) {
    const group = DISCOUNT_GROUPS.find((g) => g.types.includes(type));
    if (group) return group.key;
    return 'others';
  }
  // Untyped rows: classify taxes by reference text, everything else as "others"
  const text = `${discount?.reference || ''}`.toUpperCase();
  if (text.includes('INSS') || text.includes('IRRF') || text.includes('I.N.S.S') || text.includes('I.R.R.F')) {
    return 'taxes';
  }
  return 'others';
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
  // Live CompletePayrollCalculation used to render the full holerite breakdown
  // card (proventos/descontos + warnings). Best-effort: failures leave it null.
  const [liveCalculation, setLiveCalculation] = useState<CompletePayrollCalculation | null>(null);

  // Track page access
  usePageTracker({
    title: "Detalhes da Folha de Pagamento",
    icon: "receipt",
  });

  // Fetch payroll data - Backend handles both regular UUIDs and live IDs (live-{userId}-{year}-{month})
  const fetchPayroll = useCallback(async (showLoading = true) => {
    if (!payrollId) {
      setError('ID da folha de pagamento não fornecido');
      setLoading(false);
      return;
    }

    if (showLoading) setLoading(true);
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
            },
          },
          discounts: true,
        },
      });

      const responseData: any = response.data;

      // Backend response handling — both GET /payroll/:id and
      // GET /payroll/live/:userId/:year/:month return:
      //   { success, message, data: <payroll> }
      // where data is the payroll object directly (live and saved share the
      // exact same structure). A legacy shape { data: { payroll } } is also
      // tolerated.
      let resolved: any = null;
      let failureMessage: string | null = null;

      if (responseData && typeof responseData === 'object') {
        if ('data' in responseData && ('success' in responseData || 'message' in responseData)) {
          if (responseData.success === false) {
            failureMessage = responseData.message || null;
          } else {
            const inner = responseData.data;
            if (inner && typeof inner === 'object' && 'payroll' in inner && !('id' in inner)) {
              // Legacy wrapped format: { data: { payroll, bonus, calculations } }
              resolved = inner.payroll;
            } else {
              resolved = inner;
            }
          }
        } else {
          // Payroll object returned directly (no wrapper)
          resolved = responseData;
        }
      }

      if (resolved) {
        setPayroll(resolved);
      } else {
        setError(failureMessage || 'Folha de pagamento não encontrada.');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Erro ao carregar folha de pagamento.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [payrollId]);

  useEffect(() => {
    fetchPayroll();
  }, [fetchPayroll]);

  // Fetch the live CompletePayrollCalculation for the full holerite breakdown.
  // Best-effort: any failure (or missing user/period) simply hides the card.
  useEffect(() => {
    const userId = payroll?.user?.id ?? payroll?.userId;
    const calcYear = payroll?.year;
    const calcMonth = payroll?.month;
    if (!userId || !calcYear || !calcMonth) {
      setLiveCalculation(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const response = await payrollService.getLiveCalculation(userId, calcYear, calcMonth);
        const calc = (response?.data as any)?.data?.calculations ?? null;
        if (!cancelled) setLiveCalculation(calc ?? null);
      } catch {
        if (!cancelled) setLiveCalculation(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [payroll?.user?.id, payroll?.userId, payroll?.year, payroll?.month]);

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
        inssBase: 0,
        inssAmount: 0,
        irrfBase: 0,
        irrfAmount: 0,
        fgtsAmount: 0,
        employeeDiscounts: [] as any[],
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

    // Total gross includes ALL earnings. Prefer the API-calculated grossSalary
    // (saved AND live payrolls carry it); fall back to a client-side sum.
    const computedGross = baseRemuneration + netBonusAmount + overtime50Amount + overtime100Amount + nightDifferentialAmount + dsrAmount;
    const apiGross = getNumericValue(payroll.grossSalary);
    const totalGross = apiGross > 0 ? apiGross : computedGross;

    // Employee discounts: active rows only and NEVER FGTS (employer contribution)
    const employeeDiscounts: any[] = (payroll.discounts || []).filter(isEmployeeDiscount);

    // Calculate discounts (employee rows only)
    let computedDiscounts = 0;
    employeeDiscounts.forEach((discount: any) => {
      const discountVal = getNumericValue(discount.value);
      if (discountVal > 0) {
        computedDiscounts += discountVal;
      } else if (discount.percentage) {
        computedDiscounts += totalGross * (getNumericValue(discount.percentage) / 100);
      }
    });

    // Prefer API totals (FGTS is already excluded from them server-side)
    const apiTotalDiscounts = payroll.totalDiscounts !== undefined && payroll.totalDiscounts !== null
      ? getNumericValue(payroll.totalDiscounts)
      : null;
    const totalDiscounts = apiTotalDiscounts !== null ? apiTotalDiscounts : computedDiscounts;

    const apiNet = payroll.netSalary !== undefined && payroll.netSalary !== null
      ? getNumericValue(payroll.netSalary)
      : null;
    const totalNet = apiNet !== null ? apiNet : totalGross - totalDiscounts;

    // Tax details
    const inssBase = getNumericValue(payroll.inssBase);
    const inssAmount = getNumericValue(payroll.inssAmount);
    const irrfBase = getNumericValue(payroll.irrfBase);
    const irrfAmount = getNumericValue(payroll.irrfAmount);

    // FGTS (employer deposit): live payrolls only have the payroll field;
    // saved payrolls also carry an informational discount row.
    const fgtsRow = (payroll.discounts || []).find(isFgtsDiscount);
    const fgtsAmount = getNumericValue(payroll.fgtsAmount) || (fgtsRow ? getNumericValue(fgtsRow.value) : 0);

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
      inssBase,
      inssAmount,
      irrfBase,
      irrfAmount,
      fgtsAmount,
      employeeDiscounts,
    };
  }, [payroll]);

  // Validation - check if payrollId is provided
  if (!payrollId) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.ACCOUNTING]}>
        <Alert variant="destructive">
          <IconAlertCircle className="h-4 w-4" />
          <AlertDescription>ID da folha de pagamento não fornecido</AlertDescription>
        </Alert>
      </PrivilegeRoute>
    );
  }

  if (loading) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.ACCOUNTING]}>
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
                    <div key={i} className="flex border-b border-border py-3">
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
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.ACCOUNTING]}>
        <Alert variant="destructive">
          <IconAlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </PrivilegeRoute>
    );
  }

  if (!payroll) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.ACCOUNTING]}>
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
    { label: "Recursos Humanos", href: routes.humanResources.root },
    { label: "Folha de Pagamento", href: routes.humanResources.payroll.root },
    { label: title },
  ];

  const handleRefresh = () => {
    window.location.reload();
  };

  const handleExport = () => {
    if (!payroll) return;

    // Collect non-tax employee discounts (FGTS and inactive rows already excluded)
    const otherDiscounts = calculations.employeeDiscounts
      .filter((d: any) => {
        if (d.discountType === 'INSS' || d.discountType === 'IRRF') return false;
        const text = `${d.reference || ''}`.toUpperCase();
        return !text.includes('INSS') && !text.includes('IRRF');
      })
      .map((d: any) => ({
        description: d.reference || 'Desconto',
        amount: getNumericValue(d.value) ||
          (d.percentage ? calculations.totalGross * (getNumericValue(d.percentage) / 100) : 0),
      }));

    // Get INSS and IRRF discounts (typed rows first, reference text as fallback)
    const inssDiscount = calculations.employeeDiscounts.find((d: any) =>
      d.discountType === 'INSS' || `${d.reference || ''}`.toUpperCase().includes('INSS')
    );
    const irrfDiscount = calculations.employeeDiscounts.find((d: any) =>
      d.discountType === 'IRRF' || `${d.reference || ''}`.toUpperCase().includes('IRRF')
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
      inssBase: calculations.inssBase,
      inssAmount: (inssDiscount ? getNumericValue(inssDiscount.value) : 0) || calculations.inssAmount,
      irrfBase: calculations.irrfBase,
      irrfAmount: (irrfDiscount ? getNumericValue(irrfDiscount.value) : 0) || calculations.irrfAmount,
      fgtsAmount: calculations.fgtsAmount,
      absenceHours: getNumericValue(payroll.absenceHours),
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

  const hasBonusDiscounts = payroll.bonus?.bonusDiscounts && payroll.bonus.bonusDiscounts.length > 0;

  // Live payrolls (id "live-{userId}-{year}-{month}" or isLive flag) have no
  // database record yet, so persistent discounts (loans) can't be attached.
  // Employee discounts grouped for display
  const groupedDiscounts = DISCOUNT_GROUPS.map((group) => ({
    ...group,
    discounts: calculations.employeeDiscounts.filter((d: any) => getDiscountGroupKey(d) === group.key),
  })).filter((group) => group.discounts.length > 0);

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.ACCOUNTING]}>
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
                  <tr className="border-b border-border">
                    <td className="py-2 px-0">Salário Base</td>
                    <td className="py-2 px-0 text-left text-muted-foreground text-xs">-</td>
                    <td className="py-2 px-0 text-right font-semibold">{formatAmount(calculations.baseRemuneration)}</td>
                  </tr>

                  {/* Overtime 50% */}
                  {calculations.overtime50Amount > 0 && (
                    <tr className="border-b border-border">
                      <td className="py-2 px-0">Horas Extras 50%</td>
                      <td className="py-2 px-0 text-left text-muted-foreground text-xs">{formatHoursToHHMM(calculations.overtime50Hours)}</td>
                      <td className="py-2 px-0 text-right font-semibold text-green-600">{formatAmount(calculations.overtime50Amount)}</td>
                    </tr>
                  )}

                  {/* Overtime 100% */}
                  {calculations.overtime100Amount > 0 && (
                    <tr className="border-b border-border">
                      <td className="py-2 px-0">Horas Extras 100%</td>
                      <td className="py-2 px-0 text-left text-muted-foreground text-xs">{formatHoursToHHMM(calculations.overtime100Hours)}</td>
                      <td className="py-2 px-0 text-right font-semibold text-green-600">{formatAmount(calculations.overtime100Amount)}</td>
                    </tr>
                  )}

                  {/* Night Differential */}
                  {calculations.nightDifferentialAmount > 0 && (
                    <tr className="border-b border-border">
                      <td className="py-2 px-0">Adicional Noturno</td>
                      <td className="py-2 px-0 text-left text-muted-foreground text-xs">{formatHoursToHHMM(calculations.nightHours)}</td>
                      <td className="py-2 px-0 text-right font-semibold text-green-600">{formatAmount(calculations.nightDifferentialAmount)}</td>
                    </tr>
                  )}

                  {/* DSR */}
                  {calculations.dsrAmount > 0 && (
                    <tr className="border-b border-border">
                      <td className="py-2 px-0">Reflexo Extras DSR</td>
                      <td className="py-2 px-0 text-left text-muted-foreground text-xs">{payroll.dsrDays || '-'}</td>
                      <td className="py-2 px-0 text-right font-semibold text-green-600">{formatAmount(calculations.dsrAmount)}</td>
                    </tr>
                  )}

                  {/* Bonus - Base, Discounts, Net */}
                  {isBonifiable && calculations.bonusAmount > 0 && (
                    <>
                      {/* Base Bonus */}
                      <tr className="border-b border-border">
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
                          <tr key={extra.id || `bonus-extra-${index}`} className="border-b border-border">
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
                          <tr key={discount.id || `bonus-discount-${index}`} className="border-b border-border">
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
                        <tr className="border-b border-border bg-muted/30">
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

                  {/* Salário Bruto subtotal (all earnings) */}
                  <tr className="border-b-2 border-border bg-muted/30">
                    <td className="py-2 px-0 font-semibold" colSpan={2}>Salário Bruto</td>
                    <td className="py-2 px-0 text-right font-bold">{formatAmount(calculations.totalGross)}</td>
                  </tr>

                  {/* Discounts - grouped (FGTS and inactive rows never shown here) */}
                  {groupedDiscounts.map((group) => (
                    <Fragment key={group.key}>
                      <tr>
                        <td colSpan={3} className="pt-3 pb-1 px-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {group.label}
                        </td>
                      </tr>
                      {group.discounts.map((discount: any, index: number) => {
                        const discountValue = getNumericValue(discount.value) ||
                          (calculations.totalGross * (getNumericValue(discount.percentage) / 100));

                        // Use reference for display (clean names like "I.N.S.S.")
                        const displayDescription = discount.reference || "Desconto";

                        // Calculate reference text based on discount type
                        let referenceText = "-";
                        const ref = discount.reference?.toUpperCase() || "";
                        const discountType = discount.discountType;
                        const isInss = discountType === 'INSS' || ref.includes("INSS") || ref.includes("I.N.S.S");
                        const isIrrf = discountType === 'IRRF' || ref.includes("IRRF") || ref.includes("I.R.R.F");
                        const isLoanRow = discountType === 'LOAN' || discountType === 'ADVANCE';
                        const totalInstallments = discount.totalInstallments ? Number(discount.totalInstallments) : null;
                        const currentInstallment = discount.currentInstallment ? Number(discount.currentInstallment) : 1;

                        if (isLoanRow && totalInstallments) {
                          referenceText = `Parcela ${currentInstallment}/${totalInstallments}`;
                        } else if (['ABSENCE', 'PARTIAL_ABSENCE', 'LATE_ARRIVAL'].includes(discountType)) {
                          // Show hours in HH:MM format - prefer baseValue, fallback to payroll.absenceHours
                          const hoursValue = getNumericValue(discount.baseValue) ||
                            (discountType !== 'LATE_ARRIVAL' ? getNumericValue(payroll.absenceHours) : 0);
                          if (hoursValue > 0) {
                            referenceText = formatHoursToHHMM(hoursValue);
                          }
                        } else if (isInss) {
                          if (discount.percentage) {
                            referenceText = `${getNumericValue(discount.percentage).toFixed(2)}%`;
                          } else if (calculations.inssBase > 0 && discountValue > 0) {
                            referenceText = `${((discountValue / calculations.inssBase) * 100).toFixed(2)}%`;
                          }
                        } else if (isIrrf) {
                          if (discount.percentage) {
                            referenceText = `${getNumericValue(discount.percentage).toFixed(2)}%`;
                          } else if (calculations.irrfBase > 0 && discountValue > 0) {
                            referenceText = `${((discountValue / calculations.irrfBase) * 100).toFixed(2)}%`;
                          }
                        } else if (discount.percentage) {
                          referenceText = `${getNumericValue(discount.percentage).toFixed(2)}%`;
                        }

                        return (
                          <tr key={discount.id || `${group.key}-${index}`} className="border-b border-border">
                            <td className="py-2 px-0">
                              <span>{displayDescription}</span>
                              {isInss && calculations.inssBase > 0 && (
                                <span className="block text-xs text-muted-foreground">
                                  Base INSS: {formatAmount(calculations.inssBase)}
                                </span>
                              )}
                              {isIrrf && calculations.irrfBase > 0 && (
                                <span className="block text-xs text-muted-foreground">
                                  Base IRRF: {formatAmount(calculations.irrfBase)} (dedução de dependentes e redutor legal já aplicados)
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-0 text-left text-muted-foreground text-xs">{referenceText}</td>
                            <td className="py-2 px-0 text-right font-semibold text-destructive">
                              <span className="inline-flex items-center gap-1.5 justify-end">
                                -{formatAmount(discountValue)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </Fragment>
                  ))}

                  {/* Synthetic tax rows: live fallback when amounts exist without discount rows */}
                  {calculations.inssAmount > 0 &&
                    !calculations.employeeDiscounts.some((d: any) => d.discountType === 'INSS' || `${d.reference || ''}`.toUpperCase().includes('INSS')) && (
                    <tr className="border-b border-border">
                      <td className="py-2 px-0">
                        <span>INSS</span>
                        {calculations.inssBase > 0 && (
                          <span className="block text-xs text-muted-foreground">Base INSS: {formatAmount(calculations.inssBase)}</span>
                        )}
                      </td>
                      <td className="py-2 px-0 text-left text-muted-foreground text-xs">
                        {calculations.inssBase > 0 ? `${((calculations.inssAmount / calculations.inssBase) * 100).toFixed(2)}%` : '-'}
                      </td>
                      <td className="py-2 px-0 text-right font-semibold text-destructive">-{formatAmount(calculations.inssAmount)}</td>
                    </tr>
                  )}
                  {calculations.irrfAmount > 0 &&
                    !calculations.employeeDiscounts.some((d: any) => d.discountType === 'IRRF' || `${d.reference || ''}`.toUpperCase().includes('IRRF')) && (
                    <tr className="border-b border-border">
                      <td className="py-2 px-0">
                        <span>IRRF</span>
                        {calculations.irrfBase > 0 && (
                          <span className="block text-xs text-muted-foreground">Base IRRF: {formatAmount(calculations.irrfBase)} (dedução de dependentes e redutor legal já aplicados)</span>
                        )}
                      </td>
                      <td className="py-2 px-0 text-left text-muted-foreground text-xs">
                        {calculations.irrfBase > 0 ? `${((calculations.irrfAmount / calculations.irrfBase) * 100).toFixed(2)}%` : '-'}
                      </td>
                      <td className="py-2 px-0 text-right font-semibold text-destructive">-{formatAmount(calculations.irrfAmount)}</td>
                    </tr>
                  )}

                  {/* Totals */}
                  <tr className="border-t-2 border-border">
                    <td className="py-2 px-0 font-semibold" colSpan={2}>Total de Descontos</td>
                    <td className="py-2 px-0 text-right font-bold text-destructive">-{formatAmount(calculations.totalDiscounts)}</td>
                  </tr>
                  <tr className="bg-primary text-primary-foreground">
                    <td className="py-3 -ml-6 pl-3 font-bold" colSpan={2}>Salário Líquido</td>
                    <td className="py-3 -mr-6 pr-3 text-right font-bold text-lg">{formatAmount(calculations.totalNet)}</td>
                  </tr>

                  {/* FGTS - employer contribution, never part of the employee discounts */}
                  {calculations.fgtsAmount > 0 && (
                    <tr>
                      <td className="pt-3 pb-1 px-0 text-muted-foreground" colSpan={2}>
                        <span>FGTS (Empregador)</span>
                        <span className="block text-xs">Depósito do empregador — não descontado do colaborador</span>
                      </td>
                      <td className="pt-3 pb-1 px-0 text-right font-semibold text-muted-foreground">
                        {formatAmount(calculations.fgtsAmount)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        {/* Full holerite breakdown (live calculation) — every legal provento/
            desconto plus calculator warnings. Rendered when the live calc loads. */}
        {liveCalculation && (
          <div className="mt-4">
            <HoleriteBreakdownCard calculation={liveCalculation} />
          </div>
        )}

      </div>
    </PrivilegeRoute>
  );
}
