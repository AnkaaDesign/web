import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { VerificationCodeForm } from "@/components/auth/verification-code-form";
import { authService } from "../../api-client";
import { routes } from "../../constants";
import { IconArrowLeft, IconRefresh } from "@tabler/icons-react";
import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { z } from "zod";
import { getAuthStyles, authLayoutVariants, authCardVariants, inputVariants } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

// Schema for the new password form
const newPasswordSchema = z
  .object({
    password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

type NewPasswordFormData = z.infer<typeof newPasswordSchema>;

export function VerifyPasswordResetPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"verification" | "newPassword">("verification");
  const [verifiedCode, setVerifiedCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Get contact from URL params
  const contact = searchParams.get("contact") || "";

  const form = useForm<NewPasswordFormData>({
    resolver: zodResolver(newPasswordSchema),
    mode: "onChange",
  });

  useEffect(() => {
    // Redirect if no contact provided
    if (!contact) {
      navigate(routes.authentication.recoverPassword);
      return;
    }
  }, [contact, navigate]);

  const handleVerification = async (code: string) => {
    // Just store the code locally - verification happens when setting new password
    setVerifiedCode(code);
    setStep("newPassword");
  };

  const handleResendCode = async () => {
    setIsResending(true);
    setError("");

    try {
      await authService.resendVerification({ contact: contact });

      // API client will handle success notifications automatically
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Resend failed:", error);
      }

      // API client will handle error notifications automatically

      // Error will be handled by API client

      // API client will handle error notifications automatically
    } finally {
      setIsResending(false);
    }
  };

  const onSubmitNewPassword = async (data: NewPasswordFormData) => {
    setIsLoading(true);

    try {
      await authService.resetPasswordWithCode({
        contact: contact,
        code: verifiedCode,
        password: data.password,
        confirmPassword: data.confirmPassword,
      });

      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate(routes.authentication.login);
      }, 2000);
    } catch (error: any) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Password reset failed:", error);
      }

      // API client will handle error notifications automatically

      // If code is invalid/expired, go back to verification
      if (error?.message?.includes("expired") || error?.message?.includes("invalid")) {
        setStep("verification");
        setVerifiedCode("");
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!contact) {
    return null;
  }

  const isEmail = contact.includes("@");
  const displayContact = isEmail ? contact : contact.replace(/\D/g, "").replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");

  const contactType = isEmail ? "email" : "telefone";
  // const password = watch("password"); // Currently unused
  const styles = getAuthStyles();

  return (
    <div className={cn(authLayoutVariants({ background: "gradient" }), "w-screen")}>
      <Card className={cn(authCardVariants({ elevation: "elevated" }))}>
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <img src="/logo.png" alt="Ankaa Logo" className={styles.logo} />
          </div>
          {step === "verification" ? (
            <>
              <CardTitle className={styles.title}>Verificar código</CardTitle>
              <CardDescription className={styles.description}>
                Digite o código de 6 dígitos enviado para seu {contactType}: <br />
                <span className="font-semibold text-foreground">{displayContact}</span>
              </CardDescription>
            </>
          ) : (
            <>
              <CardTitle className={styles.title}>Nova senha</CardTitle>
              <CardDescription className={styles.description}>Defina sua nova senha para continuar</CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent>
          {step === "verification" ? (
            <VerificationCodeForm contact={contact} isLoading={isLoading} onSubmit={handleVerification} onResendCode={handleResendCode} isResending={isResending} error={error} />
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmitNewPassword, () => {})} aria-label="Formulário de nova senha" noValidate className={styles.form}>
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem className={styles.fieldset}>
                      <FormLabel className={styles.label}>
                        Nova senha
                        <span className="sr-only">obrigatório</span>
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            placeholder="Digite sua nova senha"
                            disabled={isLoading}
                            className={cn(
                              inputVariants({
                                state: form.formState.errors.password ? "error" : "default",
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
                          >
                            {showPassword ? <IconEyeOff className="h-4 w-4 text-gray-500 dark:text-gray-400" /> : <IconEye className="h-4 w-4 text-gray-500 dark:text-gray-400" />}
                            <span className="sr-only">{showPassword ? "Ocultar senha" : "Mostrar senha"}</span>
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
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
                            disabled={isLoading}
                            className={cn(
                              inputVariants({
                                state: form.formState.errors.confirmPassword ? "error" : "default",
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
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            disabled={isLoading}
                            tabIndex={-1}
                          >
                            {showConfirmPassword ? (
                              <IconEyeOff className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                            ) : (
                              <IconEye className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                            )}
                            <span className="sr-only">{showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}</span>
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={isLoading || !form.formState.isValid} aria-label="Redefinir senha">
                  {isLoading ? (
                    <>
                      <IconRefresh className="mr-2 h-4 w-4 animate-spin" />
                      Redefinindo senha...
                    </>
                  ) : (
                    "Redefinir senha"
                  )}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          {step === "verification" ? (
            <Link to={routes.authentication.recoverPassword} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <IconArrowLeft className="h-4 w-4" />
              Voltar para recuperação
            </Link>
          ) : (
            <button onClick={() => setStep("verification")} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <IconArrowLeft className="h-4 w-4" />
              Voltar para verificação
            </button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
