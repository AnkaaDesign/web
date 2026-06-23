import { useState } from "react";
import { useParams, useNavigate, Navigate } from "react-router-dom";
import { IconEdit, IconTrash, IconBan, IconPlayerTrackNext, IconPlayerTrackPrev } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES, CHANGE_LOG_ENTITY_TYPE, ADMISSION_STATUS, ADMISSION_STATUS_LABELS } from "../../../../constants";
import { useAdmission, useAdmissionMutations, useAdmissionAdvance } from "@/hooks/personnel-department/use-admissions";
import { useAuth } from "@/hooks/common/use-auth";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { Textarea } from "@/components/ui/textarea";
import { StatusCard, ExamCard, DocumentsCard, UserCard, AdmissionDetailSkeleton } from "@/components/personnel-department/admission/detail";
import { isAdmissionFinal, hasBlockingRequiredDocs, getNextAdmissionStatus, getPreviousAdmissionStatus } from "@/components/personnel-department/admission/utils";
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

const REQUIRED_PRIVILEGES = [SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.PRODUCTION_MANAGER];

export const AdmissionDetailPage = () => {
  usePageTracker({ title: "Detalhes da Admissão" });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [advanceDialogOpen, setAdvanceDialogOpen] = useState(false);
  const [previousDialogOpen, setPreviousDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const { user } = useAuth();
  const isAdmin = user?.sector?.privileges === SECTOR_PRIVILEGES.ADMIN;

  const {
    data: response,
    isLoading,
    error,
  } = useAdmission(id || "", {
    include: {
      user: {
        include: {
          position: { include: { remunerations: true } },
          sector: true,
          currentContract: true,
        },
      },
      createdBy: true,
      documents: { include: { file: true, signedFile: true, signedBy: true }, orderBy: { type: "asc" } },
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
    return <Navigate to={routes.personnelDepartment.admissions.root} replace />;
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
  const previousStatus = getPreviousAdmissionStatus(admission.status);
  const title = admission.user?.name ? `Admissão — ${admission.user.name}` : "Admissão";

  // Layout adaptativo: Colaborador é SEMPRE o primeiro (coluna esquerda). Ao lado
  // dele (coluna direita) fica o cartão da etapa atual — Exame Admissional na
  // etapa de exame, senão o Checklist de Documentos. O outro cartão fica
  // empilhado abaixo do Colaborador. Ambos permanecem visíveis (1/2 cada).
  const inExamStep = admission.status === ADMISSION_STATUS.MEDICAL_EXAM;

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

  const handlePrevious = async () => {
    if (!previousStatus) return;
    try {
      await advanceMutation.mutateAsync({ id, data: { status: previousStatus } });
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error reverting admission step:", error);
      }
    }
    setPreviousDialogOpen(false);
  };

  const handleCancel = async () => {
    const reason = cancelReason.trim();
    if (!reason) return;
    try {
      await advanceMutation.mutateAsync({ id, data: { status: ADMISSION_STATUS.CANCELLED, reason } });
    } catch (error) {
      // Error is handled by the API client with detailed message
      if (process.env.NODE_ENV !== "production") {
        console.error("Error cancelling admission:", error);
      }
    }
    setCancelDialogOpen(false);
    setCancelReason("");
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
    // Voltar etapa — retrocede um passo no fluxo; oculto na primeira etapa/final.
    ...(!isFinal && previousStatus
      ? [
          {
            key: "previous",
            label: "Voltar etapa",
            icon: IconPlayerTrackPrev,
            onClick: () => setPreviousDialogOpen(true),
            variant: "outline" as const,
            disabled: advanceMutation.isPending,
          },
        ]
      : []),
    // Avançar — oculto quando final; desabilitado (com explicação no card de
    // status) enquanto houver documentos obrigatórios pendentes (espelha o guard
    // do servidor).
    // Ordem desejada no header: Voltar etapa · Avançar · Editar · Cancelar.
    // O PageHeader renderiza secondary (Voltar/outline) e depois [primary, danger];
    // por isso Avançar+Editar usam group "primary" e Cancelar/Excluir, "danger".
    ...(!isFinal
      ? [
          {
            key: "advance",
            label: blockedByDocs ? "Avançar (documentos pendentes)" : "Avançar",
            icon: IconPlayerTrackNext,
            onClick: () => setAdvanceDialogOpen(true),
            variant: "default" as const,
            group: "primary" as const,
            disabled: blockedByDocs || advanceMutation.isPending,
          },
        ]
      : []),
    // Editar — desabilitado em processos finalizados (concluído/cancelado),
    // espelhando a rescisão: registros finais não devem ser reabertos.
    {
      key: "edit",
      label: "Editar",
      icon: IconEdit,
      onClick: () => navigate(routes.personnelDepartment.admissions.edit(id)),
      group: "primary" as const,
      disabled: isFinal,
    },
    ...(!isFinal
      ? [
          {
            key: "cancel-admission",
            label: "Cancelar",
            icon: IconBan,
            onClick: () => setCancelDialogOpen(true),
            variant: "destructive" as const,
            group: "danger" as const,
            disabled: advanceMutation.isPending,
          },
        ]
      : []),
    // Excluir — ADMIN e apenas em admissões finalizadas (canceladas/concluídas),
    // espelhando o guard do servidor: processos em andamento devem ser cancelados
    // antes (para desfazer vínculo/ASO criados ao vivo).
    ...(isAdmin && isFinal
      ? [
          {
            key: "delete",
            label: "Excluir",
            icon: IconTrash,
            onClick: () => setDeleteDialogOpen(true),
            group: "danger" as const,
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
            { label: "Departamento Pessoal", href: routes.personnelDepartment.root },
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

            {/* Linha 1: Colaborador (sempre primeiro) ao lado do cartão da etapa
                atual (Exame na etapa de exame, senão Checklist) — mesma altura. */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
              <UserCard admission={admission} className="h-full" />
              {inExamStep ? <ExamCard admission={admission} className="h-full" /> : <DocumentsCard admission={admission} className="h-full" />}
            </div>

            {/* Linha 2: o outro cartão ao lado do Histórico de Alterações, para
                aproveitar o espaço (ex.: Checklist ao lado do Changelog). */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
              {inExamStep ? <DocumentsCard admission={admission} /> : <ExamCard admission={admission} />}
              <ChangelogHistory
                entityType={CHANGE_LOG_ENTITY_TYPE.ADMISSION}
                entityId={id}
                entityName={title}
                entityCreatedAt={admission.createdAt}
                maxHeight="640px"
              />
            </div>
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

        {/* Previous step Confirmation Dialog */}
        <AlertDialog open={previousDialogOpen} onOpenChange={setPreviousDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Voltar etapa</AlertDialogTitle>
              <AlertDialogDescription>
                Retroceder esta admissão para a etapa anterior?
                {previousStatus ? (
                  <span className="block mt-2 font-medium text-foreground">Etapa anterior: {ADMISSION_STATUS_LABELS[previousStatus]}</span>
                ) : null}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction onClick={handlePrevious} disabled={advanceMutation.isPending}>
                Voltar etapa
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Cancel Confirmation Dialog */}
        <AlertDialog
          open={cancelDialogOpen}
          onOpenChange={(open) => {
            setCancelDialogOpen(open);
            if (!open) setCancelReason("");
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar admissão</AlertDialogTitle>
              <AlertDialogDescription>
                A admissão{admission.user?.name ? ` de "${admission.user.name}"` : ""} será marcada como cancelada na etapa atual ({ADMISSION_STATUS_LABELS[admission.status]}) e
                não poderá mais ser avançada. O vínculo criado por este processo será encerrado e o exame admissional (ASO) pendente, cancelado. Informe o motivo de não ter sido concluída.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-1.5">
              <Textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Motivo do cancelamento (obrigatório)"
                rows={4}
                autoFocus
              />
              {cancelReason.trim().length === 0 && <p className="text-xs text-muted-foreground">O motivo é obrigatório para cancelar.</p>}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleCancel}
                disabled={advanceMutation.isPending || cancelReason.trim().length === 0}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
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
