import { IconUser, IconGift, IconCurrencyReal, IconCalendar, IconAlertTriangle } from "@tabler/icons-react";

import type { UserBenefit } from "../../../../types/benefit";
import {
  BENEFIT_KIND,
  BENEFIT_KIND_LABELS,
  BENEFIT_ENROLLMENT_STATUS_LABELS,
  getBadgeVariant,
  type BENEFIT_ENROLLMENT_STATUS,
} from "../../../../constants";
import { formatCurrency, formatDate } from "../../../../utils";
import { getKindDiscountHelper } from "../../benefit/discount-caps";
import { calculateBenefitSplit } from "../../../../utils/benefit-discount";
import { getPositionMonthlySalary } from "../../../../utils/overtime-cost";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DetailRow } from "@/components/ui/detail-row";
import { cn } from "@/lib/utils";

const formatPercent = (percentage: number): string => {
  const formatted = percentage.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return `${formatted}%`;
};

interface CardProps {
  userBenefit: UserBenefit;
  className?: string;
}

export function UserBenefitUserCard({ userBenefit, className }: CardProps) {
  const user = userBenefit.user;

  return (
    <Card className={cn("shadow-sm border border-border", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconUser className="h-5 w-5 text-muted-foreground" />
          Colaborador
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <DetailRow label="Nome" value={user?.name || undefined} />
          <DetailRow label="Cargo" value={user?.position?.name || undefined} />
          <DetailRow label="Setor" value={user?.sector?.name || undefined} />
        </div>
      </CardContent>
    </Card>
  );
}

export function UserBenefitBenefitCard({ userBenefit, className }: CardProps) {
  const benefit = userBenefit.benefit;

  return (
    <Card className={cn("shadow-sm border border-border", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconGift className="h-5 w-5 text-muted-foreground" />
          Benefício
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <DetailRow label="Nome" value={benefit?.name || undefined} />
          <DetailRow
            label="Tipo"
            value={
              benefit ? (
                <Badge variant="secondary" className="text-xs whitespace-nowrap">
                  {BENEFIT_KIND_LABELS[benefit.kind] || benefit.kind}
                </Badge>
              ) : undefined
            }
          />
          <DetailRow label="Fornecedor" value={benefit?.provider || undefined} />
        </div>
      </CardContent>
    </Card>
  );
}

export function UserBenefitValuesCard({ userBenefit, className }: CardProps) {
  // Regra canônica (mesma da folha de pagamento): VT percentual desconta
  // % do SALÁRIO-BASE (limitado ao custo do VT); demais tipos, % do custo.
  const baseSalary = getPositionMonthlySalary(userBenefit.user?.position);
  const split = calculateBenefitSplit(
    {
      monthlyValue: userBenefit.monthlyValue,
      employeeDiscountValue: userBenefit.employeeDiscountValue,
      employeeDiscountPercent: userBenefit.employeeDiscountPercent,
      benefitKind: userBenefit.benefit?.kind,
    },
    baseSalary,
  );
  const salaryKnown = !split.dependsOnSalary || baseSalary !== null;
  const isPercentRule =
    (userBenefit.employeeDiscountValue === null || userBenefit.employeeDiscountValue === undefined) &&
    userBenefit.employeeDiscountPercent !== null &&
    userBenefit.employeeDiscountPercent !== undefined;
  const kind = userBenefit.benefit?.kind;
  const showCapNote = kind === BENEFIT_KIND.TRANSPORT_VOUCHER || kind === BENEFIT_KIND.MEAL_VOUCHER || kind === BENEFIT_KIND.FOOD_VOUCHER;

  return (
    <Card className={cn("shadow-sm border border-border", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconCurrencyReal className="h-5 w-5 text-muted-foreground" />
          Valores e Descontos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <DetailRow label="Custo Total (Valor Mensal)" value={formatCurrency(split.monthlyValue)} />
          <DetailRow
            label="Empresa Paga"
            value={salaryKnown ? formatCurrency(split.companyShare) : <span className="text-muted-foreground">depende do salário</span>}
          />
          <DetailRow
            label="Colaborador Paga"
            value={
              <>
                {salaryKnown ? formatCurrency(split.employeeShare) : <span className="text-muted-foreground">—</span>}
                {isPercentRule && (
                  <span className="text-xs text-muted-foreground ml-1">
                    ({formatPercent(userBenefit.employeeDiscountPercent!)} {split.dependsOnSalary ? "do salário" : "do custo"})
                  </span>
                )}
              </>
            }
          />
          {split.dependsOnSalary && (
            <DetailRow
              label="Salário-Base (cálculo VT)"
              value={baseSalary !== null ? formatCurrency(baseSalary) : <span className="text-muted-foreground">não disponível</span>}
            />
          )}
          {userBenefit.benefit?.kind === BENEFIT_KIND.TRANSPORT_VOUCHER && (
            <DetailRow
              label="Passagens por Dia"
              value={userBenefit.dailyTickets !== null && userBenefit.dailyTickets !== undefined ? userBenefit.dailyTickets : undefined}
            />
          )}
          {userBenefit.totalInstallments != null && (
            <DetailRow label="Parcelas" value={`${userBenefit.currentInstallment ?? 1}/${userBenefit.totalInstallments}`} />
          )}
          {showCapNote && <p className="text-xs text-muted-foreground">{getKindDiscountHelper(kind)}</p>}
          {/* Guard de VT: o desconto depende do salário-base que está desconhecido/zero.
              NÃO exibimos R$ 0,00 como se fosse o valor real — sinalizamos a pendência. */}
          {split.salaryUnknownWarning && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              <IconAlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                O desconto do Vale Transporte é {formatPercent(userBenefit.employeeDiscountPercent!)} do salário-base, mas o salário deste colaborador não está
                cadastrado. O valor não foi zerado por engano — cadastre o salário do cargo para calcular o desconto correto.
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function UserBenefitDatesCard({ userBenefit, className }: CardProps) {
  return (
    <Card className={cn("shadow-sm border border-border", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconCalendar className="h-5 w-5 text-muted-foreground" />
          Vigência e Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <DetailRow
            label="Status"
            value={
              <Badge variant={getBadgeVariant(userBenefit.status, "BENEFIT_ENROLLMENT")} className="text-xs whitespace-nowrap">
                {BENEFIT_ENROLLMENT_STATUS_LABELS[userBenefit.status as BENEFIT_ENROLLMENT_STATUS] || userBenefit.status}
              </Badge>
            }
          />
          <DetailRow label="Data de Início" value={userBenefit.startDate ? formatDate(new Date(userBenefit.startDate)) : undefined} />
          <DetailRow label="Data de Fim" value={userBenefit.endDate ? formatDate(new Date(userBenefit.endDate)) : <span className="text-muted-foreground">—</span>} />
          <DetailRow label="Criado em" value={userBenefit.createdAt ? formatDate(new Date(userBenefit.createdAt)) : undefined} />
          {userBenefit.notes && <DetailRow label="Observações" value={userBenefit.notes} block />}
        </div>
      </CardContent>
    </Card>
  );
}
