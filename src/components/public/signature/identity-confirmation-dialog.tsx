/**
 * Modal de conferência de identidade — a porta do "Enviar código".
 *
 * Por que modal, e não campos na página: a tela de assinatura é um documento, e
 * documento não tem formulário no meio. Aqui o signatário faz um ato único e
 * deliberado — completar os caracteres que faltam do CPF e do CONTATO — e só
 * então o código é disparado. O erro da API (dígitos divergentes, cooldown de
 * 60s, prazo vencido) volta **para dentro deste modal**, sem limpar o que foi
 * digitado: quem errou um dígito precisa corrigir um dígito, não redigitar tudo.
 *
 * As âncoras do cadastro (3 primeiros e os 2 verificadores do CPF; a parte
 * visível do contato) aparecem como afixos fixos ao redor do campo. Elas existem
 * para o signatário RECONHECER o registro; o que ele digita é o miolo, que é a
 * parte que a página não conhece — e é justamente por isso que digitá-la
 * corretamente vale como conferência.
 *
 * O CONTATO É O DO CANAL, NÃO SEMPRE O E-MAIL
 *   A coleta nasce por WhatsApp ou por e-mail (`EnvelopeSigner.authMethod`), e o
 *   servidor compara o que se digita aqui contra o contato DAQUELE canal. Este
 *   modal recebe `contactParts`/`contactMasked` já resolvidos pela API — nunca
 *   `emailParts`. A distinção não é cosmética: num orçamento por WhatsApp o
 *   responsável pode não ter e-mail nenhum no cadastro (a coluna é anulável), e
 *   pedir os caracteres de um endereço inexistente não desenhava campo algum —
 *   o signatário ficava preso numa janela sem nada para preencher.
 */

import { Fragment, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
// Atencao: o wrapper `Input` deste projeto entrega o VALOR no onChange,
// nao o evento nativo (`onChange?: (value: string | number | null) => void`).
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  IconBrandWhatsapp,
  IconMail,
  IconLoader2,
  IconShieldLock,
} from "@tabler/icons-react";
import type { DeliveryChannel } from "@/api-client/signature";
import {
  assembleCpf,
  isCpfWellFormed,
  onlyDigits,
  type SignatureMaskParts,
  type SignatureEmailMaskParts,
} from "./identity";

export interface IdentityConfirmation {
  /** 11 dígitos, sem pontuação. */
  cpf: string;
  cargo: string;
  /**
   * Caracteres ocultos do CONTATO — parte local do e-mail, ou dígitos do meio do
   * telefone, conforme o canal em que a coleta foi emitida.
   */
  contactConfirm: string;
}

interface AffixDigitsProps {
  id: string;
  prefix: string;
  suffix: string;
  length: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** Texto fixo antes das caixas, fora da sequência (o "+55" do telefone). */
  staticPrefix?: string;
  /** Separador entre as caixas do cadastro e as que se digitam. */
  beforeInput?: string;
  /**
   * Separadores DENTRO das caixas digitáveis. `after` conta caixas digitáveis, a
   * partir de 1. São vários porque o CPF sem âncora se digita inteiro e precisa
   * dos dois pontos e do hífen: `000.000.000-00`.
   */
  innerSeparators?: Array<{ after: number; char: string }>;
  /** Separador entre as caixas digitáveis e as finais do cadastro. */
  afterInput?: string;
  /**
   * Texto que fecha a sequência, DEPOIS do sufixo do cadastro — o `@dominio`
   * do e-mail.
   *
   * Não dá para reusar `afterInput` para isso: ele é renderizado ANTES do
   * sufixo, então o domínio saía no meio e a última letra da parte local
   * aparecia depois do `.com`, como se fizesse parte dele.
   */
  trailing?: string;
  /**
   * `digits` para CPF/telefone; `text` para a parte local do e-mail.
   *
   * O componente nasceu só para dígitos e aplicava `onlyDigits` na entrada e
   * nos afixos — o que descartaria silenciosamente qualquer letra de um
   * endereço de e-mail, deixando o campo impossível de preencher.
   */
  mode?: "digits" | "text";
}

/** Caixa que veio do cadastro: mesma forma das digitáveis, preenchida. */
function FixedSlot({ char, wide }: { char: string; wide?: boolean }) {
  return (
    <div
      className={cn(
        "relative flex h-11 w-5 items-center justify-center border border-l-0 border-border bg-muted text-base font-medium text-muted-foreground first:rounded-l-md first:border-l last:rounded-r-md sm:w-8",
        wide ? "w-7 sm:w-8" : "tabular-nums",
      )}
    >
      {char}
    </div>
  );
}

function Separator({ char }: { char: string }) {
  return (
    <span aria-hidden className="text-base font-medium text-muted-foreground">
      {char}
    </span>
  );
}

/**
 * Dígitos que faltam, em caixas, entre os afixos que vêm do cadastro. Com
 * `prefix`/`suffix` vazios vira a sequência inteira em caixas — é assim que o
 * CPF é digitado quando o cadastro não tem nenhum para ancorar.
 *
 * Usa o `InputOTP` do projeto — o MESMO widget da etapa do código e do
 * `verification-code-form`. A versão anterior era um `<input>` solto: o CPF
 * ocupava toda a largura (`flex-1`) e o telefone tinha largura fixa (`w-24`), de
 * modo que os dois campos da mesma janela tinham aparências diferentes e os
 * dígitos flutuavam longe dos afixos. Com caixas, os dois viram a mesma peça e o
 * número se lê contínuo: 115. [_][_][_][_][_][_] -61.
 *
 * As caixas têm 44px de altura (alvo de toque mínimo) e fonte de 16px — abaixo
 * disso o Safari do iPhone dá zoom ao focar, e este link chega por e-mail,
 * lido quase sempre no celular.
 */
function AffixDigits({
  id,
  prefix,
  suffix,
  length,
  value,
  onChange,
  disabled,
  staticPrefix,
  beforeInput,
  innerSeparators,
  afterInput,
  trailing,
  mode = "digits",
}: AffixDigitsProps) {
  const isText = mode === "text";
  // Em modo texto aceita o que aparece numa parte local de e-mail e descarta
  // espaco e "@" — colar o endereco inteiro nao deve poluir as caixas.
  const sanitize = (raw: string) =>
    isText ? raw.toLowerCase().replace(/[^a-z0-9._+-]/g, "") : onlyDigits(raw);
  const prefixDigits = sanitize(prefix);
  const suffixDigits = sanitize(suffix);
  const slotClass = cn(
    "h-11 text-base font-medium sm:w-8",
    isText ? "w-7" : "w-5 tabular-nums",
  );

  const inputSlots = (from: number, to: number) => (
    <InputOTPGroup>
      {Array.from({ length: to - from }, (_, i) => (
        <InputOTPSlot key={from + i} index={from + i} className={slotClass} />
      ))}
    </InputOTPGroup>
  );

  // Fatia as caixas digitáveis nos pontos de separação. Sem separador vira uma
  // fatia só, que é o caso do telefone.
  const cuts = (innerSeparators ?? [])
    .filter(s => s.after > 0 && s.after < length)
    .sort((a, b) => a.after - b.after);
  const segments = cuts.reduce<Array<{ from: number; to: number; separatorAfter?: string }>>(
    (acc, cut) => {
      const last = acc[acc.length - 1];
      if (cut.after <= last.from) return acc;
      last.to = cut.after;
      last.separatorAfter = cut.char;
      acc.push({ from: cut.after, to: length });
      return acc;
    },
    [{ from: 0, to: length }],
  );

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-0.5 gap-y-2">
      {staticPrefix && (
        <span className="shrink-0 pr-1 text-base font-medium tabular-nums text-muted-foreground">
          {staticPrefix}
        </span>
      )}

      {prefixDigits && (
        <div className="flex">
          {prefixDigits.split("").map((char, i) => (
            <FixedSlot key={`p${i}`} char={char} wide={isText} />
          ))}
        </div>
      )}

      {beforeInput ? <Separator char={beforeInput} /> : null}

      {/* `text-base` no input real (que o input-otp mantém invisível por trás das
          caixas): abaixo de 16px o Safari do iPhone dá zoom ao focar. */}
      <InputOTP
        id={id}
        maxLength={length}
        value={value}
        onChange={next => onChange(sanitize(next).slice(0, length))}
        disabled={disabled}
        containerClassName="gap-0"
        className="text-base"
        inputMode={isText ? "text" : "numeric"}
        autoComplete="off"
      >
        {segments.map(segment => (
          <Fragment key={segment.from}>
            {inputSlots(segment.from, segment.to)}
            {segment.separatorAfter ? <Separator char={segment.separatorAfter} /> : null}
          </Fragment>
        ))}
      </InputOTP>

      {afterInput ? <Separator char={afterInput} /> : null}

      {suffixDigits && (
        <div className="flex">
          {suffixDigits.split("").map((char, i) => (
            <FixedSlot key={`s${i}`} char={char} wide={isText} />
          ))}
        </div>
      )}

      {trailing ? (
        <span className="shrink-0 whitespace-nowrap pl-1 text-base font-medium text-muted-foreground">
          {trailing}
        </span>
      ) : null}
    </div>
  );
}

export interface IdentityConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signerName: string;
  /** Âncoras do CPF cadastrado. Null quando o cadastro não tem CPF. */
  cpfParts: SignatureMaskParts | null;
  /**
   * Partes da máscara do CONTATO DO CANAL — `contactParts` da API, nunca
   * `emailParts`. No WhatsApp `domain` vem vazio e as caixas são dígitos.
   */
  contactParts: SignatureEmailMaskParts | null;
  /** Máscara já pronta do mesmo contato, para o texto de ajuda. */
  contactMasked: string;
  /** Canal da coleta. Decide o rótulo, o teclado e o texto de ajuda. */
  channel?: DeliveryChannel;
  /** Cargo do cadastro. Quando existe, não se digita cargo nenhum. */
  registryCargo: string | null;
  initialCargo?: string | null;
  /**
   * Para que serve o código. A recusa também exige OTP verificado no servidor,
   * então ela passa por este mesmo modal — e o signatário precisa entender por
   * que "Recusar" pediu o CPF dele.
   */
  intent?: "sign" | "refuse";
  /** Segundos restantes do cooldown de reenvio; > 0 desabilita o envio. */
  cooldownSeconds: number;
  /** Devolve a mensagem de erro para exibir aqui dentro, ou null em caso de sucesso. */
  onConfirm: (values: IdentityConfirmation) => Promise<string | null>;
}

export function IdentityConfirmationDialog({
  open,
  onOpenChange,
  signerName,
  cpfParts,
  contactParts,
  contactMasked,
  channel = "EMAIL",
  registryCargo,
  initialCargo,
  intent = "sign",
  cooldownSeconds,
  onConfirm,
}: IdentityConfirmationDialogProps) {
  // O estado vive AQUI, e este componente permanece montado enquanto a página
  // está na etapa de identificação — então fechar e reabrir o modal não apaga o
  // que já foi digitado (o Radix desmonta só o conteúdo do portal).
  const [cpfHidden, setCpfHidden] = useState("");
  const [cpfFull, setCpfFull] = useState("");
  const [contactHidden, setContactHidden] = useState("");
  const [cargo, setCargo] = useState(initialCargo ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isWhatsApp = channel === "WHATSAPP";
  const cpfAnchored = !!cpfParts && cpfParts.hiddenLength > 0;
  const contactHiddenLength = contactParts?.hiddenLength ?? 0;
  const needsCargo = !registryCargo?.trim();

  /**
   * O "+55" sai da sequência de caixas e vira texto fixo.
   *
   * `phoneMaskParts` devolve `prefix: "+55 43 9"`, e em `mode="digits"` o
   * `AffixDigits` roda `onlyDigits` sobre o prefixo — os cinco dígitos `5 5 4 3 9`
   * virariam caixas iguais às do número, como se o código do país fizesse parte
   * do telefone. Separando, lê-se `+55 [4][3][9] ...`, que é como um número
   * brasileiro se lê.
   */
  const contactPrefix = isWhatsApp
    ? onlyDigits(contactParts?.prefix).replace(/^55/, "")
    : (contactParts?.prefix ?? "");

  const touch = <T,>(setter: (value: T) => void) => (value: T) => {
    setError(null);
    setter(value);
  };

  const handleSubmit = async () => {
    setError(null);

    let cpfDigits: string;
    if (cpfAnchored && cpfParts) {
      const hidden = onlyDigits(cpfHidden);
      if (hidden.length !== cpfParts.hiddenLength) {
        setError(`Complete os ${cpfParts.hiddenLength} dígitos que faltam do CPF.`);
        return;
      }
      cpfDigits = assembleCpf(cpfParts, hidden);
      if (!isCpfWellFormed(cpfDigits)) {
        // Miolo errado quase sempre quebra o mod-11 do número montado. Devolver
        // aqui poupa a requisição e dá a mensagem certa — a API responderia
        // "CPF inválido.", que soa como culpa do cadastro.
        setError("Os dígitos do CPF não conferem com o cadastro. Confira ou fale com a Ankaa.");
        return;
      }
    } else {
      cpfDigits = onlyDigits(cpfFull);
      if (cpfDigits.length !== 11) {
        setError("Digite os 11 dígitos do seu CPF.");
        return;
      }
      if (!isCpfWellFormed(cpfDigits)) {
        setError("CPF inválido. Confira os dígitos.");
        return;
      }
    }

    // No WhatsApp o que conta são DÍGITOS: medir `.trim().length` deixaria passar
    // um campo com máscara ou espaço e reprovaria um preenchimento correto.
    const contactTyped = isWhatsApp
      ? onlyDigits(contactHidden)
      : contactHidden.trim().toLowerCase();
    if (contactHiddenLength > 0 && contactTyped.length !== contactHiddenLength) {
      setError(
        isWhatsApp
          ? `Complete os ${contactHiddenLength} dígitos que faltam do telefone.`
          : `Complete os ${contactHiddenLength} caracteres ocultos do e-mail.`,
      );
      return;
    }

    // `signatureRequestCodeSchema` exige 2..100 caracteres. Barrar aqui evita a
    // mensagem genérica de validação do servidor ("Dados do corpo da requisição
    // inválidos"), que não diz qual campo está errado.
    const effectiveCargo = (registryCargo ?? cargo).trim().slice(0, 100);
    if (effectiveCargo.length < 2) {
      setError("Informe seu cargo na empresa.");
      return;
    }

    setSubmitting(true);
    const message = await onConfirm({
      cpf: cpfDigits,
      cargo: effectiveCargo,
      contactConfirm: contactTyped,
    });
    setSubmitting(false);
    if (message) setError(message);
  };

  const blocked = submitting || cooldownSeconds > 0;

  return (
    <Dialog open={open} onOpenChange={next => (submitting ? undefined : onOpenChange(next))}>
      <DialogContent
        /* force-light: o Radix monta o conteúdo num portal preso ao <body>, fora
           do wrapper claro da página, então ele não herdaria o escopo. */
        className="force-light max-h-[90vh] max-w-3xl overflow-y-auto"
        onPointerDownOutside={e => submitting && e.preventDefault()}
        onEscapeKeyDown={e => submitting && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconShieldLock className="h-5 w-5 text-primary" />
            Confirme sua identidade
          </DialogTitle>
          <DialogDescription>
            {signerName} — complete os dígitos que faltam. Eles são conferidos com o
            cadastro antes de o código ser enviado.
            {intent === "refuse" &&
              " A recusa também é registrada com o código: é o que prova que foi você quem recusou."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* CPF */}
          <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
            <Label htmlFor="cpf-confirm" className="text-sm">
              CPF <span className="text-destructive">*</span>
            </Label>
            {cpfAnchored && cpfParts ? (
              <>
                <AffixDigits
                  id="cpf-confirm"
                  prefix={cpfParts.prefix}
                  suffix={cpfParts.suffix}
                  length={cpfParts.hiddenLength}
                  value={cpfHidden}
                  onChange={touch(setCpfHidden)}
                  disabled={submitting}
                  beforeInput="."
                  innerSeparators={[{ after: 3, char: "." }]}
                  afterInput="-"
                />
                <p className="text-xs text-muted-foreground">
                  Os dígitos das pontas vêm do cadastro. Digite os {cpfParts.hiddenLength} do
                  meio.
                </p>
              </>
            ) : (
              <>
                {/* Sem âncora no cadastro digitam-se os 11 dígitos — mas nas MESMAS
                    caixas do caso ancorado e do campo do WhatsApp logo abaixo. Um
                    `<input>` de texto aqui fazia a janela ter dois widgets
                    diferentes para a mesma coisa, e o campo mais importante da
                    conferência era justamente o que parecia menos deliberado. */}
                <AffixDigits
                  id="cpf-confirm"
                  prefix=""
                  suffix=""
                  length={11}
                  value={cpfFull}
                  onChange={touch(setCpfFull)}
                  disabled={submitting}
                  innerSeparators={[
                    { after: 3, char: "." },
                    { after: 6, char: "." },
                    { after: 9, char: "-" },
                  ]}
                />
                <p className="text-xs text-muted-foreground">
                  O cadastro deste orçamento não tem CPF. Informe o seu por inteiro.
                </p>
              </>
            )}
          </div>

          {/* Contato — canal do código. No e-mail o domínio aparece inteiro: ele
              é da própria empresa do signatário e escondê-lo custaria
              reconhecimento sem proteger nada; o que se confirma é a parte
              local. No WhatsApp confirmam-se os dígitos do meio, com DDD e os
              quatro finais visíveis. */}
          {contactHiddenLength > 0 && contactParts && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
              <Label htmlFor="contact-confirm" className="text-sm">
                {isWhatsApp ? "Telefone" : "E-mail"}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <AffixDigits
                id="contact-confirm"
                // Teclado numérico no celular quando o contato é telefone —
                // `mode="text"` abriria o alfabético para preencher dígitos.
                mode={isWhatsApp ? "digits" : "text"}
                staticPrefix={isWhatsApp ? "+55" : undefined}
                prefix={contactPrefix}
                suffix={contactParts.suffix}
                length={contactHiddenLength}
                value={contactHidden}
                onChange={touch(setContactHidden)}
                disabled={submitting}
                trailing={contactParts.domain ? `@${contactParts.domain}` : undefined}
              />
              <p className="text-xs text-muted-foreground">
                Complete a parte oculta de {contactMasked}. O código vai para
                {isWhatsApp ? " este número, pelo WhatsApp" : " este endereço"} — ele não
                pode ser trocado aqui.
              </p>
            </div>
          )}

          {/* Cargo — só quando o cadastro não informa nenhuma função. */}
          {needsCargo && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
              <Label htmlFor="cargo-confirm" className="text-sm">
                Cargo na empresa <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cargo-confirm"
                placeholder="Ex.: Gestor de Frota"
                className="h-12 text-base"
                value={cargo}
                onChange={v => touch(setCargo)(String(v ?? ""))}
                disabled={submitting}
              />
              <p className="text-xs text-muted-foreground">
                Aparece na declaração de que você tem poderes para aprovar este orçamento.
              </p>
            </div>
          )}

          {error && (
            <Alert variant="destructive" aria-live="polite">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="w-full sm:w-auto"
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={blocked} className="w-full sm:w-auto">
            {submitting ? (
              <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : isWhatsApp ? (
              <IconBrandWhatsapp className="mr-2 h-4 w-4" />
            ) : (
              <IconMail className="mr-2 h-4 w-4" />
            )}
            {cooldownSeconds > 0
              ? `Aguarde ${cooldownSeconds}s`
              : isWhatsApp
                ? "Enviar código por WhatsApp"
                : "Enviar código por e-mail"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
