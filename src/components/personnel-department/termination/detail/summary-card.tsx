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
import { DetailRow } from "@/components/ui/detail-row";

interface SummaryCardProps {
  termination: Termination;
  className?: string;
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
      <CardContent className="pt-0">
        <div className="space-y-2">
          <DetailRow
            label="Colaborador"
            value={
              termination.user ? (
                <Link
                  to={routes.administration.collaborators.details(termination.userId)}
                  className="text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {termination.user.name}
                </Link>
              ) : (
                "-"
              )
            }
          />

          {termination.user?.position?.name && <DetailRow label="Cargo" value={termination.user.position.name} />}
          {termination.user?.sector?.name && <DetailRow label="Setor" value={termination.user.sector.name} />}

          <DetailRow
            label="Tipo"
            value={
              <Badge variant="secondary" className="text-xs">
                {TERMINATION_TYPE_LABELS[termination.type] || termination.type}
              </Badge>
            }
          />

          <DetailRow
            label="Status"
            value={
              <Badge variant={getBadgeVariantFromStatus(termination.status, "TERMINATION")} className="text-xs">
                {TERMINATION_STATUS_LABELS[termination.status] || termination.status}
              </Badge>
            }
          />

          <DetailRow label="Aviso Prévio" value={termination.noticeType ? NOTICE_TYPE_LABELS[termination.noticeType] : "-"} />

          <DetailRow label="Dias de Aviso" value={termination.noticeDays ?? "-"} />

          {termination.noticeReduction && termination.noticeReduction !== NOTICE_REDUCTION.NONE && (
            <DetailRow label="Redução do Aviso" value={NOTICE_REDUCTION_LABELS[termination.noticeReduction]} />
          )}

          <DetailRow label="Início do Aviso" value={termination.noticeStartDate ? formatDate(new Date(termination.noticeStartDate)) : "-"} />

          <DetailRow label="Data da Rescisão" value={termination.terminationDate ? formatDate(new Date(termination.terminationDate)) : "-"} />

          <DetailRow label="Último Dia Trabalhado" value={termination.lastWorkingDate ? formatDate(new Date(termination.lastWorkingDate)) : "-"} />

          <DetailRow label="Projeção do Contrato" value={termination.projectedEndDate ? formatDate(new Date(termination.projectedEndDate)) : "-"} />

          <DetailRow
            label="Prazo de Pagamento"
            value={
              termination.paymentDueDate ? (
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
              )
            }
          />

          {termination.type === TERMINATION_TYPE.WITH_CAUSE && <DetailRow label="Artigo" value={termination.justCauseArticle || "-"} />}

          {termination.reason && <DetailRow label="Motivo" value={termination.reason} block />}

          <DetailRow label="Iniciada por" value={termination.initiatedBy?.name || "-"} />
        </div>
      </CardContent>
    </Card>
  );
}
