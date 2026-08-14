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
  IconPlayerPlay,
  IconCheck,
  IconList,
  IconLayoutGrid,
  IconFileDescription,
  IconReceiptTax,
  IconDownload,
  IconEye,
  IconPaperclip,
  IconLoader2,
} from "@tabler/icons-react";
import { DetailPage } from "@/components/ui/detailpage";
import type { DetailSectionDef } from "@/components/ui/detailpage";
import type { PageAction } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFileViewer, type FileViewMode } from "@/components/common/file";
import { useToast } from "@/hooks/common/use-toast";
import { createAirbrushingFormData } from "@/utils/form-data-helper";
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
import { usePrivileges } from "@/hooks/common/use-privileges";
import {
  canEditAirbrushings,
  canDeleteAirbrushings,
  canReleaseAirbrushings,
  canSettleAirbrushingPayment,
  AIRBRUSHING_FINANCE_PRIVILEGES,
} from "@/utils/permissions/entity-permissions";
import { getUsers } from "@/api-client";
import { useAirbrushing, useAirbrushingMutations } from "../../../../hooks";
import { useAttachAirbrushingReceipts, useDetachAirbrushingReceipt } from "../../../../hooks/production/use-airbrushing";
import { AttachReceiptsDialog } from "@/components/financial/common/attach-receipts-dialog";
import { useAirbrushingNfse } from "../../../../hooks/production/use-airbrushing-nfse";
import {
  routes,
  SECTOR_PRIVILEGES,
  CHANGE_LOG_ENTITY_TYPE,
  AIRBRUSHING_STATUS,
  AIRBRUSHING_STATUS_LABELS,
  AIRBRUSHING_PAYMENT_STATUS,
  AIRBRUSHING_PAYMENT_STATUS_LABELS,
  AIRBRUSHING_DUE_DATE_RULE,
  AIRBRUSHING_DUE_DATE_RULE_LABELS,
  PAYMENT_METHOD,
  PAYMENT_METHOD_LABELS,
  TASK_STATUS_LABELS,
  ENTITY_BADGE_CONFIG,
} from "../../../../constants";
import { AIRBRUSHING_DEFAULT_PAYMENT_TERM_DAYS } from "@/utils/airbrushing";
import { formatDate } from "@/utils";
import { formatFileSize, getFileDownloadUrl } from "@/utils/file";
import type { Airbrushing, File as AnkaaFile } from "../../../../types";
import { AirbrushingFilesSection } from "./airbrushing-files-section";
import { AirbrushingNfseSection, AirbrushingNfseHeaderBadges, DocumentRow, SubBlock } from "./airbrushing-nfse-section";
// Resolve each Layout wrapper to its backing File (id/filename/path) — shared with the
// task-detail airbrushing section so both download the real File, not the Layout id.
import { getAirbrushingLayouts } from "@/components/production/task/detail/sections/airbrushings-section";

// CANONICAL money-visibility gate for airbrushing — spread into a mutable array so it satisfies the
// `PrivilegeGate` (SECTOR_PRIVILEGES[]) shape used by requiredPrivilege/editablePrivilege.
const MONEY_GATE: SECTOR_PRIVILEGES[] = [...AIRBRUSHING_FINANCE_PRIVILEGES];

// Valid transitions for inline status edits (the current value is always kept by the editor).
// Mirrors the task lifecycle: Em Preparação → Aguardando Produção → Em Produção → Concluído,
// with a step back at every stage and Cancelado reachable until the job is concluded.
const AIRBRUSHING_STATUS_TRANSITIONS: Record<string, AIRBRUSHING_STATUS[]> = {
  [AIRBRUSHING_STATUS.PREPARATION]: [AIRBRUSHING_STATUS.WAITING_PRODUCTION, AIRBRUSHING_STATUS.IN_PRODUCTION, AIRBRUSHING_STATUS.CANCELLED],
  [AIRBRUSHING_STATUS.WAITING_PRODUCTION]: [AIRBRUSHING_STATUS.PREPARATION, AIRBRUSHING_STATUS.IN_PRODUCTION, AIRBRUSHING_STATUS.CANCELLED],
  [AIRBRUSHING_STATUS.IN_PRODUCTION]: [AIRBRUSHING_STATUS.WAITING_PRODUCTION, AIRBRUSHING_STATUS.COMPLETED, AIRBRUSHING_STATUS.CANCELLED],
  [AIRBRUSHING_STATUS.COMPLETED]: [AIRBRUSHING_STATUS.IN_PRODUCTION, AIRBRUSHING_STATUS.CANCELLED],
  [AIRBRUSHING_STATUS.CANCELLED]: [AIRBRUSHING_STATUS.PREPARATION],
};

const muted = <span className="text-muted-foreground">—</span>;

/**
 * Recibos do pagamento, DENTRO da seção "Preço & Pagamento" — o recibo é o comprovante do
 * pagamento, então mora ao lado do valor e do status, não numa seção própria lá embaixo.
 *
 * Reaproveita `SubBlock` + `DocumentRow` da seção fiscal de propósito: documento de
 * aerografia tem UM visual só (ícone à esquerda, nome e tamanho no meio, ações dentro do
 * card, à direita), seja ele DANFSe, XML ou recibo.
 */
function AirbrushingReceiptsBlock({
  airbrushingId,
  files,
  canManage,
  onRemove,
  removingId,
}: {
  airbrushingId: string;
  files: AnkaaFile[];
  canManage: boolean;
  onRemove: (file: AnkaaFile) => void;
  removingId: string | null;
}) {
  const { actions } = useFileViewer();
  const { toast } = useToast();
  const [attachOpen, setAttachOpen] = useState(false);
  const attachReceipts = useAttachAirbrushingReceipts();

  const handleAttach = async (selected: File[]) => {
    try {
      await attachReceipts.mutateAsync({ id: airbrushingId, data: createAirbrushingFormData({}, { receipts: selected }) });
      toast({ title: "Comprovante anexado", variant: "success" });
      setAttachOpen(false);
    } catch {
      toast({ title: "Não foi possível anexar o comprovante", variant: "error" });
    }
  };

  return (
    <SubBlock
      title="Recibos do pagamento"
      action={
        canManage ? (
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setAttachOpen(true)}>
            <IconPaperclip className="h-4 w-4" />
            Anexar comprovante
          </Button>
        ) : undefined
      }
    >
      <AttachReceiptsDialog
        open={attachOpen}
        onOpenChange={setAttachOpen}
        onConfirm={handleAttach}
        isPending={attachReceipts.isPending}
        description="Anexe o comprovante do pagamento desta aerografia. Os comprovantes já anexados são mantidos."
      />
      {files.length === 0 ? (
        <p className="py-1 text-sm text-muted-foreground">
          {canManage
            ? "Nenhum recibo anexado. Anexe o comprovante aqui ou ao registrar o pagamento no Contas a Pagar."
            : "Nenhum recibo anexado. O recibo é anexado pelo Contas a Pagar ao registrar o pagamento."}
        </p>
      ) : (
        <div className="space-y-2 py-1">
          {files.map((file, index) => (
            <DocumentRow
              key={file.id}
              icon={IconReceipt}
              title={file.filename}
              subtitle={formatFileSize(file.size ?? 0)}
              actions={
                <>
                  <Button variant="outline" size="sm" className="h-8 w-8 shrink-0 p-0" onClick={() => actions.viewFiles(files, index)} title="Visualizar recibo">
                    <IconEye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 shrink-0 p-0"
                    onClick={() => window.open(getFileDownloadUrl(file), "_blank", "noopener,noreferrer")}
                    title="Baixar recibo"
                  >
                    <IconDownload className="h-4 w-4" />
                  </Button>
                  {canManage && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 shrink-0 p-0 text-destructive hover:text-destructive"
                      onClick={() => onRemove(file)}
                      disabled={removingId === file.id}
                      title="Remover recibo"
                    >
                      {removingId === file.id ? <IconLoader2 className="h-4 w-4 animate-spin" /> : <IconTrash className="h-4 w-4" />}
                    </Button>
                  )}
                </>
              }
            />
          ))}
        </div>
      )}
    </SubBlock>
  );
}

export function AirbrushingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { hasAnyPrivilegeAccess } = usePrivileges();
  const { toast } = useToast();
  const { deleteMutation, updateAsync } = useAirbrushingMutations();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  // Grid/list view for the Layouts section — lifted here so the toggle can live in the
  // section header (next to the count), matching the task detail Layouts section.
  const [layoutsView, setLayoutsView] = useState<FileViewMode>("grid");

  const canEdit = canEditAirbrushings(user);
  const canDelete = canDeleteAirbrushings(user);
  const canRelease = canReleaseAirbrushings(user);
  // Liquidar pagamento (marcar/desmarcar pago, mexer no comprovante) é mais amplo que
  // canEdit: o ACCOUNTING chega aqui pelo Contas a Pagar e pode PUT :id e
  // PUT :id/receipts no servidor, mas não edita status/preço/pintor nem exclui.
  const canSettlePayment = canSettleAirbrushingPayment(user);
  const [removingReceiptId, setRemovingReceiptId] = useState<string | null>(null);
  const { mutateAsync: detachReceiptAsync } = useDetachAirbrushingReceipt();
  // Aprovar/reprovar layout é decisão comercial — mesma regra de canApproveLayouts no
  // servidor, que ignora em SILÊNCIO (200, sem mudança) quem não pode. Esconder o
  // controle aqui é o que evita o clique que parece funcionar e não faz nada.
  const canApproveLayouts = hasAnyPrivilegeAccess([SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.ADMIN]);
  // VER a nota segue o gate de dinheiro (MONEY_GATE, que inclui COMMERCIAL), mas EMITIR /
  // CANCELAR é mais estreito no servidor — ADMIN/Contabilidade/Financeiro. Sem esse recorte
  // o comercial veria botões que só devolvem 403.
  const canManageNfse = hasAnyPrivilegeAccess([SECTOR_PRIVILEGES.ADMIN, SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.FINANCIAL]);

  /**
   * fileId → LayoutStatus. A seção de layouts trabalha com os Files (é o File que baixa e
   * gera miniatura), mas o status mora no WRAPPER Layout — este mapa é a ponte entre os dois.
   */
  const getAirbrushingLayoutStatuses = useCallback((a: Airbrushing): Record<string, string> => {
    const entries = ((a.layouts ?? []) as any[])
      .map((layout) => [layout?.file?.id ?? layout?.fileId ?? layout?.id, layout?.status])
      .filter(([fileId, status]) => Boolean(fileId && status));
    return Object.fromEntries(entries);
  }, []);

  /**
   * O mapa `layoutStatuses` é chaveado por File ID e a API o aplica sobre os layouts
   * JÁ vinculados — por isso não vai `layoutIds` junto: mandar a lista seria um
   * `set` completo da relação, e um save de status acabaria reescrevendo anexos.
   */
  const handleLayoutStatusChange = useCallback(
    async (fileId: string, status: string) => {
      if (!id) return;
      try {
        await updateAsync({ id, data: { layoutStatuses: { [fileId]: status } } as any });
      } catch {
        // O interceptor global já mostra o erro; o refetch da mutation devolve o valor antigo.
      }
    },
    [id, updateAsync],
  );
  // The "Produção" dashboard (`pages/production/root.tsx`) is gated to FINANCIAL/ADMIN,
  // while this detail page also admits PRODUCTION/ACCOUNTING/COMMERCIAL. Render the
  // ancestor crumb as a plain label for those users instead of a link into a denied page.
  const canOpenProductionRoot = hasAnyPrivilegeAccess([SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN]);

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
      // Layouts are Layout wrappers; the backing File (id/path) lives on the nested
      // `file` relation. Without this include the grid would fall back to the Layout's
      // OWN id as a File id → /files/<layoutId>/download 404s ("Arquivo não encontrado").
      layouts: { include: { file: true } },
      invoices: true,
      receipts: true,
    },
    enabled: !!id,
  });

  const airbrushing = response?.data as Airbrushing | undefined;

  /**
   * A nota também é lida AQUI — não só dentro da seção — porque a página precisa de
   * `pdfFileId` para tirar o DANFSe da galeria de notas ANEXADAS e dos badges de
   * status/ambiente no cabeçalho da seção. É a mesma query key da seção: o react-query
   * deduplica, então não há requisição extra.
   *
   * O `enabled` repete o gate de dinheiro da seção de propósito: sem ele, um usuário de
   * PRODUÇÃO (que nunca vê a seção) passaria a bater num endpoint que só responde 403.
   */
  const canSeeMoney = hasAnyPrivilegeAccess(MONEY_GATE);
  const { data: nfseResponse } = useAirbrushingNfse(id ?? "", { enabled: !!id && canSeeMoney });
  const nfse = nfseResponse?.data ?? null;

  /**
   * Desanexa UM comprovante pelo endpoint dedicado. NÃO usa o PUT genérico com
   * `receiptIds`: aquele é um `set` do Prisma (substituição total da relação), então
   * dependeria da lista inteira estar hidratada e apagaria anexos em silêncio se a tela
   * estivesse com estado velho. O File em si não é apagado (o ACCOUNTING nem tem
   * privilégio para DELETE /files/:id) — o varredor de órfãos recolhe depois.
   */
  const handleRemoveReceipt = useCallback(
    async (file: AnkaaFile) => {
      if (!airbrushing) return;
      setRemovingReceiptId(file.id);
      try {
        await detachReceiptAsync({ id: airbrushing.id, fileId: file.id });
        toast({ title: "Comprovante removido", variant: "success" });
      } catch {
        toast({ title: "Não foi possível remover o comprovante", variant: "error" });
      } finally {
        setRemovingReceiptId(null);
      }
    },
    [airbrushing, detachReceiptAsync, toast],
  );

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
      // MUST be the `includeSectorPrivileges` convenience filter, not a nested `where`: a nested
      // `where` is JSON-stringified by the paramsSerializer and the API pipe only JSON.parses
      // `include`, so it arrives as a string, fails `userWhereSchema` and 400s (see PainterSelector).
      includeSectorPrivileges: [SECTOR_PRIVILEGES.AIRBRUSHING],
      ...(search ? { searchingFor: search } : {}),
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
          id: "description",
          label: "Descrição",
          icon: IconFileDescription,
          dataType: "textarea",
          accessor: (a) => a.description ?? null,
          edit: canEdit
            ? {
                get: (a) => a.description ?? null,
                placeholder: "Detalhes da aerografia",
                validate: (v) => (typeof v === "string" && v.length > 500 ? "Descrição muito longa (máximo 500 caracteres)" : null),
                onCommit: async (v, a) => {
                  await updateAsync({ id: a.id, data: { description: (v as string)?.trim() || null } });
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
    // São todos valores CURTOS (dinheiro, status, forma, regra, datas): empilhados em meia
    // largura viravam uma coluna alta de linhas quase vazias. Aqui a seção ocupa a largura
    // toda (`span: 2`) e os campos dividem UMA linha (`fieldsLayout: "row"`), cada um com
    // rótulo em cima e valor embaixo (`block: true`) — em telas estreitas a linha quebra
    // sozinha. O gate de dinheiro (MONEY_GATE) segue campo a campo, como antes.
    list.push({
      id: "payment",
      label: "Preço & Pagamento",
      icon: IconCurrencyReal,
      span: 2,
      fieldsLayout: "row",
      requiredPrivilege: MONEY_GATE,
      fields: [
        {
          id: "price",
          label: "Preço",
          icon: IconCurrencyReal,
          dataType: "money",
          block: true,
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
          block: true,
          requiredPrivilege: MONEY_GATE,
          editablePrivilege: MONEY_GATE,
          accessor: (a) => a.paymentStatus ?? null,
          render: (a) => (
            <div className="flex items-center">
              <Badge variant={(ENTITY_BADGE_CONFIG.AIRBRUSHING_PAYMENT[a.paymentStatus] || "default") as any}>
                {AIRBRUSHING_PAYMENT_STATUS_LABELS[a.paymentStatus] || a.paymentStatus}
              </Badge>
            </div>
          ),
          // Liquidar/estornar é do time de dinheiro, não de quem edita a aerografia —
          // por isso `canSettlePayment` e não `canEdit`. Sem esse OR o ACCOUNTING via a
          // página em modo leitura e não conseguia desfazer um pagamento que o próprio
          // servidor já autoriza (PUT :id inclui ACCOUNTING).
          edit: canEdit || canSettlePayment
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
        {
          id: "paymentMethod",
          label: "Forma de Pagamento",
          icon: IconCreditCard,
          dataType: "enum",
          block: true,
          requiredPrivilege: MONEY_GATE,
          editablePrivilege: MONEY_GATE,
          accessor: (a) => a.paymentMethod ?? null,
          render: (a) => <div className="flex items-center">{a.paymentMethod ? PAYMENT_METHOD_LABELS[a.paymentMethod] : "-"}</div>,
          edit: canEdit
            ? {
                get: (a) => a.paymentMethod ?? null,
                enum: { values: Object.values(PAYMENT_METHOD), labels: PAYMENT_METHOD_LABELS },
                onCommit: async (v, a) => {
                  await updateAsync({ id: a.id, data: { paymentMethod: (v as PAYMENT_METHOD) || null } });
                },
              }
            : undefined,
        },
        {
          id: "dueDateRule",
          label: "Regra de Vencimento",
          icon: IconCalendar,
          dataType: "enum",
          block: true,
          requiredPrivilege: MONEY_GATE,
          editablePrivilege: MONEY_GATE,
          accessor: (a) => a.dueDateRule ?? AIRBRUSHING_DUE_DATE_RULE.DAYS_AFTER_FINISH,
          render: (a) => {
            const rule = a.dueDateRule ?? AIRBRUSHING_DUE_DATE_RULE.DAYS_AFTER_FINISH;
            // A regra sozinha não diz nada — o que interessa é o parâmetro dela.
            const detail =
              rule === AIRBRUSHING_DUE_DATE_RULE.DAYS_AFTER_FINISH
                ? `${a.paymentTermDays ?? AIRBRUSHING_DEFAULT_PAYMENT_TERM_DAYS} dias após o término`
                : rule === AIRBRUSHING_DUE_DATE_RULE.DAY_OF_MONTH
                  ? a.dueDayOfMonth
                    ? `Todo dia ${a.dueDayOfMonth}`
                    : AIRBRUSHING_DUE_DATE_RULE_LABELS[rule]
                  : AIRBRUSHING_DUE_DATE_RULE_LABELS[rule];
            return <div className="flex items-center">{detail}</div>;
          },
          edit: canEdit
            ? {
                get: (a) => a.dueDateRule ?? AIRBRUSHING_DUE_DATE_RULE.DAYS_AFTER_FINISH,
                enum: { values: Object.values(AIRBRUSHING_DUE_DATE_RULE), labels: AIRBRUSHING_DUE_DATE_RULE_LABELS },
                onCommit: async (v, a) => {
                  // Trocar a regra sem dar o campo que ela consome é 400 no servidor
                  // (assertDueDateConfig). Semeia um valor sensato para que a troca
                  // sozinha nunca falhe: o dia de hoje, ou o prazo padrão.
                  const rule = v as AIRBRUSHING_DUE_DATE_RULE;
                  const data: Record<string, unknown> = { dueDateRule: rule };
                  if (rule === AIRBRUSHING_DUE_DATE_RULE.DAY_OF_MONTH && !a.dueDayOfMonth) data.dueDayOfMonth = new Date().getDate();
                  if (rule === AIRBRUSHING_DUE_DATE_RULE.FIXED_DATE && !a.dueDate) data.dueDate = a.dueDate ?? new Date();
                  await updateAsync({ id: a.id, data: data as any });
                },
              }
            : undefined,
        },
        // Vencimento é MATERIALIZADO pelo servidor a partir da regra — só é editável à
        // mão na regra "Data específica"; nas outras, editar aqui seria escrever um
        // valor que o próximo save recalcularia por cima.
        {
          id: "dueDate",
          label: "Vencimento",
          icon: IconCalendar,
          dataType: "date",
          block: true,
          requiredPrivilege: MONEY_GATE,
          editablePrivilege: MONEY_GATE,
          accessor: (a) => a.dueDate ?? null,
          // Enquanto a aerografia não é CONCLUÍDA de fato (`finishedAt` nulo), as regras
          // derivadas do término são calculadas sobre o término PREVISTO — o servidor
          // recalcula tudo na conclusão. Sem esse rótulo a data parece firme e alguém
          // programa pagamento por um vencimento que ainda vai mudar. Nada é calculado
          // aqui: só rotulamos o valor que já veio do servidor.
          render: (a) => {
            if (!a.dueDate) return muted;
            const rule = a.dueDateRule ?? AIRBRUSHING_DUE_DATE_RULE.DAYS_AFTER_FINISH;
            const isForecast = !a.finishedAt && rule !== AIRBRUSHING_DUE_DATE_RULE.FIXED_DATE;
            const shown = formatDate(new Date(a.dueDate));
            if (!isForecast) return <div className="flex items-center">{shown}</div>;
            // Numa linha só não cabe o parágrafo que explicava a previsão: a frase inteira
            // vira o `title` da célula e fica no lugar dela a marcação "Previsto" + o
            // lembrete curto de que a data ainda vai mudar.
            return (
              <div
                className="flex flex-col items-start gap-1"
                title="Calculado sobre o término previsto — será recalculado quando a aerografia for concluída."
              >
                <span className="inline-flex items-center gap-2">
                  <span>{shown}</span>
                  <Badge variant="secondary">Previsto</Badge>
                </span>
                <span className="text-xs font-normal text-muted-foreground">Recalculado na conclusão.</span>
              </div>
            );
          },
          edit:
            canEdit && (airbrushing?.dueDateRule ?? AIRBRUSHING_DUE_DATE_RULE.DAYS_AFTER_FINISH) === AIRBRUSHING_DUE_DATE_RULE.FIXED_DATE
              ? {
                  get: (a) => a.dueDate ?? null,
                  onCommit: async (v, a) => {
                    await updateAsync({ id: a.id, data: { dueDate: (v as Date) ?? null } });
                  },
                }
              : undefined,
        },
        // paidAt is server-stamped when paymentStatus becomes PAID — read-only.
        { id: "paidAt", label: "Pago em", icon: IconCalendar, dataType: "datetime", block: true, requiredPrivilege: MONEY_GATE, accessor: (a) => a.paidAt ?? null },
      ],
      // Os recibos entram ABAIXO da linha de campos: comprovante e pagamento na mesma
      // seção. O gate continua sendo o da seção (MONEY_GATE) — mudou o lugar, não quem vê.
      render: (a) => (
        <AirbrushingReceiptsBlock airbrushingId={a.id} files={a.receipts ?? []} canManage={canSettlePayment} onRemove={handleRemoveReceipt} removingId={removingReceiptId} />
      ),
    });

    // --- NFS-e do Aerografista (financial-only) ---
    // O id é "nfse" e NÃO "invoices": este último já pertence à galeria de notas fiscais
    // ANEXADAS (arquivos), que é outra coisa — colidir apagaria uma das duas seções.
    //
    // Esta é a seção ÚNICA do documento fiscal: DANFSe (PDF) e XML autorizado ficam juntos
    // no bloco "Documentos da nota". `invoices` entra porque é lá que o servidor conecta o
    // File do DANFSe — é de onde sai nome/tamanho/miniatura sem uma segunda busca.
    // `span: 2` porque o corpo agora tem três blocos + documentos e ficava espremido em
    // meia largura (quem já personalizou a largura desta seção mantém a escolha dele).
    list.push({
      id: "nfse",
      label: "NFS-e do Aerografista",
      icon: IconReceiptTax,
      span: 2,
      requiredPrivilege: MONEY_GATE,
      headerActions: () => <AirbrushingNfseHeaderBadges nfse={nfse} />,
      render: (a) => <AirbrushingNfseSection airbrushingId={a.id} canManage={canManageNfse} invoices={a.invoices ?? []} />,
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
        // Count sits next to the title; the grid/list toggle is in headerActions (right),
        // so the header reads: "Layouts da Aerografia [n] .......... [list][grid]".
        label: (
          <span className="flex items-center gap-2">
            Layouts da Aerografia
            <Badge variant="secondary">{airbrushing?.layouts?.length ?? 0}</Badge>
          </span>
        ),
        icon: IconPhoto,
        span: 1,
        headerActions: () => (
          <div className="flex items-center gap-1">
            <Button variant={layoutsView === "list" ? "default" : "outline"} size="sm" onClick={() => setLayoutsView("list")} className="h-8 w-8 p-0">
              <IconList className="h-4 w-4" />
            </Button>
            <Button variant={layoutsView === "grid" ? "default" : "outline"} size="sm" onClick={() => setLayoutsView("grid")} className="h-8 w-8 p-0">
              <IconLayoutGrid className="h-4 w-4" />
            </Button>
          </div>
        ),
        render: (a) => (
          <AirbrushingFilesSection
            files={getAirbrushingLayouts(a)}
            viewMode={layoutsView}
            onViewModeChange={setLayoutsView}
            hideToolbar
            layoutStatusByFileId={getAirbrushingLayoutStatuses(a)}
            canApproveLayouts={canApproveLayouts}
            onLayoutStatusChange={handleLayoutStatusChange}
            emptyIcon={IconPhoto}
            emptyTitle="Nenhum layout cadastrado"
            emptyDescription="Esta aerografia não possui layouts anexados."
          />
        ),
      });
    }

    // --- Notas Fiscais Anexadas (financial-only) ---
    // O DANFSe gerado pelo sistema é conectado pelo servidor na MESMA relação
    // (AIRBRUSHING_INVOICES) em que caem os anexos manuais. Aqui ele sai da lista: seu lugar
    // é a seção "NFS-e do Aerografista", junto do XML. O filtro é por `pdfFileId` e nada
    // mais — em notas antigas (pdfFileId nulo) o PDF simplesmente continua entre os anexos,
    // que é melhor do que adivinhar por nome de arquivo e esconder o anexo errado.
    //
    // A seção continua existindo mesmo com a subtração: há arquivos que usuários anexaram à
    // mão e sumir com eles seria perda de dado visível.
    const attachedInvoices = (airbrushing?.invoices ?? []).filter((f) => f.id !== nfse?.pdfFileId);
    if (attachedInvoices.length > 0) {
      list.push({
        id: "invoices",
        label: "Notas Fiscais Anexadas",
        icon: IconFileInvoice,
        span: 1,
        requiredPrivilege: MONEY_GATE,
        headerActions: (a) => <Badge variant="secondary">{(a.invoices ?? []).filter((f) => f.id !== nfse?.pdfFileId).length}</Badge>,
        render: (a) => (
          <AirbrushingFilesSection
            files={(a.invoices ?? []).filter((f) => f.id !== nfse?.pdfFileId)}
            emptyIcon={IconFileInvoice}
            emptyTitle="Nenhuma nota fiscal cadastrada"
            emptyDescription="Esta aerografia não possui notas fiscais anexadas."
          />
        ),
      });
    }

    // --- Recibos: NÃO há seção própria ---
    // Os recibos são exibidos dentro de "Preço & Pagamento" (o comprovante pertence ao
    // pagamento). Nada foi escondido: é mudança de lugar, não de visibilidade.

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
    airbrushing?.invoices,
    airbrushing?.receipts?.length,
    // A nota entra nas deps porque o `pdfFileId` decide o que sobra na galeria de anexos
    // (e alimenta os badges do cabeçalho da seção fiscal).
    nfse,
    canEdit,
    canSettlePayment,
    canManageNfse,
    handleRemoveReceipt,
    removingReceiptId,
    updateAsync,
    confirmPaymentChange,
    loadPainters,
    navigate,
    layoutsView,
  ]);

  const actions = useMemo<PageAction[]>(() => {
    if (!airbrushing) return [];
    const list: PageAction[] = [];

    // Lifecycle shortcuts, mirroring the task detail page. startedAt/finishedAt are
    // stamped server-side from the transition, so they are deliberately not sent here.
    if (canRelease && airbrushing.status === AIRBRUSHING_STATUS.PREPARATION) {
      list.push({
        key: "disponibilizar",
        label: "Disponibilizar para Produção",
        icon: IconPlayerPlay,
        variant: "default",
        onClick: () => void updateAsync({ id: airbrushing.id, data: { status: AIRBRUSHING_STATUS.WAITING_PRODUCTION } }),
      });
    } else if (canEdit && airbrushing.status === AIRBRUSHING_STATUS.WAITING_PRODUCTION) {
      list.push({
        key: "iniciar",
        label: "Iniciar Produção",
        icon: IconPlayerPlay,
        variant: "default",
        onClick: () => void updateAsync({ id: airbrushing.id, data: { status: AIRBRUSHING_STATUS.IN_PRODUCTION } }),
      });
    } else if (canEdit && airbrushing.status === AIRBRUSHING_STATUS.IN_PRODUCTION) {
      list.push({
        key: "finalizar",
        label: "Finalizar",
        icon: IconCheck,
        variant: "default",
        onClick: () => void updateAsync({ id: airbrushing.id, data: { status: AIRBRUSHING_STATUS.COMPLETED } }),
      });
    }

    if (canEdit) list.push({ key: "edit", label: "Editar", icon: IconEdit, variant: "default", onClick: () => navigate(routes.production.airbrushings.edit(airbrushing.id)) });
    if (canDelete) list.push({ key: "delete", label: "Excluir", icon: IconTrash, onClick: () => setShowDeleteDialog(true) });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [airbrushing, canEdit, canDelete, canRelease, updateAsync, navigate]);

  return (
    <>
      <DetailPage<Airbrushing>
        detailKey="airbrushing-detail"
        // Sem `attention`: a aerografia não tem regra (ver lib/attention/rules.ts, seção Produção).
        data={airbrushing}
        isLoading={isLoading}
        error={error ? "Aerografia não encontrada" : undefined}
        emptyMessage="A aerografia que você está procurando não existe ou foi removida do sistema."
        sections={sections}
        title={airbrushing?.task?.name ?? "Aerografia"}
        icon={IconBrush}
        actions={actions}
        hideEmptyFields
        breadcrumbs={
          (location.state as { from?: string } | null)?.from === "payables"
            ? [
                // Arrived from Contas a Pagar — reflect the path actually taken
                // instead of the Produção/Aerografia trail.
                { label: "Início", href: routes.home },
                { label: "Financeiro", href: routes.financial.root },
                { label: "Contas a Pagar", href: routes.financial.accountsPayable.root },
                { label: airbrushing?.task?.name ?? "Detalhe" },
              ]
            : [
                { label: "Início", href: routes.home },
                { label: "Produção", href: canOpenProductionRoot ? routes.production.root : undefined },
                { label: "Aerografia", href: routes.production.airbrushings.root },
                { label: airbrushing?.task?.name ?? "Detalhe" },
              ]
        }
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
