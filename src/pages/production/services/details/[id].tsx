import { useParams, useNavigate } from "react-router-dom";
import { useServiceDetail, useServiceMutations } from "../../../../hooks";
import { routes } from "../../../../constants";
import { ServiceDetails } from "@/components/production/service/details/service-details";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { IconTool, IconEdit, IconTrash } from "@tabler/icons-react";
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

export const ServiceDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useServiceDetail(id!);
  const { remove, isDeleting } = useServiceMutations();

  const handleDelete = async () => {
    if (!id) return;

    try {
      await remove(id);
      navigate(routes.production.services.list);
    } catch (error) {
      // Error is handled by the API client
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full space-y-6">
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="container mx-auto max-w-3xl space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <Skeleton className="h-8 w-1/3" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!data?.data) {
    return (
      <div className="flex flex-col h-full space-y-6">
        <PageHeader
          title="Detalhes do Serviço"
          icon={IconTool}
          variant="detail"
          breadcrumbs={[
            { label: "Home", href: "/" },
            { label: "Produção", href: routes.production.root },
            { label: "Serviços", href: routes.production.services.list },
            { label: "Detalhes" },
          ]}
        />
        <div className="flex-1 overflow-y-auto">
          <div className="container mx-auto max-w-3xl space-y-6">
            <Card>
              <CardContent className="p-6">
                <p className="text-center text-muted-foreground">Serviço não encontrado</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const service = data.data;

  return (
    <div className="flex flex-col h-full space-y-6">
      <PageHeader
        title={service.description}
        subtitle={`ID: ${service.id}`}
        icon={IconTool}
        variant="detail"
        breadcrumbs={[
          { label: "Home", href: "/" },
          { label: "Produção", href: routes.production.root },
          { label: "Serviços", href: routes.production.services.list },
          { label: service.description },
        ]}
        backButton={{
          onClick: () => navigate(routes.production.services.list),
        }}
        actions={[
          {
            key: "edit",
            label: "Editar",
            icon: IconEdit,
            onClick: () => navigate(routes.production.services.edit(service.id)),
          },
          {
            key: "delete",
            label: "Excluir",
            icon: IconTrash,
            onClick: () => {
              document.getElementById("delete-trigger")?.click();
            },
            disabled: isDeleting,
          },
        ]}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="container mx-auto max-w-3xl space-y-6">
          <Card>
            <CardContent className="p-6">
              <ServiceDetails service={service} />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="destructive" disabled={isDeleting} onClick={() => {}} className="hidden" id="delete-trigger">
            Excluir
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este serviço? Esta ação não pode ser desfeita. Tarefas que utilizam este serviço não serão afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
