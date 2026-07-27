/**
 * Painel interno da coleta de assinaturas do orçamento.
 *
 * Segue o mesmo padrão visual das demais seções da revisão
 * (`budget-step-review.tsx`): `Card` + `CardHeader` com ícone, e linhas em
 * `bg-muted/50 rounded-lg`. Sem isso o bloco destoava do resto da página.
 *
 * Nota sobre CPF: aqui aparece MASCARADO (`***.456.789-**`, o formato com lastro
 * na LDO/CGU). O CPF completo vive apenas na página anexa de trilha de auditoria
 * do PDF, que é a peça probatória entregue às partes. Mascare a exibição, nunca
 * o registro.
 */

import { useCallback, useEffect, useState } from "react";
import { signatureService } from "@/api-client/signature";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconClock,
  IconCopy,
  IconEye,
  IconFileTypePdf,
  IconLoader2,
  IconBrandWhatsapp,
  IconLink,
  IconSend,
  IconSignature,
  IconX,
} from "@tabler/icons-react";

interface EnvelopeSigner {
  id: string;
  name: string;
  phoneMasked: string;
  cpfMasked: string | null;
  cargo: string | null;
  cpfMatch: boolean | null;
  side: "ANKAA" | "CUSTOMER";
  status: string;
  signedAt: string | null;
  refusedAt: string | null;
  refusalReason: string | null;
  timesViewed: number;
  lastViewedAt: string | null;
  ipAddress: string | null;
  phone: string;
  signingUrl: string;
  /** INVITATION_SENT | INVITATION_FAILED | null (ainda não tentado). */
  inviteState: string | null;
}

interface Envelope {
  id: string;
  version: number;
  status: string;
  verificationCode: string;
  deadlineAt: string;
  sentAt: string | null;
  completedAt: string | null;
  invalidatedReason: string | null;
  originalSha256: string;
  finalSha256: string | null;
  padesLevel: string | null;
  sealedAt: string | null;
  signers: EnvelopeSigner[];
}

type Tone = "ok" | "warn" | "bad" | "muted";

const ENVELOPE_LABEL: Record<string, { text: string; tone: Tone }> = {
  DRAFT: { text: "Rascunho", tone: "muted" },
  RUNNING: { text: "Aguardando assinaturas", tone: "warn" },
  COMPLETED: { text: "Assinado", tone: "ok" },
  REFUSED: { text: "Recusado", tone: "bad" },
  EXPIRED: { text: "Prazo expirado", tone: "bad" },
  CANCELLED: { text: "Cancelado", tone: "muted" },
  INVALIDATED: { text: "Invalidado", tone: "bad" },
  SUPERSEDED: { text: "Substituído", tone: "muted" },
};

const SIGNER_LABEL: Record<string, { text: string; tone: Tone }> = {
  PENDING: { text: "Pendente", tone: "muted" },
  VIEWED: { text: "Visualizou", tone: "warn" },
  AUTHENTICATED: { text: "Autenticado", tone: "warn" },
  SIGNED: { text: "Assinou", tone: "ok" },
  REFUSED: { text: "Recusou", tone: "bad" },
  EXPIRED: { text: "Expirado", tone: "muted" },
  VOIDED: { text: "Invalidada", tone: "bad" },
};

/**
 * As variantes `dark:` são obrigatórias, não decorativas.
 *
 * `cn` = twMerge(clsx), que só desduplica classes do MESMO grupo de modificador.
 * O `variant="outline"` do Badge traz `dark:text-neutral-100`; uma classe sem
 * prefixo como `text-green-600` NÃO a remove, e `.dark .dark\:text-neutral-100`
 * (especificidade 0,2,0) vence `.text-green-600` (0,1,0). Sem o par `dark:`,
 * todos os badges de status ficavam quase brancos no tema escuro — exatamente
 * onde a cor carrega o significado.
 */
const toneClass: Record<Tone, string> = {
  ok: "bg-green-600/15 text-green-600 dark:text-green-500 border-green-600/30 hover:bg-green-600/15",
  warn: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/15",
  bad: "bg-red-500/15 text-red-500 dark:text-red-400 border-red-500/30 hover:bg-red-500/15",
  muted: "bg-muted text-muted-foreground dark:text-neutral-400 border-transparent hover:bg-muted",
};

function Meta({
  label,
  value,
  mono,
  tone,
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "ok";
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`truncate text-sm ${mono ? "font-mono" : ""} ${
          tone === "ok" ? "text-green-600 dark:text-green-500" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function fmtDateTime(v: string | null): string {
  return v ? new Date(v).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "";
}

export function SignatureEnvelopeCard({
  quoteId,
  canManage,
}: {
  quoteId: string | null | undefined;
  canManage: boolean;
}) {
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const load = useCallback(async () => {
    if (!quoteId) return setLoading(false);
    try {
      const res: any = await signatureService.listForQuote(quoteId);
      setEnvelopes(res?.data?.data ?? res?.data ?? []);
    } catch {
      // ausência de envelopes não é erro
    } finally {
      setLoading(false);
    }
  }, [quoteId]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<any>, okMsg: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(okMsg);
      await load();
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Não foi possível concluir a operação.");
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async (s: EnvelopeSigner) => {
    try {
      await navigator.clipboard.writeText(s.signingUrl);
      toast.success(`Link de ${s.name} copiado.`);
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  const openWhatsApp = (s: EnvelopeSigner) => {
    // Fallback manual: abre a conversa já com o texto pronto. Útil sempre que o
    // envio automático falha (sessão do WhatsApp não pareada, por exemplo).
    const msg = `Olá, ${s.name}. Seu orçamento está pronto para revisão e assinatura eletrônica:\n\n${s.signingUrl}`;
    window.open(
      `https://wa.me/55${s.phone.replace(/\D/g, "").replace(/^55/, "")}?text=${encodeURIComponent(msg)}`,
      "_blank",
      "noopener",
    );
  };

  const openPdf = async (id: string) => {
    try {
      await signatureService.openInternalDocument(id);
    } catch {
      toast.error("Não foi possível abrir o PDF.");
    }
  };

  if (!quoteId) return null;

  const current = envelopes[0] ?? null;
  const history = envelopes.slice(1);
  const signed = current?.signers.filter(s => s.status === "SIGNED").length ?? 0;
  const total = current?.signers.length ?? 0;
  const label = current ? ENVELOPE_LABEL[current.status] ?? { text: current.status, tone: "muted" as Tone } : null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <IconSignature className="h-4 w-4 text-muted-foreground" />
            Assinatura eletrônica
            {current && (
              <Badge variant="outline" className={`ml-1 ${toneClass[label!.tone]}`}>
                {label!.text}
              </Badge>
            )}
          </CardTitle>

          {current && (
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => openPdf(current.id)}>
                <IconFileTypePdf className="h-3.5 w-3.5" />
                PDF
              </Button>
              {canManage && current.status === "RUNNING" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                  disabled={busy}
                  onClick={() => run(() => signatureService.cancel(current.id), "Coleta cancelada.")}
                >
                  <IconX className="h-3.5 w-3.5" />
                  Cancelar
                </Button>
              )}
              {canManage && current.status !== "RUNNING" && current.status !== "COMPLETED" && (
                <Button
                  variant="default"
                  size="sm"
                  className="h-8 gap-1.5"
                  disabled={busy}
                  onClick={() => run(() => signatureService.createEnvelope(quoteId), "Reenviado para assinatura.")}
                >
                  {busy ? <IconLoader2 className="h-3.5 w-3.5 animate-spin" /> : <IconSend className="h-3.5 w-3.5" />}
                  Reenviar
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
            <IconLoader2 className="h-4 w-4 animate-spin" />
            Carregando…
          </div>
        ) : !current ? (
          <div className="flex flex-col items-start gap-3 rounded-lg bg-muted/50 px-4 py-5">
            <div className="space-y-1">
              <p className="text-sm font-medium">Nenhuma coleta emitida</p>
              <p className="text-xs text-muted-foreground">
                Ao enviar, o documento é congelado e cada responsável recebe um link pessoal por
                WhatsApp para revisar e assinar.
              </p>
            </div>
            {canManage && (
              <Button
                size="sm"
                className="gap-1.5"
                disabled={busy}
                onClick={() => run(() => signatureService.createEnvelope(quoteId), "Enviado para assinatura.")}
              >
                {busy ? <IconLoader2 className="h-4 w-4 animate-spin" /> : <IconSend className="h-4 w-4" />}
                Enviar para assinatura
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {current.invalidatedReason && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs">
                <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <span>
                  <strong>{current.invalidatedReason}</strong> As assinaturas coletadas foram
                  invalidadas e os signatários avisados. Reenvie para colher novamente.
                </span>
              </div>
            )}

            {current.signers.some(s => s.inviteState === "INVITATION_FAILED") && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs">
                <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <span>
                  <strong>O convite automático pelo WhatsApp falhou.</strong> A sessão do
                  WhatsApp provavelmente não está conectada. Use o ícone de link para copiar
                  o endereço pessoal de cada signatário, ou o ícone do WhatsApp para abrir a
                  conversa com a mensagem pronta.
                </span>
              </div>
            )}

            {/* Progresso */}
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-2.5">
              <span className="text-sm text-muted-foreground">Progresso</span>
              <span className="text-sm font-semibold">
                {signed} de {total} assinaram
              </span>
            </div>

            {/* Signatários */}
            <div className="space-y-1.5">
              {current.signers.map(s => {
                const st = SIGNER_LABEL[s.status] ?? { text: s.status, tone: "muted" as Tone };
                return (
                  <div key={s.id} className="flex items-start gap-3 rounded-lg bg-muted/50 px-4 py-2.5">
                    {s.status === "SIGNED" ? (
                      <IconCircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                    ) : s.status === "REFUSED" || s.status === "VOIDED" ? (
                      <IconX className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                    ) : s.timesViewed > 0 ? (
                      <IconEye className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
                    ) : (
                      <IconClock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    )}

                    <div className="min-w-0 flex-1 space-y-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium">{s.name}</span>
                        {s.side === "ANKAA" && (
                          <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                            Ankaa
                          </Badge>
                        )}
                        {/* Divergência entre o CPF que a Ankaa cadastrou e o que o
                            signatário informou é fato auditável, não bloqueio. */}
                        {s.cpfMatch === false && (
                          <Badge variant="outline" className={`h-5 px-1.5 text-[10px] ${toneClass.bad}`}>
                            CPF diverge
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {s.cargo ?? "Cargo não informado"} · {s.phoneMasked}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.cpfMasked ? `CPF ${s.cpfMasked}` : "CPF ainda não informado"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.signedAt
                          ? `Assinou em ${fmtDateTime(s.signedAt)}${s.ipAddress ? ` · IP ${s.ipAddress}` : ""}`
                          : s.refusalReason
                            ? `Recusou: ${s.refusalReason}`
                            : s.timesViewed > 0
                              ? `Abriu o link ${s.timesViewed}× · último em ${fmtDateTime(s.lastViewedAt)}`
                              : s.inviteState === "INVITATION_FAILED"
                                ? "Convite não entregue — envie o link manualmente"
                                : s.inviteState === "INVITATION_SENT"
                                  ? "Convite enviado · ainda não abriu"
                                  : "Aguardando envio do convite"}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      {canManage && s.status !== "SIGNED" && s.status !== "REFUSED" && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Copiar link de assinatura"
                            onClick={() => copyLink(s)}
                          >
                            <IconLink className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Abrir WhatsApp com a mensagem pronta"
                            onClick={() => openWhatsApp(s)}
                          >
                            <IconBrandWhatsapp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Reenviar convite automaticamente"
                            disabled={busy}
                            onClick={() =>
                              run(() => signatureService.resendInvitation(s.id), "Convite reenviado.")
                            }
                          >
                            <IconSend className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                      <Badge variant="outline" className={toneClass[st.tone]}>
                        {st.text}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Metadados — grade legível em vez da tira de 11px que exigia zoom. */}
            <div className="grid gap-x-6 gap-y-2 rounded-lg bg-muted/50 px-4 py-3 sm:grid-cols-2">
              <Meta label="Versão" value={`v${current.version}`} />
              <Meta label="Código de verificação" value={current.verificationCode} mono />
              <Meta
                label="Prazo para assinatura"
                value={new Date(current.deadlineAt).toLocaleDateString("pt-BR")}
              />
              <Meta
                label="Selo ICP-Brasil"
                value={
                  current.padesLevel
                    ? `PAdES ${current.padesLevel}${current.sealedAt ? ` · ${fmtDateTime(current.sealedAt)}` : ""}`
                    : "Ainda não selado"
                }
                tone={current.padesLevel ? "ok" : undefined}
              />
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground">SHA-256 do documento original</p>
                <button
                  type="button"
                  title="Copiar hash SHA-256"
                  className="mt-0.5 flex w-full items-center gap-1.5 text-left font-mono text-xs text-foreground hover:text-primary"
                  onClick={() => {
                    void navigator.clipboard.writeText(current.originalSha256);
                    toast.success("Hash copiado.");
                  }}
                >
                  <span className="truncate">{current.originalSha256}</span>
                  <IconCopy className="h-3.5 w-3.5 shrink-0" />
                </button>
              </div>
            </div>

            {history.length > 0 && (
              <div className="pt-1">
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline hover:text-foreground"
                  onClick={() => setShowHistory(v => !v)}
                >
                  {showHistory ? "Ocultar" : `Ver ${history.length} versão(ões) anterior(es)`}
                </button>
                {showHistory && (
                  <div className="mt-2 space-y-1">
                    {history.map(h => {
                      const hl = ENVELOPE_LABEL[h.status] ?? { text: h.status, tone: "muted" as Tone };
                      return (
                        <div
                          key={h.id}
                          className="flex items-center justify-between rounded-lg bg-muted/30 px-4 py-2 text-xs"
                        >
                          <span className="flex items-center gap-2">
                            <Badge variant="outline" className={`h-5 px-1.5 text-[10px] ${toneClass[hl.tone]}`}>
                              {hl.text}
                            </Badge>
                            <span className="text-muted-foreground">
                              v{h.version} · {h.verificationCode}
                            </span>
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1.5"
                            onClick={() => openPdf(h.id)}
                          >
                            <IconFileTypePdf className="h-3.5 w-3.5" />
                            PDF
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
