import { IconGift } from "@tabler/icons-react";

import type { Benefit } from "../../../../types/benefit";
import { BENEFIT_KIND, BENEFIT_KIND_LABELS } from "../../../../constants";
import { formatCurrency, formatDate } from "../../../../utils";
import { getKindDiscountHelper } from "../discount-caps";
import { calculateBenefitSplit } from "../../../../utils/benefit-discount";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DetailRow } from "@/components/ui/detail-row";
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
        <div className="space-y-2">
          <DetailRow
            label="Tipo"
            value={
              <Badge variant="secondary" className="text-xs whitespace-nowrap">
                {BENEFIT_KIND_LABELS[benefit.kind as BENEFIT_KIND] || benefit.kind}
              </Badge>
            }
          />

          <DetailRow label="Nome" value={benefit.name} />

          <DetailRow label="Fornecedor" value={benefit.provider || undefined} />

          <DetailRow
            label="Custo Padrão (Empresa + Colaborador)"
            value={benefit.defaultValue !== null && benefit.defaultValue !== undefined ? formatCurrency(benefit.defaultValue) : undefined}
          />

          <DetailRow
            label="Colaborador Paga (Padrão)"
            value={
              benefit.defaultEmployeeDiscountPercent !== null && benefit.defaultEmployeeDiscountPercent !== undefined ? (
                <>
                  {formatPercent(benefit.defaultEmployeeDiscountPercent)}
                  {defaultSplit.dependsOnSalary ? (
                    <span className="text-xs font-normal text-muted-foreground ml-1">do salário do colaborador</span>
                  ) : (
                    benefit.defaultValue !== null &&
                    benefit.defaultValue !== undefined && <span className="text-xs font-normal text-muted-foreground ml-1">(≈ {formatCurrency(defaultSplit.employeeShare)})</span>
                  )}
                </>
              ) : undefined
            }
          />

          {benefit.defaultValue !== null && benefit.defaultValue !== undefined && (
            <DetailRow
              label="Empresa Paga (Padrão)"
              value={defaultSplit.dependsOnSalary ? <span className="font-normal text-muted-foreground">custo − % do salário</span> : formatCurrency(defaultSplit.companyShare)}
            />
          )}

          {(benefit.kind === BENEFIT_KIND.TRANSPORT_VOUCHER || benefit.kind === BENEFIT_KIND.MEAL_VOUCHER || benefit.kind === BENEFIT_KIND.FOOD_VOUCHER) && (
            <p className="px-1 pt-1 text-xs text-muted-foreground">{getKindDiscountHelper(benefit.kind)}</p>
          )}

          <DetailRow
            label="Status"
            value={
              <Badge variant={benefit.isActive ? "active" : "inactive"} className="text-xs whitespace-nowrap">
                {benefit.isActive ? "Ativo" : "Inativo"}
              </Badge>
            }
          />

          <DetailRow label="Adesões" value={benefit._count?.enrollments ?? 0} />

          {benefit.notes && <DetailRow label="Observações" value={benefit.notes} block />}

          <DetailRow label="Criado em" value={benefit.createdAt ? formatDate(new Date(benefit.createdAt)) : undefined} />
        </div>
      </CardContent>
    </Card>
  );
}
