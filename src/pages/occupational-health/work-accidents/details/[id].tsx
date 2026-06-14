import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { IconEdit, IconTrash, IconRefresh, IconLoader2, IconAlertTriangle } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES } from "../../../../constants";
import { useWorkAccidentReport, useWorkAccidentReportMutations } from "../../../../hooks/occupational-health/use-work-accidents";
import { useAuth } from "@/contexts/auth-context";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

import { WorkAccidentInfoCard } from "@/components/occupational-health/work-accident/detail";

export const WorkAccidentDetailPage = () => {
  usePageTracker({ title: "Detalhes da CAT" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const { user } = useAuth();
  const isAdmin = user?.sector?.privileges === SECTOR_PRIVILEGES.ADMIN;

  const {
    data: response,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useWorkAccidentReport(id || "", {
    include: {
      user: {
        include: {
          position: true,
          sector: true,
          currentContract: true,
        },
      },
      leave: true,
      file: true,
    },
    enabled: !!id,
  });

  const { deleteAsync, deleteMutation } = useWorkAccidentReportMutations();

  const report = response?.data;

  if (!id) return <Navigate to={routes.occupationalHealth.workAccidents.root} replace />;
  if (error) return <Navigate to={routes.occupationalHealth.workAccidents.root} replace />;

  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
        <div className="flex items-center justify-center h-full">
          <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PrivilegeRoute>
    );
  }

  if (!report) return <Navigate to={routes.occupationalHealth.workAccidents.root} replace />;

  const handleDelete = async () => {
    try {
      await deleteAsync(id);
      navigate(routes.occupationalHealth.workAccidents.root);
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error deleting CAT:", err);
      }
    }
    setIsDeleteDialogOpen(false);
  };

  const pageActions = [
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
      onClick: () => navigate(routes.occupationalHealth.workAccidents.edit(id)),
    },
    ...(isAdmin
      ? [
          {
            key: "delete",
            label: "Excluir",
            icon: IconTrash,
            onClick: () => setIsDeleteDialogOpen(true),
            disabled: deleteMutation.isPending,
          },
        ]
      : []),
  ];

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="detail"
          title={report.user?.name ? `CAT — ${report.user.name}` : "CAT"}
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Medicina do Trabalho", href: routes.occupationalHealth.root },
            { label: "CAT", href: routes.occupationalHealth.workAccidents.root },
            { label: report.user?.name || "Detalhes" },
          ]}
          actions={pageActions}
          className="flex-shrink-0"
        />
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
            <WorkAccidentInfoCard report={report} />
          </div>
        </div>

        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <IconAlertTriangle className="h-5 w-5 text-destructive" />
                Confirmar Exclusão
              </DialogTitle>
              <DialogDescription>
                Tem certeza que deseja excluir esta CAT{report.user?.name ? ` de "${report.user.name}"` : ""}? Esta ação não poderá ser desfeita.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                Cancelar
              </Button>
              <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
                {deleteMutation.isPending ? <IconLoader2 className="h-4 w-4 mr-2 animate-spin" /> : <IconTrash className="h-4 w-4 mr-2" />}
                Excluir
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PrivilegeRoute>
  );
};

export default WorkAccidentDetailPage;
