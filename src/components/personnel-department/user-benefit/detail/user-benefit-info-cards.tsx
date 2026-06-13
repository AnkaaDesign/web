import { IconUser, IconGift, IconCurrencyReal, IconCalendar } from "@tabler/icons-react";

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
import { cn } from "@/lib/utils";

const formatPercent = (percentage: number): string => {
  const formatted = percentage.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return `${formatted}%`;
};

interface CardProps {
  userBenefit: UserBenefit;
  className?: string;
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-right">{children}</dd>
    </div>
  );
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
        <dl className="space-y-4">
          <InfoRow label="Nome">{user?.name || <span className="text-muted-foreground">-</span>}</InfoRow>
          <InfoRow label="Cargo">{user?.position?.name || <span className="text-muted-foreground">-</span>}</InfoRow>
          <InfoRow label="Setor">{user?.sector?.name || <span className="text-muted-foreground">-</span>}</InfoRow>
        </dl>
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
        <dl className="space-y-4">
          <InfoRow label="Nome">{benefit?.name || <span className="text-muted-foreground">-</span>}</InfoRow>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-sm text-muted-foreground">Tipo</dt>
            <dd>
              {benefit ? (
                <Badge variant="secondary" className="text-xs whitespace-nowrap">
                  {BENEFIT_KIND_LABELS[benefit.kind] || benefit.kind}
                </Badge>
              ) : (
                <span className="text-sm text-muted-foreground">-</span>
              )}
            </dd>
          </div>
          <InfoRow label="Fornecedor">{benefit?.provider || <span className="text-muted-foreground">-</span>}</InfoRow>
        </dl>
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
        <dl className="space-y-4">
          <InfoRow label="Custo Total (Valor Mensal)">{formatCurrency(split.monthlyValue)}</InfoRow>
          <InfoRow label="Empresa Paga">
            {salaryKnown ? formatCurrency(split.companyShare) : <span className="text-muted-foreground">depende do salário</span>}
          </InfoRow>
          <InfoRow label="Colaborador Paga">
            <>
              {salaryKnown ? formatCurrency(split.employeeShare) : <span className="text-muted-foreground">—</span>}
              {isPercentRule && (
                <span className="text-xs text-muted-foreground ml-1">
                  ({formatPercent(userBenefit.employeeDiscountPercent!)} {split.dependsOnSalary ? "do salário" : "do custo"})
                </span>
              )}
            </>
          </InfoRow>
          {split.dependsOnSalary && (
            <InfoRow label="Salário-Base (cálculo VT)">
              {baseSalary !== null ? formatCurrency(baseSalary) : <span className="text-muted-foreground">não disponível</span>}
            </InfoRow>
          )}
          {userBenefit.benefit?.kind === BENEFIT_KIND.TRANSPORT_VOUCHER && (
            <InfoRow label="Passagens por Dia">
              {userBenefit.dailyTickets !== null && userBenefit.dailyTickets !== undefined ? userBenefit.dailyTickets : <span className="text-muted-foreground">-</span>}
            </InfoRow>
          )}
          {showCapNote && <p className="text-xs text-muted-foreground">{getKindDiscountHelper(kind)}</p>}
        </dl>
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
        <dl className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-sm text-muted-foreground">Status</dt>
            <dd>
              <Badge variant={getBadgeVariant(userBenefit.status, "BENEFIT_ENROLLMENT")} className="text-xs whitespace-nowrap">
                {BENEFIT_ENROLLMENT_STATUS_LABELS[userBenefit.status as BENEFIT_ENROLLMENT_STATUS] || userBenefit.status}
              </Badge>
            </dd>
          </div>
          <InfoRow label="Data de Início">{userBenefit.startDate ? formatDate(new Date(userBenefit.startDate)) : <span className="text-muted-foreground">-</span>}</InfoRow>
          <InfoRow label="Data de Fim">{userBenefit.endDate ? formatDate(new Date(userBenefit.endDate)) : <span className="text-muted-foreground">—</span>}</InfoRow>
          <InfoRow label="Criado em">{userBenefit.createdAt ? formatDate(new Date(userBenefit.createdAt)) : <span className="text-muted-foreground">-</span>}</InfoRow>
          {userBenefit.notes && (
            <div className="space-y-1">
              <dt className="text-sm text-muted-foreground">Observações</dt>
              <dd className="text-sm whitespace-pre-wrap">{userBenefit.notes}</dd>
            </div>
          )}
        </dl>
      </CardContent>
    </Card>
  );
}
