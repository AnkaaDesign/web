import { IconGift } from "@tabler/icons-react";

import type { Benefit } from "../../../../types/benefit";
import { BENEFIT_KIND, BENEFIT_KIND_LABELS } from "../../../../constants";
import { formatCurrency, formatDate } from "../../../../utils";
import { getKindDiscountHelper } from "../discount-caps";
import { calculateBenefitSplit } from "../../../../utils/benefit-discount";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface BenefitInfoCardProps {
  benefit: Benefit;
  className?: string;
}

const formatPercent = (percentage: number): string => {
  const formatted = percentage.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return `${formatted}%`;
};

export function BenefitInfoCard({ benefit, className }: BenefitInfoCardProps) {
  // Split padrão (regra canônica). Para VT o percentual incide sobre o
  // SALÁRIO de cada colaborador — dependsOnSalary=true: não há estimativa
  // possível no nível do catálogo.
  const defaultSplit = calculateBenefitSplit({
    monthlyValue: benefit.defaultValue ?? 0,
    employeeDiscountValue: null,
    employeeDiscountPercent: benefit.defaultEmployeeDiscountPercent,
    benefitKind: benefit.kind,
  });

  return (
    <Card className={cn("shadow-sm border border-border", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconGift className="h-5 w-5 text-muted-foreground" />
          Informações do Benefício
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-sm text-muted-foreground">Tipo</dt>
            <dd>
              <Badge variant="secondary" className="text-xs whitespace-nowrap">
                {BENEFIT_KIND_LABELS[benefit.kind as BENEFIT_KIND] || benefit.kind}
              </Badge>
            </dd>
          </div>

          <div className="flex items-center justify-between gap-4">
            <dt className="text-sm text-muted-foreground">Nome</dt>
            <dd className="text-sm font-medium text-right">{benefit.name}</dd>
          </div>

          <div className="flex items-center justify-between gap-4">
            <dt className="text-sm text-muted-foreground">Fornecedor</dt>
            <dd className="text-sm font-medium text-right">{benefit.provider || <span className="text-muted-foreground">-</span>}</dd>
          </div>

          <div className="flex items-center justify-between gap-4">
            <dt className="text-sm text-muted-foreground">Custo Padrão (Empresa + Colaborador)</dt>
            <dd className="text-sm font-medium text-right">
              {benefit.defaultValue !== null && benefit.defaultValue !== undefined ? formatCurrency(benefit.defaultValue) : <span className="text-muted-foreground">-</span>}
            </dd>
          </div>

          <div className="flex items-center justify-between gap-4">
            <dt className="text-sm text-muted-foreground">Colaborador Paga (Padrão)</dt>
            <dd className="text-sm font-medium text-right">
              {benefit.defaultEmployeeDiscountPercent !== null && benefit.defaultEmployeeDiscountPercent !== undefined ? (
                <>
                  {formatPercent(benefit.defaultEmployeeDiscountPercent)}
                  {defaultSplit.dependsOnSalary ? (
                    <span className="text-xs text-muted-foreground ml-1">do salário do colaborador</span>
                  ) : (
                    benefit.defaultValue !== null &&
                    benefit.defaultValue !== undefined && <span className="text-xs text-muted-foreground ml-1">(≈ {formatCurrency(defaultSplit.employeeShare)})</span>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground">-</span>
              )}
            </dd>
          </div>

          {benefit.defaultValue !== null && benefit.defaultValue !== undefined && (
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-muted-foreground">Empresa Paga (Padrão)</dt>
              <dd className="text-sm font-medium text-right">
                {defaultSplit.dependsOnSalary ? <span className="text-muted-foreground">custo − % do salário</span> : formatCurrency(defaultSplit.companyShare)}
              </dd>
            </div>
          )}

          {(benefit.kind === BENEFIT_KIND.TRANSPORT_VOUCHER || benefit.kind === BENEFIT_KIND.MEAL_VOUCHER || benefit.kind === BENEFIT_KIND.FOOD_VOUCHER) && (
            <p className="text-xs text-muted-foreground">{getKindDiscountHelper(benefit.kind)}</p>
          )}

          <div className="flex items-center justify-between gap-4">
            <dt className="text-sm text-muted-foreground">Status</dt>
            <dd>
              <Badge variant={benefit.isActive ? "active" : "inactive"} className="text-xs whitespace-nowrap">
                {benefit.isActive ? "Ativo" : "Inativo"}
              </Badge>
            </dd>
          </div>

          <div className="flex items-center justify-between gap-4">
            <dt className="text-sm text-muted-foreground">Adesões</dt>
            <dd className="text-sm font-medium text-right">{benefit._count?.enrollments ?? 0}</dd>
          </div>

          {benefit.notes && (
            <div className="space-y-1">
              <dt className="text-sm text-muted-foreground">Observações</dt>
              <dd className="text-sm whitespace-pre-wrap">{benefit.notes}</dd>
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
            <dt className="text-sm text-muted-foreground">Criado em</dt>
            <dd className="text-sm font-medium text-right">{benefit.createdAt ? formatDate(new Date(benefit.createdAt)) : "-"}</dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}
