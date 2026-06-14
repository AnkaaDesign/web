import React from "react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { TruncatedTextWithTooltip } from "@/components/ui/truncated-text-with-tooltip";
import { formatCurrency } from "@/utils";
import type { Discount } from "@/types/payroll";

export interface LoanColumn {
  key: string;
  header: string;
  accessor: (loan: Discount) => React.ReactNode;
  className?: string;
  align?: "left" | "center" | "right";
}

/** Per-row helper: resolves the numeric value of a Discount.value (DecimalValue | number | null). */
function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "toNumber" in (value as any) && typeof (value as any).toNumber === "function") {
    return (value as any).toNumber();
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const MODALITY_LABELS: Record<string, { label: string; variant: BadgeProps["variant"] }> = {
  COMPANY: { label: "Empresa", variant: "secondary" },
  PAYROLL_CONSIGNED: { label: "Consignado", variant: "blue" },
};

const TYPE_LABELS: Record<string, string> = {
  LOAN: "Empréstimo",
  ADVANCE: "Adiantamento",
};

export function createLoanColumns(): LoanColumn[] {
  return [
    {
      key: "user",
      header: "COLABORADOR",
      className: "min-w-[300px]",
      align: "left",
      accessor: (loan) => (
        <TruncatedTextWithTooltip text={loan.user?.name ?? "—"} className="font-medium" />
      ),
    },
    {
      key: "modality",
      header: "MODALIDADE",
      align: "left",
      accessor: (loan) => {
        const meta = MODALITY_LABELS[loan.loanKind ?? "COMPANY"] ?? MODALITY_LABELS.COMPANY;
        return <Badge variant={meta.variant}>{meta.label}</Badge>;
      },
    },
    {
      key: "type",
      header: "TIPO",
      align: "left",
      accessor: (loan) => TYPE_LABELS[loan.discountType ?? "LOAN"] ?? loan.discountType ?? "—",
    },
    {
      key: "lender",
      header: "CREDOR",
      align: "left",
      accessor: (loan) => loan.lenderName?.trim() || "—",
    },
    {
      key: "installmentValue",
      header: "VALOR DA PARCELA",
      align: "right",
      accessor: (loan) => formatCurrency(toNumber(loan.value)),
    },
    {
      key: "installments",
      header: "PARCELAS",
      align: "center",
      accessor: (loan) => `${loan.currentInstallment ?? 0}/${loan.totalInstallments ?? 0}`,
    },
    {
      key: "startCompetence",
      header: "COMPETÊNCIA INICIAL",
      align: "center",
      accessor: (loan) => loan.startCompetence ?? "—",
    },
    {
      key: "status",
      header: "STATUS",
      align: "center",
      accessor: (loan) =>
        loan.isActive === false ? (
          <Badge variant="muted">Quitado</Badge>
        ) : (
          <Badge variant="active">Ativo</Badge>
        ),
    },
  ];
}
