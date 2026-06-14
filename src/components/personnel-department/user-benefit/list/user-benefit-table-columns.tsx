import React from "react";
import { formatCurrency, formatDate } from "../../../../utils";
import { BENEFIT_KIND, BENEFIT_KIND_LABELS, BENEFIT_ENROLLMENT_STATUS_LABELS, getBadgeVariant } from "../../../../constants";
import type { BENEFIT_ENROLLMENT_STATUS } from "../../../../constants";
import { Badge } from "@/components/ui/badge";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import type { UserBenefit } from "../../../../types/benefit";
import { getKindSplitTooltip } from "../../benefit/discount-caps";
import { calculateBenefitSplit, type BenefitShareSplit } from "../../../../utils/benefit-discount";
import { getPositionMonthlySalary } from "../../../../utils/overtime-cost";

export interface UserBenefitColumn {
  key: string;
  header: string;
  accessor: (userBenefit: UserBenefit) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

const formatPercent = (percentage: number): string => {
  const formatted = percentage.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return `${formatted}%`;
};

// Canonical split, salary-aware: VT percent rule discounts % of the BASE
// SALARY (capped at the VT cost); other kinds discount % of the benefit cost.
// Returns salaryKnown=false when the share depends on a salary we don't have.
const getRowSplit = (userBenefit: UserBenefit): BenefitShareSplit & { salaryKnown: boolean } => {
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
  return { ...split, salaryKnown: !split.dependsOnSalary || baseSalary !== null };
};

export const createUserBenefitColumns = (): UserBenefitColumn[] => [
  // Colaborador
  {
    key: "user.name",
    header: "COLABORADOR",
    accessor: (userBenefit: UserBenefit) => (
      <div className="text-sm font-medium truncate">
        {userBenefit.user?.name ? <TruncatedTextWithTooltip text={userBenefit.user.name} /> : <span className="text-muted-foreground">-</span>}
      </div>
    ),
    sortable: false,
    // table-layout:fixed ignora min-width — é o `w-` que define a largura da coluna.
    className: "w-[360px] min-w-[360px]",
    align: "left",
  },

  // Benefício
  {
    key: "benefit.name",
    header: "BENEFÍCIO",
    accessor: (userBenefit: UserBenefit) =>
      userBenefit.benefit ? (
        <Badge variant="secondary" className="text-xs whitespace-nowrap">
          {BENEFIT_KIND_LABELS[userBenefit.benefit.kind] || userBenefit.benefit.kind}
        </Badge>
      ) : (
        <span className="text-sm text-muted-foreground">-</span>
      ),
    sortable: false,
    align: "left",
  },

  // Status
  {
    key: "status",
    header: "STATUS",
    accessor: (userBenefit: UserBenefit) => (
      <Badge variant={getBadgeVariant(userBenefit.status, "BENEFIT_ENROLLMENT")} className="text-xs whitespace-nowrap">
        {BENEFIT_ENROLLMENT_STATUS_LABELS[userBenefit.status as BENEFIT_ENROLLMENT_STATUS] || userBenefit.status}
      </Badge>
    ),
    sortable: true,
    className: "min-w-[120px]",
    align: "left",
  },

  // Valor Mensal (custo total: empresa + colaborador)
  {
    key: "monthlyValue",
    header: "VALOR MENSAL",
    accessor: (userBenefit: UserBenefit) => (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="text-sm truncate cursor-help">{formatCurrency(userBenefit.monthlyValue)}</div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">Custo total do benefício (parte da empresa + parte do colaborador)</p>
        </TooltipContent>
      </Tooltip>
    ),
    sortable: true,
    className: "min-w-[130px]",
    align: "left",
  },

  // Empresa paga (custo total − desconto do colaborador)
  {
    key: "companyPays",
    header: "EMPRESA PAGA",
    accessor: (userBenefit: UserBenefit) => {
      const split = getRowSplit(userBenefit);
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="text-sm truncate cursor-help">
              {split.salaryKnown ? formatCurrency(split.companyShare) : <span className="text-muted-foreground">depende do salário</span>}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-xs">{getKindSplitTooltip(userBenefit.benefit?.kind)}</p>
          </TooltipContent>
        </Tooltip>
      );
    },
    sortable: false,
    className: "min-w-[130px]",
    align: "left",
  },

  // Colaborador paga (desconto resolvido: valor fixo OU percentual × custo)
  {
    key: "employeePays",
    header: "COLABORADOR PAGA",
    accessor: (userBenefit: UserBenefit) => {
      const split = getRowSplit(userBenefit);
      const hasPercentRule = userBenefit.employeeDiscountPercent !== null && userBenefit.employeeDiscountPercent !== undefined;
      const hasFixedRule = userBenefit.employeeDiscountValue !== null && userBenefit.employeeDiscountValue !== undefined;

      let display: React.ReactNode;
      if (hasPercentRule) {
        // Stored percent: keep the "do salário"/"do custo" qualifier.
        const qualifier = split.dependsOnSalary ? " do salário" : " do custo";
        display = `${formatPercent(userBenefit.employeeDiscountPercent!)}${qualifier}`;
      } else if (hasFixedRule) {
        // Fixed R$ value: no stored percent, derive percentage of cost.
        const pct = userBenefit.monthlyValue > 0 ? Math.round((split.employeeShare / userBenefit.monthlyValue) * 100) : 0;
        display = `${formatPercent(pct)} do custo`;
      } else {
        // No discount: company pays all.
        display = <span className="text-muted-foreground">0%</span>;
      }

      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="text-sm truncate cursor-help">{display}</div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-xs">{getKindSplitTooltip(userBenefit.benefit?.kind)}</p>
          </TooltipContent>
        </Tooltip>
      );
    },
    sortable: false,
    className: "min-w-[110px]",
    align: "left",
  },

  // Início
  {
    key: "startDate",
    header: "INÍCIO",
    accessor: (userBenefit: UserBenefit) => (
      <div className="text-sm truncate">{userBenefit.startDate ? formatDate(new Date(userBenefit.startDate)) : <span className="text-muted-foreground">-</span>}</div>
    ),
    sortable: true,
    className: "min-w-[120px]",
    align: "left",
  },

  // Fim
  {
    key: "endDate",
    header: "FIM",
    accessor: (userBenefit: UserBenefit) => (
      <div className="text-sm truncate">{userBenefit.endDate ? formatDate(new Date(userBenefit.endDate)) : <span className="text-muted-foreground">—</span>}</div>
    ),
    sortable: true,
    className: "min-w-[120px]",
    align: "left",
  },

  // Passagens/Dia (apenas Vale Transporte)
  {
    key: "dailyTickets",
    header: "PASSAGENS/DIA",
    accessor: (userBenefit: UserBenefit) => {
      if (userBenefit.benefit?.kind !== BENEFIT_KIND.TRANSPORT_VOUCHER) {
        return <span className="text-sm text-muted-foreground">—</span>;
      }
      return (
        <div className="text-sm truncate">
          {userBenefit.dailyTickets !== null && userBenefit.dailyTickets !== undefined ? userBenefit.dailyTickets : <span className="text-muted-foreground">-</span>}
        </div>
      );
    },
    sortable: true,
    className: "min-w-[130px]",
    align: "left",
  },

  // Parcelas (convênios parcelados) — opcional, não visível por padrão
  {
    key: "installments",
    header: "PARCELAS",
    accessor: (userBenefit: UserBenefit) =>
      userBenefit.totalInstallments != null ? (
        <div className="text-sm truncate">
          {userBenefit.currentInstallment ?? 1}/{userBenefit.totalInstallments}
        </div>
      ) : (
        <span className="text-sm text-muted-foreground">—</span>
      ),
    sortable: false,
    className: "min-w-[100px]",
    align: "left",
  },

  // Criado Em
  {
    key: "createdAt",
    header: "CRIADO EM",
    accessor: (userBenefit: UserBenefit) => (
      <div className="text-sm truncate">{userBenefit.createdAt ? formatDate(new Date(userBenefit.createdAt)) : <span className="text-muted-foreground">-</span>}</div>
    ),
    sortable: true,
    className: "min-w-[140px]",
    align: "left",
  },
];

// Export the default visible columns
export const DEFAULT_USER_BENEFIT_VISIBLE_COLUMNS = new Set(["user.name", "benefit.name", "status", "monthlyValue", "companyPays", "employeePays", "startDate", "endDate", "dailyTickets"]);
