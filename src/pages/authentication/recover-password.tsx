import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { passwordRecoverySchema } from "../../schemas";
import type { PasswordRecoveryFormData } from "../../schemas";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading";
import { getAuthStyles, authLayoutVariants, authCardVariants, inputVariants } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { routes } from "../../constants";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

export function RecoverPasswordPage() {
  const navigate = useNavigate();
  const { recoverPassword } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // Track page access
  usePageTracker({
    title: "Recuperar Senha",
    icon: "key",
  });

  const form = useForm<PasswordRecoveryFormData>({
    resolver: zodResolver(passwordRecoverySchema),
    mode: "onChange",
  });

  const onSubmit = async (data: PasswordRecoveryFormData) => {
    setIsLoading(true);

    try {
      await recoverPassword(data.contact);

      // Redirect to verification page for password reset
      navigate(`${routes.authentication.verifyPasswordReset}?contact=${encodeURIComponent(data.contact)}`);
    } catch (error) {
      // API client will handle error notifications automatically
    } finally {
      setIsLoading(false);
    }
  };

  const styles = getAuthStyles();

  return (
    <div className={authLayoutVariants({ background: "gradient" })}>
      <Card className={cn(authCardVariants({ elevation: "elevated" }))}>
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <img src="/logo.png" alt="Ankaa Logo" className={styles.logo} />
          </div>
          <CardTitle className={styles.title}>Recuperar senha</CardTitle>
          <CardDescription className={styles.description}>Digite seu email ou telefone e enviaremos um código para redefinir sua senha</CardDescription>
        </CardHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} aria-label="Formulário de recuperação de senha" noValidate>
            <CardContent className={styles.form}>
              <FormField
                control={form.control}
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
                        className={cn(
                          inputVariants({
                            state: form.formState.errors.contact ? "error" : "default",
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
            </CardContent>

            <CardFooter className={styles.footer}>
              <Button type="submit" className={styles.button} disabled={isLoading || !form.formState.isValid} aria-describedby={isLoading ? "recover-loading" : undefined}>
                {isLoading && <LoadingSpinner size="sm" className="mr-2" />}
                <span>{isLoading ? "Enviando..." : "Enviar código de recuperação"}</span>
                {isLoading && (
                  <span className="sr-only" id="recover-loading">
                    Enviando código, por favor aguarde
                  </span>
                )}
              </Button>

              <div className="text-sm text-center text-muted-foreground">
                Lembrou sua senha?{" "}
                <Link to={routes.authentication.login} className={styles.link}>
                  Voltar ao login
                </Link>
              </div>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
