import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAirbrushing, useAirbrushingMutations } from "../../../../hooks";
import { routes, SECTOR_PRIVILEGES, CHANGE_LOG_ENTITY_TYPE } from "../../../../constants";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AirbrushingInfoCard } from "@/components/production/airbrushing/detail/airbrushing-info-card";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { IconEdit, IconTrash } from "@tabler/icons-react";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { DETAIL_PAGE_SPACING, getDetailGridClasses } from "@/lib/layout-constants";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export const AirbrushingDetails = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  // Track page for analytics
  usePageTracker({ title: "Aerografia - Detalhes", icon: "airbrushing_detail" });

  // Fetch airbrushing data
  const { data, isLoading, isError } = useAirbrushing(id!, {
    include: {
      task: {
        include: {
          customer: {
            include: {
              logo: true,
            },
          },
          sector: true,
        },
      },
      receipts: true,
      invoices: true,
      artworks: true,
    },
    enabled: !!id,
  });

  // Mutations
  const { deleteMutation } = useAirbrushingMutations();
  const isDeleting = deleteMutation.isPending;

  const airbrushing = data?.data;

  const handleDelete = async () => {
    if (!id) return;

    try {
      await deleteMutation.mutateAsync(id);
      navigate(routes.production.airbrushings.root);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error deleting airbrushing:", error);
      }
    }
    setIsDeleteDialogOpen(false);
  };

  // Loading state
  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.ADMIN]}>
        <div className={DETAIL_PAGE_SPACING.CONTAINER}>
          <PageHeader
            variant="detail"
            title="Carregando..."
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Produção", href: routes.production.root },
              { label: "Aerografia", href: routes.production.airbrushings.root },
              { label: "Detalhes" },
            ]}
          />
          <div className={DETAIL_PAGE_SPACING.HEADER_TO_GRID}>
            <Card>
              <CardContent className="p-4">
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
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.ADMIN]}>
        <div className={DETAIL_PAGE_SPACING.CONTAINER}>
          <PageHeader
            variant="detail"
            title="Aerografia não encontrada"
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Produção", href: routes.production.root },
              { label: "Aerografia", href: routes.production.airbrushings.root },
              { label: "Detalhes" },
            ]}
          />
          <div className={DETAIL_PAGE_SPACING.HEADER_TO_GRID}>
            <Card>
              <CardContent className="p-4">
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
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="detail"
          title={airbrushing.task?.name || "Aerografia"}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Produção", href: routes.production.root },
            { label: "Aerografia", href: routes.production.airbrushings.root },
            { label: airbrushing.task?.name || "Detalhes" },
          ]}
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
              onClick: () => setIsDeleteDialogOpen(true),
              disabled: isDeleting,
            },
          ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <AirbrushingInfoCard airbrushing={airbrushing as any} />
            </div>

            {/* Changelog Section */}
            <Card className="border flex flex-col animate-in fade-in-50 duration-1000">
              <ChangelogHistory
                entityType={CHANGE_LOG_ENTITY_TYPE.AIRBRUSHING}
                entityId={airbrushing.id}
                entityName={`Aerografia - ${airbrushing.task?.name || airbrushing.id.slice(0, 8)}`}
                entityCreatedAt={airbrushing.createdAt}
                className="h-full"
              />
            </Card>
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>Tem certeza que deseja excluir esta aerografia? Esta ação não pode ser desfeita.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground" disabled={isDeleting}>
                {isDeleting ? "Excluindo..." : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PrivilegeRoute>
  );
};
