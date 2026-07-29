/**
 * Modal de conferência de identidade — a porta do "Enviar código por e-mail".
 *
 * Por que modal, e não campos na página: a tela de assinatura é um documento, e
 * documento não tem formulário no meio. Aqui o signatário faz um ato único e
 * deliberado — completar os caracteres que faltam do CPF e do e-mail — e só então
 * o código é disparado. O erro da API (dígitos divergentes, cooldown de 60s,
 * prazo vencido) volta **para dentro deste modal**, sem limpar o que foi
 * digitado: quem errou um dígito precisa corrigir um dígito, não redigitar tudo.
 *
 * As âncoras do cadastro (3 primeiros e os 2 verificadores do CPF; DDD e os 4
 * da parte local do e-mail) aparecem como afixos fixos ao redor do campo. Elas existem
 * para o signatário RECONHECER o registro; o que ele digita é o miolo, que é a
 * parte que a página não conhece — e é justamente por isso que digitá-la
 * corretamente vale como conferência.
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
  IconMail,
  IconLoader2,
  IconShieldLock,
} from "@tabler/icons-react";
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
  /** Caracteres ocultos da parte local do e-mail, na forma que a API compara. */
  emailConfirm: string;
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
    </div>
  );
}

export interface IdentityConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  signerName: string;
  /** Âncoras do CPF cadastrado. Null quando o cadastro não tem CPF. */
  cpfParts: SignatureMaskParts | null;
  emailParts: SignatureEmailMaskParts | null;
  emailMasked: string;
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
  emailParts,
  emailMasked,
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
  const [emailHidden, setEmailHidden] = useState("");
  const [cargo, setCargo] = useState(initialCargo ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const cpfAnchored = !!cpfParts && cpfParts.hiddenLength > 0;
  const emailHiddenLength = emailParts?.hiddenLength ?? 0;
  const needsCargo = !registryCargo?.trim();

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

    if (emailHiddenLength > 0 && emailHidden.trim().length !== emailHiddenLength) {
      setError(`Complete os ${emailHiddenLength} caracteres ocultos do e-mail.`);
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
      emailConfirm: emailHidden.trim().toLowerCase(),
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
        className="force-light max-h-[90vh] max-w-lg overflow-y-auto"
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

          {/* E-mail — canal do código. O domínio aparece inteiro: ele é da
              própria empresa do signatário e escondê-lo custaria reconhecimento
              sem proteger nada. O que se confirma é a parte local. */}
          {emailHiddenLength > 0 && emailParts && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
              <Label htmlFor="email-confirm" className="text-sm">
                E-mail <span className="text-destructive">*</span>
              </Label>
              <AffixDigits
                id="email-confirm"
                mode="text"
                prefix={emailParts.prefix}
                suffix={emailParts.suffix}
                length={emailHiddenLength}
                value={emailHidden}
                onChange={touch(setEmailHidden)}
                disabled={submitting}
                afterInput={`@${emailParts.domain}`}
              />
              <p className="text-xs text-muted-foreground">
                Complete a parte oculta de {emailMasked}. O código vai para este endereço
                — ele não pode ser trocado aqui.
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
            ) : (
              <IconMail className="mr-2 h-4 w-4" />
            )}
            {cooldownSeconds > 0 ? `Aguarde ${cooldownSeconds}s` : "Enviar código por e-mail"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
