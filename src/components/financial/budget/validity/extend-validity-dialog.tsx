import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { IconCalendarPlus, IconLoader2 } from "@tabler/icons-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { budgetService } from "@/api-client/budget";
import { budgetKeys } from "@/hooks/production/use-budget";
import { taskKeys } from "@/hooks";
import { toast } from "@/components/ui/sonner";
import { formatDate } from "@/utils";
import { cn } from "@/lib/utils";
import { daysFromToday, isQuoteValidityExpired } from "./validity";
import { ValidityPicker } from "./validity-picker";

export interface ExtendValidityQuote {
  id: string;
  budgetNumber: number;
  expiresAt: Date | string | null;
  status: string;
}

interface ExtendValidityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quotes: ExtendValidityQuote[];
  onExtended?: () => void;
}

const pad = (n: number) => String(n).padStart(4, "0");

/**
 * ESTENDER A VALIDADE EM LOTE, a partir da lista de Orçamentos.
 *
 * O formulário tem o próprio campo (`ValidityField`), que grava no Salvar. Este
 * diálogo existe para o caso que o formulário não cobre: vários orçamentos
 * vencidos de uma vez. Grava direto (`PUT /budgets/:id/validity`), então vale
 * com o faturamento aprovado, estende também a cerimônia de assinatura em
 * andamento e devolve a Pendente o orçamento em "Aguardando Reanálise".
 *
 * As opções são as do `ValidityPicker`, sem "estender a atual": cada orçamento
 * selecionado tem a sua, e uma data só não soma sobre várias.
 */
export function ExtendValidityDialog({ open, onOpenChange, quotes, onExtended }: ExtendValidityDialogProps) {
  const queryClient = useQueryClient();
  const [novaData, setNovaData] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setNovaData(null);
  }, [open]);

  const alvo = quotes.filter((q) => q.status !== "CANCELLED");
  const reanalise = alvo.filter((q) => q.status === "EXPIRED").length;

  const handleExtend = useCallback(async () => {
    if (!novaData) return;
    // A rota conta dias a partir de hoje; a data escolhida vira essa contagem.
    const days = Math.max(1, daysFromToday(novaData));
    setSaving(true);
    let ok = 0;
    const falhas: number[] = [];
    try {
      // Sequencial: uma falha (orçamento que mudou de estado entre a lista e o
      // clique) não derruba os outros.
      for (const q of alvo) {
        try {
          await budgetService.extendValidity(q.id, days);
          ok++;
        } catch {
          falhas.push(q.budgetNumber);
        }
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: budgetKeys.all }),
        queryClient.invalidateQueries({ queryKey: taskKeys.all }),
      ]);
      if (ok > 0) {
        toast.success(
          ok === 1 ? `Validade estendida até ${formatDate(novaData)}.` : `${ok} orçamentos valem até ${formatDate(novaData)}.`,
        );
      }
      if (falhas.length === 0) {
        onExtended?.();
        onOpenChange(false);
      }
    } finally {
      setSaving(false);
    }
  }, [alvo, novaData, queryClient, onExtended, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconCalendarPlus className="h-5 w-5" />
            Estender validade
          </DialogTitle>
          <DialogDescription>
            {alvo.length === 1 ? "Escolha a nova validade do orçamento." : `Uma nova validade para os ${alvo.length} orçamentos.`}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 sm:grid-cols-[1fr_auto]">
          {/* ESQUERDA: o que muda, antes e depois. */}
          <div className="flex min-w-0 flex-col gap-3">
            <div className="max-h-72 overflow-y-auto rounded-md border">
              <div className="grid grid-cols-[auto_1fr_auto] gap-x-3 border-b bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                <span>Nº</span>
                <span>Validade atual</span>
                <span>Nova</span>
              </div>
              {alvo.map((q) => {
                const vencida = isQuoteValidityExpired(q.expiresAt);
                return (
                  <div key={q.id} className="grid grid-cols-[auto_1fr_auto] gap-x-3 px-3 py-1.5 text-sm tabular-nums">
                    <span>{pad(q.budgetNumber)}</span>
                    <span className={cn(vencida ? "text-destructive" : "text-muted-foreground")}>
                      {q.expiresAt ? formatDate(q.expiresAt) : "—"}
                      {vencida && " (vencida)"}
                    </span>
                    <span className={cn(novaData ? "font-medium" : "text-muted-foreground")}>
                      {novaData ? formatDate(novaData) : "—"}
                    </span>
                  </div>
                );
              })}
              {alvo.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">Orçamento cancelado não tem validade a estender.</div>
              )}
            </div>

            {reanalise > 0 && (
              <p className="text-xs text-muted-foreground">
                {reanalise === 1
                  ? "O orçamento em Aguardando Reanálise volta para Pendente."
                  : `${reanalise} orçamentos em Aguardando Reanálise voltam para Pendente.`}
              </p>
            )}
          </div>

          {/* DIREITA: as mesmas opções do campo do formulário. */}
          <ValidityPicker className="sm:w-[280px]" current={alvo.length === 1 && alvo[0].expiresAt ? new Date(alvo[0].expiresAt) : null} selected={novaData} onPick={setNovaData} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleExtend} disabled={saving || !novaData || alvo.length === 0}>
            {saving && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
            {saving ? "Estendendo…" : "Estender"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
