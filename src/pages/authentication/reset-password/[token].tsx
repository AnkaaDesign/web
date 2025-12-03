import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconArrowLeft } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { routes } from "../../../constants";

export function ResetPasswordTokenPage() {
  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <img src="/logo.png" alt="Ankaa Logo" className="w-40 h-16 object-contain" />
          </div>
          <CardTitle className="text-2xl text-center">Redefinir senha</CardTitle>
          <CardDescription className="text-center">Sistema atualizado para verificação por código</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">Esta página foi removida. Use agora a recuperação de senha com código de 6 dígitos.</p>
            <Link to={routes.authentication.recoverPassword}>
              <Button className="w-full">Recuperar senha</Button>
            </Link>
          </div>
        </CardContent>

        <CardFooter className="flex flex-col space-y-4">
          <Link to={routes.authentication.login} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <IconArrowLeft className="h-4 w-4" />
            Voltar para o login
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
