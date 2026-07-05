import { useCallback, useMemo, type ReactNode } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  IconCut,
  IconScissors,
  IconClipboardList,
  IconExternalLink,
  IconReload,
  IconChevronRight,
  IconHistory,
  IconPlayerPlay,
  IconCheck,
  IconDownload,
  IconHash,
  IconUser,
  IconBuildingFactory,
  IconAlertCircle,
} from "@tabler/icons-react";

import { DetailPage } from "@/components/ui/detailpage";
import type { DetailSectionDef } from "@/components/ui/detailpage";
import type { PageAction } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useCut, useCutMutations, useCuts, useAuth } from "@/hooks";
import { canEditCuts } from "@/utils/permissions/entity-permissions";
import { getFileDownloadUrl } from "@/utils/file";
import type { Cut } from "@/types";
import type { CutUpdateFormData } from "@/schemas";
import {
  routes,
  SECTOR_PRIVILEGES,
  CUT_STATUS,
  CUT_STATUS_LABELS,
  CUT_ORIGIN_LABELS,
  CUT_REQUEST_REASON_LABELS,
  CHANGE_LOG_ENTITY_TYPE,
  getBadgeVariant,
} from "@/constants";
import { CutOverviewSection } from "@/components/production/cut/detail/cut-overview-section";
import { useConfirm } from "@/components/production/task/detail/use-confirm";

const PAGE_PRIVILEGES = [SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.DESIGNER, SECTOR_PRIVILEGES.PLOTTING, SECTOR_PRIVILEGES.ADMIN];

const DETAIL_INCLUDE = {
  file: true,
  task: { include: { customer: true, sector: true } },
  parentCut: { include: { file: true } },
  childCuts: { include: { file: true } },
} as const;

/** Clickable cut rows (child cuts / other cuts of the task) with status + origin colored badges. */
function CutRowList({ cuts, onOpen, showReason }: { cuts: Cut[]; onOpen: (id: string) => void; showReason?: boolean }) {
  return (
    <div className="space-y-2">
      {cuts.map((cut) => (
        <button
          key={cut.id}
          type="button"
          onClick={() => onOpen(cut.id)}
          className="flex w-full items-center justify-between gap-2 rounded-lg bg-muted/50 px-4 py-2.5 text-left transition-colors hover:bg-muted/70"
        >
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <IconScissors className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{cut.file?.filename || "Sem nome"}</p>
              {showReason && cut.reason && (
                <p className="mt-0.5 flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
                  <IconAlertCircle className="h-3 w-3 shrink-0" />
                  {CUT_REQUEST_REASON_LABELS[cut.reason]}
                </p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Badge variant={getBadgeVariant(cut.status, "CUT")} className="text-xs">
              {CUT_STATUS_LABELS[cut.status]}
            </Badge>
            <Badge variant={getBadgeVariant(cut.origin, "CUT_ORIGIN")} className="text-xs">
              {CUT_ORIGIN_LABELS[cut.origin]}
            </Badge>
            <IconChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </button>
      ))}
    </div>
  );
}

function CuttingDetailsContent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const canEdit = canEditCuts(user as never);

  const { confirm, dialog } = useConfirm();
  const { updateAsync } = useCutMutations();

  const { data: response, isLoading, error } = useCut(id!, { enabled: !!id, include: DETAIL_INCLUDE as never });
  const cut = (response?.data ?? null) as Cut | null;

  usePageTracker({ title: cut ? `Recorte: ${cut.file?.filename || "Sem nome"}` : "Detalhes do Recorte", icon: "cut" });

  // Other cuts of the same task (enabled belongs in the query OPTIONS, not the params).
  const { data: taskCutsResponse } = useCuts(
    {
      where: { taskId: cut?.taskId, id: { not: cut?.id } },
      include: { file: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    },
    { enabled: !!cut?.taskId },
  );
  const otherCuts = (taskCutsResponse?.data ?? []) as Cut[];

  // Persist a status change — mirror the lifecycle timestamps (server also auto-sets these).
  const setStatus = useCallback(
    async (c: Cut, next: CUT_STATUS) => {
      const data: Partial<CutUpdateFormData> = { status: next };
      if (next === CUT_STATUS.CUTTING && !c.startedAt) data.startedAt = new Date();
      if (next === CUT_STATUS.COMPLETED && !c.completedAt) data.completedAt = new Date();
      await updateAsync({ id: c.id, data: data as never });
    },
    [updateAsync],
  );

  const startCut = useCallback((c: Cut) => void setStatus(c, CUT_STATUS.CUTTING), [setStatus]);
  const finishCut = useCallback(
    async (c: Cut) => {
      const ok = await confirm({
        title: "Finalizar corte?",
        description: "O horário de conclusão será registrado automaticamente.",
      });
      if (!ok) return;
      await setStatus(c, CUT_STATUS.COMPLETED);
    },
    [confirm, setStatus],
  );

  const handleDownloadFile = useCallback(() => {
    if (!cut?.file) return;
    const link = document.createElement("a");
    link.href = getFileDownloadUrl(cut.file);
    link.download = cut.file.filename || "recorte";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [cut]);

  const sections = useMemo<DetailSectionDef<Cut>[]>(() => {
    if (!cut) return [];
    const list: DetailSectionDef<Cut>[] = [];

    // 1. Informações Gerais — file preview + inline-editable status / badges / timestamps / duration.
    list.push({
      id: "overview",
      label: "Informações Gerais",
      icon: IconScissors,
      span: 1,
      render: (c) => <CutOverviewSection cut={c} canEdit={canEdit} onStatusCommit={setStatus} />,
    });

    // 2. Tarefa — clickable related-entity card (title + "Ver Tarefa" both open the task detail).
    if (cut.task) {
      list.push({
        id: "task",
        label: "Tarefa",
        icon: IconClipboardList,
        span: 1,
        onTitleClick: (c) => c.task && navigate(routes.production.schedule.details(c.task.id)),
        headerActions: (c) =>
          c.task ? (
            <Button
              variant="outline"
              size="sm"
              className="h-7 gap-1.5 text-xs"
              onClick={() => navigate(routes.production.schedule.details(c.task!.id))}
            >
              <IconExternalLink className="h-3.5 w-3.5" />
              Ver Tarefa
            </Button>
          ) : null,
        fields: [
          { id: "taskName", label: "Nome da Tarefa", icon: IconClipboardList, accessor: (c) => c.task?.name ?? null },
          { id: "serialNumber", label: "Número de Série", icon: IconHash, accessor: (c) => c.task?.serialNumber ?? null },
          { id: "customer", label: "Cliente", icon: IconUser, accessor: (c) => c.task?.customer?.fantasyName ?? null },
          { id: "sector", label: "Setor", icon: IconBuildingFactory, accessor: (c) => c.task?.sector?.name ?? null },
        ],
      });
    }

    // 3. Retrabalhos Realizados (child cuts) — full width, only when present.
    if (cut.childCuts && cut.childCuts.length > 0) {
      list.push({
        id: "childCuts",
        label: "Retrabalhos Realizados",
        icon: IconReload,
        span: 2,
        scroll: true,
        headerActions: (c) => <Badge variant="secondary">{c.childCuts?.length ?? 0}</Badge>,
        render: (c) => <CutRowList cuts={c.childCuts ?? []} onOpen={(cid) => navigate(routes.production.cutting.details(cid))} showReason />,
      });
    }

    // 4. Outros Recortes da Tarefa — only when there are sibling cuts.
    if (otherCuts.length > 0) {
      list.push({
        id: "otherCuts",
        label: "Outros Recortes da Tarefa",
        icon: IconScissors,
        span: 1,
        scroll: true,
        headerActions: () => <Badge variant="secondary">{otherCuts.length}</Badge>,
        render: () => <CutRowList cuts={otherCuts} onOpen={(cid) => navigate(routes.production.cutting.details(cid))} />,
      });
    }

    // 5. Histórico de Alterações.
    list.push({
      id: "changelog",
      label: "Histórico de Alterações",
      icon: IconHistory,
      span: 2,
      scroll: true,
      render: (c) => (
        <ChangelogHistory
          embedded
          entityType={CHANGE_LOG_ENTITY_TYPE.CUT}
          entityId={c.id}
          entityName={c.file?.filename || "Recorte"}
          entityCreatedAt={c.createdAt}
          className="w-full"
        />
      ),
    });

    return list;
  }, [cut, canEdit, setStatus, navigate, otherCuts]);

  // Header actions: lifecycle buttons (primary) + Baixar — NO "Atualizar".
  const actions = useMemo<PageAction[]>(() => {
    if (!cut) return [];
    const list: PageAction[] = [];
    if (cut.file) {
      list.push({ key: "baixar", label: "Baixar", icon: IconDownload, variant: "outline", onClick: handleDownloadFile });
    }
    if (canEdit && cut.status === CUT_STATUS.PENDING) {
      list.push({ key: "iniciar", label: "Iniciar Corte", icon: IconPlayerPlay, variant: "default", onClick: () => startCut(cut) });
    }
    if (canEdit && cut.status === CUT_STATUS.CUTTING) {
      list.push({ key: "finalizar", label: "Finalizar Corte", icon: IconCheck, variant: "default", onClick: () => void finishCut(cut) });
    }
    return list;
  }, [cut, canEdit, handleDownloadFile, startCut, finishCut]);

  const errorNode: ReactNode = error ? "Recorte não encontrado." : undefined;

  return (
    <>
      <DetailPage<Cut>
        detailKey="cut-detail"
        data={cut}
        isLoading={isLoading}
        error={errorNode}
        emptyMessage="Recorte não encontrado."
        sections={sections}
        title={cut?.file?.filename || "Recorte"}
        icon={IconCut}
        actions={actions}
        hideEmptyFields
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Produção", href: routes.production.root },
          { label: "Recortes", href: routes.production.cutting.list },
          { label: cut?.file?.filename || "Recorte" },
        ]}
        navigation={{
          ids: (location.state as { ids?: string[] } | null)?.ids,
          toRoute: (rid) => routes.production.cutting.details(rid),
        }}
      />
      {dialog}
    </>
  );
}

export const CuttingDetailsPage = () => (
  <PrivilegeRoute requiredPrivilege={PAGE_PRIVILEGES}>
    <CuttingDetailsContent />
  </PrivilegeRoute>
);

export default CuttingDetailsPage;
