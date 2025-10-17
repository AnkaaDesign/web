import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { IconBriefcase, IconEdit, IconTrash, IconRefresh, IconLoader2, IconAlertTriangle } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES } from "../../../../constants";
import { usePosition, usePositionMutations } from "../../../../hooks";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/page-header";
import { SpecificationsCard, RemunerationHistoryCard, RelatedUsersCard } from "@/components/human-resources/position/detail";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { Button } from "@/components/ui/button";
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
import { toast } from "sonner";
import { usePageTracker } from "@/hooks/use-page-tracker";

export const PositionDetailPage = () => {
  usePageTracker({ title: "Page", icon: "star" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const {
    data: response,
    isLoading,
    error,
    refetch,
  } = usePosition(id || "", {
    include: {
      users: {
        include: {
          sector: true,
        },
        orderBy: {
          name: "asc",
        },
      },
      remunerations: {
        orderBy: {
          createdAt: "desc",
        },
      },
      changelogs: {
        include: {
          user: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 10,
      },
      _count: {
        select: {
          users: true,
          remunerations: true,
        },
      },
    },
    enabled: !!id,
  });

  const { deleteAsync, deleteMutation } = usePositionMutations();

  const position = response?.data;

  if (!id) {
    return <Navigate to={routes.humanResources.positions.root} replace />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-destructive mb-4">Erro ao carregar cargo</p>
        <Navigate to={routes.humanResources.positions.root} replace />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!position) {
    return <Navigate to={routes.humanResources.positions.root} replace />;
  }

  const handleDelete = async () => {
    try {
      await deleteAsync(id);
      toast.success("Cargo excluído com sucesso");
      navigate(routes.humanResources.positions.root);
    } catch (error) {
      toast.error("Erro ao excluir cargo");
    }
    setIsDeleteDialogOpen(false);
  };

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.HUMAN_RESOURCES}>
      <div className="flex flex-col h-full space-y-6">
        <PageHeader
          variant="detail"
          entity={position}
          title={position.name}
          icon={IconBriefcase}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Recursos Humanos" },
            { label: "Cargos", href: routes.humanResources.positions.root },
            { label: position.name },
          ]}
          actions={[
            {
              key: "refresh",
              label: "Atualizar",
              icon: IconRefresh,
              onClick: () => refetch(),
            },
            {
              key: "edit",
              label: "Editar",
              icon: IconEdit,
              onClick: () => navigate(routes.humanResources.positions.edit(id)),
            },
            {
              key: "delete",
              label: "Excluir",
              icon: IconTrash,
              onClick: () => setIsDeleteDialogOpen(true),
              disabled: deleteMutation.isPending,
            },
          ]}
        />

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-6">
            {/* Info Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <SpecificationsCard position={position} />
              <RemunerationHistoryCard position={position} />
            </div>

            {/* Changelog - Single column */}
            <div className="grid grid-cols-1 gap-6">
              <ChangelogHistory entityType={"POSITION" as any} entityId={id} entityName={position.name} entityCreatedAt={position.createdAt} maxHeight="500px" />
            </div>

            {/* Related Users - Full width, last section */}
            <div className="grid grid-cols-1 gap-6">
              <RelatedUsersCard position={position} />
            </div>
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={deleteMutation.isPending} onClick={() => {}} className="hidden" id="delete-trigger">
              Excluir
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <IconAlertTriangle className="h-5 w-5 text-destructive" />
                Confirmar Exclusão
              </AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o cargo "{position.name}"?
                {position._count?.users ? (
                  <span className="block mt-2 font-medium text-destructive">
                    Atenção: Este cargo possui {position._count.users} funcionário{position._count.users !== 1 ? "s" : ""} associado{position._count.users !== 1 ? "s" : ""}.
                  </span>
                ) : null}
                Esta ação não poderá ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PrivilegeRoute>
  );
};
