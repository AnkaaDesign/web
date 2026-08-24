/**
 * Modal de envio do orçamento para assinatura eletrônica.
 *
 * POR QUE UM MODAL, E NÃO O SELETOR EMBUTIDO QUE ESTAVA AQUI
 *   O seletor de canal vivia solto dentro do card, ao lado do botão. Três
 *   problemas, e o terceiro é o que decidiu:
 *
 *   1. Ele ocupava espaço permanente para uma decisão tomada UMA vez por
 *      coleta — e no celular empurrava o botão para fora da primeira dobra.
 *   2. O botão "Enviar" ficava a um toque de distância sem nenhuma etapa de
 *      confirmação, para um ato que CONGELA o documento e dispara mensagem a
 *      cliente real. O app já confirmava; a web não.
 *   3. Não havia onde caber o aviso mais importante: quem, entre os
 *      responsáveis, não pode ser alcançado pelo canal escolhido. Com 9 de 170
 *      responsáveis tendo e-mail cadastrado, escolher "E-mail" sem esse aviso é
 *      escolher um 400.
 *
 *   O modal resolve os três: a decisão aparece quando é tomada, o ato exige um
 *   segundo toque, e o aviso fica ao lado da opção que o causa.
 *
 * RESPONSIVO AO SERVIDOR, NÃO A UM LITERAL
 *   Os canais desenhados saem de `channels` do preflight, que espelha
 *   `SIGNATURE_DELIVERY_CHANNEL`. Em modo fixo (`whatsapp` ou `email`) não há
 *   escolha a fazer e o modal não desenha rádio nenhum — só diz por onde vai.
 */

import { useCallback, useEffect, useState } from "react";
import {
  signatureService,
  DELIVERY_CHANNEL_LABELS,
  type DeliveryChannel,
  type DeliveryPreflight,
} from "@/api-client/signature";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  IconAlertTriangle,
  IconBrandWhatsapp,
  IconCircleCheck,
  IconLoader2,
  IconMail,
  IconSend,
  IconTruck,
  IconUser,
} from "@tabler/icons-react";

const CHANNEL_ICON: Record<DeliveryChannel, typeof IconMail> = {
  WHATSAPP: IconBrandWhatsapp,
  EMAIL: IconMail,
};

const CHANNEL_REQUIREMENT: Record<DeliveryChannel, string> = {
  WHATSAPP: "telefone com DDD no cadastro",
  EMAIL: "e-mail no cadastro",
};

export function SignatureSendDialog({
  open,
  onOpenChange,
  quoteId,
  mode,
  busy,
  onSend,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quoteId: string;
  /** "create" = primeira coleta; "reissue" = reemissão depois de uma coleta encerrada. */
  mode: "create" | "reissue";
  busy: boolean;
  onSend: (channel: DeliveryChannel | null) => Promise<void> | void;
}) {
  const [preflight, setPreflight] = useState<DeliveryPreflight | null>(null);
  const [loading, setLoading] = useState(false);
  const [channel, setChannel] = useState<DeliveryChannel | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const res: any = await signatureService.getDeliveryPreflight(quoteId);
      const data: DeliveryPreflight | undefined = res?.data?.data ?? res?.data;
      if (!data) throw new Error("resposta vazia");
      setPreflight(data);
      // Pré-seleciona o canal do servidor, MAS prefere um que esteja pronto:
      // abrir com "E-mail" marcado quando ninguém tem e-mail transforma o
      // padrão numa armadilha.
      const preferred =
        data.channelStatus[data.defaultChannel]?.ready
          ? data.defaultChannel
          : (data.channels.find(c => data.channelStatus[c]?.ready) ?? data.defaultChannel);
      setChannel(preferred);
    } catch {
      // Sem preflight o modal não inventa: some com as opções e deixa o envio
      // seguir com o padrão do servidor, que é o comportamento de antes desta
      // tela. Falhar aqui não pode impedir de enviar.
      setPreflight(null);
      setFailed(true);
      setChannel(null);
    } finally {
      setLoading(false);
    }
  }, [quoteId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const canChoose = (preflight?.channels.length ?? 0) > 1;
  const status = channel ? preflight?.channelStatus[channel] : undefined;
  const blockers = preflight?.blockers ?? [];
  const blocked = blockers.length > 0;

  const effectiveLabel = channel ? DELIVERY_CHANNEL_LABELS[channel] : null;

  return (
    <Dialog open={open} onOpenChange={o => !busy && onOpenChange(o)}>
      {/* `max-h` + scroll interno: no celular a lista de responsáveis pode
          passar da altura da tela, e um modal que não rola esconde o botão. */}
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0">
        <DialogHeader className="space-y-1 border-b border-border px-4 py-3.5 sm:px-5">
          <DialogTitle className="flex items-center gap-2 text-base">
            <IconSend className="h-4 w-4 text-muted-foreground" />
            {mode === "create" ? "Enviar para assinatura" : "Reenviar para assinatura"}
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            O documento é congelado como está e cada responsável recebe um link
            pessoal para revisar e assinar. O código de assinatura vai pelo mesmo
            canal.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <IconLoader2 className="h-4 w-4 animate-spin" />
              Conferindo os cadastros…
            </div>
          ) : (
            <>
              {blockers.map(b => (
                <div
                  key={b}
                  className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs"
                >
                  <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                  <span className="text-foreground">{b}</span>
                </div>
              ))}

              {failed && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs">
                  <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <span className="text-foreground">
                    Não foi possível conferir os cadastros agora. O envio segue pelo
                    canal configurado no servidor — se algum responsável estiver sem
                    contato, o erro aparecerá ao confirmar.
                  </span>
                </div>
              )}

              {/* ---- Canal ---- */}
              {preflight && !blocked && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {canChoose ? "Como enviar" : "Canal de envio"}
                  </p>

                  {preflight.channels.map(c => {
                    const Icon = CHANNEL_ICON[c];
                    const st = preflight.channelStatus[c];
                    const selected = channel === c;
                    const unreachable = !st?.ready;
                    return (
                      <button
                        key={c}
                        type="button"
                        // Um canal indisponível continua SELECIONÁVEL de
                        // propósito: desabilitar esconderia o motivo, e o motivo
                        // ("Fulano está sem e-mail") é justamente o que diz ao
                        // operador o que corrigir no cadastro.
                        onClick={() => canChoose && setChannel(c)}
                        disabled={!canChoose || busy}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-lg border border-border p-3 text-left transition-colors",
                          canChoose && "hover:bg-muted/50",
                          selected && "border-primary bg-muted/50",
                          !canChoose && "cursor-default",
                        )}
                      >
                        {canChoose && (
                          <span
                            className={cn(
                              "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                              selected ? "border-primary" : "border-muted-foreground/40",
                            )}
                          >
                            {selected && <span className="h-2 w-2 rounded-full bg-primary" />}
                          </span>
                        )}
                        <Icon
                          className={cn(
                            "mt-0.5 h-4 w-4 shrink-0",
                            selected ? "text-primary" : "text-muted-foreground",
                          )}
                        />
                        <span className="min-w-0 flex-1 space-y-0.5">
                          <span className="flex flex-wrap items-center gap-2">
                            <span className="text-sm font-medium leading-none text-foreground">
                              {DELIVERY_CHANNEL_LABELS[c]}
                            </span>
                            {unreachable ? (
                              <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-500">
                                cadastro incompleto
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-700 dark:text-green-500">
                                <IconCircleCheck className="h-3 w-3" />
                                {preflight.recipients.length === 1
                                  ? "1 responsável pronto"
                                  : `${preflight.recipients.length} responsáveis prontos`}
                              </span>
                            )}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            exige {CHANNEL_REQUIREMENT[c]}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ---- Aviso do canal escolhido ---- */}
              {status && !status.ready && !blocked && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs">
                  <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <span className="space-y-1 text-foreground">
                    {status.missing.length > 0 && (
                      <span className="block">
                        <strong>
                          {status.missing.length === 1
                            ? "1 responsável não tem "
                            : `${status.missing.length} responsáveis não têm `}
                          {channel === "WHATSAPP" ? "telefone" : "e-mail"} no cadastro:
                        </strong>{" "}
                        {status.missing.join(", ")}.
                      </span>
                    )}
                    {status.ankaaMissing && (
                      <span className="block">
                        <strong>
                          O representante da Ankaa ({status.ankaaMissing}) está sem{" "}
                          {channel === "WHATSAPP" ? "telefone" : "e-mail"} no cadastro.
                        </strong>
                      </span>
                    )}
                    <span className="block text-muted-foreground">
                      {canChoose
                        ? "Escolha o outro canal ou complete o cadastro antes de enviar."
                        : "Complete o cadastro antes de enviar."}
                    </span>
                  </span>
                </div>
              )}

              {/* ---- Identificação do veículo ---- */}
              {preflight?.vehicle && preflight.vehicle.missing.length > 0 && !blocked && (
                <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-xs">
                  <IconTruck className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-foreground">
                    <strong>
                      Este orçamento está sem {preflight.vehicle.missing.join(" e ")} do
                      veículo.
                    </strong>{" "}
                    O documento é congelado como está — {preflight.vehicle.missing.length === 1
                      ? "esse dado"
                      : "esses dados"}{" "}
                    não vão constar do documento assinado, mesmo que sejam preenchidos
                    depois. Se já souber, preencha antes de enviar.
                  </span>
                </div>
              )}

              {/* ---- Quem vai receber ---- */}
              {preflight && preflight.recipients.length > 0 && !blocked && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Quem recebe
                  </p>
                  {preflight.recipients.map(r => {
                    const reachable = channel === "WHATSAPP" ? r.hasPhone : r.hasEmail;
                    const contact =
                      channel === "WHATSAPP" ? r.phoneMasked : r.emailMasked;
                    return (
                      <div
                        key={r.id}
                        className="flex items-center gap-2.5 rounded-lg bg-muted/50 px-3 py-2"
                      >
                        <IconUser className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="min-w-0 flex-1 truncate text-sm">{r.name}</span>
                        <span
                          className={cn(
                            "shrink-0 text-xs",
                            reachable ? "text-muted-foreground" : "text-amber-600 dark:text-amber-500",
                          )}
                        >
                          {reachable
                            ? contact
                            : channel === "WHATSAPP"
                              ? "sem telefone"
                              : "sem e-mail"}
                        </span>
                      </div>
                    );
                  })}
                  {preflight.ankaa && (
                    <p className="pt-0.5 text-[11px] text-muted-foreground">
                      A contra-assinatura da Ankaa ({preflight.ankaa.name}) é colhida
                      depois que todos os responsáveis assinarem.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2 border-t border-border px-4 py-3 sm:px-5">
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            className="gap-1.5"
            disabled={busy || loading || blocked}
            onClick={() => void onSend(channel)}
          >
            {busy ? (
              <IconLoader2 className="h-4 w-4 animate-spin" />
            ) : (
              <IconSend className="h-4 w-4" />
            )}
            {effectiveLabel ? `Enviar por ${effectiveLabel}` : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
