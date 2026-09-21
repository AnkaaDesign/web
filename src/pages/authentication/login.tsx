// web/src/pages/authentication/login.tsx
//
// LOGIN ÚNICO — uma só porta para quem trabalha aqui e para o contato do
// cliente.
//
// Eram duas telas (`/autenticacao/entrar` e `/cliente/entrar`) e, portanto,
// duas perguntas feitas à pessoa antes de qualquer coisa: "você é funcionário
// ou cliente?". Quem recebe um link de assinatura não sabe responder isso — e
// errar custa uma tela de senha que nunca vai funcionar.
//
// Agora são TRÊS estados: `contato` → (`senha` | `codigo`). A tela pede só o
// contato, pergunta à API qual é a segunda credencial (`POST /auth/login-method`)
// e revela o campo certo.
//
// ⚠️ A SONDA NÃO É UM ORÁCULO. Ela responde `PASSWORD` apenas para funcionário
// conhecido; para TODO o resto — responsável de cliente OU contato que não
// existe — responde `CODE`. Um contato inexistente cai aqui no passo de código
// e recebe o desafio-CHAMARIZ que `ResponsibleAuthService.requestCode` já emite
// (challengeId de enfeite, máscara do que a PESSOA digitou, nada enviado),
// falhando depois com "Código inválido ou expirado". Do lado de fora, os dois
// casos são indistinguíveis. Nunca "otimize" isso mostrando "contato não
// encontrado" no passo 1.
//
// ⚠️ O passo do código NÃO usa `useResponsibleAuth()`: o `ResponsibleAuthProvider`
// só envolve `/cliente/*` (`App.tsx`), e o hook LANÇA fora dele — tela branca.
// Falamos direto com o `responsibleAuthApi`, gravamos o token com
// `setResponsibleToken` e navegamos para o portal, que restaura a sessão no
// mount via `GET /cliente/auth/eu`.
//
// `/cliente/entrar` continua existindo e funcionando: há links de notificação e
// de assinatura apontando para lá, e `responsible-route.tsx` redireciona para
// ela. Esta tela é a porta larga, não a substituição daquela.
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoadingSpinner } from "@/components/ui/loading";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { IconArrowLeft, IconBrandWhatsapp, IconEye, IconEyeOff, IconMail } from "@tabler/icons-react";
import { loginContactSchema, loginPasswordSchema } from "../../schemas";
import type { LoginContactFormData, LoginPasswordFormData } from "../../schemas";
import { authService } from "../../api-client";
import { responsibleAuthApi, setResponsibleToken } from "@/api-client/responsible-auth";
import { getAuthStyles, authLayoutVariants, authCardVariants, inputVariants } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { routes } from "../../constants";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

import { BRAND_ASSETS } from "@/config/assets";

const CODE_LENGTH = 6;

/**
 * Espelha o cooldown de reenvio do servidor (120s por CONTATO). Só decora a
 * contagem — quem recusa de verdade é a API.
 */
const RESEND_COOLDOWN_SECONDS = 120;

/** A janela do `@VerificationSendRateLimit()` (5 min). Usada só após um 429. */
const TOO_MANY_REQUESTS_COOLDOWN_SECONDS = 300;

type Step = "contato" | "senha" | "codigo";

/** O status HTTP da falha, quando houver — `undefined` para falha de rede. */
function statusOf(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}

/** A mensagem que o servidor mandou, quando houver; senão a de reserva. */
function serverMessage(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;
  if (typeof message === "string" && message.trim()) return message;
  if (Array.isArray(message) && typeof message[0] === "string") return message[0];
  return fallback;
}

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [step, setStep] = useState<Step>("contato");
  const [contact, setContact] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  // Passo do código — o mesmo material de `/cliente/entrar`.
  const [challengeId, setChallengeId] = useState("");
  const [destinationMask, setDestinationMask] = useState("");
  const [channel, setChannel] = useState<"WHATSAPP" | "EMAIL" | "NONE">("EMAIL");
  const [code, setCode] = useState("");
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  // Verdadeiro só depois de um 429: distingue "espere para REENVIAR" (por
  // contato) de "o servidor parou de aceitar pedidos deste IP" (vale para
  // qualquer contato, e portanto também tranca o passo 1).
  const [rateLimited, setRateLimited] = useState(false);

  // Evita o envio duplo do auto-submit: o efeito dispara ao completar as 6
  // casas, e um clique no mesmo instante gastaria DUAS das cinco tentativas do
  // desafio por um erro nosso.
  const submittedFor = useRef<string>("");

  // Track page access
  usePageTracker({
    title: "Login",
    icon: "login",
  });

  const contactForm = useForm<LoginContactFormData>({
    resolver: zodResolver(loginContactSchema),
    mode: "onChange",
    defaultValues: {
      contact: "",
    },
  });

  const passwordForm = useForm<LoginPasswordFormData>({
    resolver: zodResolver(loginPasswordSchema),
    mode: "onChange",
    defaultValues: {
      password: "",
    },
  });

  useEffect(() => {
    if (cooldown <= 0) {
      // Zerou a contagem: o bloqueio do throttler também deixa de valer na
      // tela. Quem recusa de verdade continua sendo a API.
      setRateLimited(false);
      return;
    }
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const askForCode = useCallback(async (value: string, { isResend }: { isResend: boolean }) => {
    setError("");
    isResend ? setResending(true) : setIsLoading(true);
    try {
      const result = await responsibleAuthApi.requestCode(value);
      setChallengeId(result.challengeId);
      setDestinationMask(result.destinationMask);
      setChannel(result.channel as "WHATSAPP" | "EMAIL" | "NONE");
      setContact(value);
      setCode("");
      submittedFor.current = "";
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setStep("codigo");
    } catch (err) {
      // 429 é o teto de 2 pedidos por 5 minutos por IP. A mensagem do throttler
      // não explica nada a quem está tentando entrar, e repetir o botão em 120s
      // só produziria outro 429.
      if (statusOf(err) === 429) {
        setError("Muitas tentativas seguidas. Aguarde alguns minutos antes de pedir outro código.");
        setRateLimited(true);
        setCooldown(TOO_MANY_REQUESTS_COOLDOWN_SECONDS);
      } else {
        setError(serverMessage(err, "Não foi possível enviar o código agora. Tente novamente."));
      }
    } finally {
      isResend ? setResending(false) : setIsLoading(false);
    }
  }, []);

  // Passo 1 — a sonda decide qual campo aparece em seguida.
  const onContactSubmit = async (data: LoginContactFormData) => {
    setError("");
    setIsLoading(true);
    try {
      const response = await authService.resolveLoginMethod({ contact: data.contact });
      setContact(data.contact);

      if (response?.data?.method === "PASSWORD") {
        passwordForm.reset({ password: "" });
        setShowPassword(false);
        setStep("senha");
        return;
      }

      // Qualquer outro caso é o fluxo do cliente — inclusive o contato que não
      // existe, que recebe o desafio de enfeite. Ver o cabeçalho deste arquivo.
      await askForCode(data.contact, { isResend: false });
    } catch (err) {
      setError(serverMessage(err, "Não foi possível continuar agora. Tente novamente."));
    } finally {
      setIsLoading(false);
    }
  };

  // Passo 2, funcionário — exatamente o fluxo que já existia.
  const onPasswordSubmit = async (data: LoginPasswordFormData) => {
    setIsLoading(true);
    setError("");
    try {
      const result = await login(contact, data.password);

      // Check if verification is required (result will be an object if verification needed)
      if (result && typeof result === "object" && "requiresVerification" in result && (result as any).requiresVerification) {
        // Redirect to verification page with the contact method
        const contactMethod = (result as any).phone || (result as any).email || contact;
        navigate(`${routes.authentication.verifyCode}?contact=${encodeURIComponent(contactMethod)}&returnTo=${encodeURIComponent(routes.home)}`);
        return;
      }

      // If login succeeds, navigate to home
      if (result && result.success) {
        // Small delay to ensure token is properly stored
        setTimeout(() => {
          navigate(routes.home);
        }, 100);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Ocorreu um erro ao fazer login";

      // Check if this is a verification redirect (handled by AuthContext)
      if (errorMessage === "VERIFICATION_REDIRECT") {
        // AuthContext should have handled the redirect
        return;
      }

      // Check if this is a verification error message
      if (errorMessage.includes("Conta não verificada") || errorMessage.includes("Conta ainda não verificada") || errorMessage.includes("verificação")) {
        // Redirect to verification page
        navigate(`${routes.authentication.verifyCode}?contact=${encodeURIComponent(contact)}&returnTo=${encodeURIComponent(routes.home)}`);
      }
      // API client will handle error notifications automatically
    } finally {
      setIsLoading(false);
    }
  };

  // Passo 2, cliente — troca o código por uma sessão do PORTAL.
  const submitCode = useCallback(
    async (value: string) => {
      if (value.length !== CODE_LENGTH || submittedFor.current === value) return;
      submittedFor.current = value;

      setIsLoading(true);
      setError("");
      try {
        const session = await responsibleAuthApi.verifyCode({ contact, challengeId, code: value });
        setResponsibleToken(session.token);
        // O `ResponsibleAuthProvider` vive só sob `/cliente/*`; ele lê o token
        // do storage e restaura a sessão no mount, por `GET /cliente/auth/eu`.
        navigate(routes.customer.portal.root, { replace: true });
      } catch (err) {
        setError(serverMessage(err, "Código inválido ou expirado."));
        setCode("");
        submittedFor.current = "";
      } finally {
        setIsLoading(false);
      }
    },
    [contact, challengeId, navigate],
  );

  // Envia sozinho ao completar as 6 casas — digitado o último dígito não há
  // decisão a tomar, e pedir um clique a mais seria atrito sem propósito.
  useEffect(() => {
    if (step === "codigo" && code.length === CODE_LENGTH && !isLoading) {
      void submitCode(code);
    }
  }, [code, step, isLoading, submitCode]);

  const backToContact = () => {
    setStep("contato");
    setCode("");
    setError("");
    setChallengeId("");
    setShowPassword(false);
    passwordForm.reset({ password: "" });
    submittedFor.current = "";
  };

  const styles = getAuthStyles();
  const ChannelIcon = channel === "WHATSAPP" ? IconBrandWhatsapp : IconMail;
  const channelName = channel === "WHATSAPP" ? "WhatsApp" : "e-mail";

  return (
    <div className={cn(authLayoutVariants({ background: "gradient" }), "w-screen")}>
      <Card className={cn(authCardVariants({ elevation: "elevated" }))}>
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <img src={BRAND_ASSETS.logo} alt="Ankaa Logo" className={styles.logo} />
          </div>

          {step === "codigo" ? (
            <>
              <CardTitle className={styles.title}>Confirme o código</CardTitle>
              <CardDescription className={styles.description}>
                Enviamos um código de {CODE_LENGTH} dígitos por {channelName} para
                <br />
                <span className="font-semibold text-foreground">{destinationMask}</span>
              </CardDescription>
            </>
          ) : (
            <>
              <CardTitle className={styles.title}>Bem-vindo de volta</CardTitle>
              <CardDescription className={styles.description}>
                {step === "senha" ? "Digite sua senha para acessar sua conta" : "Entre com seu email ou telefone para acessar sua conta"}
              </CardDescription>
            </>
          )}
        </CardHeader>

        {step === "contato" && (
          <Form {...contactForm}>
            <form onSubmit={contactForm.handleSubmit(onContactSubmit)} aria-label="Formulário de login" noValidate>
              <CardContent className={styles.form}>
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <FormField
                  control={contactForm.control}
                  name="contact"
                  render={({ field }) => (
                    <FormItem className={styles.fieldset}>
                      <FormLabel className={styles.label}>
                        Email ou Telefone
                        <span className="sr-only">obrigatório</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="seu@email.com ou (11) 98765-4321"
                          autoComplete="username"
                          autoFocus
                          disabled={isLoading}
                          className={cn(
                            inputVariants({
                              state: contactForm.formState.errors.contact ? "error" : "default",
                            }),
                          )}
                          value={field.value}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          name={field.name}
                          ref={field.ref}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Par centrado, não um em cada canto: os dois são o mesmo tipo de
                    atalho e ficavam lidos como opções distantes uma da outra. */}
                <div className="flex items-center justify-center gap-2">
                  <Link to={routes.authentication.firstAccess} className={styles.link}>
                    Primeiro acesso
                  </Link>
                  <span className="text-muted-foreground select-none">·</span>
                  <Link to={routes.authentication.recoverPassword} className={styles.link}>
                    Esqueceu sua senha?
                  </Link>
                </div>
              </CardContent>

              <CardFooter className={styles.footer}>
                {/* Só o 429 tranca este botão, e não o cooldown de reenvio: o
                    cooldown é por CONTATO (trocar o contato digitado é legítimo
                    — erro de digitação), enquanto o teto do throttler é por IP. */}
                <Button
                  type="submit"
                  className={styles.button}
                  disabled={isLoading || rateLimited || !contactForm.formState.isValid}
                  aria-describedby={isLoading ? "login-loading" : undefined}
                >
                  {isLoading && <LoadingSpinner size="sm" className="mr-2" />}
                  <span>{isLoading ? "Verificando..." : rateLimited ? `Aguarde ${cooldown}s` : "Continuar"}</span>
                  {isLoading && (
                    <span className="sr-only" id="login-loading">
                      Verificando, por favor aguarde
                    </span>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Form>
        )}

        {step === "senha" && (
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} aria-label="Formulário de senha" noValidate>
              <CardContent className={styles.form}>
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* Mostra o contato já aceito: sem isto o campo de senha aparece
                    sozinho e a pessoa não tem como conferir o que digitou. */}
                <p className="text-center text-sm text-muted-foreground">
                  Entrando como <span className="font-semibold text-foreground">{contact}</span>
                </p>

                <FormField
                  control={passwordForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem className={styles.fieldset}>
                      <FormLabel className={styles.label}>
                        Senha
                        <span className="sr-only">obrigatório</span>
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            autoComplete="current-password"
                            autoFocus
                            disabled={isLoading}
                            className={cn(
                              inputVariants({
                                state: passwordForm.formState.errors.password ? "error" : "default",
                              }),
                            )}
                            value={field.value}
                            onChange={field.onChange}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                            disabled={isLoading}
                            tabIndex={-1}
                            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                          >
                            {showPassword ? <IconEyeOff className="h-4 w-4 text-muted-foreground" /> : <IconEye className="h-4 w-4 text-muted-foreground" />}
                            <span className="sr-only" id="password-toggle">
                              {showPassword ? "Ocultar senha" : "Mostrar senha"}
                            </span>
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex items-center justify-center gap-2">
                  <Link to={routes.authentication.firstAccess} className={styles.link}>
                    Primeiro acesso
                  </Link>
                  <span className="text-muted-foreground select-none">·</span>
                  <Link to={routes.authentication.recoverPassword} className={styles.link}>
                    Esqueceu sua senha?
                  </Link>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col space-y-2">
                <Button
                  type="submit"
                  className={styles.button}
                  disabled={isLoading || !passwordForm.formState.isValid}
                  aria-describedby={isLoading ? "password-loading" : undefined}
                >
                  {isLoading && <LoadingSpinner size="sm" className="mr-2" />}
                  <span>{isLoading ? "Fazendo login..." : "Entrar"}</span>
                  {isLoading && (
                    <span className="sr-only" id="password-loading">
                      Fazendo login, por favor aguarde
                    </span>
                  )}
                </Button>

                <Button type="button" variant="ghost" className="w-full" disabled={isLoading} onClick={backToContact}>
                  <IconArrowLeft className="mr-2 h-4 w-4" />
                  Usar outro contato
                </Button>
              </CardFooter>
            </form>
          </Form>
        )}

        {step === "codigo" && (
          <>
            <CardContent className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex justify-center">
                <InputOTP maxLength={CODE_LENGTH} value={code} onChange={setCode} disabled={isLoading} autoFocus>
                  <InputOTPGroup className="gap-2">
                    {Array.from({ length: CODE_LENGTH }, (_, index) => (
                      <InputOTPSlot
                        key={index}
                        index={index}
                        className={cn("h-12 w-12 text-lg", error && "border-destructive bg-destructive/10", !error && code[index] && "border-primary bg-primary/10")}
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <p className="flex items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                <ChannelIcon className="h-4 w-4 shrink-0" />O código expira em 10 minutos
              </p>

              {isLoading && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <LoadingSpinner size="sm" />
                  Verificando...
                </div>
              )}
            </CardContent>

            <CardFooter className="flex flex-col space-y-2">
              <Button type="button" variant="link" onClick={() => void askForCode(contact, { isResend: true })} disabled={resending || cooldown > 0 || isLoading} className="w-full">
                {resending && <LoadingSpinner size="sm" className="mr-2" />}
                {resending ? "Reenviando..." : cooldown > 0 ? `Reenviar código em ${cooldown}s` : "Reenviar código"}
              </Button>

              <Button type="button" variant="ghost" className="w-full" disabled={isLoading} onClick={backToContact}>
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
