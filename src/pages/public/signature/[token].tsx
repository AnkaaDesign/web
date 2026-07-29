/**
 * Página pública de assinatura do orçamento.
 *
 * Autenticada pelo TOKEN pessoal do signatário, que chega por e-mail. Roda
 * FORA do AuthProvider, o que traz duas consequências concretas:
 *
 *  1. precisa do seu próprio `<Toaster />` — o único montado no App fica dentro do
 *     catch-all autenticado, então todo toast disparado de uma rota pública é
 *     invisível hoje (a página pública de orçamento sofre disso agora mesmo);
 *  2. a rota TEM de viver sob `/cliente` — o `MobileUsageGuard` redireciona para
 *     `/install` qualquer caminho móvel fora de uma allowlist, e celular é
 *     exatamente onde o cliente vai assinar.
 *
 * Fluxo: termo de aceite → revisar documento → conferir identidade (modal) →
 * código no e-mail → 4 declarações → assinar.
 *
 * A tela é um DOCUMENTO, não um painel: nome, CPF, e-mail e cargo vêm do
 * cadastro e aparecem como linhas de leitura. Nada disso é editável — se o
 * signatário pudesse escolher o endereço que recebe o código, o OTP provaria
 * apenas que ele controla uma caixa que ele mesmo digitou. A única coisa que
 * ele digita é o miolo que a máscara esconde, e isso acontece no modal disparado
 * por "Enviar código por e-mail", como ato deliberado e único.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { signatureService, type PublicSignerState } from "@/api-client/signature";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Toaster, toast } from "@/components/ui/sonner";
import { InlineDocumentPages } from "@/components/public/inline-document-pages";
import { SignerIdentityCard } from "@/components/public/signature/signer-identity-card";
import {
  IdentityConfirmationDialog,
  type IdentityConfirmation,
} from "@/components/public/signature/identity-confirmation-dialog";
import {
  extractApiMessage,
  isExpiredLinkError,
  isTerminalSignatureError,
  maskCpfCgu,
  parseCooldownSeconds,
} from "@/components/public/signature/identity";
import { QuoteChangeList } from "@/components/signature/quote-change-list";
import {
  IconAlertCircle,
  IconCheck,
  IconChevronRight,
  IconCircleCheck,
  IconClock,
  IconClockOff,
  IconDeviceMobileMessage,
  IconMail,
  IconExternalLink,
  IconFileTypePdf,
  IconLoader2,
  IconShieldCheck,
  IconX,
} from "@tabler/icons-react";
import { COMPANY_INFO } from "@/config/company";

/**
 * A porta de consentimento NÃO abre mais no carregamento.
 *
 * Ela pedia o aceite antes de o signatário ter feito qualquer coisa — antes
 * mesmo de ver o documento — e reaparecia como um muro na frente do orçamento.
 * Agora o aceite é o último passo antes de assinar: abre sozinho depois que o
 * código sai por e-mail, junto das quatro declarações, que antes ficavam soltas
 * num quadro cinza do cartão do código.
 */
type Step = "review" | "code" | "done" | "refused";

export default function PublicSignaturePage() {
  const { token = "" } = useParams<{ token: string }>();

  const [state, setState] = useState<PublicSignerState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Link vencido tem tela própria: o que morreu foi o LINK, não o orçamento. */
  const [linkExpired, setLinkExpired] = useState(false);

  const [step, setStep] = useState<Step>("review");
  const [busy, setBusy] = useState(false);

  const [identityOpen, setIdentityOpen] = useState(false);
  /** Identidade já aceita pela API — sobrevive ao "Voltar" e alimenta o reenvio. */
  const [confirmed, setConfirmed] = useState<IdentityConfirmation | null>(null);

  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [destinationMask, setDestinationMask] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);

  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [refusing, setRefusing] = useState(false);
  const [refusalReason, setRefusalReason] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);
  /** Termo + declarações. Abre sozinho quando o código é enviado. */
  const [termsOpen, setTermsOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res: any = await signatureService.getPublicState(token);
      const data: PublicSignerState = res?.data?.data ?? res?.data;
      setState(data);
      setLoadError(null);
      setLinkExpired(false);
      if (data?.signer?.status === "SIGNED") setStep("done");
      else if (data?.signer?.status === "REFUSED") setStep("refused");
    } catch (e) {
      const message = extractApiMessage(
        e,
        "Não foi possível abrir este link de assinatura. Ele pode ter expirado ou sido substituído.",
      );
      setLoadError(message);
      // 403 de `tokenExpiresAt`: a mensagem já traz a data do vencimento.
      setLinkExpired(isExpiredLinkError(e, message));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  const allAccepted = useMemo(
    () => (state?.declarations ?? []).every(d => accepted[d.key]),
    [state, accepted],
  );

  /**
   * Um aceite na tela, as quatro declarações no servidor.
   *
   * O signatário marca UMA caixa cujo texto abrange as quatro declarações do
   * §9.2 — quatro caixas viravam quatro cliques mecânicos sobre o mesmo
   * consentimento. O que a trilha registra não muda: `handleSign` continua
   * enviando as quatro chaves, e é o teor declarado que tem peso probatório.
   */
  const acceptAll = useCallback(
    (value: boolean) => {
      setConsentChecked(value);
      setAccepted(
        Object.fromEntries((state?.declarations ?? []).map(d => [d.key, value])),
      );
    },
    [state],
  );

  /** Cargo que vale para as declarações: cadastro > confirmado > tentativa anterior. */
  const effectiveCargo =
    state?.signer?.registryCargo?.trim() ||
    confirmed?.cargo?.trim() ||
    state?.signer?.cargo?.trim() ||
    "";

  // O PDF NÃO pode ser embutido pela URL da API: o helmet global manda
  // `X-Frame-Options: DENY`, e mesmo sem ele web (:5173) e API (:3030) são
  // origens distintas. Buscar os bytes e criar um blob: URL resolve — blob é
  // same-origin em relação à página — e continua valendo em produção, onde os
  // domínios também diferem.
  const documentUrl = useMemo(() => signatureService.documentUrl(token), [token]);

  /**
   * Largura do PDF medida no container.
   *
   * Era fixa em 840px — num iPhone (390px de viewport) isso empurrava a PÁGINA
   * INTEIRA para 863px de rolagem horizontal: os cartões saíam do lugar e o
   * signatário tinha que arrastar de lado para ler qualquer coisa. E o celular é
   * onde a assinatura acontece, porque o link chega por WhatsApp.
   */
  const documentBoxRef = useRef<HTMLDivElement | null>(null);
  const [documentWidth, setDocumentWidth] = useState(840);

  useEffect(() => {
    const el = documentBoxRef.current;
    if (!el) return;
    // PISO DE LEGIBILIDADE. Acompanhar o container cegamente resolvia a rolagem
    // da página, mas num iPhone rendia uma folha A4 com ~345px de largura — corpo
    // de texto em torno de 5px, ilegível. Ninguém assina o que não consegue ler.
    // Abaixo de 560px o documento passa a rolar DENTRO do quadro (que já tem
    // overflow-x-auto), e a página continua sem rolagem horizontal.
    const measure = () => setDocumentWidth(Math.max(560, Math.min(840, el.clientWidth)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [state]);

  /**
   * Geolocalização é OPCIONAL e a recusa é registrada como fato.
   * Nunca bloqueia a assinatura: exigir GPS destruiria conversão e a coordenada
   * não é o que sustenta a autoria — o código no e-mail cadastrado é.
   */
  const collectGeo = (): Promise<{ lat: number; lon: number; accuracy?: number } | null> =>
    new Promise(resolve => {
      if (!navigator.geolocation) return resolve(null);
      const timer = setTimeout(() => resolve(null), 6000);
      navigator.geolocation.getCurrentPosition(
        pos => {
          clearTimeout(timer);
          resolve({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        () => {
          clearTimeout(timer);
          resolve(null);
        },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 },
      );
    });

  /**
   * Pede o código. Devolve a mensagem de erro em vez de exibi-la: quem chamou
   * decide onde ela aparece — dentro do modal (conferência) ou sob o campo do
   * código (reenvio). Nos dois casos o que foi digitado continua no lugar.
   */
  const sendCode = useCallback(
    async (values: IdentityConfirmation): Promise<string | null> => {
      setBusy(true);
      setStepError(null);
      try {
        const res: any = await signatureService.requestCode(token, {
          cpf: values.cpf,
          cargo: values.cargo,
          emailConfirm: values.emailConfirm,
        });
        const data = res?.data?.data ?? res?.data;
        setChallengeId(data.challengeId);
        setDestinationMask(data.destinationMask);
        setSecondsLeft(60);
        setConfirmed(values);
        setIdentityOpen(false);
        setStep("code");
        // Só depois do código: aceitar o termo é o ato imediatamente anterior a
        // assinar, não um pedágio na entrada da página.
        setTermsOpen(true);
        toast.success(`Código enviado para ${data.destinationMask}`);
        return null;
      } catch (e) {
        const message = extractApiMessage(e, "Não foi possível enviar o código.");
        // "Aguarde 42s" vira contagem no botão, em vez de a mesma recusa a cada toque.
        const wait = parseCooldownSeconds(message);
        if (wait) setSecondsLeft(wait);
        // Prazo vencido, coleta cancelada, link já usado: manter o formulário
        // aberto não ajuda ninguém — recarrega o estado e a página se redesenha.
        if (isTerminalSignatureError(e, message)) void load();
        return message;
      } finally {
        setBusy(false);
      }
    },
    [token, load],
  );

  const handleResend = async () => {
    if (!confirmed) {
      setIdentityOpen(true);
      return;
    }
    const message = await sendCode(confirmed);
    if (message) setStepError(message);
  };

  const handleSign = async () => {
    setStepError(null);
    if (code.replace(/\D/g, "").length !== 6)
      return setStepError("Digite os 6 dígitos do código.");
    if (!allAccepted) return setStepError("Aceite todas as declarações para assinar.");
    setBusy(true);
    try {
      const geo = await collectGeo();
      await signatureService.sign(token, {
        challengeId,
        code: code.replace(/\D/g, ""),
        declarations: (state?.declarations ?? []).map(d => d.key),
        clientTimestamp: new Date().toISOString(),
        geo,
      });
      // Sem toast próprio: o `api-client` já anuncia a mensagem que o servidor
      // devolve neste POST ("Orçamento assinado com sucesso."), e o cartão verde
      // logo abaixo repete o fato. Um `toast.success` aqui empilhava dois avisos
      // idênticos na tela do cliente.
      setStep("done");
      void load();
    } catch (e) {
      const message = extractApiMessage(e, "Não foi possível concluir a assinatura.");
      setStepError(message);
      // Só apaga o código quando foi ELE que o servidor recusou. Numa queda de
      // conexão o que o signatário digitou está certo, e limpar o campo o obriga
      // a sair da página para reler o WhatsApp — justamente no passo final.
      if (/c[óo]digo/i.test(message)) setCode("");
      if (isTerminalSignatureError(e, message)) void load();
    } finally {
      setBusy(false);
    }
  };

  /**
   * Recusa — passa pelo MESMO código do WhatsApp que a assinatura.
   *
   * O servidor exige `challengeId` + `code` (e CPF/cargo já gravados): sem isso,
   * quem recebesse o link encaminhado matava o negócio anonimamente. Por isso a
   * recusa só existe depois da etapa do código, e reaproveita o desafio vivo.
   */
  const handleRefuse = async () => {
    setStepError(null);
    const digits = code.replace(/\D/g, "");
    if (refusalReason.trim().length < 3)
      return setStepError("Descreva o motivo da recusa.");
    if (digits.length !== 6)
      return setStepError("Digite os 6 dígitos do código para confirmar a recusa.");
    setBusy(true);
    try {
      await signatureService.refuse(token, {
        challengeId,
        code: digits,
        reason: refusalReason.trim(),
      });
      // Idem: o `api-client` já toasta "Recusa registrada." (mensagem do
      // servidor) e o cartão vermelho abaixo diz que a Ankaa foi notificada.
      setStep("refused");
    } catch (e) {
      const message = extractApiMessage(e, "Não foi possível registrar a recusa.");
      setStepError(message);
      if (isTerminalSignatureError(e, message)) void load();
    } finally {
      setBusy(false);
    }
  };

  // ---------------------------------------------------------------- estados

  if (loading) {
    return (
      <Shell>
        <div className="flex flex-col items-center gap-3 py-24 text-muted-foreground">
          <IconLoader2 className="h-8 w-8 animate-spin" />
          <p>Carregando orçamento…</p>
        </div>
      </Shell>
    );
  }

  // O TOKEN venceu — tela própria. Não é "link inválido" (nunca existiu) nem
  // "prazo do orçamento" (a coleta pode seguir viva para os outros signatários):
  // este link específico morreu, e a única saída é pedir outro.
  if (linkExpired) {
    return (
      <Shell>
        <Card className="mx-auto max-w-lg border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <IconClockOff className="h-10 w-10 text-amber-600" />
            <h2 className="text-lg font-semibold">Link de assinatura expirado</h2>
            <p className="text-sm text-muted-foreground">{loadError}</p>
            <p className="text-sm text-muted-foreground">
              Peça um novo link à {COMPANY_INFO.name} — o orçamento continua o mesmo, só
              este endereço deixou de valer.
            </p>
            <Button variant="outline" className="mt-1" asChild>
              <a
                href={`https://wa.me/${COMPANY_INFO.phoneClean}`}
                target="_blank"
                rel="noreferrer"
              >
                <IconDeviceMobileMessage className="mr-2 h-4 w-4" />
                Pedir um novo link no WhatsApp
              </a>
            </Button>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (loadError || !state) {
    return (
      <Shell>
        <Card className="mx-auto max-w-lg">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <IconAlertCircle className="h-10 w-10 text-destructive" />
            <h2 className="text-lg font-semibold">Link indisponível</h2>
            <p className="text-sm text-muted-foreground">{loadError}</p>
            <a
              className="mt-2 text-sm underline"
              href={`https://wa.me/${COMPANY_INFO.phoneClean}`}
              target="_blank"
              rel="noreferrer"
            >
              Falar com a {COMPANY_INFO.name}
            </a>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  const { envelope, signer, company, declarations } = state;
  const identityVisible = state.canSign && (step === "review" || step === "code");

  return (
    <Shell>
      <div className="mx-auto max-w-5xl space-y-4">
        {/* Cabeçalho */}
        <Card>
          {/* No celular os dois blocos empilham com um fio entre eles, ambos
              alinhados à esquerda. Com `flex-wrap` + `justify-between` o bloco do
              valor caía sozinho numa segunda linha ainda alinhado à direita,
              parecendo solto no meio do cartão. */}
          <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Orçamento</p>
              <h1 className="text-xl font-bold text-foreground">
                Nº {envelope.budgetNumber}
              </h1>
              <p className="text-sm text-muted-foreground">
                {company.name}
                {company.cnpj ? ` · ${company.cnpj}` : ""}
              </p>
            </div>
            <div className="border-t border-dashed border-border pt-3 sm:border-0 sm:pt-0 sm:text-right">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Valor total</p>
              <p className="text-xl font-bold">{envelope.total}</p>
              <p className="flex items-center gap-1 text-xs text-muted-foreground sm:justify-end">
                <IconClock className="h-3.5 w-3.5" />
                Válido até {new Date(envelope.deadlineAt).toLocaleDateString("pt-BR")}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* CONFIRMAÇÃO DA ASSINATURA — abre sozinho quando o código sai no
            WhatsApp e concentra o ato inteiro: ler o termo, aceitar, digitar o
            código e assinar. Antes isso estava espalhado entre um modal na
            abertura da página (aceite), um quadro cinza (declarações) e um cartão
            (código) — três lugares para um ato só. */}
        <Dialog open={state.canSign && termsOpen} onOpenChange={next => (busy ? undefined : setTermsOpen(next))}>
          <DialogContent
            /* force-light também aqui: o Radix monta o modal num portal preso
               ao <body>, fora do wrapper da página, então ele não herdaria o
               escopo claro. */
            className="force-light max-h-[90vh] max-w-2xl overflow-y-auto"
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <IconShieldCheck className="h-5 w-5 text-primary" />
                {refusing ? "Recusar assinatura" : "Confirmar assinatura"}
              </DialogTitle>
              <DialogDescription>
                Orçamento nº {envelope.budgetNumber} · {envelope.total} · {company.name}
              </DialogDescription>
            </DialogHeader>

            <div className="max-h-[38vh] space-y-3 overflow-y-auto rounded-lg border border-border bg-muted/50 p-4 text-sm leading-relaxed">
              <p className="font-medium text-foreground">
                Você foi indicado por {COMPANY_INFO.name} para revisar e assinar
                eletronicamente o orçamento nº {envelope.budgetNumber}, no valor de{" "}
                {envelope.total}.
              </p>
              <p className="text-muted-foreground">{envelope.acceptanceClause}</p>

              {/* As quatro declarações do §9.2 são TEXTO, não quatro caixas.
                  Quatro caixas viravam quatro cliques mecânicos; o que tem peso
                  probatório é o teor declarado, e ele é registrado por inteiro na
                  trilha (o `sign` envia as quatro chaves). */}
              <div className="space-y-1.5 border-t border-border pt-3">
                <p className="font-medium text-foreground">Ao assinar, você declara que:</p>
                <ul className="list-disc space-y-1.5 pl-5 text-muted-foreground">
                  {declarations.map(d => (
                    <li key={d.key}>{d.text.replace("{cargo}", effectiveCargo || "{cargo}")}</li>
                  ))}
                </ul>
              </div>

              <p className="text-muted-foreground">
                Serão registrados, para comprovação de autoria e integridade: seu nome, CPF,
                cargo, endereço IP, data e hora, e o resumo criptográfico (SHA-256) do
                documento — em trilha de auditoria encadeada, anexada ao PDF assinado. O
                tratamento desses dados tem por finalidade exclusiva a comprovação da autoria
                e da integridade deste documento e o exercício regular de direitos, nos termos
                da Lei nº 13.709/2018 (LGPD), art. 7º, VI e IX.
              </p>
              <p className="text-muted-foreground">
                Se você não é a pessoa indicada, ou se não possui poderes para aprovar este
                orçamento em nome da empresa, recuse a assinatura e entre em contato com a{" "}
                {COMPANY_INFO.name}.
              </p>
            </div>

            {/* Um aceite só. As quatro chaves seguem sendo enviadas ao servidor —
                o que muda é quantos cliques se pede por um único consentimento.
                NÃO aparece no modo recusa: pedir "li e concordo com o termo de
                aceite" dentro de uma janela intitulada "Recusar assinatura" é
                pedir o contrário do ato, e a recusa não usa esse aceite (o
                servidor exige motivo + código, não declarações). */}
            {refusing ? null : (
              <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                <Checkbox
                  checked={consentChecked}
                  onCheckedChange={v => acceptAll(v === true)}
                  className="mt-0.5"
                  disabled={busy}
                />
                <span className="text-foreground">
                  Li e concordo com o termo de aceite eletrônico e com as declarações acima.
                </span>
              </label>
            )}

            {refusing ? (
              <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3">
                <Label htmlFor="reason">Motivo da recusa *</Label>
                <Textarea
                  id="reason"
                  rows={3}
                  value={refusalReason}
                  onChange={e => {
                    setStepError(null);
                    setRefusalReason(e.target.value);
                  }}
                  placeholder="Descreva o que precisa ser ajustado."
                />
                <p className="text-xs text-muted-foreground">
                  A recusa encerra esta coleta e é registrada com seu nome, CPF, data, hora e
                  IP na trilha de auditoria.
                </p>
              </div>
            ) : null}

            {/* O código é O ato — ganha bloco próprio, centralizado e com as
                caixas grandes. Espremido entre o rótulo e dois links de apoio ele
                lia como campo acessório, competindo com o "Recusar" em vermelho
                logo abaixo. */}
            <div className="space-y-4 rounded-xl border border-border bg-muted/30 p-5 text-center">
              <div className="space-y-1.5">
                <div className="flex items-center justify-center gap-2">
                  <IconMail className="h-4 w-4 text-primary" aria-hidden />
                  <p className="text-sm font-semibold text-foreground">Código de confirmação</p>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Enviamos um código de 6 dígitos para{" "}
                  <span className="font-medium text-foreground">{destinationMask}</span>.
                  <br className="hidden sm:block" /> Ele expira em 10 minutos.
                </p>
              </div>

              <div className="flex justify-center">
                {/* `input-otp` mantém UM input real por trás dos slots, então colar
                    o código de uma vez continua funcionando.

                    `autocomplete="one-time-code"` foi removido de propósito: é uma
                    dica de SMS (WebOTP no Android, leitura da mensagem no iOS) e
                    não faz nada para um código que chegou por e-mail. Deixá-la
                    ali só promete um preenchimento automático que nunca vem. */}
                <InputOTP
                  id="code"
                  maxLength={6}
                  autoComplete="off"
                  disabled={busy}
                  value={code}
                  onChange={next => {
                    setStepError(null);
                    setCode(String(next ?? "").replace(/\D/g, "").slice(0, 6));
                  }}
                >
                  <InputOTPGroup>
                    {Array.from({ length: 6 }, (_, index) => (
                      <InputOTPSlot
                        key={index}
                        index={index}
                        className="h-14 w-11 text-xl font-semibold tabular-nums sm:w-14"
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <div className="space-y-2">
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline disabled:opacity-50"
                  disabled={secondsLeft > 0 || busy}
                  onClick={handleResend}
                >
                  {secondsLeft > 0 ? `Reenviar em ${secondsLeft}s` : "Reenviar código"}
                </button>

                {/* E-mail não chega em segundos como o WhatsApp chegava: passa por
                    fila do servidor, antispam e, no primeiro contato, greylisting.
                    Sem esta orientação o signatário conclui que falhou e fica
                    pedindo código novo — o que invalida o anterior e piora tudo. */}
                <details className="text-left" open={secondsLeft > 0}>
                  <summary className="cursor-pointer text-center text-xs text-muted-foreground underline">
                    Não recebi o e-mail
                  </summary>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted-foreground">
                    <li>O envio pode levar alguns minutos. Vale esperar antes de pedir outro.</li>
                    <li>
                      Procure por <span className="font-medium">{COMPANY_INFO.name}</span> na caixa
                      de spam ou lixo eletrônico.
                    </li>
                    <li>
                      Confira se <span className="font-medium">{destinationMask}</span> está
                      correto. Ele vem do cadastro e não pode ser alterado aqui — se estiver
                      errado, fale com a {COMPANY_INFO.name}.
                    </li>
                  </ul>
                </details>
              </div>
            </div>

            {stepError && (
              <Alert variant="destructive" aria-live="polite">
                <AlertDescription>{stepError}</AlertDescription>
              </Alert>
            )}

            {/* Ação principal em largura total; a recusa vira um link discreto
                abaixo de um fio. Lado a lado num rodapé, o vermelho da recusa
                disputava atenção com o verde de assinar — e recusar não é o
                caminho esperado, é a saída. */}
            {refusing ? (
              <Button
                variant="destructive"
                className="w-full"
                onClick={handleRefuse}
                disabled={busy}
              >
                {busy ? (
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <IconX className="mr-2 h-4 w-4" />
                )}
                Confirmar recusa
              </Button>
            ) : (
              <Button
                className="w-full"
                size="lg"
                onClick={handleSign}
                disabled={busy || !allAccepted || !consentChecked}
              >
                {busy ? (
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <IconCheck className="mr-2 h-4 w-4" />
                )}
                Assinar orçamento
              </Button>
            )}

            <div className="border-t border-border pt-3 text-center">
              <button
                type="button"
                className="text-xs text-muted-foreground underline disabled:opacity-50"
                disabled={busy}
                onClick={() => {
                  setStepError(null);
                  setRefusing(v => !v);
                }}
              >
                {refusing ? "Voltar para assinar" : "Recusar assinatura"}
              </button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Conferência de identidade — fica MONTADO enquanto a coleta está viva,
            para que fechar e reabrir não apague os dígitos já digitados. */}
        {state.canSign && step !== "done" && step !== "refused" && (
          <IdentityConfirmationDialog
            open={identityOpen}
            onOpenChange={setIdentityOpen}
            signerName={signer.name}
            cpfParts={signer.cpfParts ?? null}
            emailParts={signer.emailParts ?? null}
            emailMasked={signer.emailMasked}
            registryCargo={signer.registryCargo}
            initialCargo={signer.cargo}
            intent={refusing ? "refuse" : "sign"}
            cooldownSeconds={secondsLeft}
            onConfirm={sendCode}
          />
        )}

        {step === "done" && (
          <Card className="border-green-600/40 bg-green-600/5">
            <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
              <IconCircleCheck className="h-12 w-12 text-green-600" />
              <h2 className="text-lg font-semibold">Orçamento assinado</h2>
              <p className="text-sm text-muted-foreground">
                Sua assinatura foi registrada
                {signer.signedAt
                  ? ` em ${new Date(signer.signedAt).toLocaleString("pt-BR")}`
                  : ""}
                .
              </p>
              <p className="text-xs text-muted-foreground">
                Código de verificação: <strong>{envelope.verificationCode}</strong>
              </p>
              <Button variant="outline" className="mt-2" asChild>
                <a href={documentUrl} target="_blank" rel="noreferrer">
                  <IconFileTypePdf className="mr-2 h-4 w-4" />
                  Ver documento assinado
                </a>
              </Button>
            </CardContent>
          </Card>
        )}

        {step === "refused" && (
          <Card className="border-destructive/40 bg-destructive/5">
            <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
              <IconX className="h-12 w-12 text-red-500" />
              <h2 className="text-lg font-semibold">Assinatura recusada</h2>
              <p className="text-sm text-muted-foreground">A Ankaa foi notificada da sua recusa.</p>
            </CardContent>
          </Card>
        )}

        {/* Coleta encerrada (cancelada, vencida, substituída, já concluída) —
            ACIMA do documento, junto dos outros cartões de estado.
            Estava abaixo dele: num orçamento já selado o PDF tem 3 páginas e
            empurrava este aviso para ~2900px, três telas e meia abaixo no
            celular. Quem abre um link morto precisa saber disso antes de ler o
            documento inteiro, não depois. */}
        {!state.canSign && step !== "done" && step !== "refused" && (
          <Card className="border-amber-500/30 bg-amber-500/10">
            <CardContent className="space-y-3 py-4">
              <div className="flex items-start gap-3">
                <IconAlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {envelope.status === "INVALIDATED"
                      ? "O orçamento foi alterado e este link não vale mais"
                      : "Esta coleta de assinaturas não está mais ativa"}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {envelope.status === "INVALIDATED"
                      ? "Você receberá um novo link com a versão atualizada para revisar e assinar. Nada do que você assinou antes vincula você às novas condições."
                      : "Se o orçamento foi alterado, você receberá um novo link para revisão."}
                  </p>
                </div>
              </div>

              {/* O QUE MUDOU — dito aqui, e não só no e-mail.
                  Quem chega por um link morto quer duas respostas: por que ele
                  morreu e o que mudou. A segunda estava disponível apenas na
                  frase resumida do e-mail de anulação; quem apagou o e-mail
                  ficava sem nada. */}
              {envelope.changes && envelope.changes.length > 0 && (
                <div className="rounded-lg border border-border bg-background/60 p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    O que mudou no orçamento
                  </p>
                  <QuoteChangeList changes={envelope.changes} variant="paper" />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Documento — sempre visível, inclusive depois de assinado */}
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              {/* Só "Documento": o número do orçamento já aparece no cartão
                  acima e no cabeçalho do próprio PDF logo abaixo. */}
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Documento</p>
              {/* Botão, não link em letra miúda: no celular a folha inteira sai
                  pequena, e abrir no visualizador nativo (com pinça para ampliar)
                  é o caminho real de leitura, não uma saída secundária. */}
              <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <a href={documentUrl} target="_blank" rel="noreferrer">
                  <IconExternalLink className="h-3.5 w-3.5" />
                  Abrir em tela cheia
                </a>
              </Button>
            </div>
            {/* O visualizador nativo de PDF dentro de iframe é problemático no
                Safari iOS; por isso o link "abrir em nova aba" fica sempre à mão. */}
            {/* Renderização inline: todas as páginas empilhadas, sem scroll
                interno e sem a barra do visualizador do navegador. */}
            {/* overflow-x-auto é cinto e suspensório: se a medição falhar, quem
                rola é ESTE quadro, nunca a página. */}
            <div ref={documentBoxRef} className="overflow-x-auto p-3">
              <InlineDocumentPages url={documentUrl} width={documentWidth} />
            </div>
          </CardContent>
        </Card>

        {/* Etapa 1 — identificação (leitura) */}
        {identityVisible && (
          <SignerIdentityCard
            name={signer.name}
            /* §5.9: `***.456.789-**`.
               Depois da conferência mostra o CPF que o próprio signatário
               digitou; antes dela, o do CADASTRO — que o servidor manda já
               mascarado. A linha exibia `***.***.***-**` mesmo para quem tem
               CPF cadastrado desde a emissão, porque só olhava o confirmado, e
               confirmado só existe depois de assinar. Sem CPF nenhum no
               cadastro, aí sim cai na forma inteiramente oculta. */
            cpfDisplay={confirmed?.cpf ? maskCpfCgu(confirmed.cpf) : (signer.cpfMasked ?? maskCpfCgu(null))}
            emailDisplay={signer.emailMasked}
            cargo={effectiveCargo || null}
            company={company.name}
            confirmed={!!confirmed}
          >
            {step === "review" ? (
              <div className="space-y-4">
                {/* Assinar e recusar passam pela MESMA porta: o código no
                    WhatsApp. É exigência do servidor, e o aviso existe para o
                    signatário não estranhar que "Recusar" peça o CPF dele. */}
                {refusing && (
                  <Alert variant="warning">
                    <AlertDescription>
                      Para registrar a recusa também é preciso confirmar sua identidade e
                      receber o código por e-mail — é o que prova que a recusa é sua. O
                      motivo você descreve logo depois.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
                  <Button
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => {
                      setRefusing(true);
                      setIdentityOpen(true);
                    }}
                  >
                    Recusar assinatura
                  </Button>
                  <Button
                    onClick={() => {
                      setRefusing(false);
                      setIdentityOpen(true);
                    }}
                    disabled={busy}
                  >
                    {busy ? (
                      <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <IconDeviceMobileMessage className="mr-2 h-4 w-4" />
                    )}
                    Enviar código por e-mail
                    <IconChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </SignerIdentityCard>
        )}

        {/* Etapa 2 — o ato de assinar mora no modal. Aqui fica só o estado, com
            o caminho de volta: se o modal for fechado sem concluir, é preciso ter
            como reabri-lo sem pedir outro código. */}
        {state.canSign && step === "code" && (
          <Card>
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2.5">
                <IconDeviceMobileMessage className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Código enviado para {destinationMask}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Confirme o termo e digite o código para concluir a assinatura.
                  </p>
                </div>
              </div>
              <Button className="w-full sm:w-auto" onClick={() => setTermsOpen(true)}>
                Continuar assinatura
                <IconChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* A cláusula de aceitação aparece SOMENTE no modal de "Li e concordo",
            na abertura da página. Repeti-la aqui em 11px era ruído: ninguém lê
            letra miúda de rodapé, e o aceite já é registrado com data, hora e IP
            na trilha de auditoria. */}
        <div className="pb-8" />
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="force-light min-h-screen bg-background px-3 py-6">
      {/* Toaster próprio: esta rota vive fora do AuthProvider, onde o Toaster
          global do App está montado. Sem isto, nenhum toast apareceria. */}
      <Toaster />
      <div className="mx-auto mb-5 max-w-5xl">
        {/* Logo maior e alinhada à esquerda, na mesma coluna dos cartões. */}
      <img src="/logo.png" alt={COMPANY_INFO.name} className="h-16 object-contain" />
      </div>
      {children}
    </div>
  );
}
