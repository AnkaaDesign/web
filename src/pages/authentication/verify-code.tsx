import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { VerificationCodeForm } from "@/components/auth/verification-code-form";
import { useAuth } from "@/contexts/auth-context";
import { IconArrowLeft } from "@tabler/icons-react";
import { routes } from "../../constants";
import { maskPhone } from "../../utils";

export function VerifyCodePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { verifyCode, resendCode } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState("");

  // Get contact from URL params
  const contact = searchParams.get("contact") || "";
  const returnTo = searchParams.get("returnTo") || routes.authentication.login;

  useEffect(() => {
    // Redirect if no contact provided
    if (!contact) {
      navigate(routes.authentication.login);
      return;
    }
  }, [contact, navigate]);

  const handleVerification = async (code: string) => {
    setIsLoading(true);
    setError("");

    try {
      // Use unified verification endpoint for both email and phone
      await verifyCode(contact, code);

      // Redirect back to login or specified return URL
      navigate(returnTo);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Verification failed:", error);
      }

      let message = "Código inválido. Verifique o código e tente novamente.";

      if (error instanceof Error) {
        if (error.message.includes("Limite de requisições excedido")) {
          message = "Muitas tentativas. Aguarde um minuto antes de tentar novamente.";
        } else if (error.message.includes("expired") || error.message.includes("expirou")) {
          message = "O código expirou. Solicite um novo código.";
        } else if (error.message.includes("invalid") || error.message.includes("inválido")) {
          message = "Código inválido. Verifique o código e tente novamente.";
        } else {
          message = error.message;
        }
      }

      setError(message);
      // API client will handle error notifications automatically
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendCode = async () => {
    setIsResending(true);
    setError("");

    try {
      // Use unified resend verification endpoint
      await resendCode(contact);

      // API client will handle success notifications automatically
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Resend failed:", error);
      }

      if (error instanceof Error) {
        if (error.message.includes("Limite de requisições excedido") || error.message.includes("rate limit")) {
          // Just log the error, API client will handle notifications
        }
      }

      // API client will handle error notifications automatically
    } finally {
      setIsResending(false);
    }
  };

  if (!contact) {
    return null;
  }

  const isEmail = contact.includes("@");
  const displayContact = isEmail ? contact : maskPhone(contact);

  const contactType = isEmail ? "email" : "telefone";

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <img src="/logo.png" alt="Ankaa Logo" className="w-40 h-16 object-contain" />
          </div>
          <CardTitle className="text-2xl text-center">Verificar conta</CardTitle>
          <CardDescription className="text-center">
            Digite o código de 6 dígitos enviado para seu {contactType}: <br />
            <span className="font-semibold text-foreground">{displayContact}</span>
          </CardDescription>
        </CardHeader>

        <CardContent>
          <VerificationCodeForm contact={contact} isLoading={isLoading} onSubmit={handleVerification} onResendCode={handleResendCode} isResending={isResending} error={error} />
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          <Link to={returnTo} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <IconArrowLeft className="h-4 w-4" />
            Voltar para o login
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
