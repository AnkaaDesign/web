/**
 * Portal público de verificação de autenticidade.
 *
 * O código é impresso no rodapé de TODAS as páginas do PDF assinado, junto com o
 * SHA-256 do original — é como um terceiro que recebeu o documento confere que
 * ele é legítimo, sem precisar confiar em quem o enviou.
 *
 * O que NÃO aparece aqui, de propósito: o corpo do documento. Um orçamento traz
 * preço comercial, e o código circula por WhatsApp, e-mail e impressão. A página
 * expõe apenas metadados, hashes e o roster de signatários com **CPF mascarado**
 * — o CPF completo vive só na página anexa de trilha de auditoria, entregue às
 * partes.
 *
 * FORMA: uma CERTIDÃO, não um dashboard. Tudo vive dentro de um único cartão —
 * timbre, busca, veredito, trilha, metadados e signatários — separados por
 * filetes e por hierarquia tipográfica, nunca por caixas empilhadas. Cinco
 * cartões soltos faziam a página parecer um painel de aplicação; um documento
 * emitido tem uma folha só.
 */

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { signatureService } from "@/api-client/signature";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import {
  IconAlertCircle,
  IconCircleCheck,
  IconClock,
  IconLoader2,
  IconSearch,
  IconShieldCheck,
  IconShieldX,
  IconX,
} from "@tabler/icons-react";
import { COMPANY_INFO } from "@/config/company";

interface VerificationData {
  verificationCode: string;
  status: string;
  budgetNumber: number;
  issuer: { name: string; cnpj: string };
  customer: { name: string | null; cnpj: string | null };
  originalSha256: string;
  finalSha256: string | null;
  sealedAt: string | null;
  padesLevel: string | null;
  certSerialNumber: string | null;
  auditChain: { valid: boolean; events: number; reason: string | null };
  signers: Array<{
    name: string;
    cargo: string | null;
    cpfMasked: string | null;
    status: string;
    signedAt: string | null;
    authMethod: string;
  }>;
}

/** Rótulos legíveis — não vaze o enum cru para quem verifica o documento. */
const AUTH_LABEL: Record<string, string> = {
  WHATSAPP_OTP: "Código de uso único via WhatsApp",
  SMS_OTP: "Código de uso único via SMS",
  INTERNAL_SESSION: "Sessão autenticada Ankaa",
};

type Tone = "ok" | "warn" | "bad";

const STATUS_LABEL: Record<string, { text: string; tone: Tone }> = {
  COMPLETED: { text: "Assinado e selado", tone: "ok" },
  RUNNING: { text: "Aguardando assinaturas", tone: "warn" },
  INVALIDATED: { text: "Invalidado por alteração do orçamento", tone: "bad" },
  REFUSED: { text: "Recusado por um signatário", tone: "bad" },
  EXPIRED: { text: "Prazo expirado", tone: "bad" },
  CANCELLED: { text: "Cancelado", tone: "bad" },
  SUPERSEDED: { text: "Substituído por versão mais recente", tone: "warn" },
  DRAFT: { text: "Rascunho", tone: "warn" },
};

/** Faixa do veredito: fundo tênue de página inteira, nunca uma caixa dentro da folha. */
const TONE_BAND: Record<Tone, string> = {
  ok: "bg-green-50",
  warn: "bg-amber-50",
  bad: "bg-red-50",
};

const TONE_TEXT: Record<Tone, string> = {
  ok: "text-green-800",
  warn: "text-amber-800",
  bad: "text-red-800",
};

/**
 * Estado de cada signatário no roster. Sem isto, um signatário que RECUSOU
 * aparecia como "Pendente" — a página dizia "Recusado por um signatário" no
 * veredito e, logo abaixo, mostrava todo mundo como pendente, sem apontar quem.
 */
const SIGNER_STATE: Record<string, { label: string; icon: "ok" | "bad" | "wait" }> = {
  SIGNED: { label: "Assinado", icon: "ok" },
  REFUSED: { label: "Recusou", icon: "bad" },
  VOIDED: { label: "Anulado", icon: "bad" },
  EXPIRED: { label: "Expirado", icon: "wait" },
  VIEWED: { label: "Visualizado", icon: "wait" },
};

export default function PublicSignatureVerifyPage() {
  const { code: codeParam } = useParams<{ code?: string }>();
  const [code, setCode] = useState(codeParam ?? "");
  const [data, setData] = useState<VerificationData | null>(null);
  const [loading, setLoading] = useState(!!codeParam);
  const [error, setError] = useState<string | null>(null);

  const lookup = useCallback(async (value: string) => {
    const clean = value.trim().toUpperCase();
    if (!clean) return;
    setLoading(true);
    setError(null);
    try {
      const res: any = await signatureService.verify(clean);
      setData(res?.data?.data ?? res?.data);
    } catch (e: any) {
      setData(null);
      setError(
        e?.response?.data?.message ??
          "Código não encontrado. Confira os caracteres impressos no rodapé do documento.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (codeParam) void lookup(codeParam);
  }, [codeParam, lookup]);

  const status = data ? STATUS_LABEL[data.status] ?? { text: data.status, tone: "warn" as Tone } : null;
  const tone: Tone = status?.tone ?? "warn";

  return (
    <div className="force-light min-h-screen bg-background px-3 py-6 sm:px-4 sm:py-10">
      <Toaster />
      <div className="mx-auto w-full max-w-3xl">
        {/* UM cartão. As seções internas se separam por filete (divide-y) e por
            escala tipográfica — não por bordas próprias. */}
        <Card className="overflow-hidden">
          <div className="divide-y divide-border">
            {/* ── Timbre + busca ─────────────────────────────────────────── */}
            <header className="px-4 py-5 sm:px-7 sm:py-6">
              <img
                src="/logo.png"
                alt={COMPANY_INFO.name}
                className="h-12 object-contain sm:h-14"
              />
              <h1 className="mt-4 text-lg font-semibold leading-tight text-foreground sm:text-xl">
                Verificação de autenticidade
              </h1>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Informe o código impresso no rodapé do documento para conferir a validade de um
                orçamento assinado eletronicamente.
              </p>

              {/* <form> + type="submit": sem isso, Enter (e o botão "Ir" do teclado
                  do celular) não faziam nada — e esta é a única interação da página. */}
              <form
                className="mt-4 flex gap-2"
                onSubmit={e => {
                  e.preventDefault();
                  void lookup(code);
                }}
              >
                <Input
                  placeholder="XXXX-XXXX-XXXX"
                  value={code}
                  onChange={v => setCode(String(v ?? "").toUpperCase())}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono tracking-[0.15em]"
                />
                <Button type="submit" disabled={loading} className="shrink-0">
                  {loading ? (
                    <IconLoader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <IconSearch className="h-4 w-4" />
                  )}
                  <span className="ml-1.5 hidden sm:inline">Verificar</span>
                </Button>
              </form>
            </header>

            {/* ── Código não encontrado ──────────────────────────────────── */}
            {error && (
              <div className="flex items-start gap-3 bg-red-50 px-4 py-4 sm:px-7">
                <IconAlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                <p className="text-sm leading-relaxed text-red-900">{error}</p>
              </div>
            )}

            {data && (
              <>
                {/* ── Veredito ───────────────────────────────────────────── */}
                <div className={`px-4 py-6 text-center sm:px-7 ${TONE_BAND[tone]}`}>
                  {tone === "ok" ? (
                    <IconCircleCheck className="mx-auto h-10 w-10 text-green-700" />
                  ) : tone === "bad" ? (
                    <IconX className="mx-auto h-10 w-10 text-red-600" />
                  ) : (
                    <IconClock className="mx-auto h-10 w-10 text-amber-600" />
                  )}
                  <p className={`mt-2 text-base font-semibold sm:text-lg ${TONE_TEXT[tone]}`}>
                    {status?.text}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Orçamento nº {data.budgetNumber}
                  </p>
                  <p className="mt-2 break-all font-mono text-xs tracking-[0.18em] text-muted-foreground">
                    {data.verificationCode}
                  </p>
                  {data.sealedAt && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Selado em {new Date(data.sealedAt).toLocaleString("pt-BR")}
                      {data.padesLevel ? ` · PAdES ${data.padesLevel}` : ""}
                    </p>
                  )}
                </div>

                {/* ── Trilha de auditoria: recomputa a cadeia de hash no servidor ─ */}
                <Section title="Trilha de auditoria">
                  <div className="flex items-start gap-3">
                    {data.auditChain.valid ? (
                      <IconShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-green-700" />
                    ) : (
                      <IconShieldX className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {data.auditChain.valid
                          ? "Trilha de auditoria íntegra"
                          : "Trilha de auditoria comprometida"}
                      </p>
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {data.auditChain.events} eventos encadeados por hash
                        {data.auditChain.reason ? ` · ${data.auditChain.reason}` : ""}
                      </p>
                    </div>
                  </div>
                </Section>

                {/* ── Metadados do documento ─────────────────────────────── */}
                <Section title="Documento">
                  <dl className="space-y-3">
                    <Row label="Emitido por" value={`${data.issuer.name} · ${data.issuer.cnpj}`} />
                    {data.customer.name && (
                      <Row
                        label="Cliente"
                        value={`${data.customer.name}${data.customer.cnpj ? ` · ${data.customer.cnpj}` : ""}`}
                      />
                    )}
                    <Row label="SHA-256 do original" value={data.originalSha256} mono />
                    {data.finalSha256 && (
                      <Row label="SHA-256 do documento assinado" value={data.finalSha256} mono />
                    )}
                    {data.certSerialNumber && (
                      <Row
                        label="Série do certificado ICP-Brasil"
                        value={data.certSerialNumber}
                        mono
                      />
                    )}
                  </dl>
                </Section>

                {/* ── Roster ─────────────────────────────────────────────── */}
                <Section title="Signatários">
                  <ul className="divide-y divide-border/70">
                    {data.signers.map((s, i) => {
                      const state = SIGNER_STATE[s.status] ?? { label: "Pendente", icon: "wait" };
                      const identity = [s.cargo, s.cpfMasked].filter(Boolean).join(" · ");
                      return (
                        <li key={i} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                          {state.icon === "ok" ? (
                            <IconCircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-green-700" />
                          ) : state.icon === "bad" ? (
                            <IconX className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                          ) : (
                            <IconClock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                              <span className="text-sm font-medium text-foreground">{s.name}</span>
                              <span
                                className={`text-xs ${state.icon === "bad" ? "text-red-700" : "text-muted-foreground"}`}
                              >
                                {/* A data só fala por si quando a assinatura VALE. Num
                                    signatário anulado ou que recusou, o carimbo de hora
                                    engana — ali o que importa é o rótulo. */}
                                {state.icon === "ok" && s.signedAt
                                  ? new Date(s.signedAt).toLocaleString("pt-BR")
                                  : state.label}
                              </span>
                            </div>
                            {identity && <p className="text-xs text-muted-foreground">{identity}</p>}
                            <p className="text-[11px] leading-relaxed text-muted-foreground">
                              {AUTH_LABEL[s.authMethod] ?? s.authMethod}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </Section>
              </>
            )}

            {/* ── Nota legal: o pé da certidão, dentro da mesma folha ─────── */}
            <p className="px-4 py-5 text-[11px] leading-relaxed text-muted-foreground sm:px-7">
              As assinaturas eletrônicas têm validade jurídica nos termos da Medida Provisória nº
              2.200-2/2001, art. 10, § 2º. O selo ICP-Brasil deste documento também pode ser
              validado em{" "}
              <a
                className="text-primary underline underline-offset-4 hover:opacity-90"
                href="https://validar.iti.gov.br/"
                target="_blank"
                rel="noreferrer"
              >
                validar.iti.gov.br
              </a>
              .
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

/**
 * Seção interna da certidão. O título é um rótulo tipográfico (versalete
 * pequeno), não um cabeçalho de cartão — é ele que substitui a borda que
 * separava os blocos antes.
 */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="px-4 py-5 sm:px-7">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="shrink-0 text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground sm:w-52">
        {label}
      </dt>
      <dd className={`min-w-0 break-all text-foreground ${mono ? "font-mono text-xs" : "text-sm"}`}>
        {value}
      </dd>
    </div>
  );
}
