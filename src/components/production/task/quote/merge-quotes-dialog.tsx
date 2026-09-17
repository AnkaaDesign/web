import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { IconAlertTriangle, IconArrowMerge, IconInfoCircle, IconLoader2 } from "@tabler/icons-react";
import { budgetService } from "@/api-client/budget";
import { budgetKeys } from "@/hooks/production/use-budget";
import { taskKeys } from "@/hooks";
import { toast } from "@/components/ui/sonner";

interface MergeVerdict {
  survivor: { id: string; budgetNumber: number } | null;
  absorbed: Array<{ id: string; budgetNumber: number; vehicleCount: number }>;
  vehicleCount: number;
  blockers: Array<{ code: string; message: string; budgetNumbers: number[] }>;
  warnings: Array<{ code: string; message: string; budgetNumbers: number[] }>;
}

interface MergeQuotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Os VEÍCULOS selecionados. O servidor deduplica por orçamento. */
  taskIds: string[];
  /** Chamado depois de unir, para a tela limpar a seleção. */
  onMerged?: () => void;
}

const pad = (n: number) => String(n).padStart(4, "0");

/**
 * SIMPLIFICAR ORÇAMENTO — o diálogo que mostra o veredito antes do ato.
 *
 * ⚠️ O VEREDITO VEM DO SERVIDOR, sempre, e nunca é calculado aqui. A linha da
 * Agenda carrega o total e o cliente; não carrega a lista de serviços, o desconto
 * nem as condições de pagamento — que é exatamente o que decide se dois
 * orçamentos podem virar um. Julgar no cliente com os dados da lista daria um
 * "pode" que o servidor recusaria depois, e o usuário aprenderia a não confiar no
 * botão.
 *
 * Por isso o diálogo abre em CARREGANDO e só então mostra o que vai acontecer:
 * qual número sobrevive, quais somem, quantos veículos ficam, o que impede e o
 * que muda sem impedir.
 *
 * A separação impedimento × aviso é a mesma do servidor, e é a que importa para
 * quem lê: impedimento é o que a união DESTRUIRIA (listas de serviço diferentes,
 * dinheiro já emitido, assinatura coletada); aviso é o que ela apenas DECIDE (a
 * validade que prevalece, os números que somem).
 */
export function MergeQuotesDialog({ open, onOpenChange, taskIds, onMerged }: MergeQuotesDialogProps) {
  const queryClient = useQueryClient();
  const [verdict, setVerdict] = useState<MergeVerdict | null>(null);
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || taskIds.length === 0) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setVerdict(null);
    budgetService
      .mergePreview(taskIds)
      .then((res: any) => {
        if (cancelled) return;
        setVerdict(res?.data?.data ?? res?.data ?? null);
      })
      .catch((e: any) => {
        if (cancelled) return;
        setError(e?.response?.data?.message || "Não foi possível conferir os orçamentos selecionados.");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, taskIds]);

  const handleMerge = useCallback(async () => {
    setMerging(true);
    try {
      const res: any = await budgetService.merge(taskIds);
      // As duas chaves, e não só a do orçamento: a lista de Orçamentos, a de
      // Faturamento, a Agenda e o Cronograma são todas consultas de TAREFA, e é
      // nelas que a união aparece (N linhas viram N linhas do mesmo número).
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: budgetKeys.all }),
        queryClient.invalidateQueries({ queryKey: taskKeys.all }),
        queryClient.invalidateQueries({ queryKey: ["billings"] }),
      ]);
      toast.success(res?.data?.message || "Orçamentos unidos.");
      onMerged?.();
      onOpenChange(false);
    } catch {
      // O interceptor já mostrou o motivo; manter o diálogo aberto deixa o
      // usuário ler qual orçamento travou sem refazer a seleção.
    } finally {
      setMerging(false);
    }
  }, [taskIds, queryClient, onMerged, onOpenChange]);

  const blocked = !!verdict?.blockers.length || !!error;
  const total = verdict ? verdict.absorbed.length + 1 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconArrowMerge className="h-5 w-5" />
            Simplificar orçamento
          </DialogTitle>
          <DialogDescription>
            Junta os orçamentos dos veículos selecionados num só — um documento e uma cerimônia de
            assinatura, em vez de um por caminhão.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <IconLoader2 className="h-4 w-4 animate-spin" />
            Conferindo os orçamentos…
          </div>
        )}

        {!loading && error && (
          <Alert variant="destructive">
            <IconAlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!loading && verdict && (
          <div className="space-y-4">
            {verdict.survivor && !verdict.blockers.length && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-muted-foreground">{total} orçamentos viram</span>
                  <Badge variant="completed" className="tabular-nums">
                    Nº {pad(verdict.survivor.budgetNumber)}
                  </Badge>
                  <span className="text-muted-foreground">
                    com {verdict.vehicleCount} {verdict.vehicleCount === 1 ? "veículo" : "veículos"}.
                  </span>
                </div>
                {verdict.absorbed.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span>Deixam de existir:</span>
                    {verdict.absorbed.map((a) => (
                      <span key={a.id} className="rounded bg-background px-1.5 py-0.5 tabular-nums">
                        Nº {pad(a.budgetNumber)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {verdict.blockers.length > 0 && (
              <div className="space-y-2">
                {verdict.blockers.map((b) => (
                  <Alert key={b.code} variant="destructive">
                    <IconAlertTriangle className="h-4 w-4" />
                    <AlertDescription className="text-sm">{b.message}</AlertDescription>
                  </Alert>
                ))}
              </div>
            )}

            {!verdict.blockers.length && verdict.warnings.length > 0 && (
              <div className="space-y-1.5">
                {verdict.warnings.map((w) => (
                  <div key={w.code} className="flex gap-2 text-xs text-muted-foreground">
                    <IconInfoCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>{w.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={merging}>
            Cancelar
          </Button>
          <Button onClick={handleMerge} disabled={loading || blocked || merging}>
            {merging && <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />}
            {merging ? "Unindo…" : "Simplificar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
