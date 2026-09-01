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

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  signatureService,
  describeSections,
  effectiveSections,
  DELIVERY_CHANNEL_LABELS,
  LOCAL_SECTION_CATALOG,
  QUOTE_SECTIONS,
  type DeliveryChannel,
  type DeliveryPreflight,
  type PreflightRecipient,
  type QuoteSection,
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
  IconChevronDown,
  IconCircleCheck,
  IconLoader2,
  IconMail,
  IconRotate,
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
  onSend: (
    channel: DeliveryChannel | null,
    /**
     * MAPA DE EXCEÇÕES: só os contatos cujo recorte foi alterado aqui. Quem não
     * vem cai no padrão das funções, no servidor. Ver `createEnvelope`.
     */
    signers: Array<{ responsibleId: string; sections: QuoteSection[] }>,
  ) => Promise<void> | void;
}) {
  const [preflight, setPreflight] = useState<DeliveryPreflight | null>(null);
  const [loading, setLoading] = useState(false);
  const [channel, setChannel] = useState<DeliveryChannel | null>(null);
  const [failed, setFailed] = useState(false);
  /**
   * Recortes editados pelo operador, por responsável.
   *
   * Só o que ele MEXEU entra aqui — é o mesmo contrato do corpo do POST, e é
   * ele que faz um responsável acrescentado à tarefa depois de a tela abrir
   * continuar recebendo o padrão dele em vez de ficar de fora em silêncio.
   */
  const [overrides, setOverrides] = useState<Record<string, QuoteSection[]>>({});
  /** Qual linha está com as caixas de seção abertas. Uma por vez: a lista é longa. */
  const [expanded, setExpanded] = useState<string | null>(null);

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

  // Reabrir o modal recomeça do padrão. Guardar a edição entre aberturas seria
  // guardar uma decisão sobre um estado do cadastro que pode ter mudado desde
  // então — e o operador não teria como saber que ela ainda está lá.
  useEffect(() => {
    if (!open) {
      setOverrides({});
      setExpanded(null);
    }
  }, [open]);

  /**
   * As seções que a tela desenha.
   *
   * Vem do servidor porque é ele quem decide quais existem; cai no catálogo
   * local quando a api ainda não foi atualizada — sem isso a tela desenharia
   * zero caixas e nenhuma coleta seria possível.
   */
  const catalog = preflight?.sectionCatalog?.length
    ? preflight.sectionCatalog
    : LOCAL_SECTION_CATALOG;

  /**
   * O recorte EFETIVO de um contato: o editado, ou o padrão do preflight.
   *
   * AUSENTE não é o mesmo que VAZIO. Vazio é o servidor dizendo "este contato
   * não assina"; ausente é um servidor que ainda não conhece recortes, e ali o
   * certo é o documento inteiro — que é exatamente o que aquela api entrega.
   * Sem essa distinção a tela quebrava lendo `.length` de `undefined`.
   */
  const sectionsOf = useCallback(
    (r: Pick<PreflightRecipient, "id" | "sections">): QuoteSection[] =>
      // `effectiveSections` aplica as MESMAS duas regras do servidor: a
      // obrigatória entra em quem assina, e quem decide se assina são as
      // recortáveis. Sem isso a tela e a emissão discordariam sobre quem entra
      // na coleta — e a tela é onde a decisão é tomada.
      effectiveSections(overrides[r.id] ?? r.sections ?? [...QUOTE_SECTIONS]),
    [overrides],
  );

  const toggleSection = (responsibleId: string, current: QuoteSection[], section: QuoteSection) => {
    const next = current.includes(section)
      ? current.filter(x => x !== section)
      : // Reordena pela ordem canônica: a chave do recorte é a lista unida, e
        // duas ordens diferentes do mesmo conjunto virariam dois PDFs iguais.
        // O servidor também canoniza, mas divergir aqui faria o rótulo da tela
        // discordar do que foi enviado.
        // A ordem canônica sai de `QUOTE_SECTIONS`, não do catálogo: o catálogo
        // só traz as recortáveis, e reconstruir a lista a partir dele DESCARTARIA
        // as obrigatórias (a identificação do veículo) a cada clique.
        QUOTE_SECTIONS.filter(k => k === section || current.includes(k));
    setOverrides(prev => ({ ...prev, [responsibleId]: next }));
  };

  /** Quantos PDFs a coleta vai congelar com as escolhas atuais. */
  const variantCount = useMemo(() => {
    const keys = new Set<string>();
    for (const r of preflight?.recipients ?? []) {
      const sections = sectionsOf(r);
      if (sections.length) keys.add(sections.join("+"));
    }
    // O recorte COMPLETO existe sempre — é o que a Ankaa contra-assina.
    keys.add(QUOTE_SECTIONS.join("+"));
    return keys.size;
  }, [preflight, sectionsOf]);

  const signingCount = (preflight?.recipients ?? []).filter(r => sectionsOf(r).length > 0).length;

  const overridePayload = () =>
    Object.entries(overrides).map(([responsibleId, sections]) => ({ responsibleId, sections }));

  /**
   * Quem, entre os que DE FATO vão assinar, está sem o contato do canal.
   *
   * Recalculado aqui e não lido de `channelStatus.missing`: aquela lista vem do
   * servidor com os recortes PADRÃO, e o operador acabou de mexer neles. Marcar
   * o gestor de frota — que não tem e-mail — para assinar deixava a faixa calada
   * e o envio tomava 400 no confirmar, que é exatamente o defeito que este
   * preflight existe para eliminar.
   */
  const missingContact = (preflight?.recipients ?? [])
    .filter(
      r =>
        sectionsOf(r).length > 0 &&
        (channel === "WHATSAPP" ? !r.hasPhone : !r.hasEmail),
    )
    .map(r => r.name);

  const canChoose = (preflight?.channels.length ?? 0) > 1;
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
            pessoal para revisar e assinar. Cada um recebe apenas as seções da
            função dele — abaixo dá para mudar contato a contato.
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
                    const selected = channel === c;
                    // O aviso do canal segue as escolhas do operador, não o
                    // padrão do servidor — ver `missingContact`.
                    const missingHere = preflight.recipients
                      .filter(
                        r =>
                          sectionsOf(r).length > 0 &&
                          (c === "WHATSAPP" ? !r.hasPhone : !r.hasEmail),
                      )
                      .map(r => r.name);
                    const unreachable = signingCount === 0 || missingHere.length > 0;
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
                                {signingCount === 1
                                  ? "1 responsável pronto"
                                  : `${signingCount} responsáveis prontos`}
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
              {missingContact.length > 0 && !blocked && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs">
                  <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <span className="space-y-1 text-foreground">
                    <span className="block">
                      <strong>
                        {missingContact.length === 1
                          ? "1 responsável que vai assinar não tem "
                          : `${missingContact.length} responsáveis que vão assinar não têm `}
                        {channel === "WHATSAPP" ? "telefone" : "e-mail"} no cadastro:
                      </strong>{" "}
                      {missingContact.join(", ")}.
                    </span>
                    <span className="block text-muted-foreground">
                      {canChoose
                        ? "Escolha o outro canal, complete o cadastro, ou desmarque as seções desse contato para tirá-lo desta coleta."
                        : "Complete o cadastro, ou desmarque as seções desse contato para tirá-lo desta coleta."}
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

              {/* ---- Quem recebe o quê ---- */}
              {preflight && preflight.recipients.length > 0 && !blocked && (
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Quem recebe o quê
                    </p>
                    {variantCount > 1 && (
                      <span className="text-[11px] text-muted-foreground">
                        {variantCount} documentos serão gerados
                      </span>
                    )}
                  </div>

                  {preflight.recipients.map(r => {
                    const reachable = channel === "WHATSAPP" ? r.hasPhone : r.hasEmail;
                    const contact = channel === "WHATSAPP" ? r.phoneMasked : r.emailMasked;
                    const sections = sectionsOf(r);
                    const signs = sections.length > 0;
                    const isOpen = expanded === r.id;
                    const edited = overrides[r.id] !== undefined;
                    const full = sections.length === QUOTE_SECTIONS.length;

                    return (
                      <div
                        key={r.id}
                        className={cn(
                          "rounded-lg border border-border bg-muted/40",
                          // Quem não assina fica visivelmente apagado, MAS
                          // continua na lista: sumir com ele esconderia
                          // justamente a decisão que o operador pode querer
                          // reverter — o gestor de frota que precisa assinar
                          // ESTA obra.
                          !signs && "opacity-60",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : r.id)}
                          disabled={busy}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left"
                        >
                          <IconUser className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span className="truncate text-sm">{r.name}</span>
                              {edited && (
                                <span className="shrink-0 rounded bg-primary/15 px-1 py-0.5 text-[9px] font-medium uppercase text-primary">
                                  editado
                                </span>
                              )}
                            </span>
                            <span className="block truncate text-[11px] text-muted-foreground">
                              {r.rolesLabel || "sem função"} ·{" "}
                              {/* `describeSections` e não a lista crua: a
                                  identificação do veículo entra em todo recorte
                                  e repeti-la em cada linha não distingue nada. */}
                              {signs
                                ? full
                                  ? "recebe tudo"
                                  : describeSections(sections)
                                : "não assina"}
                            </span>
                          </span>
                          <span
                            className={cn(
                              "shrink-0 text-xs",
                              !signs
                                ? "text-muted-foreground"
                                : reachable
                                  ? "text-muted-foreground"
                                  : "text-amber-600 dark:text-amber-500",
                            )}
                          >
                            {!signs
                              ? ""
                              : reachable
                                ? contact
                                : channel === "WHATSAPP"
                                  ? "sem telefone"
                                  : "sem e-mail"}
                          </span>
                          <IconChevronDown
                            className={cn(
                              "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                              isOpen && "rotate-180",
                            )}
                          />
                        </button>

                        {isOpen && (
                          <div className="space-y-1 border-t border-border px-3 py-2.5">
                            {catalog.map(sec => {
                              const on = sections.includes(sec.key);
                              return (
                                <label
                                  key={sec.key}
                                  className="flex cursor-pointer items-start gap-2.5 rounded-md px-1 py-1 hover:bg-muted/60"
                                >
                                  <input
                                    type="checkbox"
                                    checked={on}
                                    disabled={busy}
                                    onChange={() => toggleSection(r.id, sections, sec.key)}
                                    className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-primary"
                                  />
                                  <span className="min-w-0 flex-1">
                                    <span className="block text-xs font-medium text-foreground">
                                      {sec.label}
                                    </span>
                                    <span className="block text-[11px] leading-snug text-muted-foreground">
                                      {sec.description}
                                    </span>
                                  </span>
                                </label>
                              );
                            })}
                            <div className="flex items-center justify-between pt-1">
                              <span className="text-[11px] text-muted-foreground">
                                A identificação do veículo (série, placa e chassi) entra
                                em todos. Sem nenhuma seção marcada, este contato não
                                recebe o orçamento para assinar.
                              </span>
                              {edited && (
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() =>
                                    setOverrides(prev => {
                                      const next = { ...prev };
                                      delete next[r.id];
                                      return next;
                                    })
                                  }
                                  className="inline-flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                                >
                                  <IconRotate className="h-3 w-3" />
                                  padrão
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {signingCount === 0 && (
                    <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-xs">
                      <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                      <span className="text-foreground">
                        Nenhum responsável está marcado para assinar. Marque ao menos
                        uma seção para alguém.
                      </span>
                    </div>
                  )}

                  {preflight.ankaa && (
                    <p className="pt-0.5 text-[11px] text-muted-foreground">
                      A contra-assinatura da Ankaa ({preflight.ankaa.name}) é feita
                      aqui no sistema, com um botão, depois que todos os responsáveis
                      assinarem — ela recebe sempre o documento completo.
                      {preflight.ankaa.reachable === false &&
                        " Ela está sem e-mail e sem telefone no cadastro, então não receberá o aviso; a ação continua disponível nesta tela."}
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
            disabled={busy || loading || blocked || signingCount === 0}
            onClick={() => void onSend(channel, overridePayload())}
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
