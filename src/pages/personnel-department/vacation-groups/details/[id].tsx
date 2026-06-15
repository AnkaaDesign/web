import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { IconTrash, IconRefresh, IconPlayerTrackNext, IconUsersGroup, IconCalendar } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES, VACATION_STATUS, VACATION_STATUS_LABELS, VACATION_GROUP_TYPE_LABELS } from "../../../../constants";
import { useVacationGroup, useVacationGroupMutations, useAdvanceVacationGroup } from "../../../../hooks/personnel-department/use-vacation-groups";
import { useAuth } from "../../../../hooks/common/use-auth";
import { formatDate } from "../../../../utils";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { VacationGroupMembersCard, VacationGroupExpandCard } from "@/components/personnel-department/vacation-group/detail";
import { getVacationGroupStatusVariant } from "@/components/personnel-department/vacation-group/list";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const VacationGroupDetailPage = () => {
  usePageTracker({ title: "Detalhes das Férias Coletivas" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { user } = useAuth();
  const isAdmin = user?.sector?.privileges === SECTOR_PRIVILEGES.ADMIN;

  const [showAdvanceDialog, setShowAdvanceDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { deleteAsync, deleteMutation } = useVacationGroupMutations();
  const advance = useAdvanceVacationGroup();

  const {
    data: response,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useVacationGroup(id || "", {
    include: { periods: { orderBy: { startDate: "asc" } }, vacations: { include: { user: true } } },
    enabled: !!id,
  });

  const group = response?.data;

  if (!id) {
    return <Navigate to={routes.personnelDepartment.vacationGroups.root} replace />;
  }
  if (error) {
    return <Navigate to={routes.personnelDepartment.vacationGroups.root} replace />;
  }
  if (isLoading || !group) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
        <div className="flex items-center justify-center h-full text-muted-foreground">Carregando...</div>
      </PrivilegeRoute>
    );
  }

  const isFinal = group.status === VACATION_STATUS.PAID || group.status === VACATION_STATUS.EXPIRED;

  const handleAdvance = async () => {
    try {
      await advance.mutateAsync({ id });
      setShowAdvanceDialog(false);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error advancing vacation group:", error);
      }
    }
  };

  const handleDelete = async () => {
    try {
      await deleteAsync(id);
      navigate(routes.personnelDepartment.vacationGroups.root);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error deleting vacation group:", error);
      }
    }
    setShowDeleteDialog(false);
  };

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="detail"
          title={group.name ? `Férias Coletivas — ${group.name}` : "Férias Coletivas"}
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Departamento Pessoal" },
            { label: "Férias Coletivas", href: routes.personnelDepartment.vacationGroups.root },
            { label: group.name || "Detalhes" },
          ]}
          headerExtra={
            <Button variant="default" size="default" onClick={() => setShowAdvanceDialog(true)} disabled={isFinal || advance.isPending}>
              <IconPlayerTrackNext className="h-4 w-4 mr-2" />
              Avançar
            </Button>
          }
          actions={[
            {
              key: "refresh",
              label: "Atualizar",
              icon: IconRefresh,
              onClick: () => refetch(),
              loading: isRefetching,
            },
            ...(isAdmin
              ? [
                  {
                    key: "delete",
                    label: "Excluir",
                    icon: IconTrash,
                    onClick: () => setShowDeleteDialog(true),
                    disabled: deleteMutation.isPending,
                  },
                ]
              : []),
          ]}
          className="flex-shrink-0"
        />

        <div className="flex-1 overflow-y-auto pb-6">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconUsersGroup className="h-5 w-5 text-muted-foreground" />
                  Resumo
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">Abrangência</div>
                  <Badge variant="secondary" className="mt-1 text-xs">
                    {VACATION_GROUP_TYPE_LABELS[group.type] || group.type}
                  </Badge>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Status</div>
                  <Badge variant={getVacationGroupStatusVariant(group.status)} className="mt-1 text-xs">
                    {VACATION_STATUS_LABELS[group.status] || group.status}
                  </Badge>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Período aquisitivo</div>
                  <p className="mt-1 text-sm font-medium">
                    {formatDate(new Date(group.acquisitiveStart))} — {formatDate(new Date(group.acquisitiveEnd))}
                  </p>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Limite concessivo</div>
                  <p className="mt-1 text-sm font-medium">{group.concessiveEnd ? formatDate(new Date(group.concessiveEnd)) : "-"}</p>
                </div>
              </CardContent>
            </Card>

            {group.periods && group.periods.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <IconCalendar className="h-5 w-5 text-muted-foreground" />
                    Períodos de Gozo
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {group.periods.map((p) => (
                      <Badge key={p.id} variant="secondary" className="text-xs">
                        {formatDate(new Date(p.startDate))} · {p.days} dia{p.days > 1 ? "s" : ""}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <VacationGroupExpandCard groupId={id} />
            <VacationGroupMembersCard groupId={id} />
          </div>
        </div>

        <AlertDialog open={showAdvanceDialog} onOpenChange={setShowAdvanceDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Avançar status das férias coletivas</AlertDialogTitle>
              <AlertDialogDescription>Avançar o status a partir de {VACATION_STATUS_LABELS[group.status]}?</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction onClick={handleAdvance} disabled={advance.isPending}>
                Avançar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir as férias coletivas{group.name ? ` "${group.name}"` : ""}? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={deleteMutation.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </PrivilegeRoute>
  );
};

export default VacationGroupDetailPage;
