import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoadingSpinner } from "@/components/ui/loading";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface VerificationCodeFormProps {
  contact?: string;
  onSubmit: (code: string) => void;
  onResendCode?: () => void;
  isLoading?: boolean;
  isResending?: boolean;
  error?: string;
  codeLength?: number;
  contactInfo?: string;
  verificationType?: "phone" | "email";
  rateLimited?: boolean;
}

export function VerificationCodeForm({
  onSubmit,
  onResendCode,
  isLoading = false,
  isResending = false,
  error,
  codeLength = 6,
  contactInfo,
  verificationType = "phone",
  rateLimited = false,
}: VerificationCodeFormProps) {
  const [code, setCode] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Auto-submit when code is complete
  React.useEffect(() => {
    if (code.length === codeLength && !rateLimited && !hasSubmitted && !isLoading) {
      // Small delay to ensure state is settled
      const timer = setTimeout(() => {
        setHasSubmitted(true);
        onSubmit(code);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [code, codeLength, rateLimited, hasSubmitted, isLoading, onSubmit]);

  // Reset hasSubmitted when code changes (user editing)
  React.useEffect(() => {
    if (code.length < codeLength && hasSubmitted) {
      setHasSubmitted(false);
    }
  }, [code, codeLength, hasSubmitted]);

  // Clear code on error
  React.useEffect(() => {
    if (error && hasSubmitted) {
      setCode("");
      setHasSubmitted(false);
    }
  }, [error, hasSubmitted]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length === codeLength && !rateLimited && !hasSubmitted) {
      setHasSubmitted(true);
      onSubmit(code);
    }
  };

  const getInputClasses = (hasValue: boolean) => {
    if (error) {
      return "border-destructive bg-destructive/10";
    }
    if (hasValue) {
      return "border-primary bg-primary/10";
    }
    return "";
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-semibold">Verificar conta</CardTitle>
        <CardDescription className="text-base">
          Digite o código de {codeLength} dígitos enviado {verificationType === "phone" ? "por SMS" : "por email"}
          {contactInfo && <span className="font-medium"> para {contactInfo}</span>}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Rate Limit Warning */}
        {rateLimited && (
          <Alert variant="warning">
            <AlertDescription>
              <span className="font-enhanced-unicode">⚠️</span> Aguarde 1 minuto antes de tentar novamente
            </AlertDescription>
          </Alert>
        )}

        {/* Error Display */}
        {error && !rateLimited && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Code Input */}
          <div className="flex justify-center">
            <InputOTP
              maxLength={codeLength}
              value={code}
              onChange={(value) => {
                // Ensure we only accept numeric values
                const numericValue = value.replace(/\D/g, "");
                setCode(numericValue);
              }}
              disabled={isLoading || rateLimited}
              className={cn(rateLimited && "opacity-50")}
            >
              <InputOTPGroup className="gap-2">
                {Array.from({ length: codeLength }).map((_, index) => (
                  <InputOTPSlot key={index} index={index} className={cn("w-12 h-12 text-lg", getInputClasses(!!code[index]), rateLimited && "opacity-50")} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          {/* Submit Button */}
          <Button type="submit" className="w-full h-12" disabled={code.length !== codeLength || isLoading || rateLimited}>
            {isLoading && <LoadingSpinner size="sm" className="mr-2" />}
            {isLoading ? "Verificando..." : rateLimited ? "Aguarde..." : "Verificar código"}
          </Button>

          {/* Resend Button */}
          {onResendCode && (
            <div className="text-center">
              <Button
                type="button"
                variant="link"
                onClick={onResendCode}
                disabled={isResending || rateLimited}
                className={cn("text-base", (rateLimited || isResending) && "text-muted-foreground")}
              >
                {isResending && <LoadingSpinner size="sm" className="mr-2" />}
                {isResending ? "Reenviando..." : rateLimited ? "Aguarde para reenviar" : "Reenviar código"}
              </Button>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
