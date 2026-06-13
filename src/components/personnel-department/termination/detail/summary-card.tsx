import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, getBadgeVariantFromStatus } from "@/components/ui/badge";
import { IconUserOff } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import {
  routes,
  TERMINATION_TYPE,
  TERMINATION_TYPE_LABELS,
  TERMINATION_STATUS_LABELS,
  NOTICE_TYPE_LABELS,
  NOTICE_REDUCTION,
  NOTICE_REDUCTION_LABELS,
} from "../../../../constants";
import { formatDate } from "../../../../utils";
import type { Termination } from "../../../../types/termination";
import { isPaymentOverdue } from "../list/termination-table-columns";

interface SummaryCardProps {
  termination: Termination;
  className?: string;
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5">
      <span className="text-sm text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-right">{children}</span>
    </div>
  );
}

export function SummaryCard({ termination, className }: SummaryCardProps) {
  const overdue = isPaymentOverdue(termination);

  return (
    <Card className={cn("shadow-sm border border-border", className)}>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <IconUserOff className="h-5 w-5 text-muted-foreground" />
          Resumo
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 divide-y divide-border/50">
        <SummaryRow label="Colaborador">
          {termination.user ? (
            <Link
              to={routes.administration.collaborators.details(termination.userId)}
              className="text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              {termination.user.name}
            </Link>
          ) : (
            "-"
          )}
        </SummaryRow>

        {termination.user?.position?.name && <SummaryRow label="Cargo">{termination.user.position.name}</SummaryRow>}
        {termination.user?.sector?.name && <SummaryRow label="Setor">{termination.user.sector.name}</SummaryRow>}

        <SummaryRow label="Tipo">
          <Badge variant="secondary" className="text-xs">
            {TERMINATION_TYPE_LABELS[termination.type] || termination.type}
          </Badge>
        </SummaryRow>

        <SummaryRow label="Status">
          <Badge variant={getBadgeVariantFromStatus(termination.status, "TERMINATION")} className="text-xs">
            {TERMINATION_STATUS_LABELS[termination.status] || termination.status}
          </Badge>
        </SummaryRow>

        <SummaryRow label="Aviso Prévio">{termination.noticeType ? NOTICE_TYPE_LABELS[termination.noticeType] : "-"}</SummaryRow>

        <SummaryRow label="Dias de Aviso">{termination.noticeDays ?? "-"}</SummaryRow>

        {termination.noticeReduction && termination.noticeReduction !== NOTICE_REDUCTION.NONE && (
          <SummaryRow label="Redução do Aviso">{NOTICE_REDUCTION_LABELS[termination.noticeReduction]}</SummaryRow>
        )}

        <SummaryRow label="Início do Aviso">{termination.noticeStartDate ? formatDate(new Date(termination.noticeStartDate)) : "-"}</SummaryRow>

        <SummaryRow label="Data da Rescisão">{termination.terminationDate ? formatDate(new Date(termination.terminationDate)) : "-"}</SummaryRow>

        <SummaryRow label="Último Dia Trabalhado">{termination.lastWorkingDate ? formatDate(new Date(termination.lastWorkingDate)) : "-"}</SummaryRow>

        <SummaryRow label="Projeção do Contrato">{termination.projectedEndDate ? formatDate(new Date(termination.projectedEndDate)) : "-"}</SummaryRow>

        <SummaryRow label="Prazo de Pagamento">
          {termination.paymentDueDate ? (
            <span className="inline-flex items-center gap-2">
              <span className={overdue ? "text-destructive font-medium" : undefined}>{formatDate(new Date(termination.paymentDueDate))}</span>
              {overdue && (
                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                  Atrasado
                </Badge>
              )}
            </span>
          ) : (
            "-"
          )}
        </SummaryRow>

        {termination.type === TERMINATION_TYPE.WITH_CAUSE && <SummaryRow label="Artigo">{termination.justCauseArticle || "-"}</SummaryRow>}

        {termination.reason && (
          <div className="py-1.5">
            <span className="text-sm text-muted-foreground">Motivo</span>
            <p className="text-sm font-medium mt-1 whitespace-pre-wrap">{termination.reason}</p>
          </div>
        )}

        <SummaryRow label="Iniciada por">{termination.initiatedBy?.name || "-"}</SummaryRow>
      </CardContent>
    </Card>
  );
}
