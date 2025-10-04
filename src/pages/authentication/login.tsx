import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading";
import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { signInSchema, type SignInFormData } from "../../schemas";
import { getAuthStyles, authLayoutVariants, authCardVariants, inputVariants } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { routes } from "../../constants";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Track page access
  usePageTracker({
    title: "Login",
    icon: "login",
  });

  const form = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    mode: "onChange",
    defaultValues: {
      contact: "",
      password: "",
    },
  });

  const onSubmit = async (data: SignInFormData) => {
    setIsLoading(true);
    try {
      const result = await login(data.contact, data.password); // Check if verification is required (result will be an object if verification needed)
      if (result && typeof result === "object" && "requiresVerification" in result && result.requiresVerification) {
        // Redirect to verification page with the contact method
        const contactMethod = (result as any).phone || (result as any).email || data.contact;
        navigate(`${routes.authentication.verifyCode}?contact=${encodeURIComponent(contactMethod)}&returnTo=${encodeURIComponent(routes.home)}`);
        return;
      }

      // If login succeeds, navigate to home
      if (result && result.success) {
        // Small delay to ensure token is properly stored
        setTimeout(() => {
          navigate(routes.home);
        }, 100);
      } else {
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro ao fazer login";

      // Check if this is a verification redirect (handled by AuthContext)
      if (errorMessage === "VERIFICATION_REDIRECT") {
        // AuthContext should have handled the redirect
        return;
      }

      // Check if this is a verification error message
      if (errorMessage.includes("Conta não verificada") || errorMessage.includes("Conta ainda não verificada") || errorMessage.includes("verificação")) {
        // Redirect to verification page
        navigate(`${routes.authentication.verifyCode}?contact=${encodeURIComponent(data.contact)}&returnTo=${encodeURIComponent(routes.home)}`);
      }
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
          <CardTitle className={styles.title}>Bem-vindo de volta</CardTitle>
          <CardDescription className={styles.description}>Entre com suas credenciais para acessar sua conta</CardDescription>
        </CardHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} aria-label="Formulário de login" noValidate>
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

              <FormField
                control={form.control}
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

              <div className="flex items-center justify-end">
                <Link to={routes.authentication.recoverPassword} className={styles.link}>
                  Esqueceu sua senha?
                </Link>
              </div>
            </CardContent>

            <CardFooter className={styles.footer}>
              <Button type="submit" className={styles.button} disabled={isLoading || !form.formState.isValid} aria-describedby={isLoading ? "login-loading" : undefined}>
                {isLoading && <LoadingSpinner size="sm" className="mr-2" />}
                <span>{isLoading ? "Fazendo login..." : "Entrar"}</span>
                {isLoading && (
                  <span className="sr-only" id="login-loading">
                    Fazendo login, por favor aguarde
                  </span>
                )}
              </Button>

              <div className="text-sm text-center text-muted-foreground">
                Não tem uma conta?{" "}
                <Link to={routes.authentication.register} className={styles.link}>
                  Cadastre-se
                </Link>
              </div>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
