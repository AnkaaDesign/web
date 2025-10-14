/**
 * Under Construction Page
 *
 * Displayed for features that are not yet available
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IconTool, IconArrowLeft } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export function UnderConstructionPage() {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto p-6 flex items-center justify-center min-h-[600px]">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="relative">
              <IconTool className="h-24 w-24 text-muted-foreground animate-bounce" />
              <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent"></div>
            </div>
          </div>
          <CardTitle className="text-3xl">Página em Construção</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center text-muted-foreground">
            <p className="text-lg mb-2">
              Esta funcionalidade está em desenvolvimento.
            </p>
            <p>
              Estamos trabalhando para trazer novos recursos e melhorias.
              Por favor, volte em breve!
            </p>
          </div>

          <div className="flex justify-center pt-4">
            <Button
              onClick={() => navigate("/")}
              variant="outline"
              className="gap-2"
            >
              <IconArrowLeft className="h-4 w-4" />
              Voltar para o Início
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default UnderConstructionPage;
