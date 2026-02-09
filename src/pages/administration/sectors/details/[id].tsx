import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { IconEdit, IconTrash, IconRefresh, IconLoader2, IconAlertTriangle } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES, CHANGE_LOG_ENTITY_TYPE } from "../../../../constants";
import { useSector, useSectorMutations } from "../../../../hooks";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { SpecificationsCard, SectorUsersTable, SectorTasksTable } from "@/components/administration/sector/detail";
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
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const SectorDetailPage = () => {
  usePageTracker({ title: "sector-detail" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const {
    data: response,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useSector(id || "", {
    include: {
      users: {
        include: {
          position: true,
          sector: true,
          managedSector: true,
        },
        orderBy: {
          name: "asc",
        },
      },
      managedByUsers: true,
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
          tasks: true,
        },
      },
    },
    enabled: !!id,
  });

  const { deleteAsync, deleteMutation } = useSectorMutations();

  const sector = response?.data;

  if (!id) {
    return <Navigate to={routes.administration.sectors.root} replace />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-destructive mb-4">Erro ao carregar setor</p>
        <Navigate to={routes.administration.sectors.root} replace />
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

  if (!sector) {
    return <Navigate to={routes.administration.sectors.root} replace />;
  }

  const handleDelete = async () => {
    try {
      await deleteAsync(id);
      navigate(routes.administration.sectors.root);
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error deleting sector:", error);
      }
    }
    setIsDeleteDialogOpen(false);
  };

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="detail"
          entity={sector}
          title={sector.name}
          breadcrumbs={[{ label: "Início", href: "/" }, { label: "Administração" }, { label: "Setores", href: routes.administration.sectors.root }, { label: sector.name }]}
          actions={[
            {
              key: "refresh",
              label: "Atualizar",
              icon: IconRefresh,
              onClick: () => refetch(),
              loading: isRefetching,
            },
            {
              key: "edit",
              label: "Editar",
              icon: IconEdit,
              onClick: () => navigate(routes.administration.sectors.edit(id)),
            },
            {
              key: "delete",
              label: "Excluir",
              icon: IconTrash,
              onClick: () => setIsDeleteDialogOpen(true),
              disabled: deleteMutation.isPending,
            },
          ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="space-y-4">
            {/* Info Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SpecificationsCard sector={sector} />
              <ChangelogHistory entityType={CHANGE_LOG_ENTITY_TYPE.SECTOR} entityId={id} entityName={sector.name} entityCreatedAt={sector.createdAt} maxHeight="500px" />
            </div>

            {/* Related Tasks */}
            <SectorTasksTable sector={sector} />

            {/* Related Users - Last Section */}
            <SectorUsersTable sector={sector} />
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
                Tem certeza que deseja excluir o setor "{sector.name}"?
                {sector._count?.users ? (
                  <span className="block mt-2 font-medium text-destructive">
                    Atenção: Este setor possui {sector._count.users} usuário{sector._count.users !== 1 ? "s" : ""} associado{sector._count.users !== 1 ? "s" : ""}.
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
