import { useNavigate } from "react-router-dom";
import { IconUsers, IconArrowRight } from "@tabler/icons-react";

import type { Benefit } from "../../../../types/benefit";
import { routes, BENEFIT_ENROLLMENT_STATUS_LABELS, getBadgeVariant, type BENEFIT_ENROLLMENT_STATUS } from "../../../../constants";
import { formatCurrency, formatDate } from "../../../../utils";
import { useUserBenefits } from "../../../../hooks/personnel-department/use-user-benefits";
import { calculateBenefitSplit } from "../../../../utils/benefit-discount";
import { getPositionMonthlySalary } from "../../../../utils/overtime-cost";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface BenefitEnrollmentsCardProps {
  benefit: Benefit;
  className?: string;
}

export function BenefitEnrollmentsCard({ benefit, className }: BenefitEnrollmentsCardProps) {
  const navigate = useNavigate();

  const { data: response, isLoading } = useUserBenefits({
    benefitIds: [benefit.id],
    // position.remunerations = salário-base (regra percentual do VT: % do salário)
    include: { user: { include: { position: { include: { remunerations: true } } } } },
    orderBy: { createdAt: "desc" },
    limit: 10,
  });

  const enrollments = response?.data || [];
  const totalRecords = response?.meta?.totalRecords || 0;

  const enrollmentsListUrl = `${routes.personnelDepartment.benefits.enrollments.root}?benefits=${benefit.id}`;

  return (
    <Card className={cn("shadow-sm border border-border", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2">
          <IconUsers className="h-5 w-5 text-muted-foreground" />
          Adesões {totalRecords > 0 ? `(${totalRecords})` : ""}
        </CardTitle>
        <Button variant="outline" size="sm" onClick={() => navigate(enrollmentsListUrl)}>
          Ver todas
          <IconArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : enrollments.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
            <IconUsers className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <div className="text-sm">Nenhuma adesão registrada para este benefício.</div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-bold uppercase">Colaborador</TableHead>
                <TableHead className="text-xs font-bold uppercase">Status</TableHead>
                <TableHead className="text-xs font-bold uppercase">Custo Total</TableHead>
                <TableHead className="text-xs font-bold uppercase">Empresa Paga</TableHead>
                <TableHead className="text-xs font-bold uppercase">Colaborador Paga</TableHead>
                <TableHead className="text-xs font-bold uppercase">Início</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {enrollments.map((enrollment) => {
                const baseSalary = getPositionMonthlySalary(enrollment.user?.position);
                const split = calculateBenefitSplit(
                  {
                    monthlyValue: enrollment.monthlyValue,
                    employeeDiscountValue: enrollment.employeeDiscountValue,
                    employeeDiscountPercent: enrollment.employeeDiscountPercent,
                    benefitKind: benefit.kind,
                  },
                  baseSalary,
                );
                const salaryKnown = !split.dependsOnSalary || baseSalary !== null;
                return (
                  <TableRow
                    key={enrollment.id}
                    className="cursor-pointer hover:bg-muted/20"
                    onClick={() => navigate(routes.personnelDepartment.benefits.enrollments.details(enrollment.id))}
                  >
                    <TableCell className="text-sm font-medium">{enrollment.user?.name || <span className="text-muted-foreground">-</span>}</TableCell>
                    <TableCell>
                      <Badge variant={getBadgeVariant(enrollment.status, "BENEFIT_ENROLLMENT")} className="text-xs whitespace-nowrap">
                        {BENEFIT_ENROLLMENT_STATUS_LABELS[enrollment.status as BENEFIT_ENROLLMENT_STATUS] || enrollment.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{formatCurrency(split.monthlyValue)}</TableCell>
                    <TableCell className="text-sm">{salaryKnown ? formatCurrency(split.companyShare) : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-sm">
                      {salaryKnown ? formatCurrency(split.employeeShare) : <span className="text-muted-foreground">{enrollment.employeeDiscountPercent}% do salário</span>}
                    </TableCell>
                    <TableCell className="text-sm">{enrollment.startDate ? formatDate(new Date(enrollment.startDate)) : "-"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
