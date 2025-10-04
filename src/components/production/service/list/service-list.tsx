import { type Service } from "../../../../types";
import { formatDate } from "../../../../utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconEdit, IconTrash, IconCalendar } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { routes } from "../../../../constants";
import { useServiceMutations } from "../../../../hooks";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ServiceListProps {
  services: Service[];
  onServiceUpdate?: () => void;
}

export function ServiceList({ services, onServiceUpdate }: ServiceListProps) {
  const navigate = useNavigate();
  const { delete: deleteService, deleteMutation } = useServiceMutations();

  const handleDelete = async (id: string) => {
    try {
      await deleteService(id);
      onServiceUpdate?.();
    } catch (error) {
      // Error is handled by the API client
    }
  };

  if (services.length === 0) {
    return (
      <Card className="p-8">
        <p className="text-center text-muted-foreground">Nenhum serviço encontrado. Crie um novo serviço para começar.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {services.map((service: Service) => (
        <Card key={service.id} className="p-4 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(routes.production.services.details(service.id))}>
          <div className="flex items-center justify-between">
            <div className="flex-1 space-y-1">
              <h4 className="font-medium line-clamp-2">{service.description}</h4>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <IconCalendar className="h-3 w-3" />
                <span>Criado em {formatDate(service.createdAt)}</span>
              </div>
            </div>

            <div className="flex gap-2 ml-4" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
              <Button size="sm" variant="ghost" onClick={() => navigate(routes.production.services.edit(service.id))}>
                <IconEdit className="h-4 w-4" />
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="ghost" disabled={deleteMutation.isPending}>
                    <IconTrash className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                    <AlertDialogDescription>Tem certeza que deseja excluir este serviço? Esta ação não pode ser desfeita.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(service.id)} className="bg-destructive text-destructive-foreground">
                      Excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
