import { useCallback, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  IconShoppingCart,
  IconPackage,
  IconCreditCard,
  IconReceipt,
  IconHistory,
  IconTruck,
  IconId,
  IconFileText,
  IconCalendar,
  IconCurrencyReal,
  IconNotes,
  IconUser,
  IconQrcode,
  IconCopy,
  IconEdit,
  IconTrash,
  IconShoppingCart as IconCart,
  IconCheck,
  IconLoader2,
  IconCircleDot,
  IconCashBanknote,
} from "@tabler/icons-react";
import { DetailPage } from "@/components/ui/detailpage";
import type { DetailSectionDef } from "@/components/ui/detailpage";
import type { PageAction } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { SupplierLogoDisplay } from "@/components/ui/avatar-display";
import { ChangelogHistory } from "@/components/ui/changelog-history";
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
import { canEditOrders } from "@/utils/permissions/entity-permissions";
import { useOrder, useOrderMutations, useCanViewPrices } from "../../../../hooks";
import {
  routes,
  ORDER_STATUS,
  ORDER_STATUS_LABELS,
  CHANGE_LOG_ENTITY_TYPE,
  SECTOR_PRIVILEGES,
  PAYMENT_METHOD,
  PAYMENT_METHOD_LABELS,
  ORDER_PAYMENT_STATUS,
  ORDER_PAYMENT_STATUS_LABELS,
} from "../../../../constants";
import { getSuppliers } from "@/api-client/supplier";
import { getUsers } from "@/api-client/user";
import { formatDateTime, formatCurrency, formatPixKey, formatCNPJ } from "../../../../utils";
import { formatOrderNumber } from "@/utils/order-code";
import type { Order } from "../../../../types";
import { OrderStatusBadge } from "../common/order-status-badge";
import { OrderPaymentStatusBadge } from "../common/order-payment-status-badge";
import { OrderTotalBadge } from "../common/order-total-calculator";
import { OrderItemsCard } from "../detail/order-items-card";
import { OrderDocumentsSection } from "./order-documents-section";
import { OrderPaymentExtras } from "./order-payment-extras";

// Price viewers among the page audience (everyone except WAREHOUSE) — faithful gate for the legacy
// `canViewPrices` (WAREHOUSE never sees money). ADMIN always passes via the gate.
const PRICE_VIEW_PRIVILEGES = [SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.ADMIN];

// Valid forward transitions for inline status edits (the current value is always kept by the editor).
// Mirrors the order lifecycle; RECEIVED/CANCELLED are terminal. CANCELLED is always reachable while
// the order is still open.
const ORDER_STATUS_TRANSITIONS: Record<string, ORDER_STATUS[]> = {
  [ORDER_STATUS.CREATED]: [ORDER_STATUS.PARTIALLY_FULFILLED, ORDER_STATUS.FULFILLED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PARTIALLY_FULFILLED]: [ORDER_STATUS.FULFILLED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.FULFILLED]: [ORDER_STATUS.PARTIALLY_RECEIVED, ORDER_STATUS.RECEIVED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PARTIALLY_RECEIVED]: [ORDER_STATUS.RECEIVED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.OVERDUE]: [ORDER_STATUS.FULFILLED, ORDER_STATUS.RECEIVED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.RECEIVED]: [],
  [ORDER_STATUS.CANCELLED]: [],
};

const muted = (v: string | null | undefined) => (v ? <span>{v}</span> : <span className="text-muted-foreground">—</span>);

// Computed grand total for an order: items (price×qty + ICMS/IPI) − discount% on goods subtotal + freight.
// Mirrors OrderTotalBadge so the inline-edit fallback and the badge agree.
const computedOrderTotal = (o: Order): number => {
  let goodsSubtotal = 0;
  const total = (o.items ?? []).reduce((acc, it) => {
    const subtotal = it.orderedQuantity * it.price;
    const taxAmount = subtotal * ((it.icms ?? 0) / 100) + subtotal * ((it.ipi ?? 0) / 100);
    goodsSubtotal += subtotal;
    return acc + subtotal + taxAmount;
  }, 0);
  const discountAmount = (o.discount ?? 0) > 0 ? goodsSubtotal * ((o.discount ?? 0) / 100) : 0;
  return total - discountAmount + (o.freight ?? 0);
};

export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const canViewPrices = useCanViewPrices();
  const canManageWarehouse = canEditOrders(user);
  const { isAdmin } = usePrivileges();
  const { deleteMutation, updateAsync, markPaidAsync, markAwaitingPaymentAsync, requestPaymentAsync } = useOrderMutations();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);

  // Promise-based confirm for the inline "Status de Pagamento" edit. Settling / un-settling money
  // (markPaid / markAwaitingPayment) must be confirmed first — the legacy payment card gated this
  // behind an AlertDialog; `beforeCommit` awaits this before the status actually changes.
  const [paymentConfirm, setPaymentConfirm] = useState<{ open: boolean; target: ORDER_PAYMENT_STATUS | null }>({ open: false, target: null });
  const paymentConfirmResolver = useRef<((ok: boolean) => void) | null>(null);
  const confirmPaymentChange = useCallback((target: ORDER_PAYMENT_STATUS): Promise<boolean> => {
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

  const {
    data: response,
    isLoading,
    error,
    refetch,
  } = useOrder(id!, {
    include: {
      items: { include: { item: { include: { brands: true, measures: true, category: true } }, temporaryItemCategory: true } },
      supplier: { include: { logo: true } },
      receipts: true,
      paymentResponsible: true,
      paymentAssignedBy: true,
      installments: true,
    },
    enabled: !!id,
  });

  const order = response?.data as Order | undefined;

  const handleOrderUpdate = () => refetch();

  const handleDelete = async () => {
    if (!order) return;
    try {
      await deleteMutation.mutateAsync(order.id);
      navigate(routes.inventory.orders.list);
    } catch (e) {
      if (process.env.NODE_ENV !== "production") console.error("Error deleting order:", e);
    }
  };

  const handleCompleteOrder = async () => {
    if (!order) return;
    try {
      await updateAsync({ id: order.id, data: { status: ORDER_STATUS.RECEIVED } });
      setShowCompleteDialog(false);
      refetch();
    } catch (e) {
      if (process.env.NODE_ENV !== "production") console.error("Error completing order:", e);
    }
  };

  // --- order lifecycle / payment actions (rendered inside the Itens do Pedido card toolbar) ---
  const orderActions = useMemo(() => {
    if (!order) return [];
    const allItemsFulfilled = order.items?.every((item) => item.fulfilledAt !== null) ?? false;
    let isInFulfillmentPhase = false;
    let isInReceivingPhase = false;
    if (order.status === ORDER_STATUS.OVERDUE) {
      isInReceivingPhase = allItemsFulfilled;
      isInFulfillmentPhase = !allItemsFulfilled;
    } else if ([ORDER_STATUS.CREATED, ORDER_STATUS.PARTIALLY_FULFILLED].includes(order.status)) {
      isInFulfillmentPhase = true;
    } else if ([ORDER_STATUS.FULFILLED, ORDER_STATUS.PARTIALLY_RECEIVED].includes(order.status)) {
      isInReceivingPhase = true;
    }

    const list: Array<{ key: string; label: string; icon?: any; tone?: "blue" | "green"; onClick: () => void }> = [];
    if (canManageWarehouse && isInFulfillmentPhase && order.status !== ORDER_STATUS.CANCELLED) {
      list.push({
        key: "fulfill",
        label: "Marcar como Feito",
        icon: IconCart,
        tone: "blue",
        onClick: async () => {
          try {
            await updateAsync({ id: order.id, data: { status: ORDER_STATUS.FULFILLED } });
            const itemIds = order.items?.map((item) => item.id) || [];
            if (itemIds.length > 0) {
              const { batchMarkOrderItemsFulfilled } = await import("../../../../api-client");
              await batchMarkOrderItemsFulfilled(itemIds);
            }
            refetch();
          } catch (e) {
            if (process.env.NODE_ENV !== "production") console.error("Error marking order as done:", e);
          }
        },
      });
    }
    if (canManageWarehouse && isInReceivingPhase && order.status !== ORDER_STATUS.RECEIVED && order.status !== ORDER_STATUS.CANCELLED) {
      list.push({ key: "complete", label: "Marcar como Recebido", icon: IconCheck, tone: "green", onClick: () => setShowCompleteDialog(true) });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, canManageWarehouse, updateAsync]);

  // Main-field inline edits are available to order managers (WAREHOUSE/ADMIN) only while the order is
  // still open — a RECEIVED or CANCELLED order is read-only. Financial fields are gated separately by
  // PRICE_VIEW_PRIVILEGES (financial/accounting/admin) and only blocked once the order is CANCELLED.
  const isCancelled = order?.status === ORDER_STATUS.CANCELLED;
  const canEdit = !!order && canManageWarehouse && ![ORDER_STATUS.RECEIVED, ORDER_STATUS.CANCELLED].includes(order.status);
  // The total-override edit is gated only by the financial price-view privilege (editablePrivilege) and
  // by lifecycle: a RECEIVED or CANCELLED order is locked.
  const isReceivedOrCancelled = !!order && [ORDER_STATUS.RECEIVED, ORDER_STATUS.CANCELLED].includes(order.status);

  // Async option loader for the Fornecedor inline-edit combobox.
  const loadSuppliers = useCallback(async (search: string, page = 1) => {
    const limit = 100;
    const res = (await getSuppliers({ searchingFor: search, page, limit, orderBy: { fantasyName: "asc" } } as never)) as {
      data?: Array<{ id: string; fantasyName?: string }>;
    };
    const out = (res?.data ?? []).map((s) => ({ value: s.id, label: s.fantasyName || s.id }));
    return { data: out, hasMore: out.length === limit };
  }, []);

  // Async option loader for the Responsável pelo Pagamento inline-edit combobox.
  const loadUsers = useCallback(async (search: string, page = 1) => {
    const limit = 100;
    const res = (await getUsers({ searchingFor: search, page, limit, orderBy: { name: "asc" } } as never)) as {
      data?: Array<{ id: string; name?: string }>;
    };
    const out = (res?.data ?? []).map((u) => ({ value: u.id, label: u.name || u.id }));
    return { data: out, hasMore: out.length === limit };
  }, []);

  const sections = useMemo<DetailSectionDef<Order>[]>(() => {
    const list: DetailSectionDef<Order>[] = [];

    // --- Informações do Pedido ---
    list.push({
      id: "info",
      label: "Informações do Pedido",
      icon: IconPackage,
      span: 1,
      fields: [
        {
          id: "status",
          label: "Status",
          icon: IconCircleDot,
          dataType: "enum",
          accessor: (o) => o.status,
          render: (o) => (
            <div className="flex items-center justify-end gap-2">
              <OrderStatusBadge status={o.status} />
            </div>
          ),
          edit: canEdit
            ? {
                get: (o) => o.status,
                enum: {
                  values: Object.values(ORDER_STATUS),
                  labels: ORDER_STATUS_LABELS,
                  badgeEntity: "ORDER",
                  transitions: (current) => [current, ...(ORDER_STATUS_TRANSITIONS[current] ?? [])],
                },
                onCommit: async (v, o) => {
                  await updateAsync({ id: o.id, data: { status: v as ORDER_STATUS } });
                },
              }
            : undefined,
        },
        {
          id: "supplier",
          label: "Fornecedor",
          icon: IconTruck,
          dataType: "relation",
          editablePrivilege: SECTOR_PRIVILEGES.WAREHOUSE,
          accessor: (o) => o.supplier?.fantasyName ?? null,
          render: (o) =>
            o.supplier ? (
              <div className="flex items-center gap-2.5">
                <SupplierLogoDisplay logo={o.supplier.logo} supplierName={o.supplier.fantasyName} size="sm" shape="rounded" />
                <span className="text-sm font-semibold text-foreground">{o.supplier.fantasyName}</span>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground italic">Nenhum fornecedor associado</span>
            ),
          edit: canEdit
            ? {
                get: (o) => o.supplierId,
                loadOptions: loadSuppliers,
                options: order?.supplier ? [{ value: order.supplier.id, label: order.supplier.fantasyName || "" }] : undefined,
                placeholder: "Buscar fornecedor...",
                onCommit: async (v, o) => {
                  await updateAsync({ id: o.id, data: { supplierId: (v as string) || undefined } });
                },
              }
            : undefined,
        },
        {
          id: "supplierCnpj",
          label: "CNPJ",
          icon: IconId,
          accessor: (o) => o.supplier?.cnpj ?? null,
          render: (o) => (o.supplier?.cnpj ? <span className="tabular-nums">{formatCNPJ(o.supplier.cnpj)}</span> : muted(null)),
        },
        {
          id: "orderNumber",
          label: "Número do Pedido",
          icon: IconId,
          accessor: (o) => (o.orderNumber != null ? formatOrderNumber(o.orderNumber) : null),
          render: (o) => (
            <span className="flex items-center gap-2">
              <span className="tabular-nums">{o.orderNumber != null ? formatOrderNumber(o.orderNumber) : "—"}</span>
              {o.items?.some((it) => it.temporaryItemDescription) && (
                <Badge variant="outline" className="text-xs">
                  Temporário
                </Badge>
              )}
            </span>
          ),
        },
        {
          id: "description",
          label: "Descrição",
          icon: IconFileText,
          dataType: "text",
          editablePrivilege: SECTOR_PRIVILEGES.WAREHOUSE,
          accessor: (o) => o.description ?? null,
          edit: canEdit
            ? {
                get: (o) => o.description ?? "",
                onCommit: async (v, o) => {
                  await updateAsync({ id: o.id, data: { description: (v as string) || undefined } });
                },
              }
            : undefined,
        },
        {
          id: "forecast",
          label: "Previsão de Entrega",
          icon: IconCalendar,
          dataType: "date",
          editablePrivilege: SECTOR_PRIVILEGES.WAREHOUSE,
          accessor: (o) => o.forecast ?? null,
          edit: canEdit
            ? {
                get: (o) => o.forecast ?? null,
                onCommit: async (v, o) => {
                  await updateAsync({ id: o.id, data: { forecast: (v as Date) ?? null } });
                },
              }
            : undefined,
        },
        { id: "createdAt", label: "Data do Pedido", icon: IconCalendar, dataType: "datetime", accessor: (o) => o.createdAt, render: (o) => <span>{formatDateTime(o.createdAt)}</span> },
        { id: "updatedAt", label: "Atualizado em", icon: IconCalendar, dataType: "datetime", accessor: (o) => o.updatedAt ?? null },
        {
          id: "origin",
          label: "Origem",
          accessor: (o) => (o.orderSchedule ? "Agendado" : null),
          render: (o) => (o.orderSchedule ? <Badge variant="outline">Agendado</Badge> : <span className="text-muted-foreground">—</span>),
        },
        {
          id: "freight",
          label: "Frete",
          icon: IconTruck,
          dataType: "money",
          requiredPrivilege: PRICE_VIEW_PRIVILEGES,
          // Hide (via hideEmptyFields) when there's no freight — legacy only showed it when > 0.
          accessor: (o) => ((o.freight ?? 0) > 0 ? o.freight : null),
          render: (o) => <span>{formatCurrency(o.freight ?? 0)}</span>,
        },
        {
          id: "notes",
          label: "Observações",
          icon: IconNotes,
          dataType: "textarea",
          block: true,
          editablePrivilege: SECTOR_PRIVILEGES.WAREHOUSE,
          accessor: (o) => o.notes ?? null,
          edit: canEdit
            ? {
                get: (o) => o.notes ?? "",
                onCommit: async (v, o) => {
                  await updateAsync({ id: o.id, data: { notes: (v as string) ?? "" } });
                },
              }
            : undefined,
        },
      ],
    });

    // --- Pagamento (financial-only) ---
    list.push({
      id: "payment",
      label: "Pagamento",
      icon: IconCreditCard,
      span: 1,
      requiredPrivilege: PRICE_VIEW_PRIVILEGES,
      fields: [
        {
          id: "total",
          label: "Valor Total",
          icon: IconCurrencyReal,
          dataType: "money",
          requiredPrivilege: PRICE_VIEW_PRIVILEGES,
          editablePrivilege: PRICE_VIEW_PRIVILEGES,
          // Effective total: the manual override when set, else the computed total.
          accessor: (o) => o.totalOverride ?? computedOrderTotal(o),
          render: (o) => <OrderTotalBadge orderItems={o.items} discount={o.discount} freight={o.freight} totalOverride={o.totalOverride} />,
          // Inline edit (financial privilege + order still open): a number sets a manual grand-total
          // override; clearing the field reverts to the automatic computed total (null).
          edit: !isReceivedOrCancelled
            ? {
                get: (o) => o.totalOverride ?? computedOrderTotal(o),
                placeholder: "Total automático",
                min: 0,
                onCommit: async (v, o) => {
                  const n = typeof v === "number" ? v : v == null || v === "" ? null : parseFloat(v as string);
                  const next = n != null && Number.isFinite(n) && n >= 0 ? n : null;
                  await updateAsync({ id: o.id, data: { totalOverride: next } });
                },
              }
            : undefined,
        },
        {
          id: "paymentStatus",
          label: "Status de Pagamento",
          icon: IconCreditCard,
          dataType: "enum",
          editablePrivilege: PRICE_VIEW_PRIVILEGES,
          accessor: (o) => o.paymentStatus ?? null,
          render: (o) => (o.paymentStatus ? <OrderPaymentStatusBadge status={o.paymentStatus} paymentMethod={o.paymentMethod} /> : muted(null)),
          // The order update endpoint doesn't accept paymentStatus — transition via the dedicated
          // markPaid / markAwaitingPayment endpoints. PARTIALLY_PAID is server-derived (set only by
          // partial installment payments), so it's only ever the current value, never a manual target.
          edit: !isCancelled
            ? {
                get: (o) => o.paymentStatus ?? null,
                enum: {
                  values: Object.values(ORDER_PAYMENT_STATUS),
                  labels: ORDER_PAYMENT_STATUS_LABELS,
                  badgeEntity: "ORDER_PAYMENT",
                  transitions: (current) =>
                    // A still-PENDING order leaves PENDING only via the admin "Requisitar Pagamento"
                    // action — the inline editor offers no targets for it.
                    current === ORDER_PAYMENT_STATUS.PENDING
                      ? [ORDER_PAYMENT_STATUS.PENDING]
                      : Array.from(new Set([current, ORDER_PAYMENT_STATUS.AWAITING_PAYMENT, ORDER_PAYMENT_STATUS.PAID].filter(Boolean))),
                },
                // Confirm before settling/un-settling money — a no-op (same status) commits silently.
                beforeCommit: (v, o) => {
                  if (v === o.paymentStatus) return true;
                  return confirmPaymentChange(v as ORDER_PAYMENT_STATUS);
                },
                onCommit: async (v, o) => {
                  if (v === o.paymentStatus) return;
                  if (v === ORDER_PAYMENT_STATUS.PAID) await markPaidAsync(o.id);
                  else if (v === ORDER_PAYMENT_STATUS.AWAITING_PAYMENT) await markAwaitingPaymentAsync(o.id);
                },
              }
            : undefined,
        },
        {
          id: "paymentResponsible",
          label: "Responsável pelo Pagamento",
          icon: IconUser,
          dataType: "relation",
          editablePrivilege: PRICE_VIEW_PRIVILEGES,
          accessor: (o) => o.paymentResponsible?.name ?? null,
          edit: !isCancelled
            ? {
                get: (o) => o.paymentResponsibleId ?? null,
                options: order?.paymentResponsible ? [{ value: order.paymentResponsible.id, label: order.paymentResponsible.name ?? order.paymentResponsible.id }] : undefined,
                loadOptions: loadUsers,
                onCommit: async (v, o) => {
                  await updateAsync({ id: o.id, data: { paymentResponsibleId: (v as string) || null } });
                },
              }
            : undefined,
        },
        {
          id: "paymentMethod",
          label: "Forma de Pagamento",
          icon: IconCreditCard,
          dataType: "enum",
          editablePrivilege: PRICE_VIEW_PRIVILEGES,
          accessor: (o) => (o.paymentMethod ? PAYMENT_METHOD_LABELS[o.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS] : null),
          render: (o) =>
            o.paymentMethod ? <Badge variant="outline">{PAYMENT_METHOD_LABELS[o.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS]}</Badge> : muted(null),
          edit: !isCancelled
            ? {
                get: (o) => o.paymentMethod ?? null,
                enum: { values: Object.values(PAYMENT_METHOD), labels: PAYMENT_METHOD_LABELS },
                onCommit: async (v, o) => {
                  await updateAsync({ id: o.id, data: { paymentMethod: (v as PAYMENT_METHOD) ?? null } });
                },
              }
            : undefined,
        },
        {
          id: "pix",
          label: "Chave Pix",
          icon: IconQrcode,
          editablePrivilege: PRICE_VIEW_PRIVILEGES,
          accessor: (o) => (o.paymentMethod === "PIX" && o.paymentPix ? formatPixKey(o.paymentPix) : null),
          edit:
            !isCancelled && order?.paymentMethod === "PIX"
              ? {
                  get: (o) => o.paymentPix ?? "",
                  placeholder: "Chave Pix",
                  onCommit: async (v, o) => {
                    await updateAsync({ id: o.id, data: { paymentPix: (v as string) || null } });
                  },
                }
              : undefined,
          render: (o) =>
            o.paymentMethod === "PIX" && o.paymentPix ? (
              <div className="flex flex-col items-end gap-1 min-w-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    navigator.clipboard.writeText(o.paymentPix!);
                    toast.success("Chave Pix copiada!");
                  }}
                >
                  <IconCopy className="h-4 w-4 mr-1" />
                  Copiar
                </Button>
                <span className="text-sm font-semibold text-foreground font-mono break-all text-right">{formatPixKey(o.paymentPix!)}</span>
              </div>
            ) : (
              muted(null)
            ),
        },
        {
          id: "parcelas",
          label: "Parcelas",
          accessor: (o) => (o.paymentMethod === "BANK_SLIP" && (o.installmentCount || 1) > 1 ? `${o.installmentCount}x` : null),
        },
        // Pago em is derived from the payment-status transition (inline "Status de Pagamento" edit) —
        // the order update endpoint doesn't accept paidAt, so it stays read-only here.
        { id: "paidAt", label: "Pago em", icon: IconCalendar, dataType: "datetime", accessor: (o) => o.paidAt ?? null },
      ],
      render: (o) => <OrderPaymentExtras order={o} />,
    });

    // --- Comprovantes (only when the order has files, like the legacy side card) ---
    if ((order?.receipts?.length || 0) > 0) {
      list.push({
        id: "documents",
        label: "Comprovantes",
        icon: IconReceipt,
        span: 1,
        render: (o) => <OrderDocumentsSection order={o} />,
      });
    }

    // --- Itens do Pedido (embedded items table + lifecycle/payment toolbar) ---
    list.push({
      id: "items",
      label: "Itens do Pedido",
      icon: IconPackage,
      span: 2,
      required: true,
      render: (o) => <OrderItemsCard embedded order={o} className="w-full" onOrderUpdate={handleOrderUpdate} orderActions={orderActions as any} />,
    });

    // --- Histórico ---
    list.push({
      id: "changelog",
      // Full-width: the changelog is a wide timeline and is the last section, so a half-width span
      // would leave an empty right column. (Matches the user/task detail changelog, also full-width.)
      span: 2,
      label: "Histórico",
      icon: IconHistory,
      scroll: true,
      render: (o) => (
        <ChangelogHistory embedded entityType={CHANGE_LOG_ENTITY_TYPE.ORDER} entityId={o.id} entityName={o.description} entityCreatedAt={o.createdAt} className="w-full" />
      ),
    });

    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.receipts?.length, order?.supplier, order?.paymentResponsible, order?.paymentMethod, orderActions, canEdit, isCancelled, isReceivedOrCancelled, updateAsync, markPaidAsync, markAwaitingPaymentAsync, confirmPaymentChange, loadSuppliers, loadUsers]);

  const actions = useMemo<PageAction[]>(() => {
    if (!order) return [];
    const canEdit = canManageWarehouse && ![ORDER_STATUS.RECEIVED, ORDER_STATUS.CANCELLED].includes(order.status);
    const list: PageAction[] = [];
    if (canEdit) list.push({ key: "edit", label: "Editar", icon: IconEdit, variant: "default", onClick: () => navigate(routes.inventory.orders.edit(order.id)) });
    // ADMIN: move a still-PENDING order into AWAITING_PAYMENT so accounting can pay it.
    if (isAdmin && order.paymentStatus === ORDER_PAYMENT_STATUS.PENDING) {
      list.push({
        key: "request-payment",
        label: "Requisitar Pagamento",
        icon: IconCashBanknote,
        onClick: async () => {
          try {
            await requestPaymentAsync(order.id);
            refetch();
          } catch (e) {
            if (process.env.NODE_ENV !== "production") console.error("Error requesting payment:", e);
          }
        },
      });
    }
    if (canManageWarehouse) list.push({ key: "delete", label: "Excluir", icon: IconTrash, onClick: () => setShowDeleteDialog(true) });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, canManageWarehouse, isAdmin, requestPaymentAsync, navigate]);

  return (
    <>
      <DetailPage<Order>
        detailKey="order-detail"
        data={order}
        isLoading={isLoading}
        error={error ? "Pedido não encontrado" : undefined}
        emptyMessage="O pedido que você está procurando não existe ou foi removido do sistema."
        sections={sections}
        title={order?.description ?? "Pedido"}
        icon={IconShoppingCart}
        actions={actions}
        hideEmptyFields
        breadcrumbs={
          (location.state as { from?: string } | null)?.from === "payables"
            ? [
                // Arrived from Contas a Pagar — reflect the path actually taken
                // instead of the Estoque/Pedidos trail (which ACCOUNTING can't open).
                { label: "Início", href: routes.home },
                { label: "Financeiro", href: routes.financial.root },
                { label: "Contas a Pagar", href: routes.financial.accountsPayable.root },
                { label: order?.description ?? "Detalhe" },
              ]
            : [
                { label: "Início", href: routes.home },
                // ACCOUNTING can open an order's detail page directly (e.g. from Contas a
                // Pagar) but has no access to "Estoque" / the orders list — those ancestor
                // crumbs must render as plain (non-clickable) labels for it, not links
                // into pages it would be denied.
                { label: "Estoque", href: canManageWarehouse ? routes.inventory.root : undefined },
                { label: "Pedidos", href: canManageWarehouse ? routes.inventory.orders.list : undefined },
                { label: order?.description ?? "Detalhe" },
              ]
        }
        navigation={{
          ids: (location.state as { ids?: string[] } | null)?.ids,
          toRoute: (rid) => routes.inventory.orders.details(rid),
        }}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este pedido? Esta ação não pode ser desfeita.
              <br />
              <br />
              <strong>Fornecedor:</strong> {order?.supplier?.fantasyName || "Não especificado"}
              {canViewPrices && order && (
                <>
                  <br />
                  <strong>Valor Total:</strong> <OrderTotalBadge orderItems={order.items} discount={order.discount} freight={order.freight} totalOverride={order.totalOverride} />
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Complete Order Confirmation Dialog */}
      <AlertDialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Recebimento Total</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja marcar este pedido como totalmente recebido?
              <br />
              <br />
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                <p className="text-sm">
                  <span className="font-medium">Fornecedor:</span> {order?.supplier?.fantasyName || "Não especificado"}
                </p>
                {canViewPrices && order && (
                  <p className="text-sm">
                    <span className="font-medium">Valor Total:</span> <OrderTotalBadge orderItems={order.items} discount={order.discount} freight={order.freight} totalOverride={order.totalOverride} />
                  </p>
                )}
                <p className="text-sm">
                  <span className="font-medium">Itens:</span> {order?.items?.length || 0}
                </p>
              </div>
              <br />
              Esta ação irá:
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Marcar o pedido como completamente recebido</li>
                <li>Registrar a data de conclusão</li>
                <li>Criar atividades de entrada para todos os itens</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCompleteOrder}>
              {false ? (
                <>
                  <IconLoader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <IconCheck className="mr-2 h-4 w-4" />
                  Confirmar Recebimento
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment-status change confirmation — gates the inline edit that settles / un-settles money. */}
      <AlertDialog open={paymentConfirm.open} onOpenChange={(o) => !o && settlePaymentConfirm(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {paymentConfirm.target === ORDER_PAYMENT_STATUS.PAID ? "Confirmar pagamento" : "Desfazer pagamento"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {paymentConfirm.target === ORDER_PAYMENT_STATUS.PAID
                ? "Marcar este pedido como pago? Isso registra a liquidação do pagamento."
                : "Desfazer o pagamento deste pedido? Ele voltará para aguardando pagamento."}
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
