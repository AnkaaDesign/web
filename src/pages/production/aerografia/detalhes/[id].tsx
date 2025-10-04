import { useParams, useNavigate } from "react-router-dom";
import { useAirbrushing, useAirbrushingMutations } from "../../../../hooks";
import { routes, SECTOR_PRIVILEGES } from "../../../../constants";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AirbrushingInfoCard } from "@/components/production/airbrushing/detail";
import { IconBrush, IconEdit, IconTrash } from "@tabler/icons-react";
import { usePageTracker } from "@/hooks/use-page-tracker";
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
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const AirbrushingDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Track page for analytics
  usePageTracker({ title: "Aerografia - Detalhes", icon: "airbrushing_detail" });

  // Fetch airbrushing data
  const { data, isLoading, isError } = useAirbrushing(id!, {
    enabled: !!id,
    include: {
      task: {
        include: {
          customer: true,
          sector: true,
        },
      },
      receipts: true,
      nfes: true,
    },
  });

  // Mutations
  const { deleteMutation: deleteAirbrushing } = useAirbrushingMutations();

  const airbrushing = data?.data;

  const handleDelete = async () => {
    if (!id) return;

    try {
      await deleteAirbrushing.mutateAsync(id);
      toast.success("Aerografia excluída com sucesso");
      navigate(routes.production.airbrushings.root);
    } catch (error) {
      toast.error("Erro ao excluir aerografia");
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.PRODUCTION}>
        <div className="h-full flex flex-col space-y-4">
          <div className="flex-shrink-0">
            <PageHeader
              variant="detail"
              title="Carregando..."
              icon={IconBrush}
              breadcrumbs={[
                { label: "Início", href: routes.home },
                { label: "Produção", href: routes.production.root },
                { label: "Aerografia", href: routes.production.airbrushings.root },
                { label: "Detalhes" },
              ]}
            />
          </div>
          <div className="flex-1 space-y-6">
            <Card>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <Skeleton className="h-8 w-1/3" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-32 w-full" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </PrivilegeRoute>
    );
  }

  // Error or not found state
  if (isError || !airbrushing) {
    return (
      <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.PRODUCTION}>
        <div className="h-full flex flex-col space-y-4">
          <div className="flex-shrink-0">
            <PageHeader
              variant="detail"
              title="Aerografia não encontrada"
              icon={IconBrush}
              breadcrumbs={[
                { label: "Início", href: routes.home },
                { label: "Produção", href: routes.production.root },
                { label: "Aerografia", href: routes.production.airbrushings.root },
                { label: "Detalhes" },
              ]}
              backButton={{
                onClick: () => navigate(routes.production.airbrushings.root),
              }}
            />
          </div>
          <div className="flex-1">
            <Card>
              <CardContent className="p-6">
                <div className="text-center">
                  <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-red-800 font-medium">Aerografia não encontrada</p>
                    <p className="text-red-600 text-sm mt-1">A aerografia solicitada não existe ou você não tem permissão para acessá-la.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </PrivilegeRoute>
    );
  }

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.PRODUCTION}>
      <div className="h-full flex flex-col space-y-4">
        <div className="flex-shrink-0">
          <PageHeader
            variant="detail"
            title={`Aerografia`}
            subtitle={airbrushing.task ? `Tarefa: ${airbrushing.task.name}` : `ID: ${airbrushing.id.slice(-8)}`}
            icon={IconBrush}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Produção", href: routes.production.root },
              { label: "Aerografia", href: routes.production.airbrushings.root },
              { label: `Aerografia #${airbrushing.id.slice(-8)}` },
            ]}
            backButton={{
              onClick: () => navigate(routes.production.airbrushings.root),
            }}
            actions={[
              {
                key: "edit",
                label: "Editar",
                icon: IconEdit,
                onClick: () => navigate(routes.production.airbrushings.edit(airbrushing.id)),
              },
              {
                key: "delete",
                label: "Excluir",
                icon: IconTrash,
                onClick: handleDelete,
                variant: "destructive",
                disabled: deleteAirbrushing.isPending,
              },
            ]}
          />
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          <div className="max-w-4xl mx-auto px-4">
            <AirbrushingInfoCard airbrushing={airbrushing as any} />
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button style={{ display: "none" }} />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>Tem certeza que deseja excluir esta aerografia? Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground" disabled={deleteAirbrushing.isPending}>
                {deleteAirbrushing.isPending ? "Excluindo..." : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PrivilegeRoute>
  );
};
