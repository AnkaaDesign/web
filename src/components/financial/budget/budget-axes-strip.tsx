/**
 * A FAIXA DOS QUATRO EIXOS — no topo do orçamento.
 *
 * Valor · Arte (k de N veículos) · Assinatura · Cobrança: cada um com o estado e
 * o próximo passo, quando ele é da Ankaa. Embaixo, "Para emitir falta…", com o
 * que o portão de emissão da API recusa e um botão que leva aonde se resolve.
 *
 * A faixa não age: ela LEVA até o lugar do ato (`onNavigate`). Os atos moram
 * nos cartões (valor, arte, assinatura), que é onde ficam as confirmações.
 */
import { IconArrowRight, IconListCheck } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BudgetEmission } from "@/types/budget";
import {
  budgetAxes,
  emissionBlockerItems,
  type BudgetAxisTarget,
  type BudgetAxisTone,
} from "@/utils/budget-axes";
import type { ImplementArtState } from "@/utils/implement-art";

const TONE_VARIANT: Record<BudgetAxisTone, string> = {
  done: "completed",
  waiting: "teal",
  todo: "amber",
  blocked: "gray",
  off: "outline",
};

interface BudgetAxesStripProps {
  status?: string | null;
  signatureStatus?: string | null;
  billable?: boolean | null;
  emission?: BudgetEmission | null;
  artStates: readonly ImplementArtState[];
  /** Leva até o lugar da tela que resolve (cartão do valor, arte, assinatura…). */
  onNavigate?: (target: BudgetAxisTarget) => void;
  className?: string;
}

export function BudgetAxesStrip({
  status,
  signatureStatus,
  billable,
  emission,
  artStates,
  onNavigate,
  className,
}: BudgetAxesStripProps) {
  const axes = budgetAxes({ status, signatureStatus, billable, emission, artStates });
  const signatureDone = axes.find((axis) => axis.key === "signature")?.tone === "done";
  // Depois de assinado, o portão de emissão já não diz nada útil.
  const blockers = signatureDone ? [] : emissionBlockerItems(emission);

  return (
    <div className={cn("space-y-3 rounded-lg border border-border bg-card p-3", className)}>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {axes.map((axis) => (
          <div key={axis.key} className="flex min-w-0 flex-col gap-1.5 rounded-md border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-muted-foreground">{axis.title}</span>
            </div>
            <Badge variant={TONE_VARIANT[axis.tone] as any} className="w-fit max-w-full truncate">
              {axis.state}
            </Badge>
            {axis.hint && <p className="text-sm text-muted-foreground">{axis.hint}</p>}
            {axis.next && onNavigate && (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto w-fit gap-1 p-0"
                onClick={() => onNavigate(axis.next!.target)}
              >
                {axis.next.label}
                <IconArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {blockers.length > 0 && (
        <div className="rounded-md bg-muted/50 p-3">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <IconListCheck className="h-4 w-4 text-muted-foreground" />
            Para emitir para assinatura, falta:
          </p>
          <ul className="space-y-2">
            {blockers.map((blocker) => (
              <li key={blocker.code} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm">{blocker.message}</span>
                {blocker.action && onNavigate && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-fit shrink-0 gap-1"
                    onClick={() => onNavigate(blocker.action!.target)}
                  >
                    {blocker.action.label}
                    <IconArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
