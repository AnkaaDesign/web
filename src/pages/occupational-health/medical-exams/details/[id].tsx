import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { IconEdit, IconTrash, IconRefresh, IconLoader2, IconAlertTriangle, IconClipboardCheck } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES, CHANGE_LOG_ENTITY_TYPE, MEDICAL_EXAM_STATUS, MEDICAL_EXAM_TYPE_LABELS } from "../../../../constants";
import type { MEDICAL_EXAM_TYPE } from "../../../../constants";
import { useAuth } from "@/contexts/auth-context";
import { useMedicalExam, useMedicalExamMutations } from "@/hooks/occupational-health/use-medical-exams";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { ExamInfoCard, DocumentCard } from "@/components/occupational-health/medical-exam/detail";
import { MedicalExamCompleteDialog } from "@/components/occupational-health/medical-exam/complete";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const MedicalExamDetailPage = () => {
  usePageTracker({ title: "Detalhes do Exame (ASO)" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.sector?.privileges === SECTOR_PRIVILEGES.ADMIN;

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isCompleteDialogOpen, setIsCompleteDialogOpen] = useState(false);

  const {
    data: response,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useMedicalExam(id || "", {
    include: {
      user: {
        include: {
          position: true,
          sector: true,
        },
      },
      file: true,
    },
    enabled: !!id,
  });

  const { deleteAsync, deleteMutation } = useMedicalExamMutations();

  const exam = response?.data;

  if (!id) {
    return <Navigate to={routes.occupationalHealth.medicalExams.root} replace />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-destructive mb-4">Erro ao carregar exame</p>
        <Navigate to={routes.occupationalHealth.medicalExams.root} replace />
      </div>
    );
  }

  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
        <div className="flex items-center justify-center h-full">
          <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </PrivilegeRoute>
    );
  }

  if (!exam) {
    return <Navigate to={routes.occupationalHealth.medicalExams.root} replace />;
  }

  const examTitle = `${MEDICAL_EXAM_TYPE_LABELS[exam.type as MEDICAL_EXAM_TYPE] || exam.type}${exam.user?.name ? ` - ${exam.user.name}` : ""}`;
  const isScheduled = exam.status === MEDICAL_EXAM_STATUS.SCHEDULED;

  const handleDelete = async () => {
    try {
      await deleteAsync(id);
      navigate(routes.occupationalHealth.medicalExams.root);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error deleting medical exam:", error);
      }
    }
    setIsDeleteDialogOpen(false);
  };

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="detail"
          title={examTitle}
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Medicina do Trabalho", href: routes.occupationalHealth.root },
            { label: "ASO", href: routes.occupationalHealth.medicalExams.root },
            { label: examTitle },
          ]}
          actions={[
            {
              key: "refresh",
              label: "Atualizar",
              icon: IconRefresh,
              onClick: () => refetch(),
              loading: isRefetching,
            },
            ...(isScheduled
              ? [
                  {
                    key: "complete",
                    label: "Concluir",
                    icon: IconClipboardCheck,
                    onClick: () => setIsCompleteDialogOpen(true),
                  },
                ]
              : []),
            {
              key: "edit",
              label: "Editar",
              icon: IconEdit,
              onClick: () => navigate(routes.occupationalHealth.medicalExams.edit(id)),
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
          ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="space-y-4">
            {/* Info and Document Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
              <ExamInfoCard exam={exam} className="h-full" />
              <div className="flex flex-col gap-4">
                <DocumentCard exam={exam} />
                <ChangelogHistory
                  entityType={CHANGE_LOG_ENTITY_TYPE.MEDICAL_EXAM}
                  entityId={id}
                  entityName={examTitle}
                  entityCreatedAt={exam.createdAt}
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Complete Dialog */}
        <MedicalExamCompleteDialog exam={exam} open={isCompleteDialogOpen} onOpenChange={setIsCompleteDialogOpen} />

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <IconAlertTriangle className="h-5 w-5 text-destructive" />
                Confirmar Exclusão
              </DialogTitle>
              <DialogDescription>
                Tem certeza que deseja excluir este exame{exam.user?.name ? ` de "${exam.user.name}"` : ""}? Esta ação não poderá ser desfeita.
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

export default MedicalExamDetailPage;
