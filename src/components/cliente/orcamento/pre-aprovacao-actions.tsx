// web/src/components/cliente/orcamento/pre-aprovacao-actions.tsx
//
// A DECISÃO DO CLIENTE — as duas únicas escritas do portal sobre um orçamento.
//
// `IN_NEGOTIATION` é o estado em que a bola está com o vendedor do CLIENTE: o
// preço foi montado e alguém do lado de lá precisa dizer "segue" ou "refaz".
// Daqui saem os dois caminhos:
//
//   pré-aprovar → `PRE_APPROVED`, e a Ankaa emite o documento para assinatura;
//   recusar     → `REQUESTED`,    e o orçamento volta para o comercial refazer.
//
// ⛔ A RECUSA NÃO É UM CANCELAMENTO, e esta é a frase que o diálogo precisa
// deixar impossível de ler errado. `CANCELLED` é um estado terminal do qual não
// se sai (`CANCELLED → ∅` na tabela de transições). `REQUESTED` é o começo:
// o orçamento continua vivo, volta para a mesa do comercial e é REFEITO. Quem
// clica em "Recusar" achando que está desistindo do serviço está errado por um
// estado inteiro — e é a única ação do portal que parece irreversível.
//
// ⚠️ O motivo é OBRIGATÓRIO. Recusar sem dizer por quê devolve o orçamento ao
// comercial sem nada para ele corrigir, e o ciclo recomeça igual. O servidor
// exige (`{ motivo }` no corpo); este diálogo não deixa nem tentar.
//
// ⚠️ NENHUM TOAST daqui: o interceptor de `api-client/portal.ts` já toasta erro
// de API e sucesso de escrita. Toastar aqui é a mesma frase duas vezes.
import { useState } from "react";
import { IconAlertTriangle, IconCheck, IconX } from "@tabler/icons-react";

import { usePortalPreApproveBudget, usePortalRefuseBudget } from "@/api-client/portal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PORTAL_CAPABILITY, hasPortalCapability } from "@/utils/portal-capabilities";
import type { TASK_QUOTE_STATUS } from "@/types/budget";

/** Quanto texto o motivo aceita — o mesmo teto confortável de uma observação. */
const MOTIVO_MAX = 1000;

export interface PreAprovacaoActionsProps {
  budgetId: string;
  status: TASK_QUOTE_STATUS;
  /** Os papéis do contato logado. */
  roles: readonly string[] | null | undefined;
  /**
   * O que o SERVIDOR disse sobre esta pessoa neste orçamento.
   *
   * `undefined` = a resposta não trouxe o campo; aí vale o recorte local. O
   * `false` EXPLÍCITO manda: o servidor sabe coisas que a tela não sabe (a
   * decisão já tomada, o CHECK de pré-aprovado-e-recusado, o escopo do dado).
   */
  canPreApprove?: boolean;
  /** Chamado depois de uma decisão aceita — para a tela voltar para a lista, por exemplo. */
  onDecided?: () => void;
  className?: string;
}

/**
 * Este contato pode decidir ESTE orçamento AGORA?
 *
 * Três perguntas, e todas as três têm de dar sim. O estado, porque só
 * `IN_NEGOTIATION` tem as transições; a capacidade, porque `PRE_APPROVE` é de
 * Comercial/Vendedor/Representante/Coordenador e de mais ninguém (o Compras do
 * cliente escreve pedido, não decide preço); e o servidor, que é quem manda.
 */
export function canDecideBudget({
  status,
  roles,
  canPreApprove,
}: {
  status: TASK_QUOTE_STATUS;
  roles: readonly string[] | null | undefined;
  canPreApprove?: boolean;
}): boolean {
  if (status !== "IN_NEGOTIATION") return false;
  if (!hasPortalCapability(roles ? [...roles] : [], PORTAL_CAPABILITY.PRE_APPROVE)) return false;
  return canPreApprove !== false;
}

export function PreAprovacaoActions({
  budgetId,
  status,
  roles,
  canPreApprove,
  onDecided,
  className,
}: PreAprovacaoActionsProps) {
  const [approveOpen, setApproveOpen] = useState(false);
  const [refuseOpen, setRefuseOpen] = useState(false);
  const [nota, setNota] = useState("");
  const [motivo, setMotivo] = useState("");
  /** O aviso do motivo só aparece DEPOIS da primeira tentativa — não recebe quem ainda nem digitou. */
  const [motivoTouched, setMotivoTouched] = useState(false);

  const preApprove = usePortalPreApproveBudget();
  const refuse = usePortalRefuseBudget();

  if (!canDecideBudget({ status, roles, canPreApprove })) return null;

  const motivoTrimmed = motivo.trim();
  const motivoInvalid = motivoTrimmed.length === 0;
  const busy = preApprove.isPending || refuse.isPending;

  const closeApprove = (open: boolean) => {
    if (busy) return;
    setApproveOpen(open);
    if (!open) setNota("");
  };

  const closeRefuse = (open: boolean) => {
    if (busy) return;
    setRefuseOpen(open);
    if (!open) {
      setMotivo("");
      setMotivoTouched(false);
    }
  };

  const submitApprove = async () => {
    const trimmed = nota.trim();
    try {
      await preApprove.mutateAsync({ id: budgetId, nota: trimmed || undefined });
      setApproveOpen(false);
      setNota("");
      onDecided?.();
    } catch {
      // O interceptor já explicou. O diálogo FICA ABERTO de propósito: fechar
      // apagaria a nota que a pessoa acabou de escrever.
    }
  };

  const submitRefuse = async () => {
    setMotivoTouched(true);
    // ⛔ O portão do motivo. Não é só o `disabled` do botão: o Enter dentro do
    // diálogo e um clique duplo rápido chegam aqui também.
    if (motivoInvalid) return;
    try {
      await refuse.mutateAsync({ id: budgetId, motivo: motivoTrimmed });
      setRefuseOpen(false);
      setMotivo("");
      setMotivoTouched(false);
      onDecided?.();
    } catch {
      // idem: mantém o motivo digitado na tela.
    }
  };

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => setApproveOpen(true)} disabled={busy}>
          <IconCheck className="h-4 w-4" />
          <span className="ml-2">Aprovar</span>
        </Button>
        <Button type="button" variant="outline" onClick={() => setRefuseOpen(true)} disabled={busy}>
          <IconX className="h-4 w-4" />
          <span className="ml-2">Recusar</span>
        </Button>
      </div>

      {/* ── APROVAR ───────────────────────────────────────────────────────── */}
      <Dialog open={approveOpen} onOpenChange={closeApprove}>
        {/* `max-w-md`: o diálogo ABRAÇA o conteúdo. */}
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Aprovar este orçamento?</DialogTitle>
            <DialogDescription>
              O orçamento passa a <strong>Pré-aprovado</strong> e volta para a Ankaa, que emite o documento para
              assinatura. Você ainda vai assinar depois — aprovar aqui não é assinar.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="portal-pre-aprovar-nota" className="text-sm">
              Observação (opcional)
            </Label>
            <Textarea
              id="portal-pre-aprovar-nota"
              value={nota}
              maxLength={MOTIVO_MAX}
              placeholder="Algo que o comercial precise saber junto da aprovação."
              /* ⚠️ `Textarea` entrega o EVENTO (é o `<textarea>` nativo).
                 `Input`, na mesma base, entrega o VALOR. */
              onChange={(event) => setNota(event.target.value)}
              disabled={busy}
              className="min-h-[88px]"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => closeApprove(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => void submitApprove()} disabled={busy}>
              {preApprove.isPending ? "Aprovando..." : "Aprovar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── RECUSAR ───────────────────────────────────────────────────────── */}
      <Dialog open={refuseOpen} onOpenChange={closeRefuse}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Recusar e devolver para a Ankaa?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2">
                <p>
                  O orçamento volta ao estado <strong>Requisição</strong> e cai de novo na mesa do comercial da Ankaa,
                  que vai <strong>refazê-lo</strong> com o que você escrever abaixo.
                </p>
                {/* ⛔ A frase que impede a leitura errada. Fica num bloco
                    destacado porque é a única ação do portal que PARECE
                    irreversível e não é. */}
                <p className="flex items-start gap-2 rounded-lg bg-muted/50 px-4 py-2.5 text-sm text-foreground">
                  <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span>
                    Isto <strong>não cancela</strong> o serviço nem encerra a negociação. O orçamento continua vivo — só
                    volta para ser refeito. Para desistir de vez, fale com o seu contato comercial.
                  </span>
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="portal-recusar-motivo" className="text-sm">
              Motivo da recusa <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="portal-recusar-motivo"
              value={motivo}
              maxLength={MOTIVO_MAX}
              placeholder="O que precisa mudar? Preço, prazo, escopo, forma de pagamento…"
              onChange={(event) => setMotivo(event.target.value)}
              onBlur={() => setMotivoTouched(true)}
              disabled={busy}
              error={motivoTouched && motivoInvalid}
              aria-invalid={motivoTouched && motivoInvalid}
              aria-describedby="portal-recusar-motivo-ajuda"
              className="min-h-[96px]"
            />
            <p
              id="portal-recusar-motivo-ajuda"
              className={
                motivoTouched && motivoInvalid ? "text-sm text-destructive" : "text-sm text-muted-foreground"
              }
            >
              {motivoTouched && motivoInvalid
                ? "Escreva o motivo — é ele que diz ao comercial o que refazer."
                : "O comercial recebe este texto junto com a devolução."}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => closeRefuse(false)} disabled={busy}>
              Voltar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void submitRefuse()}
              /* O botão desabilitado é a PRIMEIRA barreira; `submitRefuse`
                 confere de novo, porque um diálogo tem mais de um caminho até o
                 envio. */
              disabled={busy || motivoInvalid}
            >
              {refuse.isPending ? "Devolvendo..." : "Recusar e devolver"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
