import { useMemo } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { QuoteStatusBadge } from "@/components/production/task/quote/quote-status-badge";
import { formatCurrency, formatDate, formatChassis, formatCNPJ, formatCPF, formatPhone, formatPaidInstallmentLabel, formatInstallmentPaymentForm } from "@/utils";
import { resolveTomadorContact } from "@/lib/nfse-tomador-contact";
import { TRUCK_CATEGORY_LABELS, IMPLEMENT_TYPE_LABELS } from "@/constants/enum-labels";
import type { TRUCK_CATEGORY, IMPLEMENT_TYPE } from "@/constants/enums";
import { generatePaymentText } from "@/utils/quote-text-generators";
import { BoletoActions } from "@/components/production/task/billing/boleto-actions";
import { NfseStatusBadge } from "@/components/production/task/billing/nfse-status-badge";
import { NfseActions } from "@/components/production/task/billing/nfse-actions";
import { useNfseDetail } from "@/hooks/financial/use-nfse";
import { canUpdateQuoteStatus, getAvailableQuoteStatusTransitions } from "@/utils/permissions/quote-permissions";
import type { Invoice } from "@/types/invoice";
import type { TASK_QUOTE_STATUS } from "@/types/task-quote";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { IconFileInvoice, IconCurrencyReal, IconBuilding, IconTruck, IconCreditCard, IconReceipt, IconDownload, IconEye, IconLoader2, IconFolderCheck, IconCameraCheck, IconCameraBolt, IconExternalLink } from "@tabler/icons-react";
import { cn, getApiBaseUrl } from "@/lib/utils";
import { useState, useCallback } from "react";
import { invoiceService } from "@/api-client/invoice";
import { nfseService } from "@/api-client/nfse";
import { taskQuoteService } from "@/api-client/task-quote";
import { SERVICE_ORDER_TYPE } from "@/constants/enums";
import { FileThumbnail, useFileViewer } from "@/components/common/file";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { useNavigate } from "react-router-dom";
import { routes } from "@/constants";
import { exportTaskDossiePdf } from "@/components/production/task/detail/sections/dossie-section";
import { attentionFieldClass, useAttentionField } from "@/lib/attention";
import { missingBillingCustomerKeys, missingBillingCustomerLabels, NFSE_DOCUMENT_KEY } from "@/lib/billing-customer-data";
import { PINNED_CUSTOMERS } from "@/config/company";

// Must match the page's own list (`pages/financial/billing/details/[id].tsx`) — the two gates run
// on the same transition, and disagreeing meant this dialog waved through a status the page then
// refused. BUDGET_APPROVED is also the window `task-quote.billing-customer-incomplete` fires in.
const STATUSES_REQUIRING_COMPLETE_DATA = ["BUDGET_APPROVED", "BILLING_APPROVED"];

// Canonical label map for every quote status (used for the trigger-render fallback).
const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  BUDGET_APPROVED: "Orçamento Aprovado",
  BILLING_APPROVED: "Faturamento Aprovado",
  UPCOMING: "A Vencer",
  DUE: "Vencido",
  PARTIAL: "Parcial",
  SETTLED: "Liquidado",
};

// Synthetic combobox option that triggers the revert-billing flow instead of a status change.
const REVERT_OPTION_VALUE = "__REVERT_BILLING__";

// Statuses meaning billing has already been approved (invoice/NF/boleto exist or are generating).
// Pre-billing (e.g. BUDGET_APPROVED) → the forward action is to APPROVE faturamento, which
// generates the documents. Post-billing → the only manual actions are revert or mark-as-settled.
const POST_BILLING_STATUSES = ["BILLING_APPROVED", "UPCOMING", "DUE", "PARTIAL", "SETTLED"];

// Action-oriented (verb) labels for selectable options, vs STATUS_LABELS (the state name shown in
// the trigger). e.g. the BILLING_APPROVED option reads "Aprovar Faturamento", but once current it
// reads "Faturamento Aprovado".
const ACTION_LABELS: Record<string, string> = {
  BILLING_APPROVED: "Aprovar Faturamento",
  SETTLED: "Liquidado",
};

// Statuses that are set automatically and cannot be manually selected (shown disabled for context)
const AUTOMATIC_STATUSES = ["UPCOMING", "DUE", "PARTIAL"];

const getStatusTriggerClass = (status: string) => {
  const map: Record<string, string> = {
    PENDING: "bg-neutral-500 text-white hover:bg-neutral-600 border-neutral-600",
    BUDGET_APPROVED: "bg-blue-700 text-white hover:bg-blue-800 border-blue-800",
    BILLING_APPROVED: "bg-green-700 text-white hover:bg-green-800 border-green-800",
    UPCOMING: "bg-amber-600 text-white hover:bg-amber-700 border-amber-700",
    DUE: "bg-red-600 text-white hover:bg-red-700 border-red-700",
    PARTIAL: "bg-blue-700 text-white hover:bg-blue-800 border-blue-800",
    SETTLED: "bg-green-700 text-white hover:bg-green-800 border-green-800",
  };
  return map[status] || "";
};

interface BillingStepReviewProps {
  task: any;
  customersCache: React.MutableRefObject<Map<string, any>>;
  invoices?: Invoice[];
  userPrivilege?: string;
  disabled?: boolean;
  isGenerating?: boolean;
  /** When set, filters to show only this customer's data */
  filterCustomerId?: string;
}

export function BillingStepReview({ task, customersCache, invoices = [], userPrivilege = "", disabled, isGenerating = false, filterCustomerId }: BillingStepReviewProps) {
  const navigate = useNavigate();
  const { control, setValue } = useFormContext();
  const currentStatus = useWatch({ control, name: "status" }) || "";
  const services = useWatch({ control, name: "services" }) || [];
  const customerConfigs = useWatch({ control, name: "customerConfigs" }) || [];

  // Attention on the quote's `orderNumber`. The Resumo is where this page usually OPENS (it jumps
  // here whenever invoices already exist), while the editable field lives on a customer step that
  // is hidden at that moment — so without this the alert would be pointing at something the user
  // cannot see. `attentionOrderNumberFor` narrows the quote-wide signal to the one config it is
  // actually about, and returns "" for every other config so nothing else changes here.
  const orderNumberAttention = useAttentionField("TASK_QUOTE", task?.quote?.id, "orderNumber");
  const attentionOrderNumberFor = (config: any): string =>
    orderNumberAttention?.active && config?.customerId === PINNED_CUSTOMERS.IBIPORA && !config?.orderNumber
      ? attentionFieldClass(orderNumberAttention)
      : "";

  // Same idea for `task-quote.billing-customer-incomplete`: the Resumo is where the user lands
  // once a nota exists, so the cadastro gap has to be visible here too. Each summary row asks
  // about the keys IT renders, so only the row that is actually short of data lights up.
  const customerDataAttention = useAttentionField("TASK_QUOTE", task?.quote?.id, "customerData");
  const attentionCustomerFor = (config: any, keys: string[]): string => {
    if (!customerDataAttention?.active || config?.generateInvoice === false) return "";
    const missing = missingBillingCustomerKeys(config?.customerData);
    return keys.some((k) => missing.includes(k)) ? attentionFieldClass(customerDataAttention) : "";
  };

  // File viewer for dossiê images
  let fileViewerContext: ReturnType<typeof useFileViewer> | null = null;
  try {
    fileViewerContext = useFileViewer();
  } catch {
    // Context not available
  }

  const handleDossieFileClick = useCallback((file: any) => {
    if (!fileViewerContext || !task?.serviceOrders) return;
    const productionSOs = (task.serviceOrders as any[])
      .filter((so) => so.type === SERVICE_ORDER_TYPE.PRODUCTION && (so.checkinFiles?.length > 0 || so.checkoutFiles?.length > 0))
      .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
    const allFiles: any[] = [];
    for (const so of productionSOs) {
      const checkin = so.checkinFiles || [];
      const checkout = so.checkoutFiles || [];
      const maxLen = Math.max(checkin.length, checkout.length);
      for (let i = 0; i < maxLen; i++) {
        if (i < checkin.length) allFiles.push(checkin[i]);
        if (i < checkout.length) allFiles.push(checkout[i]);
      }
    }
    const index = allFiles.findIndex((f: any) => f.id === file.id);
    fileViewerContext.actions.viewFiles(allFiles, index >= 0 ? index : 0);
  }, [fileViewerContext, task?.serviceOrders]);

  const allValidServices = useMemo(
    () => services.filter((s: any) => s.description?.trim()),
    [services],
  );

  // Filter by selected customer when filterCustomerId is set
  const validServices = useMemo(() => {
    if (!filterCustomerId) return allValidServices;
    return allValidServices.filter((s: any) => s.invoiceToCustomerId === filterCustomerId || !s.invoiceToCustomerId);
  }, [allValidServices, filterCustomerId]);

  const filteredCustomerConfigs = useMemo(() => {
    if (!filterCustomerId) return customerConfigs;
    return customerConfigs.filter((c: any) => c.customerId === filterCustomerId);
  }, [customerConfigs, filterCustomerId]);

  const filteredInvoices = useMemo(() => {
    if (!filterCustomerId) return invoices;
    return invoices.filter((inv: any) => inv.customerId === filterCustomerId);
  }, [invoices, filterCustomerId]);

  const subtotal = validServices.reduce((sum: number, s: any) => sum + (Number(s?.amount) || 0), 0);
  const totalFromConfigs = customerConfigs.reduce((sum: number, c: any) => sum + (Number(c?.total) || 0), 0);
  const total = totalFromConfigs || subtotal;
  const discountAmount = Math.max(0, subtotal - total);

  const hasMultipleCustomers = !filterCustomerId && customerConfigs.length >= 2;

  // Group services by customer for multi-customer view
  const customerGroups = useMemo(() => {
    if (!hasMultipleCustomers) return null;
    const groups = new Map<string, { name: string; services: any[] }>();
    // Initialize groups from all customerConfigs so every customer appears
    for (const config of customerConfigs) {
      const cached = customersCache.current.get(config.customerId);
      const name = config.customerData?.corporateName || config.customerData?.fantasyName || cached?.corporateName || cached?.fantasyName || "Sem cliente";
      groups.set(config.customerId, { name, services: [] });
    }
    // Assign valid services to their customer group
    for (const svc of validServices) {
      const customerId = svc.invoiceToCustomerId || "__unassigned__";
      if (groups.has(customerId)) {
        groups.get(customerId)!.services.push(svc);
      } else {
        const cached = customersCache.current.get(customerId);
        const name = cached?.corporateName || cached?.fantasyName || "Sem cliente";
        groups.set(customerId, { name, services: [svc] });
      }
    }
    return groups;
  }, [hasMultipleCustomers, validServices, customersCache, customerConfigs]);

  const canChangeStatus = canUpdateQuoteStatus(userPrivilege);

  // Allowed transitions from the current status for this user.
  // Helper centralizes role + transition logic.
  const allowedNextStatuses = useMemo(() => {
    if (!currentStatus) return [] as string[];
    return getAvailableQuoteStatusTransitions(currentStatus as TASK_QUOTE_STATUS, userPrivilege);
  }, [currentStatus, userPrivilege]);

  // Reject/cancel dialog state — when downgrading to PENDING from a non-PENDING status
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [pendingDestructiveStatus, setPendingDestructiveStatus] = useState<string | null>(null);
  // Generic confirmation for non-reject destructive transitions (e.g. SETTLED -> PARTIAL)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingConfirmStatus, setPendingConfirmStatus] = useState<string | null>(null);

  // Revert billing approval state
  const [revertBillingDialogOpen, setRevertBillingDialogOpen] = useState(false);
  const [revertBillingLoading, setRevertBillingLoading] = useState(false);

  const revertableStatuses = ["BILLING_APPROVED", "UPCOMING", "DUE", "PARTIAL"];
  const canRevertBilling = canChangeStatus && revertableStatuses.includes(currentStatus);

  // Whether the revert-billing option should be offered. Mirrors the backend precondition
  // (revertBillingApproval): the revert flow itself baixa's active boletos and cancels AUTHORIZED
  // NFS-e, so they need NOT be pre-cancelled. It is only blocked when an installment is already
  // PAID, or an NFS-e is still PROCESSING/PENDING (might become AUTHORIZED).
  const canRevertForBilling = useMemo(() => {
    if (!canRevertBilling) return false;
    for (const inv of filteredInvoices) {
      const insts = (inv as any).installments || [];
      for (const inst of insts) {
        if (inst.status === 'PAID') return false;
      }
      const nfses = (inv as any).nfseDocuments || [];
      for (const n of nfses) {
        if (['PROCESSING', 'PENDING'].includes(n.status)) return false;
      }
    }
    return true;
  }, [canRevertBilling, filteredInvoices]);

  const handleRevertBilling = useCallback(async () => {
    if (!task?.quoteId) return;
    setRevertBillingLoading(true);
    try {
      await taskQuoteService.revertBilling(task.quoteId);
      window.location.reload();
    } catch {
      // Error toast is emitted by the axios error interceptor.
    } finally {
      setRevertBillingLoading(false);
      setRevertBillingDialogOpen(false);
    }
  }, [task?.quoteId]);

  // Compute paid/total installment counts for PARTIAL badge
  const installmentCounts = useMemo(() => {
    let paid = 0;
    let total = 0;
    for (const inv of filteredInvoices) {
      const insts = (inv as any).installments || [];
      for (const inst of insts) {
        if (inst.status !== 'CANCELLED') {
          total++;
          if (inst.status === 'PAID') paid++;
        }
      }
    }
    return { paid, total };
  }, [invoices]);

  // Validate customer data completeness for statuses that require it
  const validateCustomerDataForStatus = useCallback((targetStatus: string): boolean => {
    if (!STATUSES_REQUIRING_COMPLETE_DATA.includes(targetStatus)) return true;

    for (let i = 0; i < customerConfigs.length; i++) {
      const config = customerConfigs[i];
      const data = config.customerData || {};
      // From the SHARED list, not transcribed. This block used to spell all nine requirements out
      // by hand — a fourth copy alongside the rule, the page's gate and the badges, which happened
      // to agree today and would have drifted the first time the NFS-e needed another field.
      // `generateInvoice === false` is skipped for the same reason the rule and the page skip it.
      const errors: string[] = config.generateInvoice === false ? [] : missingBillingCustomerLabels(data);
      if (!config.paymentCondition && !(config.paymentConfig as any)?.type) errors.push("Condição de Pagamento");
      if (errors.length > 0) {
        const name = data.fantasyName || data.corporateName || `Cliente ${i + 1}`;
        toast.error(`${name} — campos obrigatórios não preenchidos`, {
          description: errors.join(", "),
        });
        return false;
      }
    }

    // Multi-customer: all services must have invoiceToCustomerId
    if (customerConfigs.length >= 2) {
      const unassigned = validServices.filter((s: any) => !s.invoiceToCustomerId);
      if (unassigned.length > 0) {
        toast.error("Serviços sem cliente atribuído", {
          description: "Todos os serviços devem ter um cliente selecionado em 'Faturar Para'",
        });
        return false;
      }
    }

    return true;
  }, [customerConfigs, validServices]);

  return (
    <div className="space-y-6">
      {/* Generation progress banner */}
      {isGenerating && (
        <div className="flex items-center gap-3 rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
          <IconLoader2 className="h-5 w-5 animate-spin text-blue-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-500">Gerando faturas, boletos e NFS-e...</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Aguarde enquanto os documentos são processados. Esta página será atualizada automaticamente.
            </p>
          </div>
        </div>
      )}

      {/* Task Info Summary — with inline status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <IconTruck className="h-4 w-4 text-muted-foreground" />
              Resumo da Tarefa
            </CardTitle>
            <div className="flex items-center gap-2">
            {task?.id && (
              <Button
                variant="outline"
                size="default"
                onClick={() => navigate(
                  task.status === "COMPLETED" || task.status === "CANCELLED"
                    ? routes.production.history.details(task.id)
                    : routes.production.preparation.details(task.id)
                )}
                className="gap-1.5 h-9"
              >
                <IconExternalLink className="h-3.5 w-3.5" />
                Ver Tarefa
              </Button>
            )}
            {canChangeStatus ? (
              <Combobox
                value={currentStatus}
                onValueChange={(v) => {
                  if (v && typeof v === "string" && v !== currentStatus) {
                    // Revert action — selected from inside the combobox (it replaces the old
                    // separate button). Open the confirmation dialog; this is a different endpoint
                    // (revertBilling) and must short-circuit before any status setValue.
                    if (v === REVERT_OPTION_VALUE) {
                      setRevertBillingDialogOpen(true);
                      return;
                    }
                    if (!validateCustomerDataForStatus(v)) return;
                    // Reject/cancel: downgrading any non-PENDING status back to PENDING — collect reason
                    if (v === "PENDING" && currentStatus !== "PENDING") {
                      setPendingDestructiveStatus(v);
                      setRejectReason("");
                      setRejectDialogOpen(true);
                      return;
                    }
                    // Generic confirmation for other backwards transitions handled by valid-transitions map
                    // (e.g. SETTLED -> PARTIAL, BUDGET_APPROVED -> PENDING handled above already).
                    const isBackward =
                      (currentStatus === "BUDGET_APPROVED" && v === "PENDING") ||
                      (currentStatus === "SETTLED" && v === "PARTIAL");
                    if (isBackward) {
                      setPendingConfirmStatus(v);
                      setConfirmDialogOpen(true);
                      return;
                    }
                    setValue("status", v, { shouldDirty: true });
                  }
                }}
                options={(() => {
                  const opts: Array<{ value: string; label: string; disabled?: boolean }> = [];
                  const isPostBilling = POST_BILLING_STATUSES.includes(currentStatus);

                  // Revert action first — sits before the due-states. The revert flow cancels active
                  // boletos/NFS-e itself, so it is offered whenever the backend would accept it
                  // (post-billing + nothing paid + no NFS-e processing).
                  if (canRevertForBilling) {
                    opts.push({ value: REVERT_OPTION_VALUE, label: "Reverter Faturamento" });
                  }

                  // Candidate statuses for this step, in display order:
                  //  - Pre-billing (e.g. BUDGET_APPROVED): the forward action is to APPROVE
                  //    faturamento (BILLING_APPROVED — generates the invoice/NF/boleto) or settle
                  //    directly. The automatic due-states are not shown yet (no invoice exists).
                  //  - Post-billing (UPCOMING/DUE/PARTIAL/…): show the due-states for context
                  //    (disabled) plus the settle action; reverting is the synthetic option above.
                  const values = isPostBilling
                    ? [...AUTOMATIC_STATUSES, "SETTLED"]
                    : ["BILLING_APPROVED", "SETTLED"];
                  // Always include the current status so the trigger renders its label.
                  if (!values.includes(currentStatus)) values.unshift(currentStatus);

                  const seen = new Set<string>();
                  for (const v of values) {
                    if (seen.has(v)) continue;
                    seen.add(v);
                    // Disable: the current status (can't select itself), automatic due-states, and
                    // anything outside the user's allowed transitions (e.g. COMMERCIAL can't approve
                    // billing — getAvailableQuoteStatusTransitions strips BILLING_APPROVED for them).
                    const isCurrent = v === currentStatus;
                    const isAutomatic = AUTOMATIC_STATUSES.includes(v);
                    const isAllowed = isCurrent || allowedNextStatuses.includes(v as TASK_QUOTE_STATUS);
                    // Selectable options use the verb label; the current status uses its state name.
                    const label = isCurrent
                      ? (STATUS_LABELS[v] || v)
                      : (ACTION_LABELS[v] || STATUS_LABELS[v] || v);
                    opts.push({ value: v, label, disabled: isCurrent || isAutomatic || !isAllowed });
                  }
                  return opts;
                })()}
                searchable={false}
                clearable={false}
                disabled={disabled}
                className="w-[240px]"
                triggerClassName={cn("font-medium", getStatusTriggerClass(currentStatus))}
              />
            ) : (
              <QuoteStatusBadge
                status={currentStatus as TASK_QUOTE_STATUS}
                size="lg"
                paidCount={installmentCounts.paid}
                totalCount={installmentCounts.total}
              />
            )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
              <span className="text-sm text-muted-foreground">Logomarca</span>
              <span className="text-sm font-medium">{task.name}</span>
            </div>
            {task.customer && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                <span className="text-sm text-muted-foreground">Cliente</span>
                <span className="text-sm font-medium">{task.customer.corporateName || task.customer.fantasyName}</span>
              </div>
            )}
            {task.truck?.plate && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                <span className="text-sm text-muted-foreground">Placa</span>
                <span className="text-sm font-medium">{task.truck.plate}</span>
              </div>
            )}
            {task.serialNumber && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                <span className="text-sm text-muted-foreground">Nº de Série</span>
                <span className="text-sm font-medium">{task.serialNumber}</span>
              </div>
            )}
            {task.truck?.chassisNumber && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                <span className="text-sm text-muted-foreground">Chassi</span>
                <span className="text-sm font-medium">{formatChassis(task.truck.chassisNumber)}</span>
              </div>
            )}
            {/* Plaqueta — é uma FOTO (truck.vinPlate -> File), não texto. */}
            {task.truck?.vinPlate && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                <span className="text-sm text-muted-foreground">Plaqueta</span>
                <FileThumbnail file={task.truck.vinPlate} size="sm" onClick={() => fileViewerContext?.actions.viewFiles([task.truck!.vinPlate!] as never, 0)} />
              </div>
            )}
            {task.truck?.category && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                <span className="text-sm text-muted-foreground">Categoria</span>
                <span className="text-sm font-medium">{TRUCK_CATEGORY_LABELS[task.truck.category as TRUCK_CATEGORY] || task.truck.category}</span>
              </div>
            )}
            {task.truck?.implementType && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                <span className="text-sm text-muted-foreground">Implemento</span>
                <span className="text-sm font-medium">{IMPLEMENT_TYPE_LABELS[task.truck.implementType as IMPLEMENT_TYPE] || task.truck.implementType}</span>
              </div>
            )}
            {task.finishedAt && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                <span className="text-sm text-muted-foreground">Finalizado em</span>
                <span className="text-sm font-medium">{formatDate(task.finishedAt)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Services Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <IconCurrencyReal className="h-4 w-4 text-muted-foreground" />
            Serviços ({validServices.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Services table - grouped by customer or flat */}
          {(() => {
            if (hasMultipleCustomers && customerGroups) {
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 items-stretch gap-3">
                  {Array.from(customerGroups.entries()).map(([customerId, group], groupIndex) => {
                    const config = customerConfigs.find((c: any) => c.customerId === customerId);
                    const groupSubtotal = group.services.reduce((sum: number, s: any) => sum + (Number(s?.amount) || 0), 0);
                    const groupTotal = config?.total != null ? Number(config.total) : groupSubtotal;

                    return (
                      <div key={customerId} className="border border-border rounded-lg overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/40 border-b border-border">
                          <IconBuilding className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-semibold">
                            <span className="text-muted-foreground font-medium">Cliente {groupIndex + 1}:</span>{" "}
                            {group.name}
                          </span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {formatCurrency(groupTotal)}
                          </span>
                        </div>
                        <table className="w-full">
                          <thead className="bg-muted/50">
                            <tr>
                              <th className="px-4 py-2.5 text-left text-sm font-semibold text-muted-foreground">Descrição</th>
                              <th className="px-4 py-2.5 text-right text-sm font-semibold text-muted-foreground w-28">Valor</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {group.services.map((svc: any, idx: number) => (
                              <ServiceTableRow key={idx} service={svc} />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
              );
            }

            // Single customer - flat table
            return (
              <div className="border border-border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-sm font-semibold text-muted-foreground">Descrição</th>
                      <th className="px-4 py-2.5 text-right text-sm font-semibold text-muted-foreground w-32">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {validServices.map((svc: any, idx: number) => (
                      <ServiceTableRow key={idx} service={svc} />
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}

          {/* Totals */}
          <div className="bg-muted/20 border border-border rounded-lg p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="font-medium">{formatCurrency(subtotal)}</span>
            </div>
            {discountAmount > 0 && (() => {
              const firstConfig = customerConfigs[0];
              let label = 'Desconto';
              if (firstConfig?.discountType === 'PERCENTAGE' && firstConfig?.discountValue) {
                label = `Desconto (${firstConfig.discountValue}%)`;
              }
              if (firstConfig?.discountReference) {
                label += ` — ${firstConfig.discountReference}`;
              }
              return (
                <div className="flex items-center justify-between text-sm text-destructive">
                  <span>{label}</span>
                  <span className="font-medium">- {formatCurrency(discountAmount)}</span>
                </div>
              );
            })()}
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-base font-bold">TOTAL</span>
              <span className="text-xl font-bold text-primary">{formatCurrency(total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Per-Customer Summary Cards */}
      {customerConfigs.length > 0 && (
        <div className={filteredCustomerConfigs.length >= 2 ? "grid grid-cols-1 lg:grid-cols-2 gap-4" : "space-y-4"}>
          {filteredCustomerConfigs.map((config: any, _i: number) => {
            const cached = customersCache.current.get(config.customerId);
            const name = config.customerData?.corporateName || config.customerData?.fantasyName || cached?.corporateName || cached?.fantasyName || "Cliente";
            const configTotal = Number(config.total) || 0;
            const paymentText = generatePaymentText({
              customPaymentText: config.customPaymentText,
              paymentCondition: config.paymentCondition,

              total: configTotal,
            });

            // Validate NFS-e data — the SHARED requirement list, so this badge, the "Faturar Para"
            // badge, the save gate and the attention rule all answer the same question. This block
            // used to check three of the nine fields, which is how a customer could read "complete"
            // here and still be rejected on save.
            const data = config.customerData || {};
            const missingCustomerLabels = missingBillingCustomerLabels(data);
            const isComplete = missingCustomerLabels.length === 0;

            const docLabel = data.cnpj ? "CNPJ" : data.cpf ? "CPF" : "Documento";
            const docValue = data.cnpj ? formatCNPJ(data.cnpj) : data.cpf ? formatCPF(data.cpf) : "-";
            const addressValue = data.address
              ? `${data.address}, ${data.addressNumber || "s/n"} - ${data.neighborhood ? data.neighborhood + ", " : ""}${data.city}/${data.state}`
              : "-";
            // Fone/Fax e E-Mail que a prefeitura vai imprimir no tomador. `phones` é ARRAY:
            // a nota leva o primeiro, o Resumo mostra todos. Cai para o responsável do
            // faturamento quando o cadastro do cliente não tem contato — mesma precedência
            // da emissão, senão o Resumo diria "sem telefone" numa nota que sai com um.
            const tomadorContact = resolveTomadorContact(data, (config as any).responsible);

            return (
              <Card key={config.customerId}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <IconBuilding className="h-4 w-4 text-muted-foreground" />
                    {name}
                    {!isComplete && (
                      <Badge variant="destructive" className="text-xs" title={missingCustomerLabels.join(", ")}>
                        Dados incompletos
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {/* Nome Fantasia is in NFSE_REQUIRED_CUSTOMER_FIELDS, so the rule and the badge
                        can both name it — but it had no row here, which meant the one field the
                        card title falls back to was the one the Resumo could not point at. */}
                    <div className={cn("flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5", attentionCustomerFor(config, ["fantasyName"]))}>
                      <span className="text-sm text-muted-foreground">Nome Fantasia</span>
                      <span className="text-sm font-medium">{data.fantasyName || "-"}</span>
                    </div>
                    <div className={cn("flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5", attentionCustomerFor(config, ["corporateName"]))}>
                      <span className="text-sm text-muted-foreground">Razão Social</span>
                      <span className="text-sm font-medium">{data.corporateName || "-"}</span>
                    </div>
                    <div className={cn("flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5", attentionCustomerFor(config, [NFSE_DOCUMENT_KEY]))}>
                      <span className="text-sm text-muted-foreground">{docLabel}</span>
                      <span className="text-sm font-medium">{docValue}</span>
                    </div>
                    {data.stateRegistration && (
                      <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                        <span className="text-sm text-muted-foreground">Inscrição Estadual</span>
                        <span className="text-sm font-medium">{data.stateRegistration}</span>
                      </div>
                    )}
                    {data.municipalRegistration && (
                      <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                        <span className="text-sm text-muted-foreground">Inscrição Municipal</span>
                        <span className="text-sm font-medium">{data.municipalRegistration}</span>
                      </div>
                    )}
                    <div
                      className={cn(
                        "flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5",
                        attentionCustomerFor(config, ["address", "addressNumber", "neighborhood", "city", "state", "zipCode"]),
                      )}
                    >
                      <span className="text-sm text-muted-foreground">Endereço</span>
                      <span className="text-sm font-medium text-right max-w-[60%]">
                        {addressValue}{data.zipCode ? ` - CEP: ${data.zipCode}` : ""}
                      </span>
                    </div>
                    {tomadorContact.phones.length > 0 && (
                      <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                        <span className="text-sm text-muted-foreground">
                          {tomadorContact.phones.length > 1 ? "Telefones" : "Telefone"}
                        </span>
                        <span className="text-sm font-medium text-right max-w-[60%]">
                          {tomadorContact.phones.map((p) => formatPhone(p)).join(" / ")}
                        </span>
                      </div>
                    )}
                    {tomadorContact.email && (
                      <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                        <span className="text-sm text-muted-foreground">E-mail</span>
                        <span className="text-sm font-medium text-right max-w-[60%] break-all">
                          {tomadorContact.email}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                      <span className="text-sm text-muted-foreground font-bold">Total</span>
                      <span className="text-sm font-bold text-primary">{formatCurrency(configTotal)}</span>
                    </div>
                    {paymentText && (
                      <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                        <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <IconCreditCard className="h-3.5 w-3.5" />
                          Pagamento
                        </span>
                        <span className="text-sm font-medium text-right max-w-[60%]">{paymentText}</span>
                      </div>
                    )}
                    {(() => {
                      // Normally shown only when filled. When a rule is asking for it, the row is
                      // rendered EMPTY and highlighted — a missing value with no DOM node is a
                      // signal with nothing to point at.
                      const attnCls = attentionOrderNumberFor(config);
                      if (!config.orderNumber && !attnCls) return null;
                      return (
                        <div
                          className={cn("flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5", attnCls)}
                          title={attnCls ? orderNumberAttention?.match.rule.name : undefined}
                        >
                          <span className="text-sm text-muted-foreground">N° do Pedido</span>
                          <span className={cn("text-sm font-medium", !config.orderNumber && "text-muted-foreground")}>
                            {config.orderNumber || "Pendente"}
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Installments / NFS-e */}
                  {(() => {
                    const configInvoice = invoices.find((inv) => inv.customerConfigId === config.id);
                    if (!configInvoice) return null;

                    const installments = configInvoice.installments
                      ? [...configInvoice.installments].sort((a: any, b: any) => a.number - b.number)
                      : [];
                    const nfseDocuments = (configInvoice as any).nfseDocuments ?? [];
                    // Current NFSe: AUTHORIZED > PROCESSING > PENDING > ERROR (priority order)
                    const activeNfse = nfseDocuments.find((d: any) => d.status === "AUTHORIZED")
                      ?? nfseDocuments.find((d: any) => d.status === "PROCESSING")
                      ?? nfseDocuments.find((d: any) => d.status === "PENDING")
                      ?? nfseDocuments.find((d: any) => d.status === "ERROR")
                      ?? null;
                    const canceledNfses = nfseDocuments.filter((d: any) => d.status === "CANCELLED");

                    return (
                      <div className="mt-4 space-y-3">
                        {/* Parcelas */}
                        {installments.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm font-semibold">
                              <div className="flex items-center gap-2">
                                <IconReceipt className="h-3.5 w-3.5 text-muted-foreground" />
                                Parcelas
                              </div>
                              <DownloadAllBoletosButton installments={installments} />
                            </div>
                            <div className="rounded-md border border-border/50 overflow-x-auto">
                              <table className="w-full text-sm table-fixed">
                                <thead>
                                  <tr className="border-b border-border/50 bg-muted/40 text-muted-foreground">
                                    <th className="px-3 py-2 text-left font-medium whitespace-nowrap w-24">Parcela</th>
                                    <th className="px-3 py-2 text-left font-medium whitespace-nowrap w-36">Status</th>
                                    <th className="px-3 py-2 text-left font-medium whitespace-nowrap w-44">Vencimento</th>
                                    <th className="px-3 py-2 text-left font-medium whitespace-nowrap w-44">Pago em</th>
                                    <th className="px-3 py-2 text-left font-medium whitespace-nowrap w-40">Forma</th>
                                    <th aria-hidden />
                                    <th className="px-3 py-2 text-right font-medium whitespace-nowrap w-40">Valor</th>
                                    <th className="px-3 py-2 text-right font-medium whitespace-nowrap w-56">Ações</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border/50">
                                  {installments.map((installment: any) => (
                                    <tr key={installment.id} className="hover:bg-muted/40 transition-colors">
                                      <td className="px-3 py-2 tabular-nums text-muted-foreground whitespace-nowrap">
                                        {installment.number}/{installments.length}
                                      </td>
                                      <td className="px-3 py-2">
                                        <UnifiedInstallmentBadge installment={installment} />
                                      </td>
                                      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                                        {formatDate(installment.dueDate)}
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap">
                                        {installment.paidAt ? (
                                          <span className="text-emerald-700">{formatDate(installment.paidAt)}</span>
                                        ) : (
                                          <span className="text-muted-foreground">-</span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2 whitespace-nowrap">
                                        {(() => {
                                          const form = formatInstallmentPaymentForm(installment.paymentMethod, !!installment.bankSlip);
                                          return form ? (
                                            <Badge variant="secondary" size="sm" className="font-medium whitespace-nowrap">{form}</Badge>
                                          ) : (
                                            <span className="text-muted-foreground">-</span>
                                          );
                                        })()}
                                      </td>
                                      <td aria-hidden />
                                      <td className="px-3 py-2 text-right font-medium whitespace-nowrap">
                                        {formatCurrency(installment.amount)}
                                      </td>
                                      <td className="px-3 py-2">
                                        <div className="flex justify-end">
                                          <BoletoActions
                                            installmentId={installment.id}
                                            bankSlip={installment.bankSlip}
                                            dueDate={installment.dueDate}
                                            installmentStatus={installment.status}
                                            installmentPaymentMethod={installment.paymentMethod}
                                            receiptFiles={installment.receiptFiles}
                                            observations={installment.observations}
                                            canManage={!disabled}
                                          />
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {/* NFS-e — same table layout as Parcelas above */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 text-sm font-semibold">
                            <IconFileInvoice className="h-3.5 w-3.5 text-muted-foreground" />
                            NFS-e
                          </div>
                          <div className="rounded-md border border-border/50 overflow-x-auto">
                            <table className="w-full text-sm table-fixed">
                              <thead>
                                <tr className="border-b border-border/50 bg-muted/40 text-muted-foreground">
                                  <th className="px-3 py-2 text-left font-medium whitespace-nowrap w-24">Número</th>
                                  <th className="px-3 py-2 text-left font-medium whitespace-nowrap w-36">Status</th>
                                  <th className="px-3 py-2 text-left font-medium whitespace-nowrap w-44">Emissão</th>
                                  <th aria-hidden />
                                  <th className="px-3 py-2 text-right font-medium whitespace-nowrap w-32">ISS</th>
                                  {/* Bruto and Líquido are separate because a discount makes
                                      them differ, and only the LÍQUIDO figure matches the
                                      parcela below. A single "Valor" carrying the gross made
                                      the note read as if it disagreed with its own parcela. */}
                                  <th className="px-3 py-2 text-right font-medium whitespace-nowrap w-36">Valor Bruto</th>
                                  <th className="px-3 py-2 text-right font-medium whitespace-nowrap w-40">Valor Líquido</th>
                                  <th className="px-3 py-2 text-right font-medium whitespace-nowrap w-56">Ações</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/50">
                                {/* No NFS-e at all — single row with emit button */}
                                {!activeNfse && canceledNfses.length === 0 && (
                                  <tr>
                                    <td colSpan={7} className="px-3 py-2 text-muted-foreground">Não emitida</td>
                                    <td className="px-3 py-2">
                                      <div className="flex justify-end">
                                        <NfseActions invoiceId={configInvoice.id} nfseDocuments={nfseDocuments} canManage={!disabled} />
                                      </div>
                                    </td>
                                  </tr>
                                )}
                                {/* Active/Current NFS-e — cancel/reemit inline */}
                                {activeNfse && (
                                  <NfseTableRow
                                    doc={activeNfse}
                                    showActions
                                    invoiceId={configInvoice.id}
                                    nfseDocuments={nfseDocuments}
                                    canManage={!disabled}
                                  />
                                )}
                                {/* Canceled NFS-e entries — reemit button only on the last one when no active */}
                                {canceledNfses.map((doc: any, idx: number) => (
                                  <NfseTableRow
                                    key={doc.id}
                                    doc={doc}
                                    showActions={!activeNfse && idx === canceledNfses.length - 1}
                                    invoiceId={configInvoice.id}
                                    nfseDocuments={nfseDocuments}
                                    canManage={!disabled}
                                  />
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dossiê — Proof of services with check-in/check-out photos */}
      {(() => {
        const serviceOrdersWithFiles = (task.serviceOrders || [])
          .filter((so: any) => so.type === SERVICE_ORDER_TYPE.PRODUCTION && (so.checkinFiles?.length > 0 || so.checkoutFiles?.length > 0))
          .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));

        if (serviceOrdersWithFiles.length === 0) return null;

        const totalDossieFiles = serviceOrdersWithFiles.reduce(
          (sum: number, so: any) => sum + (so.checkinFiles?.length || 0) + (so.checkoutFiles?.length || 0), 0
        );

        const apiUrl = getApiBaseUrl();

        return (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <IconFolderCheck className="h-4 w-4 text-muted-foreground" />
                  Dossiê
                  <Badge variant="secondary" className="ml-1">
                    {totalDossieFiles} {totalDossieFiles === 1 ? 'foto' : 'fotos'}
                  </Badge>
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  // Mesmo dossiê do servidor usado na página da tarefa: páginas do
                  // orçamento ASSINADO + fotos + notas + boletos. Ver
                  // `exportTaskDossiePdf`.
                  onClick={() => void exportTaskDossiePdf(task)}
                >
                  <IconDownload className="h-3.5 w-3.5" />
                  Baixar PDF
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Registro fotográfico dos serviços por ordem de serviço
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-3 gap-4">
                {serviceOrdersWithFiles.map((serviceOrder: any) => {
                  const isOutrosWithObservation = serviceOrder.description === 'Outros' && !!serviceOrder.observation;
                  const displayDescription = isOutrosWithObservation ? serviceOrder.observation : serviceOrder.description;
                  const checkinFiles = serviceOrder.checkinFiles || [];
                  const checkoutFiles = serviceOrder.checkoutFiles || [];

                  return (
                    <div key={serviceOrder.id} className="border border-border/30 rounded-lg overflow-hidden">
                      {/* Service Order Header */}
                      <div className="bg-muted/30 px-3 py-2 flex items-center gap-2 border-b border-border/30">
                        <h4 className="text-xs font-semibold truncate">{displayDescription}</h4>
                        {!isOutrosWithObservation && serviceOrder.observation && (
                          <span className="text-[11px] text-muted-foreground truncate" title={serviceOrder.observation}>
                            — {serviceOrder.observation}
                          </span>
                        )}
                      </div>

                      {/* Antes / Depois Content */}
                      <div className="px-3 py-3 space-y-5">
                        {/* Antes */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5">
                            <IconCameraCheck className="h-4 w-4 text-blue-500" />
                            <span className="text-xs font-medium">Antes</span>
                            <span className="text-[11px] text-muted-foreground">{checkinFiles.length}</span>
                          </div>
                          {checkinFiles.length > 0 ? (
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
                              {checkinFiles.map((file: any) => {
                                const src = file.thumbnailUrl
                                  ? (file.thumbnailUrl.startsWith('/api') ? `${apiUrl}${file.thumbnailUrl}` : file.thumbnailUrl)
                                  : `${apiUrl}/files/thumbnail/${file.id}`;
                                return (
                                  <button
                                    key={file.id}
                                    onClick={() => handleDossieFileClick(file)}
                                    className="relative aspect-square rounded overflow-hidden border border-border/30 bg-muted hover:opacity-80 transition-opacity cursor-pointer"
                                  >
                                    <img
                                      src={src}
                                      alt={file.originalName || file.filename}
                                      className="w-full h-full object-cover"
                                    />
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-[11px] text-muted-foreground italic">Nenhuma foto</p>
                          )}
                        </div>

                        {/* Depois */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-1.5">
                            <IconCameraBolt className="h-4 w-4 text-green-500" />
                            <span className="text-xs font-medium">Depois</span>
                            <span className="text-[11px] text-muted-foreground">{checkoutFiles.length}</span>
                          </div>
                          {checkoutFiles.length > 0 ? (
                            <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2">
                              {checkoutFiles.map((file: any) => {
                                const src = file.thumbnailUrl
                                  ? (file.thumbnailUrl.startsWith('/api') ? `${apiUrl}${file.thumbnailUrl}` : file.thumbnailUrl)
                                  : `${apiUrl}/files/thumbnail/${file.id}`;
                                return (
                                  <button
                                    key={file.id}
                                    onClick={() => handleDossieFileClick(file)}
                                    className="relative aspect-square rounded overflow-hidden border border-border/30 bg-muted hover:opacity-80 transition-opacity cursor-pointer"
                                  >
                                    <img
                                      src={src}
                                      alt={file.originalName || file.filename}
                                      className="w-full h-full object-cover"
                                    />
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <p className="text-[11px] text-muted-foreground italic">Nenhuma foto</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        );
      })()}

      {/* Reject / Cancel reason dialog — collected before reverting to PENDING.
          The reason is stored in the form ("statusReason") and forwarded to
          taskQuoteService.updateStatus by the parent's executeSave. */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Orçamento</DialogTitle>
            <DialogDescription>
              Informe o motivo da rejeição. O status do orçamento voltará para Pendente.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <Label htmlFor="reject-reason" className="text-sm font-medium">
              Motivo da rejeição <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Descreva o motivo (mínimo 5 caracteres)..."
              rows={4}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectDialogOpen(false);
                setRejectReason("");
                setPendingDestructiveStatus(null);
              }}
            >
              Voltar
            </Button>
            <Button
              variant="destructive"
              disabled={rejectReason.trim().length < 5}
              onClick={() => {
                if (rejectReason.trim().length < 5 || !pendingDestructiveStatus) return;
                setValue("statusReason", rejectReason.trim(), { shouldDirty: true });
                setValue("status", pendingDestructiveStatus, { shouldDirty: true });
                setRejectDialogOpen(false);
                setPendingDestructiveStatus(null);
                setRejectReason("");
              }}
            >
              Confirmar Rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generic confirmation for backwards transitions (cancel-style ops without reason). */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reverter status do orçamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja reverter o status? Esta ação altera o estado do orçamento
              e pode afetar fluxos automáticos (faturas, boletos, NFS-e).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setConfirmDialogOpen(false);
                setPendingConfirmStatus(null);
              }}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingConfirmStatus) {
                  setValue("status", pendingConfirmStatus, { shouldDirty: true });
                }
                setConfirmDialogOpen(false);
                setPendingConfirmStatus(null);
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Revert billing approval confirmation */}
      <AlertDialog open={revertBillingDialogOpen} onOpenChange={setRevertBillingDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reverter aprovação de faturamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação irá baixar os boletos ativos no Sicredi, cancelar as NFS-e autorizadas, remover as
              faturas e parcelas, e reverter o orçamento para <strong>Aprovado</strong>.
              O orçamento poderá ser editado e aprovado novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revertBillingLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRevertBilling}
              disabled={revertBillingLoading}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {revertBillingLoading ? "Revertendo..." : "Reverter Faturamento"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

// =====================
// Unified Installment Badge
// =====================

function getPaymentMethodLabel(bankSlip: any, installment?: any): string {
  // Check installment paymentMethod first (more reliable). Normalizing here keeps
  // raw "BOLETO" and enum "BANK_SLIP" from rendering as two different badges.
  const instLabel = formatPaidInstallmentLabel(installment?.paymentMethod);
  if (instLabel) return instLabel;

  // Fallback to bankSlip sicrediStatus
  const method = bankSlip?.sicrediStatus;
  if (method === 'PAID_PIX') return 'Paga (PIX)';
  if (method === 'PAID_CASH') return 'Paga (Dinheiro)';
  if (method === 'PAID_TRANSFER') return 'Paga (Transferência)';
  if (method?.startsWith('PAID_')) return 'Paga (por fora)';
  return 'Paga (Boleto)';
}

function UnifiedInstallmentBadge({ installment }: { installment: any }) {
  const bankSlip = installment.bankSlip;

  // Paid (by bank slip or externally)
  if (installment.status === 'PAID') {
    return (
      <Badge variant="green" size="sm" className="font-medium whitespace-nowrap">
        {getPaymentMethodLabel(bankSlip, installment)}
      </Badge>
    );
  }

  // Bank slip error/rejected — blocking
  if (bankSlip && ['ERROR', 'REJECTED'].includes(bankSlip.status)) {
    return <Badge variant="destructive" size="sm" className="font-medium whitespace-nowrap">Erro</Badge>;
  }

  // Overdue
  if (installment.status === 'OVERDUE' || bankSlip?.status === 'OVERDUE') {
    return <Badge variant="destructive" size="sm" className="font-medium whitespace-nowrap">Vencida</Badge>;
  }

  // Cancelled
  if (installment.status === 'CANCELLED') {
    return <Badge variant="cancelled" size="sm" className="font-medium whitespace-nowrap">Cancelada</Badge>;
  }

  // Bank slip cancelled but installment not paid — cancelled
  if (bankSlip?.status === 'CANCELLED') {
    return <Badge variant="cancelled" size="sm" className="font-medium whitespace-nowrap">Cancelado</Badge>;
  }

  // Active bank slip
  if (bankSlip?.status === 'ACTIVE') {
    return <Badge variant="processing" size="sm" className="font-medium whitespace-nowrap">Aberto</Badge>;
  }

  // Creating/registering
  if (bankSlip && ['CREATING', 'REGISTERING'].includes(bankSlip.status)) {
    return <Badge variant="processing" size="sm" className="font-medium whitespace-nowrap">Processando</Badge>;
  }

  // Default: pending
  return <Badge variant="pending" size="sm" className="font-medium whitespace-nowrap">Pendente</Badge>;
}

// =====================
// Service Table Row
// =====================

function ServiceTableRow({ service }: { service: any }) {
  const amount = typeof service.amount === "number" ? service.amount : Number(service.amount) || 0;
  const isOutrosWithObservation = service.description === "Outros" && !!service.observation;
  const displayDescription = isOutrosWithObservation ? service.observation : service.description;

  return (
    <tr className="hover:bg-muted/30 transition-colors">
      <td className="px-4 py-1.5 text-sm align-middle">
        <div>
          <span>
            {displayDescription}
            {!isOutrosWithObservation && service.observation && (
              <span className="text-muted-foreground italic"> — {service.observation}</span>
            )}
          </span>
        </div>
      </td>
      <td className="px-4 py-1.5 text-sm text-right font-medium align-middle">
        {formatCurrency(amount)}
      </td>
    </tr>
  );
}

function DownloadAllBoletosButton({ installments }: { installments: any[] }) {
  const [isDownloading, setIsDownloading] = useState(false);

  const downloadable = installments.filter(
    (inst) => inst.bankSlip && (inst.bankSlip.status === 'ACTIVE' || inst.bankSlip.status === 'OVERDUE'),
  );

  if (downloadable.length < 2) return null;

  const handleDownloadAll = async () => {
    setIsDownloading(true);
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();

      for (const inst of downloadable) {
        const res = await invoiceService.getBoletoPdf(inst.id);
        const blob = res.data instanceof Blob
          ? res.data
          : new Blob([res.data], { type: 'application/pdf' });
        zip.file(`boleto-parcela-${inst.number}.pdf`, blob);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `boletos.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silently fail
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleDownloadAll}
      disabled={isDownloading}
      title="Baixar todos os boletos"
      className="h-7 px-2 text-xs gap-1"
    >
      {isDownloading ? (
        <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <IconDownload className="h-3.5 w-3.5" />
      )}
      Baixar todos
    </Button>
  );
}

function NfsePdfButtons({ elotechNfseId }: { elotechNfseId: number }) {
  const [isViewing, setIsViewing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const fetchPdf = async () => {
    const res = await nfseService.getPdf(elotechNfseId);
    return res.data instanceof Blob
      ? res.data
      : new Blob([res.data], { type: 'application/pdf' });
  };

  const handleView = async () => {
    setIsViewing(true);
    try {
      const blob = await fetchPdf();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch {
      // silently fail
    } finally {
      setIsViewing(false);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const blob = await fetchPdf();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nfse-${elotechNfseId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // silently fail
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleView}
        disabled={isViewing}
        title="Visualizar NFS-e"
        className="h-7 w-7 p-0"
      >
        {isViewing ? (
          <IconLoader2 className="h-4 w-4 animate-spin" />
        ) : (
          <IconEye className="h-4 w-4" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDownload}
        disabled={isDownloading}
        title="Baixar NFS-e"
        className="h-7 w-7 p-0"
      >
        {isDownloading ? (
          <IconLoader2 className="h-4 w-4 animate-spin" />
        ) : (
          <IconDownload className="h-4 w-4" />
        )}
      </Button>
    </>
  );
}

/**
 * One row of the NFS-e table. Loads Número/Emissão/Valor/ISS from the enriched
 * NFS-e detail (same source as the old NfseEnrichedInfo card). `showActions`
 * controls whether the cancel/reemit control is shown on this row.
 */
function NfseTableRow({
  doc,
  showActions,
  invoiceId,
  nfseDocuments,
  canManage,
}: {
  doc: any;
  showActions: boolean;
  invoiceId: string;
  nfseDocuments: any[];
  canManage: boolean;
}) {
  const navigate = useNavigate();
  // enabled:!!elotechNfseId inside the hook — passing 0 is a no-op (docs not yet emitted).
  const { data } = useNfseDetail(doc.elotechNfseId ?? 0);
  const detail: any = data?.data;
  const numero = detail?.formDadosNFSe?.numeroNfse ?? doc.nfseNumber ?? null;
  const emissao = detail?.formDadosNFSe?.dataEmissao ?? null;
  // Mind the naming: in this DETAIL payload `totalNfse` is the GROSS value and
  // `valorLiquidoNfse` is the net one — the inverse of the list endpoint's
  // `valorDoc`/`valorLiquidoNota`. Only the NET figure equals the invoice total and the
  // parcela; showing `totalNfse` alone as "Valor" is what made a note with a discount
  // look like it disagreed with its own parcela (R$ 33.255,00 vs R$ 31.592,25).
  const valorBruto = detail?.formTotal?.totalNfse ?? null;
  const valorLiquido = detail?.formTotal?.valorLiquidoNfse ?? valorBruto;
  const temDesconto =
    valorBruto != null && valorLiquido != null && Math.abs(valorBruto - valorLiquido) >= 0.01;
  const iss = detail?.formImposto?.valorIss ?? null;
  const clickable = !!doc.elotechNfseId;

  return (
    <tr
      className={cn("hover:bg-muted/40 transition-colors", clickable && "cursor-pointer")}
      onClick={clickable ? () => navigate(routes.financial.nfse.detail(doc.elotechNfseId)) : undefined}
    >
      <td className="px-3 py-2 tabular-nums font-medium whitespace-nowrap">{numero ?? "-"}</td>
      <td
        className="px-3 py-2"
        title={doc.status === "ERROR" && doc.errorMessage ? doc.errorMessage : undefined}
      >
        <NfseStatusBadge status={doc.status} size="sm" />
      </td>
      <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
        {emissao ? formatDate(emissao) : "-"}
      </td>
      <td aria-hidden />
      <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums text-muted-foreground">
        {iss != null ? formatCurrency(iss) : "-"}
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums text-muted-foreground">
        {valorBruto != null ? formatCurrency(valorBruto) : "-"}
      </td>
      <td
        className="px-3 py-2 text-right font-medium whitespace-nowrap tabular-nums"
        title={temDesconto ? "Valor com desconto — é este que confere com a parcela" : undefined}
      >
        {valorLiquido != null ? formatCurrency(valorLiquido) : "-"}
      </td>
      <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-end gap-1">
          {doc.elotechNfseId && <NfsePdfButtons elotechNfseId={doc.elotechNfseId} />}
          {showActions && (
            <NfseActions invoiceId={invoiceId} nfseDocuments={nfseDocuments} canManage={canManage} />
          )}
        </div>
      </td>
    </tr>
  );
}
