import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { IconAlertTriangle, IconHome, IconArrowLeft } from "@tabler/icons-react";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { routes } from "../constants";

export function NotFound() {
  const navigate = useNavigate();

  // Track page access
  usePageTracker({
    title: "Página Não Encontrada",
    icon: "alert",
    trackingEnabled: false, // Don't track 404 pages in most accessed
  });

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="max-w-md w-full">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-6">
            {/* Icon */}
            <div className="relative">
              <div className="absolute inset-0 bg-destructive/10 rounded-full blur-2xl" />
              <IconAlertTriangle className="h-20 w-20 text-destructive relative" />
            </div>

            {/* Error code */}
            <h1 className="text-6xl font-bold text-muted-foreground">404</h1>

            {/* Message */}
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold">Página não encontrada</h2>
              <p className="text-muted-foreground">Desculpe, a página que você está procurando não existe ou foi movida.</p>
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

            {/* Additional help text */}
            <p className="text-sm text-muted-foreground">Se você acredita que isso é um erro, entre em contato com o suporte.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
