/**
 * A APROVAÇÃO DO VALOR VIGENTE — quem aprovou, quando, por onde e com que nota.
 *
 * O valor aprovado (Modelo C) é um ATO com autor: pelo cliente no portal, em nome
 * dele (com a nota de como ele aprovou), pela assinatura, ou herdado do legado.
 * Este cartão mostra esse registro (`GET /budgets/:id → valueApproval`) e é o
 * lugar de desfazê-lo ("Reprovar valor", com motivo): o orçamento volta a
 * Pendente e a aprovação fica encerrada na trilha.
 */
import { useState } from "react";
import { IconCircleCheck } from "@tabler/icons-react";

import { ArtNoteDialog, type ArtNoteDialogConfig } from "@/components/production/implement-art/art-note-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BUDGET_VALUE_APPROVAL_SOURCE_LABELS } from "@/constants/budget-contract";
import { SECTOR_PRIVILEGES, TASK_QUOTE_STATUS } from "@/constants/enums";
import { useRevokeBudgetValueApproval } from "@/hooks/production/use-budget";
import type { BudgetValueApproval } from "@/types/budget";
import { formatDateTime } from "@/utils/date";
import { formatCurrency } from "@/utils/number";

const REVOKE_DIALOG: ArtNoteDialogConfig = {
  title: "Reprovar valor",
  description:
    "O orçamento volta para Pendente e a aprovação do valor é encerrada. Se a coleta de assinaturas já saiu, ela deixa de valer. O motivo é obrigatório.",
  placeholder: "Motivo da reprovação",
  confirm: "Reprovar valor",
  destructive: true,
};

/** Quem pode desfazer a aprovação: os mesmos `@Roles` de `DELETE /budgets/:id/value-approval`. */
const CAN_REVOKE = new Set<string>([SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.COMMERCIAL]);

interface BudgetValueApprovalCardProps {
  budgetId?: string | null;
  status?: string | null;
  valueApproval?: BudgetValueApproval | null;
  userRole?: string;
  disabled?: boolean;
  /** Há alterações por salvar: o ato vale sobre o gravado. */
  hasUnsavedChanges?: boolean;
  /** Âncora para a faixa dos eixos. */
  anchorId?: string;
}

export function BudgetValueApprovalCard({
  budgetId,
  status,
  valueApproval,
  userRole = "",
  disabled,
  hasUnsavedChanges,
  anchorId,
}: BudgetValueApprovalCardProps) {
  const revoke = useRevokeBudgetValueApproval();
  const [open, setOpen] = useState(false);

  if (!budgetId || status !== TASK_QUOTE_STATUS.APPROVED || !valueApproval) return null;
  const canRevoke = CAN_REVOKE.has(userRole);

  const confirm = (reason: string) => {
    void revoke
      .mutateAsync({ id: budgetId, reason })
      .then(() => setOpen(false))
      .catch(() => undefined);
  };

  return (
    <Card id={anchorId} className="mb-4 border border-border">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <IconCircleCheck className="h-4 w-4 text-muted-foreground" />
            Valor aprovado
            {valueApproval.total != null && <span className="font-normal">· {formatCurrency(valueApproval.total)}</span>}
          </p>
          <p className="text-sm text-muted-foreground">
            {BUDGET_VALUE_APPROVAL_SOURCE_LABELS[valueApproval.source] ?? valueApproval.source}
            {valueApproval.by?.name ? ` · ${valueApproval.by.name}` : ""} · {formatDateTime(valueApproval.at)}
          </p>
          {valueApproval.note && <p className="text-sm italic">"{valueApproval.note}"</p>}
        </div>
        {canRevoke && (
          <div className="shrink-0 space-y-1">
            <Button
              type="button"
              variant="outline"
              disabled={disabled || revoke.isPending || hasUnsavedChanges}
              onClick={() => setOpen(true)}
            >
              Reprovar valor
            </Button>
            {hasUnsavedChanges && <p className="text-sm text-muted-foreground">Salve antes.</p>}
          </div>
        )}
      </CardContent>
      <ArtNoteDialog
        config={open ? REVOKE_DIALOG : null}
        busy={revoke.isPending}
        onCancel={() => setOpen(false)}
        onConfirm={confirm}
      />
    </Card>
  );
}
