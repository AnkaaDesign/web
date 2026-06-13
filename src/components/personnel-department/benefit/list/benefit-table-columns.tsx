import React from "react";
import { formatCurrency, formatDate } from "../../../../utils";
import { BENEFIT_KIND_LABELS } from "../../../../constants";
import type { BENEFIT_KIND } from "../../../../constants";
import { Badge } from "@/components/ui/badge";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import type { Benefit } from "../../../../types/benefit";
import { getKindSplitTooltip } from "../discount-caps";
import { calculateBenefitSplit } from "../../../../utils/benefit-discount";

// Split padrão do catálogo (regra canônica). Para Vale Transporte o percentual
// incide sobre o SALÁRIO de cada colaborador, então o catálogo não tem como
// estimar um valor — dependsOnSalary=true sinaliza isso.
const getDefaultSplit = (benefit: Benefit) =>
  calculateBenefitSplit({
    monthlyValue: benefit.defaultValue ?? 0,
    employeeDiscountValue: null,
    employeeDiscountPercent: benefit.defaultEmployeeDiscountPercent,
    benefitKind: benefit.kind,
  });

export interface BenefitColumn {
  key: string;
  header: string;
  accessor: (benefit: Benefit) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  align?: "left" | "center" | "right";
}

export const formatPercent = (percentage: number): string => {
  const formatted = percentage.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return `${formatted}%`;
};

export const createBenefitColumns = (): BenefitColumn[] => [
  // Tipo
  {
    key: "kind",
    header: "TIPO",
    accessor: (benefit: Benefit) => (
      <Badge variant="secondary" className="text-xs whitespace-nowrap">
        {BENEFIT_KIND_LABELS[benefit.kind as BENEFIT_KIND] || benefit.kind}
      </Badge>
    ),
    sortable: true,
    className: "min-w-[160px]",
    align: "left",
  },

  // Nome
  {
    key: "name",
    header: "NOME",
    accessor: (benefit: Benefit) => (
      <div className="text-sm font-medium truncate">
        <TruncatedTextWithTooltip text={benefit.name} />
      </div>
    ),
    sortable: true,
    className: "min-w-[200px]",
    align: "left",
  },

  // Fornecedor
  {
    key: "provider",
    header: "FORNECEDOR",
    accessor: (benefit: Benefit) => (
      <div className="text-sm truncate">{benefit.provider ? <TruncatedTextWithTooltip text={benefit.provider} /> : <span className="text-muted-foreground">-</span>}</div>
    ),
    sortable: true,
    className: "min-w-[180px]",
    align: "left",
  },

  // Custo padrão (empresa + colaborador)
  {
    key: "defaultValue",
    header: "CUSTO PADRÃO",
    accessor: (benefit: Benefit) => (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="text-sm truncate cursor-help">
            {benefit.defaultValue !== null && benefit.defaultValue !== undefined ? formatCurrency(benefit.defaultValue) : <span className="text-muted-foreground">-</span>}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">Custo mensal total padrão do benefício (parte da empresa + parte do colaborador)</p>
        </TooltipContent>
      </Tooltip>
    ),
    sortable: true,
    className: "min-w-[140px]",
    align: "left",
  },

  // Colaborador paga (padrão)
  {
    key: "defaultEmployeeDiscountPercent",
    header: "COLABORADOR PAGA (PADRÃO)",
    accessor: (benefit: Benefit) => {
      if (benefit.defaultEmployeeDiscountPercent === null || benefit.defaultEmployeeDiscountPercent === undefined) {
        return <span className="text-sm text-muted-foreground">-</span>;
      }
      const split = getDefaultSplit(benefit);
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="text-sm truncate cursor-help">
              {formatPercent(benefit.defaultEmployeeDiscountPercent)}
              {split.dependsOnSalary ? (
                <span className="text-xs text-muted-foreground ml-1">do salário</span>
              ) : (
                benefit.defaultValue !== null &&
                benefit.defaultValue !== undefined && <span className="text-xs text-muted-foreground ml-1">(≈ {formatCurrency(split.employeeShare)})</span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-xs">{getKindSplitTooltip(benefit.kind)}</p>
          </TooltipContent>
        </Tooltip>
      );
    },
    sortable: true,
    className: "min-w-[180px]",
    align: "left",
  },

  // Empresa paga (padrão) — computed from the defaults when both are set
  {
    key: "defaultCompanyPays",
    header: "EMPRESA PAGA (PADRÃO)",
    accessor: (benefit: Benefit) => {
      if (benefit.defaultValue === null || benefit.defaultValue === undefined) {
        return <span className="text-sm text-muted-foreground">-</span>;
      }
      const split = getDefaultSplit(benefit);
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="text-sm truncate cursor-help">
              {split.dependsOnSalary ? <span className="text-muted-foreground">depende do salário</span> : formatCurrency(split.companyShare)}
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-xs">{getKindSplitTooltip(benefit.kind)}</p>
          </TooltipContent>
        </Tooltip>
      );
    },
    sortable: false,
    className: "min-w-[160px]",
    align: "left",
  },

  // Status
  {
    key: "isActive",
    header: "STATUS",
    accessor: (benefit: Benefit) => (
      <Badge variant={benefit.isActive ? "active" : "inactive"} className="text-xs whitespace-nowrap">
        {benefit.isActive ? "Ativo" : "Inativo"}
      </Badge>
    ),
    sortable: true,
    className: "min-w-[110px]",
    align: "left",
  },

  // Adesões
  {
    key: "enrollmentsCount",
    header: "ADESÕES",
    accessor: (benefit: Benefit) => (
      <Badge variant="default" className="w-10">
        {benefit._count?.enrollments ?? 0}
      </Badge>
    ),
    sortable: false,
    className: "min-w-[110px]",
    align: "left",
  },

  // Criado Em
  {
    key: "createdAt",
    header: "CRIADO EM",
    accessor: (benefit: Benefit) => (
      <div className="text-sm truncate">{benefit.createdAt ? formatDate(new Date(benefit.createdAt)) : <span className="text-muted-foreground">-</span>}</div>
    ),
    sortable: true,
    className: "min-w-[140px]",
    align: "left",
  },
];

// Export the default visible columns
export const DEFAULT_BENEFIT_VISIBLE_COLUMNS = new Set([
  "kind",
  "name",
  "provider",
  "defaultValue",
  "defaultEmployeeDiscountPercent",
  "defaultCompanyPays",
  "isActive",
  "enrollmentsCount",
]);
