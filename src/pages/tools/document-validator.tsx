/**
 * Validador de documentos — a versão INTERNA do portal público `/v/:code`.
 *
 * Mesma fonte (`GET /assinatura/verificar/:code`) e mesmos rótulos
 * (`components/public/signature/verification`), mas no layout do sistema e com
 * o que só faz sentido para quem está do lado de dentro:
 *
 *  - conferir o ARQUIVO em mãos: o SHA-256 é calculado no navegador e comparado
 *    com cada hash que a cerimônia conhece (original, assinado, recortes,
 *    aditivo). O PDF nunca sai da máquina;
 *  - copiar/abrir o link público para mandar ao cliente;
 *  - o código fica na URL (`?codigo=`), então a consulta sobrevive a F5 e pode
 *    ser repassada a um colega.
 *
 * Acesso: ADMIN + COMMERCIAL. O gate real é `route-privileges`
 * (`/ferramentas/validador-de-documentos`); menu e hub apenas espelham.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import {
  IconAlertCircle,
  IconCircleCheck,
  IconClock,
  IconCopy,
  IconExternalLink,
  IconFileCertificate,
  IconFilePlus,
  IconFileSearch,
  IconFileText,
  IconFileUpload,
  IconFiles,
  IconLoader2,
  IconSearch,
  IconShieldCheck,
  IconShieldX,
  IconUsers,
  IconX,
} from "@tabler/icons-react";
import type { Icon as TablerIcon } from "@tabler/icons-react";

import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/components/ui/sonner";
import { signatureService } from "@/api-client/signature";
import { apiStatusCode, extractApiMessage } from "@/components/public/signature/identity";
import {
  AUTH_LABEL,
  SIGNER_STATE,
  STATUS_LABEL,
  type Tone,
  type VerificationData,
} from "@/components/public/signature/verification";
import { routes, FAVORITE_PAGES } from "@/constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { cn } from "@/lib/utils";

const TONE_BADGE: Record<Tone, "success" | "warning" | "destructive"> = {
  ok: "success",
  warn: "warning",
  bad: "destructive",
};

const TONE_PANEL: Record<Tone, string> = {
  ok: "border-green-600/30 bg-green-500/10 text-green-800 dark:text-green-300",
  warn: "border-amber-600/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  bad: "border-red-600/30 bg-red-500/10 text-red-800 dark:text-red-300",
};

interface FileCheck {
  name: string;
  sha256: string;
  /** Rótulo do hash que bateu; null quando o arquivo não pertence ao código. */
  match: string | null;
}

async function sha256Hex(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Todo hash que a cerimônia conhece, com o nome do que ele identifica. */
function knownHashes(data: VerificationData): Array<{ label: string; hash: string }> {
  const out: Array<{ label: string; hash: string }> = [];
  const push = (label: string, hash: string | null | undefined) => {
    if (hash) out.push({ label, hash: hash.toLowerCase() });
  };
  push("Documento assinado", data.finalSha256);
  push("Documento original (antes das assinaturas)", data.originalSha256);
  for (const d of data.documents ?? []) {
    push(`${d.label} — assinado`, d.finalSha256);
    push(`${d.label} — original`, d.originalSha256);
  }
  push("Aditivo de identificação do veículo", data.addendum?.sha256);
  return out;
}

const HOW_IT_WORKS = [
  { title: "Informe o código", text: "Impresso no rodapé de todas as páginas do orçamento assinado." },
  { title: "Veja o veredito", text: "Estado da assinatura, trilha de auditoria e quem assinou." },
  { title: "Confira o PDF", text: "Compare o arquivo recebido com o registrado na assinatura." },
];

const EMPTY_CODE_MESSAGE = "Informe o código impresso no rodapé do documento.";

const formatDateTime = (iso: string) => new Date(iso).toLocaleString("pt-BR");

export function DocumentValidatorPage() {
  usePageTracker({ title: "Validador de Documentos", icon: "verify" });

  const [searchParams, setSearchParams] = useSearchParams();
  const codeParam = searchParams.get("codigo") ?? "";

  const [code, setCode] = useState(codeParam);
  const [data, setData] = useState<VerificationData | null>(null);
  // Já nasce carregando quando a URL traz `?codigo=`: sem isso a primeira
  // pintura mostrava "Nenhum documento consultado" antes do efeito disparar.
  const [loading, setLoading] = useState(!!codeParam);
  const [error, setError] = useState<string | null>(null);
  const [fileCheck, setFileCheck] = useState<FileCheck | null>(null);
  const [hashing, setHashing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Só a ÚLTIMA consulta pode escrever o resultado: trocar de código com a
  // anterior ainda em voo mostraria o veredito do código errado.
  const requestSeq = useRef(0);
  // Aviso a exibir quando a URL for limpa pelo próprio submit vazio — o efeito
  // da URL zera o estado, e sem isto apagaria o aviso logo após mostrá-lo.
  const pendingEmptyError = useRef<string | null>(null);

  const lookup = useCallback(async (value: string) => {
    const clean = value.trim().toUpperCase();
    if (!clean) {
      requestSeq.current++; // descarta consulta ainda em voo
      setLoading(false);
      setData(null);
      setFileCheck(null);
      setError(EMPTY_CODE_MESSAGE);
      return;
    }
    const seq = ++requestSeq.current;
    setLoading(true);
    setError(null);
    setFileCheck(null);
    try {
      const res: any = await signatureService.verify(clean);
      if (seq !== requestSeq.current) return;
      setData(res?.data?.data ?? res?.data);
    } catch (e) {
      if (seq !== requestSeq.current) return;
      setData(null);
      // Mesma regra do portal: só o 404 pode ser culpa da digitação.
      setError(
        apiStatusCode(e) === 404
          ? "Código não encontrado. Confira os caracteres impressos no rodapé do documento."
          : extractApiMessage(e, "Não foi possível verificar o código agora. Tente novamente em instantes."),
      );
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, []);

  // A URL é a fonte da consulta: submit grava `?codigo=`, e este efeito busca.
  useEffect(() => {
    setCode(codeParam);
    if (codeParam) void lookup(codeParam);
    else {
      requestSeq.current++;
      setLoading(false);
      setData(null);
      setError(pendingEmptyError.current);
      pendingEmptyError.current = null;
      setFileCheck(null);
    }
  }, [codeParam, lookup]);

  const submit = () => {
    const clean = code.trim().toUpperCase();
    if (clean && clean === codeParam) {
      void lookup(clean); // mesmo código: força nova consulta
      return;
    }
    if (!clean) {
      // Campo vazio com `?codigo=` na URL: limpa a URL também, senão um F5
      // ressuscitaria a consulta que o usuário acabou de apagar.
      if (codeParam) {
        pendingEmptyError.current = EMPTY_CODE_MESSAGE;
        setSearchParams({});
      } else {
        void lookup("");
      }
      return;
    }
    setSearchParams({ codigo: clean });
  };

  // Soltar um PDF FORA da área de conferência faz o navegador abrir o arquivo
  // no lugar do sistema. Nesta página, arrastar arquivo é o gesto esperado.
  useEffect(() => {
    const block = (e: DragEvent) => {
      if (e.dataTransfer?.types?.includes("Files")) e.preventDefault();
    };
    window.addEventListener("dragover", block);
    window.addEventListener("drop", block);
    return () => {
      window.removeEventListener("dragover", block);
      window.removeEventListener("drop", block);
    };
  }, []);

  const hashes = useMemo(() => (data ? knownHashes(data) : []), [data]);

  const checkFile = async (file: File | undefined) => {
    if (!file || !data) return;
    if (!window.crypto?.subtle) {
      toast.error("Este navegador não permite calcular o hash do arquivo (conexão não segura).");
      return;
    }
    setHashing(true);
    try {
      const sha256 = await sha256Hex(file);
      const hit = hashes.find((h) => h.hash === sha256);
      setFileCheck({ name: file.name, sha256, match: hit?.label ?? null });
    } catch {
      toast.error("Não foi possível ler o arquivo.");
    } finally {
      setHashing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const publicUrl = data ? `${window.location.origin}${routes.customer.signatureVerify(data.verificationCode)}` : "";

  const copyPublicUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success("Link de verificação copiado.");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  };

  const status = data ? (STATUS_LABEL[data.status] ?? { text: data.status, tone: "warn" as Tone }) : null;
  const tone: Tone = status?.tone ?? "warn";

  return (
    <div className="h-full flex flex-col px-4 pt-4">
      <div className="flex-shrink-0">
        <PageHeader
          title="Validador de Documentos"
          icon={IconFileCertificate}
          favoritePage={FAVORITE_PAGES.FERRAMENTAS_VALIDADOR_DOCUMENTOS}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Ferramentas", href: routes.tools.root },
            { label: "Validador de Documentos" },
          ]}
        />
      </div>

      {/* Leitura de cima para baixo, cada bloco na largura toda: consulta →
          veredito → detalhes. Colunas só aparecem quando há resultado, e
          alinhadas pelo topo — cartões de alturas diferentes lado a lado, sem
          conteúdo, pareciam soltos. */}
      <div className="flex-1 overflow-y-auto pb-6">
        <div className="mt-4 space-y-4">
          {/* ── 1. Consulta ─────────────────────────────────────────────── */}
          <Card>
            <CardContent className="p-4 sm:p-5">
              <form
                className="flex flex-col gap-3 sm:flex-row sm:items-end"
                onSubmit={(e) => {
                  e.preventDefault();
                  submit();
                }}
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Label htmlFor="verification-code">Código de verificação</Label>
                  <Input
                    id="verification-code"
                    placeholder="XXXX-XXXX-XXXX"
                    value={code}
                    onChange={(v) => setCode(String(v ?? "").toUpperCase())}
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    className="font-mono tracking-[0.15em]"
                  />
                </div>
                <Button type="submit" disabled={loading} className="sm:w-36">
                  {loading ? <IconLoader2 className="h-4 w-4 animate-spin" /> : <IconSearch className="h-4 w-4" />}
                  <span className="ml-1.5">Verificar</span>
                </Button>
              </form>
              <p className="mt-2 text-xs text-muted-foreground">
                O código está impresso no rodapé de todas as páginas do orçamento assinado.
              </p>

              {error && (
                <div className="mt-3 flex items-start gap-2 rounded-md border border-red-600/30 bg-red-500/10 px-3 py-2.5">
                  <IconAlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                  <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── 2a. Sem resultado: um bloco só, explicando o fluxo ──────── */}
          {!data && (
            <Card>
              <CardContent className="p-6 sm:p-8">
                {loading ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                    <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-sm font-medium">Consultando…</p>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col items-center text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                        <IconFileSearch className="h-6 w-6 text-primary" />
                      </div>
                      <p className="mt-3 text-sm font-medium">Nenhum documento consultado</p>
                      <p className="mt-1 max-w-md text-xs text-muted-foreground">
                        Confira a autenticidade de um orçamento assinado eletronicamente.
                      </p>
                    </div>
                    <ol className="mx-auto mt-6 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
                      {HOW_IT_WORKS.map((step, i) => (
                        <li key={step.title} className="flex gap-3 rounded-lg border bg-muted/30 p-3">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{step.title}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{step.text}</p>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {data && status && (
            <>
              {/* ── 2b. Veredito + ações do link público ─────────────────── */}
              <Card className={cn("border", TONE_PANEL[tone])}>
                <CardContent className="flex flex-col gap-4 p-4 sm:p-5 md:flex-row md:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-4">
                    {tone === "ok" ? (
                      <IconCircleCheck className="h-10 w-10 shrink-0" />
                    ) : tone === "bad" ? (
                      <IconX className="h-10 w-10 shrink-0" />
                    ) : (
                      <IconClock className="h-10 w-10 shrink-0" />
                    )}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-semibold">{status.text}</p>
                        <Badge variant={TONE_BADGE[tone]}>Orçamento nº {data.budgetNumber}</Badge>
                      </div>
                      <p className="mt-1 break-all font-mono text-xs tracking-[0.18em] opacity-80">{data.verificationCode}</p>
                      {data.sealedAt && (
                        <p className="mt-1 text-xs opacity-80">
                          Selado em {formatDateTime(data.sealedAt)}
                          {data.padesLevel ? ` · PAdES ${data.padesLevel}` : ""}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button type="button" variant="outline" size="sm" className="bg-background" onClick={copyPublicUrl}>
                      <IconCopy className="mr-1.5 h-4 w-4" />
                      Copiar link público
                    </Button>
                    <Button type="button" variant="outline" size="sm" className="bg-background" asChild>
                      <a href={publicUrl} target="_blank" rel="noreferrer">
                        <IconExternalLink className="mr-1.5 h-4 w-4" />
                        Abrir portal
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* ── 3. Detalhes (2/3) · Conferência (1/3) ──────────────── */}
              <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
                <div className="space-y-4 lg:col-span-2">
                  <SectionCard icon={IconFileText} title="Documento">
                    <dl className="space-y-3">
                      <Row label="Emitido por" value={`${data.issuer.name} · ${data.issuer.cnpj}`} />
                      {data.customer.name && (
                        <Row
                          label="Cliente"
                          value={`${data.customer.name}${data.customer.cnpj ? ` · ${data.customer.cnpj}` : ""}`}
                        />
                      )}
                      <Row label="SHA-256 do original" value={data.originalSha256} mono />
                      {data.finalSha256 && <Row label="SHA-256 do assinado" value={data.finalSha256} mono />}
                      {data.certSerialNumber && <Row label="Série do certificado ICP-Brasil" value={data.certSerialNumber} mono />}
                    </dl>
                  </SectionCard>

                  {data.addendum && (
                    <SectionCard
                      icon={IconFilePlus}
                      title="Aditivo de identificação do veículo"
                      description={'Assinado antes da chegada do veículo, com placa/chassi "a registrar" — a identificação foi declarada depois nesta folha, selada com o mesmo certificado.'}
                    >
                      <dl className="space-y-3">
                        {data.addendum.sha256 && <Row label="SHA-256 do aditivo" value={data.addendum.sha256} mono />}
                        {data.addendum.sealedAt && <Row label="Selado em" value={formatDateTime(data.addendum.sealedAt)} />}
                        {data.addendum.padesLevel && <Row label="Selo" value={`PAdES ${data.addendum.padesLevel}`} />}
                      </dl>
                    </SectionCard>
                  )}

                  {(data.documents?.length ?? 0) > 1 && (
                    <SectionCard
                      icon={IconFiles}
                      title="Documentos desta assinatura"
                      description="Cada responsável recebeu as seções da própria função, em arquivo e selo próprios."
                    >
                      <ul className="divide-y divide-border">
                        {(data.documents ?? []).map((d) => (
                          <li key={d.originalSha256} className="py-3 first:pt-0 last:pb-0">
                            <p className="text-sm font-medium">
                              {d.label}
                              {d.isFull && <span className="ml-2 text-xs font-normal text-muted-foreground">(o instrumento)</span>}
                            </p>
                            <dl className="mt-2 space-y-2">
                              <Row label="SHA-256 do original" value={d.originalSha256} mono />
                              {d.finalSha256 && <Row label="SHA-256 do assinado" value={d.finalSha256} mono />}
                              {d.padesLevel && <Row label="Selo" value={`PAdES ${d.padesLevel}`} />}
                            </dl>
                          </li>
                        ))}
                      </ul>
                    </SectionCard>
                  )}

                  <SectionCard icon={IconUsers} title="Signatários">
                    <ul className="divide-y divide-border">
                      {data.signers.map((s, i) => {
                        const state = SIGNER_STATE[s.status] ?? { label: "Pendente", icon: "wait" as const };
                        const identity = [s.cargo, s.cpfMasked].filter(Boolean).join(" · ");
                        return (
                          <li key={i} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                            <SignerIcon icon={state.icon} />
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                                <span className="text-sm font-medium">{s.name}</span>
                                <span
                                  className={cn(
                                    "text-xs",
                                    state.icon === "bad" ? "text-red-700 dark:text-red-400" : "text-muted-foreground",
                                  )}
                                >
                                  {state.icon === "ok" && s.signedAt ? formatDateTime(s.signedAt) : state.label}
                                </span>
                              </div>
                              {identity && <p className="text-xs text-muted-foreground">{identity}</p>}
                              <p className="text-[11px] text-muted-foreground">{AUTH_LABEL[s.authMethod] ?? s.authMethod}</p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </SectionCard>
                </div>

                <div className="space-y-4">
                  <SectionCard icon={data.auditChain.valid ? IconShieldCheck : IconShieldX} title="Trilha de auditoria">
                    <div
                      className={cn(
                        "rounded-md border px-3 py-2.5",
                        data.auditChain.valid ? TONE_PANEL.ok : TONE_PANEL.bad,
                      )}
                    >
                      <p className="text-sm font-medium">
                        {data.auditChain.valid ? "Íntegra" : "Comprometida"}
                      </p>
                      <p className="mt-0.5 text-xs opacity-80">
                        {data.auditChain.events} eventos encadeados por hash
                        {data.auditChain.reason ? ` · ${data.auditChain.reason}` : ""}
                      </p>
                    </div>
                  </SectionCard>

                  <SectionCard
                    icon={IconFileUpload}
                    title="Conferir arquivo"
                    description="Compare o PDF recebido com o registrado na assinatura. O arquivo é lido só no seu navegador."
                  >
                    <div className="space-y-3">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="application/pdf,.pdf"
                        className="hidden"
                        onChange={(e) => void checkFile(e.target.files?.[0])}
                      />
                      <div
                        role="button"
                        tabIndex={hashing ? -1 : 0}
                        aria-disabled={hashing}
                        onClick={() => !hashing && fileInputRef.current?.click()}
                        onKeyDown={(e) => {
                          if ((e.key === "Enter" || e.key === " ") && !hashing) {
                            e.preventDefault();
                            fileInputRef.current?.click();
                          }
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (!hashing) void checkFile(e.dataTransfer.files?.[0]);
                        }}
                        className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border px-4 py-6 text-center transition-colors hover:bg-muted"
                      >
                        {hashing ? (
                          <IconLoader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        ) : (
                          <IconFileUpload className="h-6 w-6 text-muted-foreground" />
                        )}
                        <span className="text-sm font-medium">Clique ou arraste o PDF aqui</span>
                      </div>

                      {fileCheck && (
                        <div className={cn("rounded-md border px-3 py-2.5", fileCheck.match ? TONE_PANEL.ok : TONE_PANEL.bad)}>
                          <div className="flex items-start gap-2">
                            {fileCheck.match ? (
                              <IconCircleCheck className="mt-0.5 h-4 w-4 shrink-0" />
                            ) : (
                              <IconX className="mt-0.5 h-4 w-4 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-medium">
                                {fileCheck.match ? `Arquivo confere: ${fileCheck.match}` : "Arquivo NÃO confere com este código"}
                              </p>
                              <p className="break-all text-xs opacity-80">{fileCheck.name}</p>
                              <p className="mt-1 break-all font-mono text-[11px] opacity-80">{fileCheck.sha256}</p>
                              {!fileCheck.match && (
                                <p className="mt-1 text-xs opacity-90">
                                  Qualquer alteração no PDF — inclusive salvar novamente ou imprimir em PDF — muda o hash.
                                  Peça o arquivo original ao remetente.
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </SectionCard>

                  <p className="px-1 text-[11px] leading-relaxed text-muted-foreground">
                    Assinaturas eletrônicas com validade jurídica nos termos da MP nº 2.200-2/2001, art. 10, § 2º. O selo
                    ICP-Brasil também pode ser validado em{" "}
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
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** Cabeçalho único para todo cartão de resultado: ícone + título (+ descrição). */
function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: TablerIcon;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
    </Card>
  );
}

function SignerIcon({ icon }: { icon: "ok" | "bad" | "wait" }): ReactNode {
  if (icon === "ok") return <IconCircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-green-700 dark:text-green-400" />;
  if (icon === "bad") return <IconX className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />;
  return <IconClock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />;
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-4">
      <dt className="shrink-0 text-xs font-medium text-muted-foreground sm:w-48">{label}</dt>
      <dd className={cn("min-w-0 break-all", mono ? "font-mono text-xs" : "text-sm")}>{value}</dd>
    </div>
  );
}

export default DocumentValidatorPage;
