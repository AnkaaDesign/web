import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconAlertTriangle, IconRefresh } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

interface ErrorCardProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorCard({
  title = "Algo deu errado",
  description = "Ocorreu um erro ao processar sua solicitação. Por favor, tente novamente.",
  onRetry,
  className,
}: ErrorCardProps) {
  return (
    <Card className={cn("max-w-md mx-auto", className)}>
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 p-3 rounded-full bg-destructive/10">
          <IconAlertTriangle className="h-8 w-8 text-destructive" />
        </div>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {onRetry && (
        <CardFooter className="justify-center">
          <Button onClick={onRetry} variant="outline" className="gap-2">
            <IconRefresh className="h-4 w-4" />
            Tentar Novamente
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
