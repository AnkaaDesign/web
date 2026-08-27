import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { IconArrowLeft, IconEye, IconEyeOff } from "@tabler/icons-react";
import { getAuthStyles, authLayoutVariants, authCardVariants, inputVariants } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { routes } from "../../constants";
import { firstAccessRequestSchema } from "../../schemas";
import type { FirstAccessRequestFormData } from "../../schemas";
import { BRAND_ASSETS } from "@/config/assets";

// Local to the page: the server takes `setupToken` alongside the password, and
// the token lives in component state rather than in the form.
const newPasswordSchema = z
  .object({
    password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres").max(128, "Senha deve ter no máximo 128 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

type NewPasswordFormData = z.infer<typeof newPasswordSchema>;

type Step = "contact" | "code" | "password";

const CODE_LENGTH = 6;

/**
 * Primeiro acesso: o RH cadastra o colaborador sem senha, e é aqui que ele
 * assume a conta — confirma o contato com um código, escolhe a senha e já entra.
 *
 * Os três passos moram em uma tela só, de propósito: o código e o token de
 * ativação são estado de memória, e uma navegação entre páginas (ou um F5)
 * jogaria a cerimônia fora no meio.
 */
export function FirstAccessPage() {
  const navigate = useNavigate();
  const { requestFirstAccess, verifyFirstAccess, completeFirstAccess } = useAuth();

  const [step, setStep] = useState<Step>("contact");
  const [contact, setContact] = useState("");
  const [code, setCode] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [userName, setUserName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  usePageTracker({
    title: "Primeiro Acesso",
    icon: "user-check",
  });

  const contactForm = useForm<FirstAccessRequestFormData>({
    resolver: zodResolver(firstAccessRequestSchema),
    mode: "onChange",
    defaultValues: { contact: "" },
  });

  const passwordForm = useForm<NewPasswordFormData>({
    resolver: zodResolver(newPasswordSchema),
    mode: "onChange",
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmitContact = async (data: FirstAccessRequestFormData) => {
    setIsLoading(true);
    try {
      await requestFirstAccess(data.contact);
      setContact(data.contact);
      setCode("");
      setCodeError("");
      setStep("code");
    } catch {
      // API client will handle error notifications automatically
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmitCode = async (submittedCode: string) => {
    setIsLoading(true);
    setCodeError("");
    try {
      const { setupToken: token, name } = await verifyFirstAccess(contact, submittedCode);
      setSetupToken(token);
      setUserName(name);
      setStep("password");
    } catch (error) {
      // Inline, next to the field: this is the one error the person can fix
      // right where they are, without leaving the step.
      setCodeError(error instanceof Error ? error.message : "Código inválido. Tente novamente.");
      setCode("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setIsResending(true);
    setCodeError("");
    try {
      await requestFirstAccess(contact);
      setCode("");
    } catch {
      // API client will handle error notifications automatically
    } finally {
      setIsResending(false);
    }
  };

  const onSubmitPassword = async (data: NewPasswordFormData) => {
    setIsLoading(true);
    try {
      await completeFirstAccess(setupToken, data.password, data.confirmPassword);
      // Já autenticado pelo próprio endpoint de ativação — a conta não volta
      // para a tela de login só para digitar a senha recém-criada.
      navigate(routes.home);
    } catch (error) {
      // Um token expirado (15 min) só se resolve com um código novo.
      if (error instanceof Error && /expirad|inválida/i.test(error.message)) {
        setSetupToken("");
        setCode("");
        setCodeError("Sua sessão expirou. Solicite um novo código.");
        setStep("code");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const styles = getAuthStyles();
  const isEmail = contact.includes("@");
  const displayContact = isEmail ? contact : contact.replace(/\D/g, "").replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");

  return (
    <div className={cn(authLayoutVariants({ background: "gradient" }), "w-screen")}>
      <Card className={cn(authCardVariants({ elevation: "elevated" }))}>
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <img src={BRAND_ASSETS.logo} alt="Ankaa Logo" className={styles.logo} />
          </div>
          {step === "contact" && (
            <>
              <CardTitle className={styles.title}>Primeiro acesso</CardTitle>
              <CardDescription className={styles.description}>Sua conta já foi criada. Informe seu email ou telefone para receber o código de ativação.</CardDescription>
            </>
          )}
          {step === "code" && (
            <>
              <CardTitle className={styles.title}>Confirme seu {isEmail ? "email" : "telefone"}</CardTitle>
              <CardDescription className={styles.description}>
                Digite o código de {CODE_LENGTH} dígitos enviado para: <br />
                <span className="font-semibold text-foreground">{displayContact}</span>
              </CardDescription>
            </>
          )}
          {step === "password" && (
            <>
              <CardTitle className={styles.title}>Crie sua senha</CardTitle>
              <CardDescription className={styles.description}>
                {userName ? `Tudo certo, ${userName.split(" ")[0]}! ` : ""}
                Escolha uma senha para ativar sua conta e entrar.
              </CardDescription>
            </>
          )}
        </CardHeader>

        {step === "contact" && (
          <Form {...contactForm}>
            <form onSubmit={contactForm.handleSubmit(onSubmitContact)} aria-label="Formulário de primeiro acesso" noValidate>
              <CardContent className={styles.form}>
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
                          disabled={isLoading}
                          className={cn(inputVariants({ state: contactForm.formState.errors.contact ? "error" : "default" }))}
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
              </CardContent>

              <CardFooter className={styles.footer}>
                <Button type="submit" className={styles.button} disabled={isLoading || !contactForm.formState.isValid}>
                  {isLoading && <LoadingSpinner size="sm" className="mr-2" />}
                  <span>{isLoading ? "Enviando..." : "Enviar código"}</span>
                </Button>

                <div className="text-sm text-center text-muted-foreground">
                  Já tem uma senha?{" "}
                  <Link to={routes.authentication.login} className={styles.link}>
                    Voltar ao login
                  </Link>
                </div>
              </CardFooter>
            </form>
          </Form>
        )}

        {step === "code" && (
          <>
            <CardContent className="space-y-6">
              {codeError && (
                <Alert variant="destructive">
                  <AlertDescription>{codeError}</AlertDescription>
                </Alert>
              )}

              <div className="flex justify-center">
                <InputOTP
                  maxLength={CODE_LENGTH}
                  value={code}
                  onChange={(value) => {
                    const numericValue = value.replace(/\D/g, "");
                    setCode(numericValue);
                    if (numericValue.length === CODE_LENGTH && !isLoading) {
                      void onSubmitCode(numericValue);
                    }
                  }}
                  disabled={isLoading}
                  autoFocus
                >
                  <InputOTPGroup className="gap-2">
                    {Array.from({ length: CODE_LENGTH }).map((_, index) => (
                      <InputOTPSlot key={index} index={index} className="w-12 h-12 text-lg" />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>

              <Button type="button" className="w-full h-12" disabled={code.length !== CODE_LENGTH || isLoading} onClick={() => void onSubmitCode(code)}>
                {isLoading && <LoadingSpinner size="sm" className="mr-2" />}
                {isLoading ? "Verificando..." : "Verificar código"}
              </Button>

              <div className="text-center">
                <Button type="button" variant="link" onClick={handleResendCode} disabled={isResending || isLoading}>
                  {isResending && <LoadingSpinner size="sm" className="mr-2" />}
                  {isResending ? "Reenviando..." : "Reenviar código"}
                </Button>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col space-y-4">
              <button
                type="button"
                onClick={() => {
                  setStep("contact");
                  setCode("");
                  setCodeError("");
                }}
                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <IconArrowLeft className="h-4 w-4" />
                Usar outro email ou telefone
              </button>
            </CardFooter>
          </>
        )}

        {step === "password" && (
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(onSubmitPassword)} aria-label="Formulário de criação de senha" noValidate>
              <CardContent className={styles.form}>
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
                            placeholder="Crie sua senha"
                            autoComplete="new-password"
                            disabled={isLoading}
                            className={cn(inputVariants({ state: passwordForm.formState.errors.password ? "error" : "default" }))}
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
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem className={styles.fieldset}>
                      <FormLabel className={styles.label}>
                        Confirmar senha
                        <span className="sr-only">obrigatório</span>
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Digite a senha novamente"
                            autoComplete="new-password"
                            disabled={isLoading}
                            className={cn(inputVariants({ state: passwordForm.formState.errors.confirmPassword ? "error" : "default" }))}
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
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            disabled={isLoading}
                            tabIndex={-1}
                            aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
                          >
                            {showConfirmPassword ? <IconEyeOff className="h-4 w-4 text-muted-foreground" /> : <IconEye className="h-4 w-4 text-muted-foreground" />}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>

              <CardFooter className={styles.footer}>
                <Button type="submit" className={styles.button} disabled={isLoading || !passwordForm.formState.isValid}>
                  {isLoading && <LoadingSpinner size="sm" className="mr-2" />}
                  <span>{isLoading ? "Ativando conta..." : "Ativar conta e entrar"}</span>
                </Button>
              </CardFooter>
            </form>
          </Form>
        )}
      </Card>
    </div>
  );
}
