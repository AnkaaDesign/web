import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { IconSpray, IconPlus } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { routes } from "../../../../constants";

interface AirbrushingEmptyStateProps {
  className?: string;
  hasFilters?: boolean;
  onClearFilters?: () => void;
}

export function AirbrushingEmptyState({ className, hasFilters = false, onClearFilters }: AirbrushingEmptyStateProps) {
  const navigate = useNavigate();

  const handleCreateClick = () => {
    navigate(routes.production.airbrushings.create);
  };

  if (hasFilters) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <IconSpray className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Nenhum airbrushing encontrado</h3>
          <p className="text-muted-foreground mb-6 max-w-md">
            Não encontramos nenhum airbrushing que corresponda aos filtros aplicados. Tente ajustar os filtros ou limpar todos os filtros.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="outline" onClick={onClearFilters}>
              Limpar filtros
            </Button>
            <Button onClick={handleCreateClick}>
              <IconPlus className="h-4 w-4 mr-2" />
              Criar novo airbrushing
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardContent className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <IconSpray className="h-16 w-16 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Nenhum airbrushing cadastrado</h3>
        <p className="text-muted-foreground mb-6 max-w-md">Você ainda não tem nenhum airbrushing cadastrado no sistema. Comece criando seu primeiro airbrushing para uma tarefa.</p>
        <Button onClick={handleCreateClick}>
          <IconPlus className="h-4 w-4 mr-2" />
          Criar primeiro airbrushing
        </Button>
      </CardContent>
    </Card>
  );
}
