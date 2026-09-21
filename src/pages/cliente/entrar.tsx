// web/src/pages/cliente/entrar.tsx
//
// A entrada do portal do cliente. Dois passos, sem senha.
//
// Usa o MESMO vocabulário visual das telas de entrada do funcionário
// (`authLayoutVariants`, `authCardVariants`, `getAuthStyles`, `Card`, logo,
// `InputOTP`) porque é a mesma classe de tela — e porque um cliente que já viu
// a página pública de assinatura reconhece a casa.
//
// O que NÃO se copiou da tela do funcionário é a estrutura do ato: lá são duas
// credenciais na mesma tela (contato + senha); aqui são dois passos, e o
// segundo prova posse de um canal. O contato também NÃO escolhe para onde o
// código vai — ele diz quem é, e o servidor envia para o canal do CADASTRO,
// devolvendo apenas a máscara. É a mesma doutrina da cerimônia de assinatura
// (`pages/public/signature/[token].tsx`): deixar a pessoa digitar o destino
// faria o código provar só que ela controla uma caixa que ela mesma escreveu.
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate, useLocation, Navigate } from "react-router-dom";
import { z } from "zod";
import { IconArrowLeft, IconBrandWhatsapp, IconMail } from "@tabler/icons-react";

import { useResponsibleAuth } from "@/contexts/responsible-auth-context";
import { routes } from "@/constants/routes";
import { BRAND_ASSETS } from "@/config/assets";
import { cn } from "@/lib/utils";
import {
  getAuthStyles,
  authLayoutVariants,
  authCardVariants,
  inputVariants,
} from "@/lib/design-system";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoadingSpinner } from "@/components/ui/loading";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const CODE_LENGTH = 6;

/**
 * Quanto tempo o botão de reenviar fica em espera. Espelha o cooldown do
 * servidor (`RESEND_COOLDOWN_MS`, 120s por CONTATO). Só decora a contagem —
 * quem recusa de verdade é a API.
 *
 * ⚠️ São DOIS limites, e o segundo é o que morde:
 *   • cooldown de 120s por contato, em `ResponsibleAuthChallengeService.issue`;
 *   • `@VerificationSendRateLimit()` na rota: 2 pedidos por 5 MINUTOS por IP em
 *     produção, com bloqueio longo depois disso.
 * Contando só o primeiro, a tela liberava o botão aos 120s e o segundo reenvio
 * (t=240s) caía no teto do throttler — 429, com uma mensagem que não é a deste
 * fluxo. Por isso `TOO_MANY_REQUESTS_COOLDOWN_SECONDS` abaixo: quando a API
 * devolve 429, a espera passa a ser a do balde de 5 minutos, não a de 2.
 */
const RESEND_COOLDOWN_SECONDS = 120;

/** A janela do `@VerificationSendRateLimit()` (5 min). Usada só após um 429. */
const TOO_MANY_REQUESTS_COOLDOWN_SECONDS = 300;

/** O status HTTP da falha, quando houver — `undefined` para falha de rede. */
function statusOf(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}

const contactSchema = z.object({
  contact: z.string().trim().min(1, "Informe seu e-mail ou telefone"),
});

type ContactFormData = z.infer<typeof contactSchema>;

/** A mensagem que o servidor mandou, quando houver; senão a de reserva. */
function serverMessage(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data
    ?.message;
  if (typeof message === "string" && message.trim()) return message;
  if (Array.isArray(message) && typeof message[0] === "string") return message[0];
  return fallback;
}

export default function ClienteEntrarPage() {
  const { responsible, isLoading: isRestoring, requestCode, enter } = useResponsibleAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const styles = getAuthStyles();

  const [step, setStep] = useState<"contact" | "code">("contact");
  const [contact, setContact] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [destinationMask, setDestinationMask] = useState("");
  const [channel, setChannel] = useState<"WHATSAPP" | "EMAIL" | "NONE">("EMAIL");

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  // Verdadeiro só depois de um 429. Distingue "espere para REENVIAR" (por
  // contato) de "o servidor parou de aceitar pedidos deste IP" (vale para
  // qualquer contato, e portanto também tranca o passo 1).
  const [rateLimited, setRateLimited] = useState(false);
  /**
   * A espera POR CONTATO, em segundos — a do 400 "Aguarde N segundos".
   *
   * Ela NÃO tranca o botão (ver a nota no rodapé do passo 1: trocar o contato
   * digitado é legítimo, e o cooldown é daquele contato, não desta pessoa). O
   * que ela faz é CONTAR: o aviso dizia "Aguarde 120 segundos" e ficava
   * parado, então quem esperasse não tinha como saber se já podia tentar, e
   * quem tentasse cedo gastava o pedido e reiniciava a contagem. Um número que
   * anda transforma uma parede numa fila.
   */
  const [esperaDoContato, setEsperaDoContato] = useState(0);

  // Evita o envio duplo do auto-submit: o efeito dispara ao completar as 6
  // casas, e um clique no botão no mesmo instante mandaria de novo — gastando
  // DUAS das cinco tentativas do desafio por um erro nosso.
  const submittedFor = useRef<string>("");

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    mode: "onChange",
    defaultValues: { contact: "" },
  });

  useEffect(() => {
    if (cooldown <= 0) {
      // Zerou a contagem: o bloqueio do throttler também deixa de valer na tela.
      // Quem recusa de verdade continua sendo a API — isto só devolve o botão.
      setRateLimited(false);
      return;
    }
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (esperaDoContato <= 0) return;
    const timer = setTimeout(() => setEsperaDoContato((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [esperaDoContato]);

  const destination =
    (location.state as { from?: { pathname: string } } | null)?.from?.pathname ??
    routes.customer.portal.root;

  const askForCode = useCallback(
    async (value: string, { isResend }: { isResend: boolean }) => {
      setError("");
      setEsperaDoContato(0);
      isResend ? setResending(true) : setBusy(true);
      try {
        const result = await requestCode(value);
        setChallengeId(result.challengeId);
        setDestinationMask(result.destinationMask);
        setChannel(result.channel as typeof channel);
        setContact(value);
        setCode("");
        submittedFor.current = "";
        setCooldown(RESEND_COOLDOWN_SECONDS);
        setStep("code");
      } catch (err) {
        // 429 é o teto de 2 pedidos por 5 minutos por IP. A mensagem que a API
        // devolve aí é a genérica do throttler, que não explica nada a quem
        // está tentando entrar — e repetir o botão em 120s só produziria outro
        // 429. Aqui o fluxo se explica e a espera passa a ser a do balde certo.
        if (statusOf(err) === 429) {
          setError(
            "Muitas tentativas seguidas. Aguarde alguns minutos antes de pedir outro código.",
          );
          setRateLimited(true);
          setCooldown(TOO_MANY_REQUESTS_COOLDOWN_SECONDS);
        } else {
          const mensagem = serverMessage(
            err,
            "Não foi possível enviar o código agora. Tente novamente.",
          );
          setError(mensagem);
          // O servidor diz quantos segundos faltam; a tela passa a contá-los.
          // Sem isto o aviso congela num número que envelhece sozinho.
          const segundos = Number(/Aguarde\s+(\d+)\s+segundos/i.exec(mensagem)?.[1] ?? 0);
          setEsperaDoContato(segundos > 0 ? segundos : 0);
        }
      } finally {
        isResend ? setResending(false) : setBusy(false);
      }
    },
    [requestCode],
  );

  const submitCode = useCallback(
    async (value: string) => {
      if (value.length !== CODE_LENGTH || submittedFor.current === value) return;
      submittedFor.current = value;

      setBusy(true);
      setError("");
      try {
        await enter({ contact, challengeId, code: value });
        navigate(destination, { replace: true });
      } catch (err) {
        setError(serverMessage(err, "Código inválido ou expirado."));
        setCode("");
        submittedFor.current = "";
      } finally {
        setBusy(false);
      }
    },
    [contact, challengeId, enter, navigate, destination],
  );

  // Envia sozinho ao completar as 6 casas — o mesmo comportamento da tela de
  // verificação do funcionário. Digitado o último dígito, não há decisão a
  // tomar; pedir um clique a mais seria atrito sem propósito.
  useEffect(() => {
    if (step === "code" && code.length === CODE_LENGTH && !busy) {
      void submitCode(code);
    }
  }, [code, step, busy, submitCode]);

  if (isRestoring) {
    return (
      <div className={cn(authLayoutVariants({ background: "default" }), "w-screen")}>
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (responsible) return <Navigate to={destination} replace />;

  const ChannelIcon = channel === "WHATSAPP" ? IconBrandWhatsapp : IconMail;
  const channelName = channel === "WHATSAPP" ? "WhatsApp" : "e-mail";

  return (
    <div className={cn(authLayoutVariants({ background: "default" }), "w-screen")}>
      <Card className={cn(authCardVariants({ elevation: "elevated" }))}>
        <CardHeader className="space-y-1">
          <div className="mb-4 flex justify-center">
            <img src={BRAND_ASSETS.logo} alt="Ankaa" className={styles.logo} />
          </div>

          {step === "contact" ? (
            <>
              <CardTitle className={styles.title}>Área do cliente</CardTitle>
              <CardDescription className={styles.description}>
                Acompanhe seus orçamentos, assinaturas e faturamentos
              </CardDescription>
            </>
          ) : (
            <>
              <CardTitle className={styles.title}>Confirme o código</CardTitle>
              <CardDescription className={styles.description}>
                Enviamos um código de {CODE_LENGTH} dígitos por {channelName} para
                <br />
                <span className="font-semibold text-foreground">{destinationMask}</span>
              </CardDescription>
            </>
          )}
        </CardHeader>

        {step === "contact" ? (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) =>
                askForCode(data.contact.trim(), { isResend: false }),
              )}
              aria-label="Acesso do cliente"
              noValidate
            >
              <CardContent className={styles.form}>
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      {/* A contagem SUBSTITUI o número congelado da mensagem do
                          servidor. Repetir os dois ("Aguarde 120 segundos …
                          faltam 14s") seria pior que só um: quem lê acredita no
                          primeiro. */}
                      {esperaDoContato > 0
                        ? `Este contato pediu um código há pouco. Tente de novo em ${esperaDoContato}s — ou use outro contato.`
                        : error}
                    </AlertDescription>
                  </Alert>
                )}

                <FormField
                  control={form.control}
                  name="contact"
                  render={({ field }) => (
                    <FormItem className={styles.fieldset}>
                      <FormLabel className={styles.label}>E-mail ou telefone</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="voce@empresa.com.br ou (43) 99999-9999"
                          autoComplete="username"
                          autoFocus
                          disabled={busy}
                          className={cn(
                            inputVariants({
                              state: form.formState.errors.contact ? "error" : "default",
                            }),
                          )}
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Diz o mecanismo ANTES de pedir o dado. Sem isto a tela pede um
                    contato e não explica o que vai acontecer — e o passo
                    seguinte, pedindo um código, chega como surpresa. */}
                <p className="text-center text-sm text-muted-foreground">
                  Enviaremos um código de acesso para o contato do seu cadastro. Você não precisa
                  de senha.
                </p>
              </CardContent>

              <CardFooter className={styles.footer}>
                {/* Só o 429 tranca ESTE botão, e não o cooldown de reenvio: o
                    cooldown é por CONTATO (trocar o contato digitado é
                    legítimo e comum — erro de digitação), enquanto o teto do
                    throttler é por IP e vale para qualquer contato. */}
                <Button
                  type="submit"
                  className={styles.button}
                  disabled={busy || rateLimited || !form.formState.isValid}
                >
                  {busy && <LoadingSpinner size="sm" className="mr-2" />}
                  {busy
                    ? "Enviando..."
                    : rateLimited
                      ? `Aguarde ${cooldown}s`
                      : "Receber código"}
                </Button>
              </CardFooter>
            </form>
          </Form>
        ) : (
          <>
            <CardContent className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex justify-center">
                <InputOTP
                  maxLength={CODE_LENGTH}
                  value={code}
                  onChange={setCode}
                  disabled={busy}
                  autoFocus
                >
                  <InputOTPGroup className="gap-2">
                    {Array.from({ length: CODE_LENGTH }, (_, index) => (
                      <InputOTPSlot
                        key={index}
                        index={index}
                        className={cn(
                          "h-12 w-12 text-lg",
                          error && "border-destructive bg-destructive/10",
                          !error && code[index] && "border-primary bg-primary/10",
                        )}
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <p className="flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                <ChannelIcon className="h-4 w-4 shrink-0" />O código expira em 10 minutos
              </p>

              {busy && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <LoadingSpinner size="sm" />
                  Verificando...
                </div>
              )}
            </CardContent>

            <CardFooter className="flex flex-col space-y-2">
              <Button
                type="button"
                variant="link"
                onClick={() => void askForCode(contact, { isResend: true })}
                disabled={resending || cooldown > 0 || busy}
                className="w-full"
              >
                {resending && <LoadingSpinner size="sm" className="mr-2" />}
                {resending
                  ? "Reenviando..."
                  : cooldown > 0
                    ? `Reenviar código em ${cooldown}s`
                    : "Reenviar código"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full"
                disabled={busy}
                onClick={() => {
                  setStep("contact");
                  setCode("");
                  setError("");
                  submittedFor.current = "";
                }}
              >
                <IconArrowLeft className="mr-2 h-4 w-4" />
                Usar outro contato
              </Button>
            </CardFooter>
          </>
        )}
      </Card>
    </div>
  );
}
