import { useNavigate } from "react-router-dom";
import { IconHeartHandshake, IconArrowRight, IconAlertTriangle } from "@tabler/icons-react";

import { routes, BENEFIT_KIND, BENEFIT_KIND_LABELS, BENEFIT_ENROLLMENT_STATUS } from "../../../constants";
import { formatCurrency } from "../../../utils";
import { calculateBenefitSplit } from "../../../utils/benefit-discount";
import { getPositionMonthlySalary } from "../../../utils/overtime-cost";
import { useUserBenefits } from "../../../hooks/personnel-department/use-user-benefits";
import { useDependents } from "../../../hooks/human-resources/use-dependents";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface UserBenefitsCardProps {
  userId: string;
  className?: string;
}

/**
 * Benefícios do colaborador (adesões ATIVAS) com a divisão de custo
 * Empresa × Colaborador, usando a regra canônica da folha de pagamento
 * (utils/benefit-discount): VT percentual = % do salário-base (limitado ao
 * custo do VT); demais tipos = % do custo do benefício.
 *
 * Self-contained: busca os próprios dados a partir do userId — pode ser
 * inserido em qualquer página de detalhe de colaborador.
 */
export function UserBenefitsCard({ userId, className }: UserBenefitsCardProps) {
  const navigate = useNavigate();

  const { data: response, isLoading } = useUserBenefits(
    {
      userIds: [userId],
      statuses: [BENEFIT_ENROLLMENT_STATUS.ACTIVE],
      // position.remunerations = salário-base (regra percentual do VT)
      include: { benefit: true, user: { include: { position: { include: { remunerations: true } } } } },
      orderBy: { createdAt: "asc" },
      limit: 50,
    },
    { enabled: !!userId },
  );

  const enrollments = response?.data || [];

  const rows = enrollments.map((enrollment) => {
    const baseSalary = getPositionMonthlySalary(enrollment.user?.position);
    const split = calculateBenefitSplit(
      {
        monthlyValue: enrollment.monthlyValue,
        employeeDiscountValue: enrollment.employeeDiscountValue,
        employeeDiscountPercent: enrollment.employeeDiscountPercent,
        benefitKind: enrollment.benefit?.kind,
      },
      baseSalary,
    );
    return { enrollment, split, salaryKnown: !split.dependsOnSalary || baseSalary !== null };
  });

  const allKnown = rows.every((r) => r.salaryKnown);
  // Guard de VT: alguma adesão depende do salário-base (% do salário) mas o
  // salário do colaborador é desconhecido/zero. NÃO tratamos como R$ 0,00 real.
  const hasVtSalaryUnknown = rows.some((r) => r.split.salaryUnknownWarning);
  const totalCost = rows.reduce((sum, r) => sum + r.split.monthlyValue, 0);
  const totalCompany = rows.reduce((sum, r) => sum + r.split.companyShare, 0);
  const totalEmployee = rows.reduce((sum, r) => sum + r.split.employeeShare, 0);

  // Aggregate plano de saúde cost: titular's health-plan monthlyValue + Σ enrolled dependents
  const { data: dependentsResponse } = useDependents(
    {
      userIds: [userId],
      limit: 100,
    } as any,
    { enabled: !!userId },
  );

  const healthPlanEnrollments = enrollments.filter((e) => e.benefit?.kind === BENEFIT_KIND.HEALTH_PLAN);
  const healthPlanEnrollmentIds = new Set(healthPlanEnrollments.map((e) => e.id));
  const titularHealthPlanCost = healthPlanEnrollments.reduce((sum, e) => sum + (e.monthlyValue || 0), 0);

  const enrolledDependents = (dependentsResponse?.data || []).filter(
    (d) => d.healthPlanBenefitId && healthPlanEnrollmentIds.has(d.healthPlanBenefitId),
  );
  const dependentsHealthPlanCost = enrolledDependents.reduce((sum, d) => sum + (d.healthPlanValue || 0), 0);
  const totalHealthPlanCost = titularHealthPlanCost + dependentsHealthPlanCost;
  const hasHealthPlan = healthPlanEnrollments.length > 0;

  const enrollmentsListUrl = `${routes.personnelDepartment.benefits.enrollments.root}?users=${userId}`;

  return (
    <Card className={cn("shadow-sm border border-border", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <IconHeartHandshake className="h-5 w-5 text-muted-foreground" />
          Benefícios Ativos {rows.length > 0 ? `(${rows.length})` : ""}
        </CardTitle>
        <Button variant="outline" size="sm" onClick={() => navigate(enrollmentsListUrl)}>
          Ver adesões
          <IconArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
            <IconHeartHandshake className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <div className="text-sm">Nenhum benefício ativo para este colaborador.</div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-bold uppercase">Benefício</TableHead>
                <TableHead className="text-xs font-bold uppercase">Custo Total</TableHead>
                <TableHead className="text-xs font-bold uppercase">Empresa Paga</TableHead>
                <TableHead className="text-xs font-bold uppercase">Colaborador Paga</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(({ enrollment, split, salaryKnown }) => (
                <TableRow
                  key={enrollment.id}
                  className="cursor-pointer hover:bg-muted/20"
                  onClick={() => navigate(routes.personnelDepartment.benefits.enrollments.details(enrollment.id))}
                >
                  <TableCell className="text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium truncate">{enrollment.benefit?.name || "-"}</span>
                      {enrollment.benefit?.kind && (
                        <Badge variant="secondary" className="text-xs whitespace-nowrap shrink-0">
                          {BENEFIT_KIND_LABELS[enrollment.benefit.kind] || enrollment.benefit.kind}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{formatCurrency(split.monthlyValue)}</TableCell>
                  <TableCell className="text-sm">{salaryKnown ? formatCurrency(split.companyShare) : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell className="text-sm">
                    {salaryKnown ? (
                      formatCurrency(split.employeeShare)
                    ) : (
                      <span className="text-muted-foreground">{enrollment.employeeDiscountPercent}% do salário</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {/* Totais mensais */}
              <TableRow className="bg-muted/30 hover:bg-muted/30 font-medium">
                <TableCell className="text-sm">Total mensal</TableCell>
                <TableCell className="text-sm">{formatCurrency(totalCost)}</TableCell>
                <TableCell className="text-sm">{allKnown ? formatCurrency(totalCompany) : <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell className="text-sm">{allKnown ? formatCurrency(totalEmployee) : <span className="text-muted-foreground">—</span>}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}

        {hasVtSalaryUnknown && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
            <IconAlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Há Vale Transporte descontado como percentual do salário-base, mas o salário deste colaborador não está cadastrado. A parte da empresa/colaborador
              não foi zerada por engano — cadastre o salário do cargo para apurar o desconto correto.
            </span>
          </div>
        )}

        {hasHealthPlan && (
          <div className="mt-4 rounded-lg border border-border bg-muted/20 p-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <IconHeartHandshake className="h-4 w-4 text-muted-foreground" />
              Plano de Saúde (titular + {enrolledDependents.length} {enrolledDependents.length === 1 ? "dependente" : "dependentes"})
              <span className="ml-auto font-semibold">{formatCurrency(totalHealthPlanCost)}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              titular {formatCurrency(titularHealthPlanCost)} + dependentes {formatCurrency(dependentsHealthPlanCost)}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
