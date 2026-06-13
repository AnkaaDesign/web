import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { IconEdit, IconTrash, IconRefresh, IconBan, IconPlayerTrackNext } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES, CHANGE_LOG_ENTITY_TYPE, ADMISSION_STATUS, ADMISSION_STATUS_LABELS } from "../../../../constants";
import { useAdmission, useAdmissionMutations, useAdmissionAdvance } from "@/hooks/personnel-department/use-admissions";
import { useAuth } from "@/hooks/common/use-auth";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { StatusCard, DocumentsCard, UserCard, AdmissionDetailSkeleton } from "@/components/personnel-department/admission/detail";
import { isAdmissionFinal, hasBlockingRequiredDocs, getNextAdmissionStatus } from "@/components/personnel-department/admission/utils";
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
import { usePageTracker } from "@/hooks/common/use-page-tracker";

const REQUIRED_PRIVILEGES = [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN];

export const AdmissionDetailPage = () => {
  usePageTracker({ title: "Detalhes da Admissão" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [advanceDialogOpen, setAdvanceDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { user } = useAuth();
  const isAdmin = user?.sector?.privileges === SECTOR_PRIVILEGES.ADMIN;

  const {
    data: response,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useAdmission(id || "", {
    include: {
      user: { include: { position: true, sector: true } },
      createdBy: true,
      documents: { include: { file: true }, orderBy: { type: "asc" } },
    },
    enabled: !!id,
  });

  const { deleteAsync, deleteMutation } = useAdmissionMutations();
  const advanceMutation = useAdmissionAdvance();

  const admission = response?.data;

  if (!id) {
    return <Navigate to={routes.personnelDepartment.admissions.root} replace />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <p className="text-destructive mb-4">Erro ao carregar admissão</p>
        <Navigate to={routes.personnelDepartment.admissions.root} replace />
      </div>
    );
  }

  if (isLoading) {
    return (
      <PrivilegeRoute requiredPrivilege={REQUIRED_PRIVILEGES}>
        <AdmissionDetailSkeleton />
      </PrivilegeRoute>
    );
  }

  if (!admission) {
    return <Navigate to={routes.personnelDepartment.admissions.root} replace />;
  }

  const isFinal = isAdmissionFinal(admission.status);
  const blockedByDocs = hasBlockingRequiredDocs(admission);
  const nextStatus = getNextAdmissionStatus(admission.status);
  const title = admission.user?.name ? `Admissão — ${admission.user.name}` : "Admissão";

  const handleAdvance = async () => {
    try {
      await advanceMutation.mutateAsync({ id });
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== "production") {
        console.error("Error advancing admission:", error);
      }
    }
    setAdvanceDialogOpen(false);
  };

  const handleCancel = async () => {
    try {
      await advanceMutation.mutateAsync({ id, data: { status: ADMISSION_STATUS.CANCELLED } });
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== "production") {
        console.error("Error cancelling admission:", error);
      }
    }
    setCancelDialogOpen(false);
  };

  const handleDelete = async () => {
    try {
      await deleteAsync(id);
      navigate(routes.personnelDepartment.admissions.root);
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== "production") {
        console.error("Error deleting admission:", error);
      }
    }
    setDeleteDialogOpen(false);
  };

  const actions = [
    {
      key: "refresh",
      label: "Atualizar",
      icon: IconRefresh,
      onClick: () => refetch(),
      loading: isRefetching,
    },
    // Advance — hidden when final; disabled (with explanation in the status card)
    // while required documents are still pending (mirrors the server guard).
    ...(!isFinal
      ? [
          {
            key: "advance",
            label: blockedByDocs ? "Avançar (documentos pendentes)" : "Avançar",
            icon: IconPlayerTrackNext,
            onClick: () => setAdvanceDialogOpen(true),
            variant: "default" as const,
            disabled: blockedByDocs || advanceMutation.isPending,
          },
        ]
      : []),
    {
      key: "edit",
      label: "Editar",
      icon: IconEdit,
      onClick: () => navigate(routes.personnelDepartment.admissions.edit(id)),
    },
    ...(!isFinal
      ? [
          {
            key: "cancel-admission",
            label: "Cancelar",
            icon: IconBan,
            onClick: () => setCancelDialogOpen(true),
            variant: "destructive" as const,
            disabled: advanceMutation.isPending,
          },
        ]
      : []),
    ...(isAdmin
      ? [
          {
            key: "delete",
            label: "Excluir",
            icon: IconTrash,
            onClick: () => setDeleteDialogOpen(true),
            disabled: deleteMutation.isPending,
          },
        ]
      : []),
  ];

  return (
    <PrivilegeRoute requiredPrivilege={REQUIRED_PRIVILEGES}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="detail"
          entity={{ id: admission.id, name: title }}
          title={title}
          breadcrumbs={[
            { label: "Início", href: "/" },
            { label: "Departamento Pessoal" },
            { label: "Admissões", href: routes.personnelDepartment.admissions.root },
            { label: admission.user?.name || "Detalhes" },
          ]}
          actions={actions}
          className="flex-shrink-0"
        />
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="space-y-4">
            {/* Status stepper */}
            <StatusCard admission={admission} />

            {/* Documentação (spec stage 2) is the centerpiece while the
                process is collecting documents (DOCS_PENDING); afterwards it
                moves below the summary/changelog grid. */}
            {admission.status === ADMISSION_STATUS.DOCS_PENDING && <DocumentsCard admission={admission} />}

            {/* User summary and Changelog Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
              <UserCard admission={admission} className="h-full" />
              <ChangelogHistory
                entityType={CHANGE_LOG_ENTITY_TYPE.ADMISSION}
                entityId={id}
                entityName={title}
                entityCreatedAt={admission.createdAt}
                className="h-full"
              />
            </div>

            {/* Documents checklist */}
            {admission.status !== ADMISSION_STATUS.DOCS_PENDING && <DocumentsCard admission={admission} />}
          </div>
        </div>

        {/* Advance Confirmation Dialog */}
        <AlertDialog open={advanceDialogOpen} onOpenChange={setAdvanceDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Avançar etapa</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja avançar esta admissão?
                {nextStatus ? (
                  <span className="block mt-2 font-medium text-foreground">Novo status: {ADMISSION_STATUS_LABELS[nextStatus]}</span>
                ) : null}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction onClick={handleAdvance} disabled={advanceMutation.isPending}>
                Avançar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Cancel Confirmation Dialog */}
        <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar admissão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja cancelar a admissão{admission.user?.name ? ` de "${admission.user.name}"` : ""}? O processo será marcado como cancelado e não
                poderá mais ser avançado.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction onClick={handleCancel} disabled={advanceMutation.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Cancelar admissão
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir a admissão{admission.user?.name ? ` de "${admission.user.name}"` : ""}? Os documentos do checklist também serão removidos.
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
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

export default AdmissionDetailPage;
