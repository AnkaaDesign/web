import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  IconCurrencyReal,
  IconCalculator,
  IconBuildingBank,
} from "@tabler/icons-react";
import { formatCurrency } from "../../../utils";
import { getDiscountTypeInfo } from "../../../utils/payroll-discount-utils";
import type { Payroll } from "../../../types/payroll";

interface PayrollSummaryCardProps {
  payroll: Payroll;
}

export function PayrollSummaryCard({ payroll }: PayrollSummaryCardProps) {
  // Calculate hourly rate
  const monthlyHours = 220; // Standard Brazilian workweek
  const hourlyRate = Number(payroll.baseRemuneration) / monthlyHours;

  // Group discounts by category
  const taxDiscounts = payroll.discounts?.filter(d =>
    d.discountType === 'INSS' || d.discountType === 'IRRF'
  ) || [];

  const absenceDiscounts = payroll.discounts?.filter(d =>
    d.discountType === 'ABSENCE' || d.discountType === 'LATE_ARRIVAL'
  ) || [];

  const benefitDiscounts = payroll.discounts?.filter(d =>
    ['MEAL_VOUCHER', 'TRANSPORT_VOUCHER', 'HEALTH_INSURANCE', 'DENTAL_INSURANCE'].includes(d.discountType || '')
  ) || [];

  const legalDiscounts = payroll.discounts?.filter(d =>
    ['UNION_CONTRIBUTION', 'ALIMONY', 'GARNISHMENT'].includes(d.discountType || '')
  ) || [];

  const loanDiscounts = payroll.discounts?.filter(d =>
    ['LOAN', 'ADVANCE'].includes(d.discountType || '')
  ) || [];

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* LEFT COLUMN - EARNINGS */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <IconCurrencyReal className="h-5 w-5 text-green-600" />
            <CardTitle>Proventos (Ganhos)</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Base Salary */}
          <div className="flex justify-between">
            <span className="text-sm">Salário Base:</span>
            <span className="font-medium">{formatCurrency(Number(payroll.baseRemuneration) || 0)}</span>
          </div>

          {/* Overtime 50% */}
          {(payroll.overtime50Hours && payroll.overtime50Hours > 0) && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                + HE 50% ({payroll.overtime50Hours?.toFixed(2)}h × R$ {hourlyRate.toFixed(2)} × 1,5)
              </span>
              <span className="text-green-600">
                {formatCurrency(Number(payroll.overtime50Amount) || 0)}
              </span>
            </div>
          )}

          {/* Overtime 100% */}
          {(payroll.overtime100Hours && payroll.overtime100Hours > 0) && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                + HE 100% ({payroll.overtime100Hours?.toFixed(2)}h × R$ {hourlyRate.toFixed(2)} × 2,0)
              </span>
              <span className="text-green-600">
                {formatCurrency(Number(payroll.overtime100Amount) || 0)}
              </span>
            </div>
          )}

          {/* Night Differential */}
          {(payroll.nightHours && payroll.nightHours > 0) && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                + Adicional Noturno ({payroll.nightHours?.toFixed(2)}h × 20%)
              </span>
              <span className="text-green-600">
                {formatCurrency(Number(payroll.nightDifferentialAmount) || 0)}
              </span>
            </div>
          )}

          {/* DSR */}
          {(payroll.dsrAmount && payroll.dsrAmount > 0) && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">+ DSR sobre Horas Extras</span>
              <span className="text-green-600">
                {formatCurrency(Number(payroll.dsrAmount) || 0)}
              </span>
            </div>
          )}

          {/* Bonus */}
          {(payroll.bonus?.baseBonus && payroll.bonus.baseBonus > 0) && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">+ Bonificação</span>
              <span className="text-green-600">
                {formatCurrency(Number(payroll.bonus.baseBonus) || 0)}
              </span>
            </div>
          )}

          <Separator />

          {/* Gross Salary */}
          <div className="flex justify-between font-semibold text-lg">
            <span>Salário Bruto:</span>
            <span className="text-green-600">
              {formatCurrency(Number(payroll.grossSalary) || 0)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* RIGHT COLUMN - DEDUCTIONS */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <IconCalculator className="h-5 w-5 text-red-600" />
            <CardTitle>Descontos</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tax Deductions */}
          {taxDiscounts.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Impostos</p>
              {taxDiscounts.map((discount) => {
                const info = getDiscountTypeInfo(discount.discountType);
                const value = discount.value || 0;
                return (
                  <div key={discount.id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <span>{info.icon}</span>
                      <span>{discount.discountType === 'INSS' ? 'INSS' : 'IRRF'}</span>
                    </span>
                    <span className="text-red-600">-{formatCurrency(Number(value))}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Absence/Lateness Deductions */}
          {absenceDiscounts.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Faltas/Atrasos</p>
              {absenceDiscounts.map((discount) => {
                const info = getDiscountTypeInfo(discount.discountType);
                const value = discount.value || 0;
                return (
                  <div key={discount.id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <span>{info.icon}</span>
                      <span>{discount.reference}</span>
                    </span>
                    <span className="text-red-600">-{formatCurrency(Number(value))}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Benefit Deductions */}
          {benefitDiscounts.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Benefícios</p>
              {benefitDiscounts.map((discount) => {
                const info = getDiscountTypeInfo(discount.discountType);
                const value = discount.value || 0;
                return (
                  <div key={discount.id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <span>{info.icon}</span>
                      <span>{discount.reference}</span>
                    </span>
                    <span className="text-red-600">-{formatCurrency(Number(value))}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Legal Deductions */}
          {legalDiscounts.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Descontos Legais</p>
              {legalDiscounts.map((discount) => {
                const info = getDiscountTypeInfo(discount.discountType);
                const value = discount.value || 0;
                return (
                  <div key={discount.id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <span>{info.icon}</span>
                      <span>{discount.reference}</span>
                    </span>
                    <span className="text-red-600">-{formatCurrency(Number(value))}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Loan Deductions */}
          {loanDiscounts.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Empréstimos/Adiantamentos</p>
              {loanDiscounts.map((discount) => {
                const info = getDiscountTypeInfo(discount.discountType);
                const value = discount.value || 0;
                return (
                  <div key={discount.id} className="flex justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <span>{info.icon}</span>
                      <span>{discount.reference}</span>
                    </span>
                    <span className="text-red-600">-{formatCurrency(Number(value))}</span>
                  </div>
                );
              })}
            </div>
          )}

          {payroll.discounts && payroll.discounts.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum desconto aplicado
            </p>
          )}

          <Separator />

          {/* Total Deductions */}
          <div className="flex justify-between font-semibold text-lg">
            <span>Total Descontos:</span>
            <span className="text-red-600">
              -{formatCurrency(Number(payroll.totalDiscounts) || 0)}
            </span>
          </div>

          <Separator className="my-4" />

          {/* Net Salary */}
          <div className="flex justify-between font-bold text-xl">
            <span>Salário Líquido:</span>
            <span className="text-blue-600">
              {formatCurrency(Number(payroll.netSalary) || 0)}
            </span>
          </div>

          {/* FGTS Info */}
          {(payroll.fgtsAmount && payroll.fgtsAmount > 0) && (
            <div className="mt-4 p-3 bg-muted/50 rounded-lg">
              <div className="flex items-start gap-2">
                <IconBuildingBank className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div className="flex-1 text-xs">
                  <p className="font-medium">FGTS (Depósito do Empregador)</p>
                  <p className="text-muted-foreground">
                    Valor depositado pelo empregador: <span className="font-semibold">{formatCurrency(Number(payroll.fgtsAmount))}</span>
                  </p>
                  <p className="text-muted-foreground italic mt-1">
                    * Não descontado do salário do funcionário
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
