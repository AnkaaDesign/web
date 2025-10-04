import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { contactMethodSchema } from "../../schemas";
import { z } from "zod";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/ui/loading";
import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { getAuthStyles, authLayoutVariants, authCardVariants, inputVariants } from "@/lib/design-system";
import { cn } from "@/lib/utils";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { routes } from "../../constants";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";

// Create a schema that matches the form structure
const registerFormSchema = z
  .object({
    name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(200, "Nome deve ter no máximo 200 caracteres"),
    contact: contactMethodSchema,
    password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

type RegisterFormData = z.infer<typeof registerFormSchema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const { register: registerUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Track page access
  usePageTracker({
    title: "Cadastro",
    icon: "user-plus",
  });

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerFormSchema),
    mode: "onChange",
  });

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);

    try {
      const result = await registerUser({
        name: data.name as string,
        contact: data.contact as string,
        password: data.password as string,
      });

      // Check if verification is required
      if (result.requiresVerification) {
        const contactMethod = (result as any).phone || (result as any).email || data.contact;

        // Always redirect to the 6-digit verification page
        navigate(`${routes.authentication.verifyCode}?contact=${encodeURIComponent(contactMethod)}&returnTo=${encodeURIComponent("/")}`);
      } else {
        // No verification required, already logged in
        window.location.href = "/";
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro ao criar sua conta";

      // Check if this is a verification redirect (success case)
      if (errorMessage.includes("Conta criada com sucesso") || errorMessage.includes("verificação")) {
        // Redirect to verification page
        navigate(`${routes.authentication.verifyCode}?contact=${encodeURIComponent(data.contact)}&returnTo=${encodeURIComponent("/")}`);
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
          <CardTitle className={styles.title}>Criar conta</CardTitle>
          <CardDescription className={styles.description}>Preencha os dados abaixo para criar sua conta</CardDescription>
        </CardHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} aria-label="Formulário de cadastro" noValidate>
            <CardContent className={styles.form}>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className={styles.fieldset}>
                    <FormLabel className={styles.label}>
                      Nome completo
                      <span className="sr-only">obrigatório</span>
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="Seu nome completo"
                        autoComplete="name"
                        disabled={isLoading}
                        className={cn(
                          inputVariants({
                            state: form.formState.errors.name ? "error" : "default",
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
                          placeholder="••••••"
                          autoComplete="new-password"
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
                          placeholder="••••••"
                          autoComplete="new-password"
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
                          aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
                        >
                          {showConfirmPassword ? <IconEyeOff className="h-4 w-4 text-muted-foreground" /> : <IconEye className="h-4 w-4 text-muted-foreground" />}
                          <span className="sr-only" id="confirmPassword-toggle">
                            {showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
                          </span>
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>

            <CardFooter className={styles.footer}>
              <Button type="submit" className={styles.button} disabled={isLoading || !form.formState.isValid} aria-describedby={isLoading ? "register-loading" : undefined}>
                {isLoading && <LoadingSpinner size="sm" className="mr-2" />}
                <span>{isLoading ? "Criando conta..." : "Criar conta"}</span>
                {isLoading && (
                  <span className="sr-only" id="register-loading">
                    Criando conta, por favor aguarde
                  </span>
                )}
              </Button>

              <div className="text-sm text-center text-muted-foreground">
                Já tem uma conta?{" "}
                <Link to={routes.authentication.login} className={styles.link}>
                  Fazer login
                </Link>
              </div>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}
