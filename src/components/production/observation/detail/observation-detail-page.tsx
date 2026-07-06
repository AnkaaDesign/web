import { useMemo, useState } from "react";
import { useParams, useNavigate, useLocation, Navigate } from "react-router-dom";
import {
  IconAlertCircle,
  IconClipboardList,
  IconTruck,
  IconCircleCheck,
  IconUser,
  IconBuildingFactory,
  IconCalendar,
  IconFileText,
  IconFileDescription,
  IconTag,
  IconGift,
  IconHistory,
  IconEdit,
  IconTrash,
  IconRefresh,
  IconLoader2,
  IconAlertTriangle,
} from "@tabler/icons-react";

import { DetailPage } from "@/components/ui/detailpage";
import type { DetailSectionDef } from "@/components/ui/detailpage";
import type { PageAction } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { canEditObservations, canDeleteObservations } from "@/utils/permissions/entity-permissions";

import { useObservation, useObservationMutations, useAuth } from "../../../../hooks";
import {
  routes,
  SECTOR_PRIVILEGES,
  CHANGE_LOG_ENTITY_TYPE,
  TASK_STATUS_LABELS,
  TASK_OBSERVATION_TYPE_LABELS,
  BONIFICATION_STATUS_LABELS,
  ENTITY_BADGE_CONFIG,
} from "../../../../constants";
import type { Observation } from "../../../../types";
import { ObservationFilesSection } from "./observation-files-section";

// Roles allowed to VIEW the observation detail (mirrors the previous PrivilegeRoute gate).
const OBSERVATION_VIEW_PRIVILEGES: SECTOR_PRIVILEGES[] = [
  SECTOR_PRIVILEGES.PRODUCTION,
  SECTOR_PRIVILEGES.WAREHOUSE,
  SECTOR_PRIVILEGES.FINANCIAL,
  SECTOR_PRIVILEGES.COMMERCIAL,
  SECTOR_PRIVILEGES.ADMIN,
];

// Roles allowed to EDIT — mirrors canEditObservations(). Used as the per-field `editablePrivilege`.
const OBSERVATION_EDIT_PRIVILEGES: SECTOR_PRIVILEGES[] = [
  SECTOR_PRIVILEGES.ADMIN,
  SECTOR_PRIVILEGES.COMMERCIAL,
  SECTOR_PRIVILEGES.FINANCIAL,
  SECTOR_PRIVILEGES.WAREHOUSE,
  SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
];

// Bonification badge variant (same mapping the old info-card used).
function bonificationBadgeVariant(status: string): string {
  switch (status) {
    case "APPROVED":
    case "PAID":
      return "success";
    case "SUSPENDED_BONIFICATION":
      return "destructive";
    default:
      return "secondary";
  }
}

// Observation-type badge color (the entity has no ENTITY_BADGE_CONFIG entry).
function reasonBadgeVariant(reason: string): string {
  switch (reason) {
    case "DAMAGE":
      return "red";
    case "OVERDUE":
      return "orange";
    case "QUALITY":
      return "blue";
    default:
      return "secondary";
  }
}

const muted = <span className="text-muted-foreground">—</span>;

interface ObservationBonification {
  id: string;
  status: string;
  reason?: string | null;
  user?: { id: string; name: string } | null;
}

// The detail query loads relations that the base Observation type doesn't declare — narrow them here.
type ObservationRecord = Observation & {
  bonifications?: ObservationBonification[];
};

export function ObservationDetailPage() {
  return (
    <PrivilegeRoute requiredPrivilege={OBSERVATION_VIEW_PRIVILEGES}>
      <ObservationDetailContent />
    </PrivilegeRoute>
  );
}

function ObservationDetailContent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const canEdit = canEditObservations(user as any);
  const canDelete = canDeleteObservations(user as any);

  const {
    data: response,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useObservation(id || "", {
    include: {
      task: { include: { customer: true, sector: true } },
      files: true,
      bonifications: { include: { user: true } },
    },
    enabled: !!id,
  });

  const observation = (response?.data ?? null) as ObservationRecord | null;

  usePageTracker({ title: "observation-detail" });

  const { updateAsync, deleteAsync, deleteMutation } = useObservationMutations();

  const handleDelete = async () => {
    if (!observation) return;
    try {
      await deleteAsync(observation.id);
      navigate(routes.production.observations.root);
    } catch (err) {
      if (process.env.NODE_ENV !== "production") console.error("Error deleting observation:", err);
    }
    setIsDeleteDialogOpen(false);
  };

  const sections = useMemo<DetailSectionDef<ObservationRecord>[]>(() => {
    const list: DetailSectionDef<ObservationRecord>[] = [];

    // --- Detalhes da Observação ---
    list.push({
      id: "info",
      label: "Detalhes da Observação",
      icon: IconAlertCircle,
      span: 1,
      fields: [
        {
          id: "description",
          label: "Descrição",
          icon: IconFileDescription,
          dataType: "textarea",
          required: true,
          accessor: (o) => o.description,
          editablePrivilege: OBSERVATION_EDIT_PRIVILEGES,
          edit: canEdit
            ? {
                get: (o) => o.description,
                placeholder: "Descrição da observação",
                validate: (v) => (typeof v === "string" && v.trim().length > 0 ? null : "Descrição é obrigatória"),
                onCommit: async (v, o) => {
                  await updateAsync({ id: o.id, data: { description: (v as string).trim() } });
                },
              }
            : undefined,
        },
        {
          id: "reason",
          label: "Tipo",
          icon: IconTag,
          dataType: "enum",
          accessor: (o) => o.reason ?? null,
          render: (o) =>
            o.reason ? (
              <div className="flex items-center justify-end">
                <Badge variant={reasonBadgeVariant(o.reason) as any}>{TASK_OBSERVATION_TYPE_LABELS[o.reason as keyof typeof TASK_OBSERVATION_TYPE_LABELS] || o.reason}</Badge>
              </div>
            ) : (
              muted
            ),
        },
        { id: "createdAt", label: "Criada em", icon: IconCalendar, dataType: "datetime", accessor: (o) => o.createdAt },
        {
          id: "updatedAt",
          label: "Atualizada em",
          icon: IconCalendar,
          dataType: "datetime",
          // Only meaningful when it differs from creation — otherwise hidden by hideEmptyFields.
          accessor: (o) => (o.updatedAt && new Date(o.updatedAt).getTime() !== new Date(o.createdAt).getTime() ? o.updatedAt : null),
        },
      ],
    });

    // --- Tarefa Relacionada (read-only; belongs to the Task) ---
    if (observation?.task) {
      list.push({
        id: "task",
        label: "Tarefa Relacionada",
        icon: IconClipboardList,
        span: 1,
        onTitleClick: (o) => o.task && navigate(routes.production.schedule.details(o.task.id)),
        fields: [
          { id: "taskName", label: "Nome da Tarefa", icon: IconTruck, accessor: (o) => o.task?.name ?? null },
          {
            id: "taskStatus",
            label: "Status",
            icon: IconCircleCheck,
            accessor: (o) => o.task?.status ?? null,
            render: (o) =>
              o.task ? (
                <div className="flex items-center justify-end">
                  <Badge variant={(ENTITY_BADGE_CONFIG.TASK[o.task.status as keyof typeof ENTITY_BADGE_CONFIG.TASK] || "default") as any}>
                    {TASK_STATUS_LABELS[o.task.status as keyof typeof TASK_STATUS_LABELS] || o.task.status}
                  </Badge>
                </div>
              ) : (
                muted
              ),
          },
          { id: "customer", label: "Cliente", icon: IconUser, accessor: (o) => o.task?.customer?.fantasyName ?? o.task?.customer?.corporateName ?? null },
          { id: "sector", label: "Setor", icon: IconBuildingFactory, accessor: (o) => o.task?.sector?.name ?? null },
        ],
      });
    }

    // --- Bonificações Afetadas (read-only; derived) ---
    if ((observation?.bonifications?.length || 0) > 0) {
      list.push({
        id: "bonifications",
        label: "Bonificações Afetadas",
        icon: IconGift,
        span: 1,
        headerActions: (o) => <Badge variant="secondary">{o.bonifications?.length ?? 0}</Badge>,
        render: (o) => (
          <div className="space-y-3">
            {(o.bonifications ?? []).map((b) => (
              <div key={b.id} className="bg-muted/50 rounded-lg px-4 py-3">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">{b.user?.name || "Usuário"}</span>
                  <Badge variant={bonificationBadgeVariant(b.status) as any}>
                    {BONIFICATION_STATUS_LABELS[b.status as keyof typeof BONIFICATION_STATUS_LABELS] || b.status}
                  </Badge>
                </div>
                {b.reason && <p className="text-xs text-muted-foreground mt-2">{b.reason}</p>}
              </div>
            ))}
          </div>
        ),
      });
    }

    // --- Arquivos Anexados ---
    if ((observation?.files?.length || 0) > 0) {
      list.push({
        id: "files",
        label: "Arquivos Anexados",
        icon: IconFileText,
        span: 2,
        headerActions: (o) => (
          <Badge variant="secondary">
            {o.files?.length ?? 0} arquivo{(o.files?.length ?? 0) > 1 ? "s" : ""}
          </Badge>
        ),
        render: (o) => (
          <ObservationFilesSection
            files={o.files ?? []}
            defaultViewMode="grid"
            emptyIcon={IconFileText}
            emptyTitle="Nenhum arquivo anexado"
            emptyDescription="Esta observação não possui arquivos anexados."
          />
        ),
      });
    }

    // --- Histórico ---
    list.push({
      id: "changelog",
      label: "Histórico",
      icon: IconHistory,
      span: 2,
      scroll: true,
      render: (o) => (
        <ChangelogHistory
          embedded
          entityType={CHANGE_LOG_ENTITY_TYPE.OBSERVATION}
          entityId={o.id}
          entityName={`Observação - ${o.task?.name || o.id.slice(0, 8)}`}
          entityCreatedAt={o.createdAt}
          className="w-full"
        />
      ),
    });

    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [observation?.task, observation?.bonifications?.length, observation?.files?.length, canEdit, updateAsync, navigate]);

  const actions = useMemo<PageAction[]>(() => {
    const list: PageAction[] = [{ key: "refresh", label: "Atualizar", icon: IconRefresh, onClick: () => refetch(), loading: isRefetching }];
    if (!observation) return list;
    if (canEdit) list.push({ key: "edit", label: "Editar", icon: IconEdit, variant: "default", onClick: () => navigate(routes.production.observations.edit(observation.id)) });
    if (canDelete) list.push({ key: "delete", label: "Excluir", icon: IconTrash, onClick: () => setIsDeleteDialogOpen(true) });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [observation, canEdit, canDelete, isRefetching, refetch, navigate]);

  if (!id) {
    return <Navigate to={routes.production.observations.root} replace />;
  }

  const title = observation?.task ? `Observação - ${observation.task.name}` : "Observação";
  const hasSuspendedBonifications = (observation?.bonifications?.length || 0) > 0;

  return (
    <>
      <DetailPage<ObservationRecord>
        detailKey="observation-detail"
        data={observation}
        isLoading={isLoading}
        error={error ? "Observação não encontrada" : undefined}
        emptyMessage="A observação que você está procurando não existe ou foi removida do sistema."
        sections={sections}
        title={title}
        icon={IconAlertCircle}
        actions={actions}
        hideEmptyFields
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Produção", href: routes.production.root },
          { label: "Observações", href: routes.production.observations.root },
          { label: observation ? title : "Detalhe" },
        ]}
        navigation={{
          ids: (location.state as { ids?: string[] } | null)?.ids,
          toRoute: (rid) => routes.production.observations.details(rid),
        }}
      />

      {/* Delete confirmation — warns that suspended bonifications will be restored. */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <IconAlertTriangle className="h-5 w-5 text-destructive" />
              Confirmar Exclusão
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir esta observação?
              {hasSuspendedBonifications && (
                <span className="block mt-2 font-medium text-warning">Atenção: As bonificações suspensas por esta observação serão restauradas automaticamente.</span>
              )}
              Esta ação não poderá ser desfeita.
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
    </>
  );
}
