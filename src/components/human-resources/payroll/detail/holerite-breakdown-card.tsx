import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  IconCurrencyReal,
  IconCalculator,
  IconBuildingBank,
  IconAlertTriangle,
  IconClockExclamation,
} from "@tabler/icons-react";
import { formatCurrency } from "../../../../utils";
import type { CompletePayrollCalculation } from "../../../../types/payroll";

interface HoleriteBreakdownCardProps {
  calculation: CompletePayrollCalculation;
}

interface EarningLine {
  label: string;
  amount: number;
  hint?: string;
}

/**
 * Full holerite (contracheque) breakdown rendered from the live/saved
 * CompletePayrollCalculation result. Surfaces every legal provento and desconto
 * the calculator now produces, including the additions from the Área Andressa
 * pipeline:
 *  - salário-família / insalubridade / periculosidade / gratificação habitual
 *  - justified vs unjustified absence split (atestado ≠ perda de salário)
 *  - calculator warnings (margem consignável 35% clamp, líquido pisado em zero)
 *  - prorationFactor (avos) for mid-month admission/termination
 *
 * Layout mirrors payroll-summary-card (Proventos | Descontos two-column grid).
 */
export function HoleriteBreakdownCard({ calculation }: HoleriteBreakdownCardProps) {
  const {
    baseSalary,
    overtimeEarnings,
    dsrEarnings,
    bonusAmount,
    additionalEarnings,
    otherEarnings,
    grossSalary,
    taxDeductions,
    absenceDeductions,
    benefitDeductions,
    benefitCopayItems,
    legalDeductions,
    loanDeductions,
    customDeductions,
    totalDeductions,
    netSalary,
    employerContributions,
    prorationFactor,
    workingDaysInMonth,
    workedDays,
    warnings,
  } = calculation;

  const isProrated = prorationFactor != null && prorationFactor < 1;
  const prorationPct = isProrated ? Math.round(prorationFactor * 100) : 100;

  // ===== Build provento (earning) lines, skipping zeros =====
  const earningLines: EarningLine[] = [];
  const pushEarning = (label: string, amount?: number, hint?: string) => {
    if (amount && amount > 0) earningLines.push({ label, amount, hint });
  };

  pushEarning(
    "Salário Base",
    baseSalary,
    isProrated ? `pró-rata · ${prorationPct}% do mês` : undefined,
  );
  pushEarning(
    "Horas Extras 50%",
    overtimeEarnings?.overtime50Amount,
    overtimeEarnings?.overtime50Hours ? `${overtimeEarnings.overtime50Hours.toFixed(2)}h` : undefined,
  );
  pushEarning(
    "Horas Extras 100%",
    overtimeEarnings?.overtime100Amount,
    overtimeEarnings?.overtime100Hours ? `${overtimeEarnings.overtime100Hours.toFixed(2)}h` : undefined,
  );
  pushEarning(
    "Adicional Noturno",
    overtimeEarnings?.nightDifferentialAmount,
    overtimeEarnings?.nightHours ? `${overtimeEarnings.nightHours.toFixed(2)}h × 20%` : undefined,
  );
  pushEarning("DSR sobre Horas Extras", dsrEarnings?.dsrOnOvertime);
  pushEarning("DSR sobre Bonificações", dsrEarnings?.dsrOnBonifications);
  pushEarning("Bonificação", bonusAmount);

  // ---- New legal earnings (Área Andressa pipeline) ----
  pushEarning(
    "Salário-família",
    additionalEarnings?.familyAllowance,
    additionalEarnings?.eligibleChildren
      ? `${additionalEarnings.eligibleChildren} cota(s) × ${formatCurrency(additionalEarnings.familyAllowanceQuota || 0)}`
      : undefined,
  );
  pushEarning(
    "Adicional de Insalubridade",
    additionalEarnings?.insalubrity,
    additionalEarnings?.insalubrityPercent ? `${additionalEarnings.insalubrityPercent}% do salário-mínimo` : undefined,
  );
  pushEarning(
    "Adicional de Periculosidade",
    additionalEarnings?.hazardPay,
    "30% do salário-base",
  );
  pushEarning(
    "Gratificação Habitual",
    additionalEarnings?.habitualGratification,
    "integra base INSS/IRRF/FGTS",
  );
  pushEarning("Outros Proventos", otherEarnings);

  // ===== Build desconto (deduction) groups, skipping zeros =====
  const taxLines: EarningLine[] = [];
  if (taxDeductions?.inssAmount > 0) {
    taxLines.push({
      label: "INSS",
      amount: taxDeductions.inssAmount,
      hint: `base ${formatCurrency(taxDeductions.inssBase || 0)} · ${(taxDeductions.inssEffectiveRate || 0).toFixed(2)}%`,
    });
  }
  if (taxDeductions?.irrfAmount > 0) {
    taxLines.push({
      label: "IRRF",
      amount: taxDeductions.irrfAmount,
      hint: `base ${formatCurrency(taxDeductions.irrfBase || 0)} · ${(taxDeductions.irrfEffectiveRate || 0).toFixed(2)}%`,
    });
  }

  const absenceLines: EarningLine[] = [];
  if (absenceDeductions?.absenceAmount > 0) {
    const parts: string[] = [];
    if (absenceDeductions.unjustifiedAbsenceDays > 0) {
      parts.push(`${absenceDeductions.unjustifiedAbsenceDays} dia(s) injustificada(s)`);
    }
    if (absenceDeductions.justifiedAbsenceDays > 0) {
      parts.push(`${absenceDeductions.justifiedAbsenceDays} justificada(s) — sem desconto`);
    }
    absenceLines.push({
      label: "Faltas",
      amount: absenceDeductions.absenceAmount,
      hint: parts.join(" · ") || undefined,
    });
  }
  if (absenceDeductions?.absenceDsrLoss > 0) {
    absenceLines.push({
      label: "Perda de DSR (faltas)",
      amount: absenceDeductions.absenceDsrLoss,
    });
  }
  if (absenceDeductions?.lateArrivalAmount > 0) {
    absenceLines.push({
      label: "Atrasos",
      amount: absenceDeductions.lateArrivalAmount,
      hint: absenceDeductions.lateArrivalMinutes ? `${absenceDeductions.lateArrivalMinutes} min` : undefined,
    });
  }

  const benefitLines: EarningLine[] = [];
  const pushDeduction = (arr: EarningLine[], label: string, amount?: number, hint?: string) => {
    if (amount && amount > 0) arr.push({ label, amount, hint });
  };
  pushDeduction(benefitLines, "Vale Alimentação", benefitDeductions?.mealVoucher);
  pushDeduction(benefitLines, "Vale Transporte", benefitDeductions?.transportVoucher);
  pushDeduction(benefitLines, "Plano de Saúde", benefitDeductions?.healthInsurance, "dedutível do IRRF");
  pushDeduction(benefitLines, "Plano Odontológico", benefitDeductions?.dentalInsurance);
  pushDeduction(benefitLines, "Outros Benefícios", benefitDeductions?.otherBenefits);
  // Per-benefit co-pay items (when the calculator itemizes them).
  (benefitCopayItems || []).forEach((item) => {
    pushDeduction(benefitLines, item.benefitName || "Benefício", item.amount);
  });

  const legalLines: EarningLine[] = [];
  pushDeduction(legalLines, "Contribuição Sindical", legalDeductions?.unionContribution);
  pushDeduction(legalLines, "Pensão Alimentícia", legalDeductions?.alimony, "deduzida da base de IRRF");
  pushDeduction(legalLines, "Penhora/Garnishment", legalDeductions?.garnishment);

  const loanLines: EarningLine[] = [];
  pushDeduction(loanLines, "Empréstimos Consignados", loanDeductions?.loans);
  pushDeduction(loanLines, "Adiantamentos", loanDeductions?.advances);
  pushDeduction(loanLines, "Descontos Diversos", customDeductions);

  const deductionGroups: Array<{ title: string; lines: EarningLine[] }> = [
    { title: "Impostos", lines: taxLines },
    { title: "Faltas/Atrasos", lines: absenceLines },
    { title: "Benefícios", lines: benefitLines },
    { title: "Descontos Legais", lines: legalLines },
    { title: "Empréstimos/Adiantamentos", lines: loanLines },
  ].filter((g) => g.lines.length > 0);

  return (
    <div className="space-y-6">
      {/* Calculator warnings — surfaced prominently above the breakdown. */}
      {warnings && warnings.length > 0 && (
        <Alert variant="destructive" className="border-amber-300 bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200">
          <IconAlertTriangle className="h-5 w-5" />
          <AlertTitle>Avisos do cálculo</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4 space-y-1 mt-1">
              {warnings.map((w, i) => (
                <li key={i} className="text-sm">{w}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Proration banner for mid-month admission/termination. */}
      {isProrated && (
        <div className="flex items-start gap-2 p-3 rounded-lg border border-blue-200 dark:border-blue-800/40 bg-blue-50 dark:bg-blue-950/20">
          <IconClockExclamation className="h-5 w-5 text-blue-600 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-blue-800 dark:text-blue-200">
              Cálculo proporcional (avos) — {prorationPct}% do mês
            </p>
            <p className="text-blue-700 dark:text-blue-300 text-xs mt-0.5">
              {workedDays} de {workingDaysInMonth} dias · salário-base, salário-família e adicionais reduzidos proporcionalmente (admissão/desligamento no meio do mês).
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* LEFT — PROVENTOS */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <IconCurrencyReal className="h-5 w-5 text-green-600" />
                <CardTitle>Proventos (Ganhos)</CardTitle>
              </div>
              {isProrated && (
                <Badge variant="secondary" className="text-xs">Proporcional {prorationPct}%</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {earningLines.map((line, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {line.label}
                  {line.hint && <span className="ml-1 text-xs opacity-70">({line.hint})</span>}
                </span>
                <span className="text-green-600 font-medium">{formatCurrency(line.amount)}</span>
              </div>
            ))}

            <Separator />

            <div className="flex justify-between font-semibold text-lg">
              <span>Salário Bruto:</span>
              <span className="text-green-600">{formatCurrency(grossSalary || 0)}</span>
            </div>
          </CardContent>
        </Card>

        {/* RIGHT — DESCONTOS */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <IconCalculator className="h-5 w-5 text-red-600" />
              <CardTitle>Descontos</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {deductionGroups.map((group) => (
              <div key={group.title} className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">{group.title}</p>
                {group.lines.map((line, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {line.label}
                      {line.hint && <span className="ml-1 text-xs opacity-70">({line.hint})</span>}
                    </span>
                    <span className="text-red-600">-{formatCurrency(line.amount)}</span>
                  </div>
                ))}
              </div>
            ))}

            {deductionGroups.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum desconto aplicado</p>
            )}

            <Separator />

            <div className="flex justify-between font-semibold text-lg">
              <span>Total Descontos:</span>
              <span className="text-red-600">-{formatCurrency(totalDeductions || 0)}</span>
            </div>

            <Separator className="my-2" />

            <div className="flex justify-between font-bold text-xl">
              <span>Salário Líquido:</span>
              <span className="text-blue-600">{formatCurrency(netSalary || 0)}</span>
            </div>
            {netSalary === 0 && totalDeductions > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Líquido pisado em zero — descontos limitados ao salário bruto.
              </p>
            )}

            {employerContributions?.fgtsAmount > 0 && (
              <div className="mt-2 p-3 bg-muted/50 rounded-lg">
                <div className="flex items-start gap-2">
                  <IconBuildingBank className="h-4 w-4 text-muted-foreground mt-0.5" />
                  <div className="flex-1 text-xs">
                    <p className="font-medium">FGTS (Depósito do Empregador)</p>
                    <p className="text-muted-foreground">
                      Valor depositado: <span className="font-semibold">{formatCurrency(employerContributions.fgtsAmount)}</span>
                      {employerContributions.fgtsRate ? ` (${(employerContributions.fgtsRate * 100).toFixed(0)}%)` : ""}
                    </p>
                    <p className="text-muted-foreground italic mt-1">* Não descontado do salário do funcionário</p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
