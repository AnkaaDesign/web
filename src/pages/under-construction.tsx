import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { IconHammer, IconArrowLeft, IconHome } from "@tabler/icons-react";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { routes } from "../constants";

export default function UnderConstruction() {
  const navigate = useNavigate();

  // Track page access
  usePageTracker({
    title: "Em Construção",
    icon: "construction",
    trackingEnabled: false, // Don't track under construction pages
  });

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-6">
            {/* Icon */}
            <div className="relative">
              <div className="absolute inset-0 bg-orange-500/10 rounded-full blur-2xl" />
              <IconHammer className="h-20 w-20 text-orange-500 relative" />
            </div>

            {/* Message */}
            <div className="space-y-2">
              <h1 className="text-3xl font-bold">Página em Construção</h1>
              <p className="text-muted-foreground">
                Estamos trabalhando para trazer esta funcionalidade em breve.
                Por favor, volte mais tarde.
              </p>
            </div>

            {/* Progress indicator */}
            <div className="w-full bg-secondary rounded-full h-2">
              <div className="bg-orange-500 h-2 rounded-full animate-pulse" style={{ width: "45%" }} />
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <Button variant="outline" onClick={() => navigate(-1)} className="w-full sm:w-auto">
                <IconArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <Button onClick={() => navigate(routes.home)} className="w-full sm:w-auto">
                <IconHome className="h-4 w-4 mr-2" />
                Página inicial
              </Button>
            </div>

            {/* Additional info */}
            <p className="text-sm text-muted-foreground">
              Agradecemos sua paciência enquanto desenvolvemos esta nova funcionalidade.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}