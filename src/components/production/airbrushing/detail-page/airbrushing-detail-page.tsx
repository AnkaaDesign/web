import { useCallback, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  IconBrush,
  IconCurrencyReal,
  IconClipboardList,
  IconPhoto,
  IconFileInvoice,
  IconReceipt,
  IconHistory,
  IconCalendar,
  IconCalendarEvent,
  IconUser,
  IconCircleDot,
  IconCreditCard,
  IconHash,
  IconBuildingFactory,
  IconBuilding,
  IconEdit,
  IconTrash,
} from "@tabler/icons-react";
import { DetailPage } from "@/components/ui/detailpage";
import type { DetailSectionDef } from "@/components/ui/detailpage";
import type { PageAction } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { CustomerLogoDisplay } from "@/components/ui/avatar-display";
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
import { useAuth } from "@/contexts/auth-context";
import {
  canEditAirbrushings,
  canDeleteAirbrushings,
  AIRBRUSHING_FINANCE_PRIVILEGES,
} from "@/utils/permissions/entity-permissions";
import { getUsers } from "@/api-client";
import { useAirbrushing, useAirbrushingMutations } from "../../../../hooks";
import {
  routes,
  SECTOR_PRIVILEGES,
  CHANGE_LOG_ENTITY_TYPE,
  AIRBRUSHING_STATUS,
  AIRBRUSHING_STATUS_LABELS,
  AIRBRUSHING_PAYMENT_STATUS,
  AIRBRUSHING_PAYMENT_STATUS_LABELS,
  TASK_STATUS_LABELS,
  ENTITY_BADGE_CONFIG,
} from "../../../../constants";
import type { Airbrushing } from "../../../../types";
import { AirbrushingFilesSection } from "./airbrushing-files-section";

// CANONICAL money-visibility gate for airbrushing — spread into a mutable array so it satisfies the
// `PrivilegeGate` (SECTOR_PRIVILEGES[]) shape used by requiredPrivilege/editablePrivilege.
const MONEY_GATE: SECTOR_PRIVILEGES[] = [...AIRBRUSHING_FINANCE_PRIVILEGES];

// Valid forward transitions for inline status edits (the current value is always kept by the editor).
const AIRBRUSHING_STATUS_TRANSITIONS: Record<string, AIRBRUSHING_STATUS[]> = {
  [AIRBRUSHING_STATUS.PENDING]: [AIRBRUSHING_STATUS.IN_PRODUCTION, AIRBRUSHING_STATUS.COMPLETED, AIRBRUSHING_STATUS.CANCELLED],
  [AIRBRUSHING_STATUS.IN_PRODUCTION]: [AIRBRUSHING_STATUS.PENDING, AIRBRUSHING_STATUS.COMPLETED, AIRBRUSHING_STATUS.CANCELLED],
  [AIRBRUSHING_STATUS.COMPLETED]: [AIRBRUSHING_STATUS.IN_PRODUCTION, AIRBRUSHING_STATUS.CANCELLED],
  [AIRBRUSHING_STATUS.CANCELLED]: [AIRBRUSHING_STATUS.PENDING],
};

const muted = <span className="text-muted-foreground">—</span>;

export function AirbrushingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { deleteMutation, updateAsync } = useAirbrushingMutations();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const canEdit = canEditAirbrushings(user);
  const canDelete = canDeleteAirbrushings(user);

  // Promise-based confirm for the inline "Status de Pagamento" edit. Settling / un-settling money
  // must be confirmed first; `beforeCommit` awaits this before the status actually changes.
  const [paymentConfirm, setPaymentConfirm] = useState<{ open: boolean; target: AIRBRUSHING_PAYMENT_STATUS | null }>({ open: false, target: null });
  const paymentConfirmResolver = useRef<((ok: boolean) => void) | null>(null);
  const confirmPaymentChange = useCallback((target: AIRBRUSHING_PAYMENT_STATUS): Promise<boolean> => {
    // A new prompt supersedes any pending one — settle the prior promise (false) so its awaiter unblocks.
    paymentConfirmResolver.current?.(false);
    setPaymentConfirm({ open: true, target });
    return new Promise<boolean>((resolve) => {
      paymentConfirmResolver.current = resolve;
    });
  }, []);
  const settlePaymentConfirm = useCallback((ok: boolean) => {
    paymentConfirmResolver.current?.(ok);
    paymentConfirmResolver.current = null;
    setPaymentConfirm((s) => ({ ...s, open: false }));
  }, []);

  const { data: response, isLoading, error } = useAirbrushing(id!, {
    include: {
      task: { include: { customer: { include: { logo: true } }, sector: true } },
      painter: true,
      layouts: true,
      invoices: true,
      receipts: true,
    },
    enabled: !!id,
  });

  const airbrushing = response?.data as Airbrushing | undefined;

  const handleDelete = async () => {
    if (!airbrushing) return;
    try {
      await deleteMutation.mutateAsync(airbrushing.id);
      navigate(routes.production.airbrushings.list);
    } catch (e) {
      if (process.env.NODE_ENV !== "production") console.error("Error deleting airbrushing:", e);
    }
  };

  // Async option loader for the Pintor inline-edit combobox — painters are users whose sector holds the
  // AIRBRUSHING privilege (mirrors the form's PainterSelector). Do NOT filter by status/isActive:
  // painters are usually dismissed / third-party workers who must still be selectable to be paid.
  const loadPainters = useCallback(async (search: string, page = 1) => {
    const pageSize = 50;
    const res = await getUsers({
      take: pageSize,
      skip: (page - 1) * pageSize,
      where: {
        sector: { is: { privileges: SECTOR_PRIVILEGES.AIRBRUSHING } },
        ...(search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
                { cpf: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true },
    } as never);
    const users = (res?.data ?? []) as Array<{ id: string; name?: string }>;
    const total = res?.meta?.totalRecords ?? 0;
    return {
      data: users.map((u) => ({ value: u.id, label: u.name || u.id })),
      hasMore: page * pageSize < total,
    };
  }, []);

  const sections = useMemo<DetailSectionDef<Airbrushing>[]>(() => {
    const list: DetailSectionDef<Airbrushing>[] = [];

    // --- Informações da Aerografia ---
    list.push({
      id: "info",
      label: "Informações da Aerografia",
      icon: IconBrush,
      span: 1,
      fields: [
        {
          id: "status",
          label: "Status",
          icon: IconCircleDot,
          dataType: "enum",
          accessor: (a) => a.status,
          render: (a) => (
            <div className="flex items-center justify-end">
              <Badge variant={(ENTITY_BADGE_CONFIG.AIRBRUSHING[a.status] || "default") as any}>
                {AIRBRUSHING_STATUS_LABELS[a.status] || a.status}
              </Badge>
            </div>
          ),
          edit: canEdit
            ? {
                get: (a) => a.status,
                enum: {
                  values: Object.values(AIRBRUSHING_STATUS),
                  labels: AIRBRUSHING_STATUS_LABELS,
                  badgeEntity: "AIRBRUSHING",
                  transitions: (current) => [current, ...(AIRBRUSHING_STATUS_TRANSITIONS[current] ?? [])],
                },
                onCommit: async (v, a) => {
                  await updateAsync({ id: a.id, data: { status: v as AIRBRUSHING_STATUS } });
                },
              }
            : undefined,
        },
        {
          id: "painter",
          label: "Pintor",
          icon: IconUser,
          dataType: "relation",
          accessor: (a) => a.painter?.name ?? null,
          edit: canEdit
            ? {
                get: (a) => a.painterId ?? null,
                loadOptions: loadPainters,
                currentOptions: (a) => (a.painter ? [{ value: a.painter.id, label: a.painter.name ?? a.painter.id }] : []),
                placeholder: "Buscar pintor...",
                onCommit: async (v, a) => {
                  await updateAsync({ id: a.id, data: { painterId: (v as string) || null } });
                },
              }
            : undefined,
        },
        {
          id: "startDate",
          label: "Início Previsto",
          icon: IconCalendar,
          dataType: "date",
          accessor: (a) => a.startDate ?? null,
          edit: canEdit
            ? {
                get: (a) => a.startDate ?? null,
                onCommit: async (v, a) => {
                  await updateAsync({ id: a.id, data: { startDate: (v as Date) ?? null } });
                },
              }
            : undefined,
        },
        {
          id: "finishDate",
          label: "Término Previsto",
          icon: IconCalendarEvent,
          dataType: "date",
          accessor: (a) => a.finishDate ?? null,
          edit: canEdit
            ? {
                get: (a) => a.finishDate ?? null,
                onCommit: async (v, a) => {
                  await updateAsync({ id: a.id, data: { finishDate: (v as Date) ?? null } });
                },
              }
            : undefined,
        },
        // Actual timestamps are stamped by the production floor (start/finish) — read-only here.
        { id: "startedAt", label: "Iniciado em", icon: IconCalendar, dataType: "datetime", accessor: (a) => a.startedAt ?? null },
        { id: "finishedAt", label: "Finalizado em", icon: IconCalendarEvent, dataType: "datetime", accessor: (a) => a.finishedAt ?? null },
        { id: "createdAt", label: "Criado em", icon: IconCalendar, dataType: "datetime", accessor: (a) => a.createdAt },
        { id: "updatedAt", label: "Atualizado em", icon: IconCalendar, dataType: "datetime", accessor: (a) => a.updatedAt ?? null },
      ],
    });

    // --- Preço & Pagamento (financial-only) ---
    list.push({
      id: "payment",
      label: "Preço & Pagamento",
      icon: IconCurrencyReal,
      span: 1,
      requiredPrivilege: MONEY_GATE,
      fields: [
        {
          id: "price",
          label: "Preço",
          icon: IconCurrencyReal,
          dataType: "money",
          requiredPrivilege: MONEY_GATE,
          editablePrivilege: MONEY_GATE,
          accessor: (a) => a.price ?? null,
          edit: canEdit
            ? {
                get: (a) => a.price ?? null,
                placeholder: "0,00",
                min: 0,
                onCommit: async (v, a) => {
                  const n = typeof v === "number" ? v : v == null || v === "" ? null : parseFloat(v as string);
                  const next = n != null && Number.isFinite(n) && n >= 0 ? n : null;
                  await updateAsync({ id: a.id, data: { price: next } });
                },
              }
            : undefined,
        },
        {
          id: "paymentStatus",
          label: "Status do Pagamento",
          icon: IconCreditCard,
          dataType: "enum",
          requiredPrivilege: MONEY_GATE,
          editablePrivilege: MONEY_GATE,
          accessor: (a) => a.paymentStatus ?? null,
          render: (a) => (
            <div className="flex items-center justify-end">
              <Badge variant={(ENTITY_BADGE_CONFIG.AIRBRUSHING_PAYMENT[a.paymentStatus] || "default") as any}>
                {AIRBRUSHING_PAYMENT_STATUS_LABELS[a.paymentStatus] || a.paymentStatus}
              </Badge>
            </div>
          ),
          edit: canEdit
            ? {
                get: (a) => a.paymentStatus ?? null,
                enum: {
                  values: Object.values(AIRBRUSHING_PAYMENT_STATUS),
                  labels: AIRBRUSHING_PAYMENT_STATUS_LABELS,
                  badgeEntity: "AIRBRUSHING_PAYMENT",
                },
                // Confirm before settling / un-settling money — a no-op (same status) commits silently.
                beforeCommit: (v, a) => {
                  if (v === a.paymentStatus) return true;
                  return confirmPaymentChange(v as AIRBRUSHING_PAYMENT_STATUS);
                },
                onCommit: async (v, a) => {
                  if (v === a.paymentStatus) return;
                  await updateAsync({ id: a.id, data: { paymentStatus: v as AIRBRUSHING_PAYMENT_STATUS } });
                },
              }
            : undefined,
        },
        // paidAt is server-stamped when paymentStatus becomes PAID — read-only.
        { id: "paidAt", label: "Pago em", icon: IconCalendar, dataType: "datetime", requiredPrivilege: MONEY_GATE, accessor: (a) => a.paidAt ?? null },
      ],
    });

    // --- Tarefa Relacionada (read-only; belongs to the Task) ---
    if (airbrushing?.task) {
      list.push({
        id: "task",
        label: "Tarefa Relacionada",
        icon: IconClipboardList,
        span: 1,
        onTitleClick: (a) => a.task && navigate(routes.production.schedule.details(a.task.id)),
        fields: [
          { id: "taskName", label: "Nome da Tarefa", icon: IconClipboardList, accessor: (a) => a.task?.name ?? null },
          {
            id: "serialNumber",
            label: "Número de Série",
            icon: IconHash,
            accessor: (a) => a.task?.serialNumber ?? null,
            render: (a) => (a.task?.serialNumber ? <span className="font-mono">{a.task.serialNumber}</span> : muted),
          },
          { id: "sector", label: "Setor", icon: IconBuildingFactory, accessor: (a) => a.task?.sector?.name ?? null },
          {
            id: "customer",
            label: "Cliente",
            icon: IconBuilding,
            accessor: (a) => a.task?.customer?.fantasyName ?? null,
            render: (a) =>
              a.task?.customer ? (
                <div className="flex items-center gap-2">
                  <CustomerLogoDisplay logo={a.task.customer.logo} customerName={a.task.customer.fantasyName} size="sm" shape="rounded" className="flex-shrink-0" />
                  <span className="text-sm font-semibold text-foreground text-right">{a.task.customer.fantasyName}</span>
                </div>
              ) : (
                muted
              ),
          },
          {
            id: "taskStatus",
            label: "Status da Tarefa",
            accessor: (a) => a.task?.status ?? null,
            render: (a) =>
              a.task ? (
                <Badge variant={(ENTITY_BADGE_CONFIG.TASK[a.task.status as keyof typeof ENTITY_BADGE_CONFIG.TASK] || "default") as any}>
                  {TASK_STATUS_LABELS[a.task.status as keyof typeof TASK_STATUS_LABELS] || a.task.status}
                </Badge>
              ) : (
                muted
              ),
          },
        ],
      });
    }

    // --- Layouts da Aerografia (not money-gated) ---
    if ((airbrushing?.layouts?.length || 0) > 0) {
      list.push({
        id: "layouts",
        label: "Layouts da Aerografia",
        icon: IconPhoto,
        span: 1,
        headerActions: (a) => <Badge variant="secondary">{a.layouts?.length ?? 0}</Badge>,
        render: (a) => (
          <AirbrushingFilesSection
            files={a.layouts ?? []}
            defaultViewMode="grid"
            emptyIcon={IconPhoto}
            emptyTitle="Nenhum layout cadastrado"
            emptyDescription="Esta aerografia não possui layouts anexados."
          />
        ),
      });
    }

    // --- Notas Fiscais (financial-only) ---
    if ((airbrushing?.invoices?.length || 0) > 0) {
      list.push({
        id: "invoices",
        label: "Notas Fiscais",
        icon: IconFileInvoice,
        span: 1,
        requiredPrivilege: MONEY_GATE,
        headerActions: (a) => <Badge variant="secondary">{a.invoices?.length ?? 0}</Badge>,
        render: (a) => (
          <AirbrushingFilesSection
            files={a.invoices ?? []}
            emptyIcon={IconFileInvoice}
            emptyTitle="Nenhuma nota fiscal cadastrada"
            emptyDescription="Esta aerografia não possui notas fiscais anexadas."
          />
        ),
      });
    }

    // --- Recibos (financial-only) ---
    if ((airbrushing?.receipts?.length || 0) > 0) {
      list.push({
        id: "receipts",
        label: "Recibos",
        icon: IconReceipt,
        span: 1,
        requiredPrivilege: MONEY_GATE,
        headerActions: (a) => <Badge variant="secondary">{a.receipts?.length ?? 0}</Badge>,
        render: (a) => (
          <AirbrushingFilesSection
            files={a.receipts ?? []}
            emptyIcon={IconReceipt}
            emptyTitle="Nenhum recibo cadastrado"
            emptyDescription="Esta aerografia não possui recibos anexados."
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
      render: (a) => (
        <ChangelogHistory
          embedded
          entityType={CHANGE_LOG_ENTITY_TYPE.AIRBRUSHING}
          entityId={a.id}
          entityName={`Aerografia - ${a.task?.name || a.id.slice(0, 8)}`}
          entityCreatedAt={a.createdAt}
          className="w-full"
        />
      ),
    });

    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    airbrushing?.task,
    airbrushing?.layouts?.length,
    airbrushing?.invoices?.length,
    airbrushing?.receipts?.length,
    canEdit,
    updateAsync,
    confirmPaymentChange,
    loadPainters,
    navigate,
  ]);

  const actions = useMemo<PageAction[]>(() => {
    if (!airbrushing) return [];
    const list: PageAction[] = [];
    if (canEdit) list.push({ key: "edit", label: "Editar", icon: IconEdit, variant: "default", onClick: () => navigate(routes.production.airbrushings.edit(airbrushing.id)) });
    if (canDelete) list.push({ key: "delete", label: "Excluir", icon: IconTrash, onClick: () => setShowDeleteDialog(true) });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [airbrushing, canEdit, canDelete, navigate]);

  return (
    <>
      <DetailPage<Airbrushing>
        detailKey="airbrushing-detail"
        data={airbrushing}
        isLoading={isLoading}
        error={error ? "Aerografia não encontrada" : undefined}
        emptyMessage="A aerografia que você está procurando não existe ou foi removida do sistema."
        sections={sections}
        title={airbrushing?.task?.name ?? "Aerografia"}
        icon={IconBrush}
        actions={actions}
        hideEmptyFields
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Produção", href: routes.production.root },
          { label: "Aerografia", href: routes.production.airbrushings.root },
          { label: airbrushing?.task?.name ?? "Detalhe" },
        ]}
        navigation={{
          ids: (location.state as { ids?: string[] } | null)?.ids,
          toRoute: (rid) => routes.production.airbrushings.details(rid),
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>Tem certeza que deseja excluir esta aerografia? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment-status change confirmation — gates the inline edit that settles / un-settles money. */}
      <AlertDialog open={paymentConfirm.open} onOpenChange={(o) => !o && settlePaymentConfirm(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{paymentConfirm.target === AIRBRUSHING_PAYMENT_STATUS.PAID ? "Confirmar pagamento" : "Desfazer pagamento"}</AlertDialogTitle>
            <AlertDialogDescription>
              {paymentConfirm.target === AIRBRUSHING_PAYMENT_STATUS.PAID
                ? "Marcar esta aerografia como paga? Isso registra a liquidação do pagamento ao pintor."
                : "Desfazer o pagamento desta aerografia? Ela voltará para pendente."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => settlePaymentConfirm(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => settlePaymentConfirm(true)}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
