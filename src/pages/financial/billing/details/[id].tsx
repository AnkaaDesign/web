import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { useTaskDetail, useCurrentUser, useTaskMutations, taskKeys } from "@/hooks";
import { useTaskBillingInvoices } from "@/hooks/production/use-invoice";
import { taskQuoteKeys } from "@/hooks/production/use-task-quote";
import { taskQuoteService } from "@/api-client/task-quote";
import { customerService } from "@/api-client/customer";
import { uploadSingleFile } from "@/api-client/file";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { FormSteps } from "@/components/ui/form-steps";
import { BillingStepTask } from "@/components/financial/billing/steps/billing-step-task";
import { BillingStepServices } from "@/components/financial/billing/steps/billing-step-services";
import { BillingStepCustomer } from "@/components/financial/billing/steps/billing-step-customer";
import { BillingStepReview } from "@/components/financial/billing/steps/billing-step-review";
import { SignatureEnvelopeCard } from "@/components/financial/budget/signature-envelope-card";
import { BillingStepBudgetInfo } from "@/components/financial/billing/steps/billing-step-budget-info";
import { SECTOR_PRIVILEGES, IMPLEMENT_TYPE, routes } from "@/constants";
import type { FileWithPreview } from "@/components/common/file/file-uploader";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { canUpdateQuoteStatus, canEditQuote, getQuoteStatusPath } from "@/utils/permissions/quote-permissions";
import {
  quoteTasks,
  quoteVehicleCount,
  coverageSummary,
  coveredTaskCount,
  hasMultipleCustomers as hasMultipleCustomersOf,
  dedupeConfigsByCustomer,
} from "@/utils/quote-tasks";
import {
  expandConfigsIntoLots,
  groupsForSplit,
  type BillingSplitValue,
} from "@/components/financial/shared/billing-split-field";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { readReturnTo } from "@/hooks/common/use-return-to";
import { toast } from "@/components/ui/sonner";
import {
  IconArrowLeft,
  IconArrowRight,
  IconCheck,
  IconLoader2,
  IconFileInvoice,
  IconAlertCircle,
  IconExternalLink,
} from "@tabler/icons-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import type { TASK_QUOTE_STATUS } from "@/types/task-quote";
import { BillingDocumentPreviews } from "@/components/financial/billing/preview/billing-document-previews";
import { useNextNfseNumber } from "@/hooks/financial/use-nfse";
// Imported from the filters module rather than the table barrel so the detail route does not pull
// the whole list page into its bundle.
import { BILLING_FALLBACK_LIST_QUERY } from "@/components/financial/billing/table/billing-table-filters";
import { readQuoteSiblingState, useQuoteSiblingIds } from "@/components/financial/shared/quote-sibling-nav";
import { useUnsavedChangesGuard } from "@/hooks/common/use-unsaved-changes-guard";
import { UnsavedChangesDialog } from "@/components/ui/unsaved-changes-dialog";
import { toAttentionQuoteEntity } from "@/components/financial/shared/quote-attention";
import { useRecordNavigation } from "@/components/ui/detailpage/use-record-navigation";
import { RecordPager } from "@/components/ui/detailpage/record-pager-action";
import { useAttentionEntity, useAttentionField } from "@/lib/attention";
import { hasCompleteBillingCustomerData, missingBillingCustomerLabels } from "@/lib/billing-customer-data";
import { PINNED_CUSTOMERS } from "@/config/company";

/**
 * Remount the wizard whenever the record changes.
 *
 * Prev/next paging swaps `:id` under a component that would otherwise stay mounted, and this page
 * hydrates its form with `form.reset(..., { keepDirtyValues: true })` — right for a background
 * refetch of the same record, wrong for a different one: record A's half-typed name, serial and
 * customer CNPJ would render on record B, still flagged dirty, and `executeSave` would push them
 * to B's task and to B's customers. The wizard step and the "jump to Resumo" latch have the same
 * problem. A `key` reseeds all of it, which is what "a different record" means.
 */
export const BillingDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  return <BillingDetailPageInner key={id ?? "novo"} />;
};

const BillingDetailPageInner = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  // Where to return after save — set by whoever sent the user here.
  const returnTo = readReturnTo(location.state);
  // Prev/next pager context. `ids` is a fast path (the list handed it over on row click); when it
  // is absent or is only the loaded page, the sibling hook rebuilds the list from `listQuery`, so
  // the pager renders no matter how the user got here — refresh, Back, direct URL, new tab,
  // notification, deep link, a receivable row, or the task detail's "Editar".
  const siblingState = readQuoteSiblingState(location.state);
  const queryClient = useQueryClient();
  const { data: currentUser } = useCurrentUser();
  const customersCache = useRef<Map<string, any>>(new Map());

  usePageTracker({ title: "Faturamento - Detalhes", icon: "file-invoice" });

  const userPrivilege = currentUser?.sector?.privileges || "";
  const canEdit = canEditQuote(userPrivilege) || canUpdateQuoteStatus(userPrivilege);
  // ACCOUNTING is a pure read-only viewer — collapse the multi-step wizard down to
  // just the final review screen (no step indicator, no Anterior/Próximo nav).
  const reviewOnly = userPrivilege === SECTOR_PRIVILEGES.ACCOUNTING;
  const canSeeBudgetInfoStep = [
    SECTOR_PRIVILEGES.COMMERCIAL,
    SECTOR_PRIVILEGES.ADMIN,
  ].includes(userPrivilege as SECTOR_PRIVILEGES);

  // Multi-step form state
  const [currentStep, setCurrentStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [layoutFiles, setLayoutFiles] = useState<FileWithPreview[]>([]);
  // Foto da plaqueta (VIN) — imagem única, espelhando o campo do formulário de Tarefa.
  const [vinPlateFiles, setVinPlateFiles] = useState<FileWithPreview[]>([]);
  const [billingApprovalDialogOpen, setBillingApprovalDialogOpen] = useState(false);
  /**
   * A confirmação aberta é a de uma FATIA (este veículo) e não a do orçamento?
   *
   * As fatias 2..N são aprovadas por uma ação do seletor que NÃO muda o status
   * do orçamento, então `form.status` não tem como distinguir as duas — este
   * sinalizador faz a confirmação e o `executeSave` falarem do mesmo ato.
   */
  const [approvingVehicleSlice, setApprovingVehicleSlice] = useState(false);
  // Predicted NFS-e número (last emitted + 1) — fetched only while the approval modal is open.
  const { data: nextNfse } = useNextNfseNumber(billingApprovalDialogOpen);
  const [isGenerating, setIsGenerating] = useState(false);
  const [dossieCustomerId, setDossieCustomerId] = useState<string>("all");

  // Mutations
  const { updateAsync: updateTaskAsync } = useTaskMutations();

  // Fetch task with billing-related includes
  const { data: taskResponse, isLoading: isTaskLoading } = useTaskDetail(id!, {
    enabled: !!id,
    include: {
      customer: { include: { logo: true } },
      // `vinPlate` is a File relation, so a boolean `truck: true` would leave the Plaqueta field
      // permanently empty and let a save wipe a photo that was already there.
      truck: { include: { vinPlate: true } },
      serviceOrders: {
        include: {
          checkinFiles: true,
          checkoutFiles: true,
        },
        orderBy: { position: "asc" },
      },
      // Task layouts — the pool the billing "Layout Aprovado" picker chooses from.
      layouts: { include: { file: true } },
      quote: {
        include: {
          services: true,
          layoutFiles: true,
          // OS VEÍCULOS DO ORÇAMENTO. A tela é aberta por UM deles, mas o pedido
          // de compra é de cada um (`Task.customerOrderNumber`) e a nota conjunta
          // cita todos — sem esta lista o campo teria um único endereço possível,
          // que é o defeito que a coluna por cliente tinha.
          tasks: {
            select: {
              id: true,
              name: true,
              serialNumber: true,
              createdAt: true,
              customerOrderNumber: true,
              // Chassi junto: a tabela de veículos do passo 1 mostra as mesmas
              // colunas do documento, e um chassi ausente ali leria como "a
              // registrar" num caminhão que já o tem.
              truck: {
                select: {
                  id: true,
                  plate: true,
                  chassisNumber: true,
                  // Categoria e implemento: é assim que a discriminação da NFS-e
                  // nomeia o veículo ("Truck Refrigerado de n série: X"). Sem
                  // eles a prévia descreveria um caminhão sem tipo, diferente da
                  // nota que vai sair.
                  category: true,
                  implementType: true,
                },
              },
            },
          },
          customerConfigs: {
            include: {
              customer: { include: { logo: true } },
              installments: { orderBy: { number: "asc" } },
              responsible: true,
            },
          },
        },
      },
    },
  });

  const task = taskResponse?.data;
  const quote = task?.quote;

  // ─── FATURAR ESTE VEÍCULO OU O ORÇAMENTO INTEIRO ─────────────────────────────
  //
  // Um orçamento pode cobrir sessenta caminhões, e esta tela é aberta pela TAREFA
  // — ou seja, por UM deles. Com `billingSplit = PER_TASK` a decisão é veículo a
  // veículo ("os sessenta não terminam no mesmo dia"): a aprovação daqui fatura
  // só este, pela rota dedicada, e o orçamento fecha quando a última fatia sai.
  // Com `JOINT` é uma fatura para todos, e aprovar aqui aprova o conjunto — como
  // sempre foi.
  const quoteVehicles = quoteVehicleCount(quote);

  /**
   * OS VEÍCULOS do orçamento — a lista que o pedido de compra endereça.
   *
   * Recai na tarefa aberta quando o orçamento veio sem a relação: um orçamento de
   * um veículo continua com um campo só, e nenhuma tela fica sem endereço.
   */
  const quoteVehicleRows = useMemo(() => {
    const fromQuote = quoteTasks(quote as any) as Array<{
      id: string;
      name?: string | null;
      serialNumber?: string | null;
      customerOrderNumber?: string | null;
      truck?: { plate?: string | null } | null;
    }>;
    if (fromQuote.length > 0) return fromQuote;
    return task
      ? [
          {
            id: task.id,
            name: task.name,
            serialNumber: task.serialNumber,
            customerOrderNumber: task.customerOrderNumber ?? null,
            truck: task.truck ? { plate: task.truck.plate } : null,
          },
        ]
      : [];
  }, [quote, task]);

  /**
   * O FATURAMENTO DESTE ORÇAMENTO É FATIADO?
   *
   * "Fatiado" é: alguma fatura cobre MENOS que todos os veículos. Cobre a
   * cobrança veículo a veículo e o lote com a mesma conta, porque a pergunta é
   * sobre a cobertura e não sobre o modo — e é ela que decide se a aprovação
   * desta tela fecha só o que cobre o caminhão aberto (rota da fatia) ou o
   * orçamento inteiro.
   *
   * Antes era `billingSplit === "PER_TASK"`: num orçamento em lotes a resposta
   * seria "não", e aprovar um caminhão emitiria os três lotes de uma vez.
   */
  const isPerVehicleBilling = useMemo(() => {
    if (quoteVehicles <= 1) return false;
    return ((quote?.customerConfigs ?? []) as any[]).some((c) => {
      const covered = (c?.coveredTasks ?? []).length;
      return covered > 0 && covered < quoteVehicles;
    });
  }, [quote, quoteVehicles]);

  /** Os veículos na forma que o controle de divisão precisa (série, placa, pedido). */
  const billingSplitVehicles = useMemo(
    () =>
      quoteVehicleRows.map((v: any) => ({
        id: v.id,
        name: v.name ?? null,
        serialNumber: v.serialNumber ?? null,
        plate: v.truck?.plate ?? null,
        customerOrderNumber: v.customerOrderNumber ?? null,
      })),
    [quoteVehicleRows],
  );

  /**
   * Quantas faturas deste orçamento JÁ foram aprovadas.
   *
   * Com uma que seja, a divisão congela: a cobertura de uma fatura aprovada
   * sustenta nota fiscal autorizada e boletos registrados, e mudá-la alteraria
   * retroativamente de quais caminhões é um documento fiscal que já saiu.
   */
  const approvedBillingCount = useMemo(
    () => ((quote?.customerConfigs ?? []) as any[]).filter((c) => c?.billingApprovedAt).length,
    [quote],
  );

  /** Há coleta de assinaturas em andamento? Refatiar a derruba — a tela avisa antes. */
  const hasRunningSignature = useMemo(
    () =>
      ((quote as any)?.signatureEnvelopes ?? []).some((e: any) =>
        ["PENDING", "SENT", "PARTIALLY_SIGNED", "RUNNING"].includes(String(e?.status ?? "")),
      ),
    [quote],
  );

  // Attention: register this quote so its rules evaluate and honour their ack policy — the same
  // entity the Faturamento list registers, in the same shape, so a record behaves identically
  // whether it was loaded here or there. This page is a wizard, not a <DetailPage>, so the hook
  // that DetailPage would have called is called directly.
  const quoteAttentionEntity = useMemo(() => toAttentionQuoteEntity(task ?? null), [task]);
  useAttentionEntity("TASK_QUOTE", quote?.id, quoteAttentionEntity);

  // The task's image layouts — the pool the "Layout Aprovado" picker chooses from
  // (billing edits an existing task, so the candidates are its persisted layouts).
  const layoutImageOptions = useMemo(() => {
    const layouts = (task as any)?.layouts || [];
    return layouts
      .map((layout: any) => {
        const file = layout.file || layout;
        return {
          id: file.id,
          layoutId: layout.id,
          filename: file.filename,
          originalName: file.originalName,
          thumbnailUrl: file.thumbnailUrl || null,
          status: layout.status,
          mimetype: file.mimetype,
          path: file.path || null,
          size: file.size,
        };
      })
      .filter((o: any) => (o.mimetype || "").startsWith("image/"));
  }, [task]);

  // Fetch invoices — polls every 3s during generation
  // AS FATURAS QUE COBRAM ESTE VEÍCULO — pela rota do ORÇAMENTO, filtradas pela
  // cobertura. A rota por tarefa devolvia VAZIO numa fatura conjunta (ali
  // `Invoice.taskId` é nulo), e era ela que alimentava o "pular para o Resumo
  // quando já há fatura" e toda a exibição de boleto e NFS-e desta tela.
  const { data: invoicesData } = useTaskBillingInvoices(id, task?.quoteId ?? undefined, {
    refetchInterval: isGenerating ? 3000 : false,
  });
  const invoices = invoicesData?.data || [];

  // Stop polling when all bank slips/NFSe are in terminal states
  useEffect(() => {
    if (!isGenerating || invoices.length === 0) return;
    const allReady = invoices.every((inv: any) => {
      const installments = inv.installments || [];
      const nfseDocuments = inv.nfseDocuments || [];
      const bankSlipsReady = installments.every((inst: any) => {
        if (!inst.bankSlip) return true;
        return !["CREATING", "REGISTERING"].includes(inst.bankSlip.status);
      });
      const nfseReady = nfseDocuments.every(
        (doc: any) => !["PENDING", "PROCESSING"].includes(doc.status),
      );
      return bankSlipsReady && nfseReady;
    });
    if (allReady) setIsGenerating(false);
  }, [isGenerating, invoices]);

  // Form — billing-relevant task fields + quote fields
  const form = useForm({
    mode: "onChange",
    defaultValues: {
      // Task fields (billing-relevant subset)
      name: "" as string,
      customerId: "" as string,
      plate: "" as string,
      serialNumber: "" as string,
      chassisNumber: "" as string,
      /**
       * O PEDIDO DE COMPRA DO CLIENTE, DESTE veículo
       * (`Task.customerOrderNumber`). Irmão da placa e da série, no mesmo passo
       * que elas — os outros veículos do orçamento se editam abrindo cada um.
       */
      customerOrderNumber: null as string | null,
      // Foto da plaqueta (VIN). `null` é o valor EXPLÍCITO de "removida" — `undefined` faria a
      // API pular o campo e a foto antiga sobreviveria a uma remoção.
      vinPlateId: null as string | null,
      category: "" as string,
      implementType: IMPLEMENT_TYPE.REFRIGERATED as string,
      details: "" as string,
      finishedAt: null as Date | null,
      // Quote fields
      status: "" as string,
      // Optional reason captured by the BillingStepReview reject/cancel dialog.
      // Forwarded to taskQuoteService.updateStatus when transitioning to PENDING.
      statusReason: "" as string,
      expiresAt: null as Date | null,
      subtotal: 0,
      total: 0,
      services: [] as any[],
      customerConfigs: [] as any[],
      guaranteeYears: null as number | null,
      customGuaranteeText: null as string | null,
      customForecastDays: null as number | null,
      simultaneousTasks: null as number | null,
      layoutFileIds: [] as string[],
      /**
       * JUNTO, SEPARADO OU EM LOTES — e a repartição dos veículos.
       *
       * A escolha existia só no assistente de Orçamento, e esta tela não mandava
       * o campo: o FINANCEIRO, que é quem fatura, não tinha como separar sem
       * voltar ao Comercial. Agora ela vive aqui também, com o mesmo controle no
       * mesmo lugar.
       */
      billingSplit: "JOINT" as "JOINT" | "PER_TASK" | "CUSTOM",
      billingGroups: [] as string[][],
    },
  });

  /** As configurações do FORMULÁRIO — a prévia mostra o que acabou de ser digitado. */
  const formConfigsForPreview = form.watch("customerConfigs") as any[];

  /**
   * AS FATURAS QUE ESTA APROVAÇÃO VAI GERAR — o que a confirmação pré-visualiza.
   *
   * Espelha `internalApprove.targetConfigs` no servidor: as fatias ainda não
   * aprovadas e, quando a cobrança é fatiada, só as que cobrem o veículo ABERTO.
   * Sem o filtro o diálogo dizia "serão gerados apenas os documentos deste
   * veículo" logo acima das prévias das QUATRO notas e dos QUATRO boletos do
   * orçamento inteiro — e depois de aprovar o primeiro caminhão ele ainda
   * mostrava a nota dele, já emitida, como se fosse sair de novo.
   */
  const configsForApprovalPreview = useMemo(() => {
    const configs = ((formConfigsForPreview ?? []) as any[]).filter((c) => !c?.billingApprovedAt);
    if (!isPerVehicleBilling || !task?.id) return configs;
    const covering = configs.filter((c) => {
      const ids: string[] =
        (Array.isArray(c?.taskIds) && c.taskIds.length > 0
          ? c.taskIds
          : ((c?.coveredTasks ?? []) as any[]).map((r) => r.taskId)) ?? [];
      return ids.length === 0 || ids.includes(task.id);
    });
    return covering.length > 0 ? covering : configs;
  }, [formConfigsForPreview, isPerVehicleBilling, task?.id]);

  /**
   * AS MESMAS FATURAS, COM O VALOR QUE ELAS COBRAM.
   *
   * O formulário guarda `subtotal`/`total` POR VEÍCULO — é o que
   * `billing-step-services.recalculateTotals` escreve, e é a convenção que o
   * assistente de Orçamento já usa. A pré-visualização, porém, desenha o BOLETO
   * e a NOTA, que cobram `por veículo × veículos cobertos`: sem esta conversão o
   * diálogo irreversível mostrava três boletos de R$ 366,81 logo antes de o
   * banco registrar três de R$ 1.467,25.
   *
   * A conversão fica AQUI e não dentro da prévia de propósito: lá dentro
   * `config.total` significa "o que esta fatura cobra", e é bom que continue
   * significando só isso.
   */
  const configsForPreviewAtInvoiceScale = useMemo(
    () =>
      configsForApprovalPreview.map((c: any) => {
        const covered =
          (Array.isArray(c?.taskIds) && c.taskIds.length > 0
            ? c.taskIds.length
            : ((c?.coveredTasks ?? []) as any[]).length) || quoteVehicles || 1;
        const escala = (v: unknown) => Math.round((Number(v) || 0) * covered * 100) / 100;
        return { ...c, subtotal: escala(c?.subtotal), total: escala(c?.total) };
      }),
    [configsForApprovalPreview, quoteVehicles],
  );

  // Unsaved changes guard — mirrors the Orçamento wizard. It was absent here, which was survivable
  // while leaving meant a deliberate Back press; with the record pager, discarding a half-edited
  // faturamento is one click away from the wizard's own "Próximo".
  const { showDialog, confirmNavigation, cancelNavigation, guardedNavigate, allowNavigation } = useUnsavedChangesGuard({
    isDirty: form.formState.isDirty,
    isSubmitting: isSaving,
  });

  // Ordered sibling ids + the prev/next widget. Declared up here (before the loading/not-found
  // early returns) because these are hooks; the widget itself is rendered in `headerExtra` further
  // down, left of "Ver Dossiê" and clear of the wizard's own step buttons.
  const { ids: siblingIds, complete: siblingIdsComplete } = useQuoteSiblingIds(BILLING_FALLBACK_LIST_QUERY, id ?? "", siblingState);
  const recordNav = useRecordNavigation({
    ids: siblingIds,
    currentId: id ?? "",
    toRoute: (rid) => routes.financial.billing.details(rid),
    // Carried forward on every hop so the pager, the "voltar" target and the reconstructed list
    // all survive paging.
    state: { returnTo, listQuery: siblingState.listQuery, idsComplete: siblingIdsComplete },
    // No ←/→ here: this is a form, and the hook's guard only skips a FOCUSED input, so an arrow
    // key pressed with focus on the page body would page away mid-edit.
    keyboard: false,
    enabled: !!id,
    // Same reason as the Orçamento page: the guard's pushState patch would catch a bare navigate,
    // but it replays only the URL and would drop the id list the pager runs on.
    onNavigate: guardedNavigate,
  });

  // Populate form when task/quote data loads
  useEffect(() => {
    if (!task) return;

    // Seed the Plaqueta photo. Above the `!quote` early return on purpose: a task without a quote
    // still has a truck, and the field is on the Tarefa step either way.
    const persistedVinPlate = (task.truck as any)?.vinPlate;
    setVinPlateFiles(
      persistedVinPlate
        ? [
            {
              id: persistedVinPlate.id,
              name: persistedVinPlate.originalName || persistedVinPlate.filename || "plaqueta",
              size: persistedVinPlate.size || 0,
              type: persistedVinPlate.mimetype || "image/jpeg",
              lastModified: Date.now(),
              uploaded: true,
              uploadProgress: 100,
              uploadedFileId: persistedVinPlate.id,
              thumbnailUrl: persistedVinPlate.thumbnailUrl,
            } as FileWithPreview,
          ]
        : [],
    );

    const taskFields = {
      name: task.name || "",
      customerId: task.customerId || "",
      plate: task.truck?.plate || "",
      serialNumber: task.serialNumber || "",
      // O pedido de compra DESTE veículo — ver os defaults do formulário.
      customerOrderNumber: task.customerOrderNumber || null,
      chassisNumber: task.truck?.chassisNumber || "",
      vinPlateId: task.truck?.vinPlateId || null,
      category: task.truck?.category || "",
      implementType: task.truck?.implementType || IMPLEMENT_TYPE.REFRIGERATED,
      details: task.details || "",
      finishedAt: task.finishedAt ? new Date(task.finishedAt) : null,
    };

    if (!quote) {
      form.reset({
        ...taskFields,
        status: "",
        expiresAt: null,
        subtotal: 0,
        total: 0,
        services: [],
        customerConfigs: [],
        guaranteeYears: null,
        customGuaranteeText: null,
        customForecastDays: null,
        simultaneousTasks: null,
      });
      return;
    }

    // Cache customer data
    quote.customerConfigs?.forEach((config: any) => {
      if (config.customer) {
        customersCache.current.set(config.customerId, config.customer);
      }
    });

    form.reset({
      ...taskFields,
      status: quote.status || "PENDING",
      expiresAt: quote.expiresAt ? new Date(quote.expiresAt) : null,
      subtotal: Number(quote.subtotal) || 0,
      total: Number(quote.total) || 0,
      guaranteeYears: quote.guaranteeYears,
      customGuaranteeText: quote.customGuaranteeText,
      customForecastDays: quote.customForecastDays ?? null,
      simultaneousTasks: quote.simultaneousTasks ?? null,
      layoutFileIds: (quote.layoutFiles || []).map((f: any) => f.id),
      billingSplit: ((quote as any).billingSplit ?? "JOINT") as "JOINT" | "PER_TASK" | "CUSTOM",
      // Os LOTES como estão gravados. Lidos das faturas do PRIMEIRO cliente: a
      // repartição é a mesma para todos (cada um cobra os mesmos veículos, pelos
      // serviços dele), e unir as coberturas de dois clientes daria cada veículo
      // duas vezes.
      billingGroups: dedupeConfigsByCustomer(quote.customerConfigs ?? []).coverageGroups,
      // Sort by `position` explicitly: this page's custom `quote.include` replaces the
      // repository default that carried `orderBy: { position: "asc" }`, so the rows would
      // otherwise arrive in arbitrary DB order and defeat the drag-to-reorder step.
      services: [...(quote.services || [])]
        .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
        .map((s: any) => ({
          id: s.id,
          description: s.description || "",
          observation: s.observation || null,
          amount: Number(s.amount) || 0,
          invoiceToCustomerId: s.invoiceToCustomerId || null,
        })),
      customerConfigs: (quote.customerConfigs || []).map((config: any) => ({
        // A IDENTIDADE DA FATURA. Já era lida aqui, mas o schema da API não
        // declarava a chave e o zod a APAGAVA do payload — quatro faturas do
        // mesmo cliente chegavam indistinguíveis ao servidor e a última gravava
        // por cima das outras três. Agora ela viaja e é a primeira tentativa de
        // casamento.
        id: config.id,
        customerId: config.customerId,
        // A COBERTURA — de quais veículos esta fatura é. É o que faz o passo
        // saber que é "do caminhão 37" em vez de "Cliente 2", e é o que impede a
        // gravação de refatiar sem querer: mandando a cobertura de volta, o
        // servidor não reexpande pelo modo.
        taskIds: ((config.coveredTasks ?? []) as Array<{ taskId: string }>).map((r) => r.taskId),
        coveredTasks: config.coveredTasks ?? [],
        // Quando ESTA fatura foi aprovada. Fatura aprovada tem a cobertura
        // congelada e não se refatia — a tela precisa saber para não oferecer.
        billingApprovedAt: config.billingApprovedAt ?? null,
        subtotal: Number(config.subtotal) || 0,
        total: Number(config.total) || 0,
        discountType: config.discountType || "NONE",
        discountValue:
          config.discountValue != null ? Number(config.discountValue) : null,
        discountReference: config.discountReference || null,
        paymentCondition: config.paymentCondition || null,
        paymentConfig: (config.paymentConfig as any) || null,
        customPaymentText: config.customPaymentText || null,
        generateInvoice: config.generateInvoice !== false,
        generateBankSlip: config.generateBankSlip !== false,
        responsibleId: config.responsibleId || null,
        // Contato do responsável escolhido para ESTE faturamento — é o que a emissão usa
        // quando o cadastro do cliente não tem telefone/e-mail, então o Resumo e a
        // pré-visualização precisam dele para não mostrarem contato vazio numa nota que
        // sai preenchida. Não é reenviado no save (o payload lista os campos um a um).
        responsible: config.responsible
          ? {
              id: config.responsible.id,
              name: config.responsible.name,
              email: config.responsible.email ?? null,
              phone: config.responsible.phone ?? null,
            }
          : null,
        customerData: {
          corporateName: config.customer?.corporateName || "",
          fantasyName: config.customer?.fantasyName || "",
          cnpj: config.customer?.cnpj || "",
          cpf: config.customer?.cpf || "",
          address: config.customer?.address || "",
          addressNumber: config.customer?.addressNumber || "",
          addressComplement: config.customer?.addressComplement || "",
          neighborhood: config.customer?.neighborhood || "",
          city: config.customer?.city || "",
          state: config.customer?.state || "",
          zipCode: config.customer?.zipCode || "",
          stateRegistration: config.customer?.stateRegistration || "",
          municipalRegistration: config.customer?.municipalRegistration || "",
          // Contato só para a pré-visualização da NFS-e — não é editado nem reenviado no save.
          email: config.customer?.email || "",
          phones: config.customer?.phones || [],
          streetType: config.customer?.streetType || null,
          registrationStatus: config.customer?.registrationStatus || null,
        },
      })),
    }, { keepDirtyValues: true }); // preserve user edits on background refetch

    // Load layout files from the included layoutFiles relation (array, up to 2)
    // originalName so a quote layout (a private CLONE of a task layout — kept
    // originalName, generated filename) matches its task-layout twin in the picker
    // instead of rendering as a separate "orphan" tile.
    const toLayoutFile = (file: any): FileWithPreview => ({
      id: file.id,
      name: file.originalName || file.filename || "layout",
      size: file.size || 0,
      type: file.mimetype || "application/octet-stream",
      lastModified: Date.now(),
      uploaded: true,
      uploadProgress: 100,
      uploadedFileId: file.id,
      thumbnailUrl: file.thumbnailUrl,
    } as FileWithPreview);

    setLayoutFiles((quote.layoutFiles || []).map(toLayoutFile));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id, quote?.id]); // use IDs — object refs change on every refetch and would wipe unsaved edits

  // Dynamic steps: Tarefa → Serviços → Cliente(s) → [Proposta] → Resumo
  const customerConfigs = form.watch("customerConfigs") || [];

  // Skip to summary step when invoices already exist
  const hasInitializedStep = useRef(false);
  // No per-record reset needed here: the page is keyed by `:id` (see BillingDetailPage), so a
  // prev/next hop remounts and this ref starts false again.
  useEffect(() => {
    if (hasInitializedStep.current) return;
    if (invoices.length > 0 && customerConfigs.length > 0) {
      // 2 base steps + N customer steps + optional proposta step + 1 summary step
      const summaryStep = 2 + customerConfigs.length + (canSeeBudgetInfoStep ? 1 : 0) + 1;
      setCurrentStep(summaryStep);
      hasInitializedStep.current = true;
    }
  }, [invoices, customerConfigs]); // eslint-disable-line react-hooks/exhaustive-deps

  const steps = useMemo(() => {
    const base: Array<{ id: number; name: string; description: string }> = [
      // "Tarefa", sempre: este passo define a tarefa ABERTA. A relação dos
      // veículos é conferida no Resumo.
      { id: 1, name: "Tarefa", description: "Dados da tarefa e faturamento" },
    ];
    if (canSeeBudgetInfoStep) {
      base.push({ id: base.length + 1, name: "Proposta", description: "Layout e garantia" });
    }
    base.push({ id: base.length + 1, name: "Serviços", description: "Serviços e preços" });
    // ═══════════════════════════════════════════════════════════════════════
    // UM PASSO POR FATURA — e cada passo diz de QUAL VEÍCULO ele é
    // ═══════════════════════════════════════════════════════════════════════
    //
    // Os passos se chamavam "Cliente 1", "Cliente 2", "Cliente 3", "Cliente 4",
    // os quatro com o MESMO nome de cliente na descrição, porque num orçamento
    // cobrado veículo a veículo há uma fatura por caminhão e todas são do mesmo
    // cliente. Nada na tela dizia qual passo era qual caminhão: o operador
    // editava o segundo achando que era o segundo veículo, e a gravação —
    // reenviando as quatro sem cobertura — aplicava o último a todos.
    //
    // Agora o rótulo é o VEÍCULO quando há mais de uma fatura, e continua sendo
    // o CLIENTE quando há mais de um cliente. Num orçamento de um veículo e um
    // cliente nada muda: "Cliente 1" era e continua sendo o rótulo certo.
    const configsHaveSplit = customerConfigs.length > 1 && !hasMultipleCustomersOf(customerConfigs);
    customerConfigs.forEach((config: any, i: number) => {
      const cached = customersCache.current.get(config.customerId);
      const name =
        config.customerData?.fantasyName ||
        config.customerData?.corporateName ||
        cached?.fantasyName ||
        "Cliente";
      const coverage = coverageSummary(config, quoteVehicles, quoteVehicleRows as any);
      base.push({
        id: base.length + 1,
        name: configsHaveSplit ? `Fatura ${i + 1}` : `Cliente ${i + 1}`,
        // A descrição é o que o operador lê para se situar: com fatias, o
        // veículo (ou o lote); sem fatias, o cliente, como sempre foi.
        description: configsHaveSplit ? coverage : name,
      });
    });
    base.push({ id: base.length + 1, name: "Resumo", description: "Revisão final" });
    return base;
  }, [customerConfigs, canSeeBudgetInfoStep, quoteVehicles, quoteVehicleRows]);

  const totalSteps = steps.length;
  // Step layout: 1=Tarefa, 2=Proposta (if visible), then Serviços, customers, Resumo
  const proposalStepIdx = canSeeBudgetInfoStep ? 2 : null;
  const servicesStepIdx = canSeeBudgetInfoStep ? 3 : 2;
  const firstCustomerStepIdx = servicesStepIdx + 1;

  // Attention: open on the customer step that a rule is asking about.
  //
  // Without this the signal is unreachable. Both fields it can point at — the N° do Pedido and the
  // cadastro for the NFS-e — are editable only on a customer step; every customer step is mounted
  // but `display: none` unless it is the current one, and the page opens on step 1 for exactly the
  // records that match (a finished task with no invoice yet). So the user would follow a blinking
  // row into a page with nothing highlighted anywhere — and leaving acks the rule for four hours.
  // Only fires when a step was not already chosen for another reason ("jump to Resumo when
  // invoices exist" wins, and the Resumo shows both gaps too).
  const orderNumberAttention = useAttentionField("TASK_QUOTE", quote?.id, "orderNumber");
  const orderNumberAttentionActive = !!orderNumberAttention?.active;
  const customerDataAttention = useAttentionField("TASK_QUOTE", quote?.id, "customerData");
  const customerDataAttentionActive = !!customerDataAttention?.active;
  useEffect(() => {
    if (hasInitializedStep.current) return;
    if (invoices.length > 0) return;
    if (!orderNumberAttentionActive && !customerDataAttentionActive) return;
    // Wait for the configs to hydrate — latching on an empty list would spend the one-shot before
    // there is anything to point at.
    if (customerConfigs.length === 0) return;
    // Latch FIRST, unconditionally. `customerConfigs` is a `form.watch`, so it is a fresh array on
    // every keystroke; leaving the latch inside the `idx >= 0` branch meant that while nothing
    // matched, the effect stayed live forever — and the moment the user cleared a field to retype
    // it (say, on the Resumo) `idx` flipped and this teleported them off the step mid-edit.
    hasInitializedStep.current = true;
    // First config the active rule(s) actually name — a multi-customer quote must land on the
    // one with the gap, not on whichever customer happens to be first.
    const idx = customerConfigs.findIndex((c: any) => {
      if (c?.generateInvoice === false) return false; // no nota, so neither rule applies to it
      if (orderNumberAttentionActive && c?.customerId === PINNED_CUSTOMERS.IBIPORA && !c?.orderNumber) return true;
      return customerDataAttentionActive && !hasCompleteBillingCustomerData(c?.customerData);
    });
    if (idx < 0) return;
    setCurrentStep(firstCustomerStepIdx + idx);
  }, [orderNumberAttentionActive, customerDataAttentionActive, invoices.length, customerConfigs, firstCustomerStepIdx]);

  const STATUSES_REQUIRING_COMPLETE_DATA = [
    "BUDGET_APPROVED",
    "BILLING_APPROVED",
  ];

  // Step validation. Parameterized by step (not read off `currentStep`) so a
  // jump can run every gate between here and the target — see handleStepClick.
  const validateStep = useCallback((step: number) => {
    if (step === 1) {
      const configs = form.getValues("customerConfigs") || [];
      if (configs.length === 0) {
        toast.error("Selecione pelo menos um cliente para faturamento");
        return false;
      }
      return true;
    }
    if (step === servicesStepIdx) {
      const services = form.getValues("services") || [];
      const validServices = services.filter((s: any) => s.description?.trim());
      if (validServices.length === 0) {
        toast.error("Adicione pelo menos um serviço");
        return false;
      }
      return true;
    }
    return true;
  }, [form, servicesStepIdx]);

  const validateCurrentStep = useCallback(() => validateStep(currentStep), [validateStep, currentStep]);

  // Validate customer required fields — only called when status requires it
  const validateCustomerData = useCallback((): boolean => {
    const configs = form.getValues("customerConfigs") || [];
    const services = form.getValues("services") || [];
    const targetStatus = form.getValues("status");
    const validServices = services.filter((s: any) => s.description?.trim());

    if (targetStatus === "BILLING_APPROVED") {
      const negativeAmountServices = validServices.filter(
        (s: any) => Number(s.amount) < 0,
      );
      if (negativeAmountServices.length > 0) {
        setCurrentStep(servicesStepIdx);
        toast.error("Serviços com valor negativo", {
          description: `${negativeAmountServices.length} serviço(s) com valor negativo. Serviços não podem ter valor negativo para faturamento.`,
        });
        return false;
      }
    }

    // ⚠️ CLIENTES DISTINTOS, nunca FATURAS. Num orçamento cobrado veículo a
    // veículo há uma fatura por caminhão, TODAS do mesmo cliente: contar faturas
    // fazia esta guarda exigir `invoiceToCustomerId` em todo serviço e RECUSAR a
    // aprovação com um erro impossível de obedecer — o seletor "Faturar Para" só
    // aparece quando há mais de um cliente. Era o bloqueio que impedia faturar um
    // orçamento de quatro veículos de um cliente só.
    if (hasMultipleCustomersOf(configs)) {
      const unassigned = validServices.filter((s: any) => !s.invoiceToCustomerId);
      if (unassigned.length > 0) {
        setCurrentStep(servicesStepIdx);
        toast.error("Serviços sem cliente atribuído", {
          description: "Todos os serviços devem ter um cliente selecionado em 'Faturar Para'",
        });
        return false;
      }
    }

    for (let i = 0; i < configs.length; i++) {
      const config = configs[i];
      const data = config.customerData || {};
      const paymentConfig = form.getValues(`customerConfigs.${i}.paymentConfig` as any);
      const paymentCondition = form.getValues(`customerConfigs.${i}.paymentCondition` as any);
      // The customer half comes from the SHARED requirement list, which is also what the attention
      // rule `task-quote.billing-customer-incomplete` builds its predicate from — so a row can
      // never blink over a field this gate would have accepted, or stay quiet about one it rejects.
      //
      // Which is why `generateInvoice === false` is skipped here too: the rule skips it, and the
      // per-input highlight skips it. Without this the gate rejected a config no rule had ever
      // named, dropping the user on a step where nothing was highlighted and no row had blinked.
      // Condição de Pagamento is still required — that one is about collecting, not about the nota.
      const skipCadastro = config.generateInvoice === false;
      const errors: string[] = skipCadastro ? [] : missingBillingCustomerLabels(data);
      if (!paymentCondition && !(paymentConfig as any)?.type) errors.push("Condição de Pagamento");
      if (errors.length > 0) {
        setCurrentStep(firstCustomerStepIdx + i);
        const name = data.fantasyName || data.corporateName || `Cliente ${i + 1}`;
        // Com mais de uma fatura o nome do cliente se repete, e a mensagem
        // mandava o operador para "um passo do mesmo cliente" sem dizer qual.
        // O veículo desempata.
        const where =
          configs.length > 1 && coveredTaskCount(config) > 0
            ? `${name} (${coverageSummary(config, quoteVehicles, quoteVehicleRows as any)})`
            : name;
        toast.error(`${where} - campos obrigatórios`, { description: errors.join(", ") });
        return false;
      }
    }

    return true;
  }, [form, servicesStepIdx, firstCustomerStepIdx, quoteVehicles, quoteVehicleRows]);

  const nextStep = useCallback(() => {
    if (validateCurrentStep()) {
      setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
    }
  }, [validateCurrentStep, totalSteps]);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  }, []);

  // Step marker click. Back is free (nothing is lost by revisiting); forward runs
  // EVERY gate between here and the target, exactly as pressing "Próximo" that
  // many times would — the first refusal parks the user on the offending step,
  // which already surfaced its own reason. A user who cannot edit skips the gates
  // entirely: there is nothing to validate on a read-only form.
  const handleStepClick = useCallback(
    (step: number) => {
      if (step === currentStep) return;
      const target = Math.min(step, totalSteps);
      if (target < currentStep || !canEdit) {
        setCurrentStep(target);
        return;
      }
      for (let s = currentStep; s < target; s++) {
        if (!validateStep(s)) {
          setCurrentStep(s);
          return;
        }
      }
      setCurrentStep(target);
    },
    [currentStep, canEdit, validateStep, totalSteps],
  );

  /**
   * Foto da plaqueta — imagem única, só o ÚLTIMO arquivo vale (`maxFiles={1}` já limita a seleção,
   * mas o estado é normalizado aqui de qualquer forma).
   *
   * Um arquivo JÁ ENVIADO viaja como `truck.vinPlateId`; um arquivo novo ainda não tem id, então
   * `vinPlateId` fica `null` até `executeSave` fazer o upload e preencher. Limpar o campo manda
   * `null` explícito — é assim que a foto é removida.
   */
  const handleVinPlateFilesChange = useCallback(
    (files: FileWithPreview[]) => {
      const picked = files.slice(-1);
      setVinPlateFiles(picked);
      const existing = picked.find((f) => f.uploaded);
      form.setValue("vinPlateId", (existing?.uploadedFileId || existing?.id || null) as never, {
        shouldDirty: true,
      });
    },
    [form],
  );

  // Core save logic
  const executeSave = useCallback(async (options?: { approveVehicleSlice?: boolean }) => {
    if (!quote?.id || !task?.id) return;

    const formData = form.getValues();
    const targetStatus = formData.status;
    /**
     * ESTA GRAVAÇÃO APROVA A FATIA DO VEÍCULO ABERTO?
     *
     * Duas portas chegam aqui: a transição de status da PRIMEIRA aprovação
     * (BUDGET_APPROVED → BILLING_APPROVED, com o rótulo "(este veículo)") e a
     * ação sintética do seletor, que é como as fatias 2..N são faturadas — nelas
     * o status do orçamento não muda, porque ele já está no ciclo de recebíveis.
     */
    const approveVehicleSlice =
      !!options?.approveVehicleSlice ||
      (targetStatus === "BILLING_APPROVED" &&
        targetStatus !== quote.status &&
        isPerVehicleBilling &&
        !!task?.id);

    setIsSaving(true);
    try {
      // 0. Upload a newly picked Plaqueta photo, so step 1 can send its id. A failure here must
      // NOT abort the save: the rest of the billing data is what the user came for, and the
      // interceptor already toasted. `vinPlateId` then stays at whatever it was.
      let vinPlateId: string | null = (formData as any).vinPlateId ?? null;
      const pendingVinPlate = vinPlateFiles.find((f) => !f.uploaded);
      if (pendingVinPlate) {
        try {
          const response = await uploadSingleFile(pendingVinPlate, { fileContext: "truckVinPlate" });
          if (response.success && response.data) vinPlateId = response.data.id;
        } catch (error: any) {
          toast.error(`Erro ao enviar a foto da plaqueta: ${error.message}`);
        }
      }

      // 1. Update billing-relevant task fields
      const taskUpdateData: any = {
        name: formData.name || undefined,
        customerId: formData.customerId || undefined,
        // Send null (not undefined/"") when cleared so the API actually clears it:
        // the optional-description schema turns "" → undefined and the repo skips
        // undefined, so anything but explicit null silently persists the old value.
        details: formData.details?.trim() ? formData.details : null,
        serialNumber: formData.serialNumber || null,
        truck: {
          // null explícito, nunca undefined — undefined é "não mexe", então
          // apagar a placa ou o chassi mantinha o valor antigo.
          plate: formData.plate || null,
          chassisNumber: formData.chassisNumber || null,
          // Explicit null, never undefined: undefined is how the repo is told "don't touch",
          // so clearing the field would silently keep the old photo.
          vinPlateId,
          category: formData.category || undefined,
          implementType: formData.implementType || undefined,
        },
      };

      await updateTaskAsync({ id: task.id, data: taskUpdateData });

      // 2. Update customer data for NFS-e
      for (const config of formData.customerConfigs) {
        if (config.customerData && config.customerId) {
          try {
            await customerService.updateCustomer(config.customerId, {
              // First entry of NFSE_REQUIRED_CUSTOMER_FIELDS, and the step renders an input for it
              // — but it was missing here, so filling it was silently discarded and
              // `billing-customer-incomplete` kept firing over a field the user had already typed.
              fantasyName: config.customerData.fantasyName || undefined,
              corporateName: config.customerData.corporateName || undefined,
              cnpj: config.customerData.cnpj || undefined,
              cpf: config.customerData.cpf || undefined,
              address: config.customerData.address || undefined,
              addressNumber: config.customerData.addressNumber || undefined,
              addressComplement: config.customerData.addressComplement || undefined,
              neighborhood: config.customerData.neighborhood || undefined,
              city: config.customerData.city || undefined,
              state: config.customerData.state || undefined,
              zipCode: config.customerData.zipCode || undefined,
              stateRegistration: config.customerData.stateRegistration || undefined,
              municipalRegistration: config.customerData.municipalRegistration || undefined,
              streetType: config.customerData.streetType || undefined,
              registrationStatus: config.customerData.registrationStatus ?? undefined,
            });
          } catch {
            // Error toast is emitted by the axios error interceptor.
          }
        }
      }

      // 3. Upload new layout files if any (COMMERCIAL/ADMIN step). Up to 2 ordered
      // File ids.
      let layoutFileIds: string[] = (formData.layoutFileIds as string[]) || [];
      if (canSeeBudgetInfoStep) {
        const resolvedLayoutIds: string[] = [];
        for (const lf of layoutFiles) {
          if (!lf.uploaded) {
            try {
              const response = await uploadSingleFile(lf, {
                fileContext: "quote-layouts",
              });
              if (response.success && response.data) {
                resolvedLayoutIds.push(response.data.id);
              }
            } catch (error: any) {
              toast.error(`Erro ao enviar layout: ${error.message}`);
            }
          } else {
            const existingId = (lf as any).uploadedFileId || lf.id || null;
            if (existingId) resolvedLayoutIds.push(existingId);
          }
        }
        layoutFileIds = resolvedLayoutIds;
      }

      // 4. Update quote data
      // When the quote is post-billing-approval (locked), only send fields the backend allows
      // editing on a locked quote. Sending billing-structural fields (subtotal, services,
      // customerConfigs) would throw a 400 and prevent the status update from executing.
      const BILLING_LOCKED_STATUSES = ["BILLING_APPROVED", "UPCOMING", "DUE", "PARTIAL", "SETTLED"];
      const isQuoteLocked = quote.status && BILLING_LOCKED_STATUSES.includes(quote.status);

      // ═══════════════════════════════════════════════════════════════════════
      // A DIVISÃO DO FATURAMENTO MUDOU?
      // ═══════════════════════════════════════════════════════════════════════
      //
      // Duas gravações diferentes, e confundi-las é o defeito:
      //
      //   NÃO MUDOU → cada fatura volta como veio, com o seu `id` e a sua
      //     cobertura. É o que torna a gravação idempotente: sem a cobertura, o
      //     servidor entende "decida pelo modo" e reexpande — e os termos da
      //     ÚLTIMA fatura vão parar em todas as outras.
      //
      //   MUDOU → o que vai é UMA linha por cliente, sem `id` e sem cobertura
      //     (ou com o lote, quando é lote), mais o modo. O servidor refatia: as
      //     faturas que sobram são apagadas, as novas herdam as condições da
      //     primeira do mesmo cliente.
      const persistedSplit = ((quote as any).billingSplit ?? "JOINT") as BillingSplitValue;
      const nextBillingSplit = ((formData as any).billingSplit ??
        persistedSplit) as BillingSplitValue;
      const quoteTaskIds = quoteVehicleRows.map((v) => v.id);
      const groupsKey = (groups: string[][]) =>
        groups
          .map((g) => [...g].sort().join("|"))
          .sort()
          .join("//");
      const persistedGroups = dedupeConfigsByCustomer(quote.customerConfigs ?? []).coverageGroups;
      const formGroups = groupsForSplit(
        nextBillingSplit,
        quoteTaskIds,
        (formData as any).billingGroups,
      );
      const billingSplitChanged =
        nextBillingSplit !== persistedSplit ||
        (quoteTaskIds.length > 1 && groupsKey(formGroups) !== groupsKey(persistedGroups));

      const configTerms = (c: any) => ({
        customerId: c.customerId,
        subtotal: Number(c.subtotal) || 0,
        total: Number(c.total) || 0,
        discountType: c.discountType || "NONE",
        discountValue: c.discountValue != null ? Number(c.discountValue) : null,
        discountReference: c.discountReference || null,
        paymentCondition: c.paymentCondition || null,
        paymentConfig: c.paymentConfig ?? null,
        customPaymentText: c.customPaymentText || null,
        generateInvoice: c.generateInvoice !== false,
        generateBankSlip: c.generateBankSlip !== false,
        responsibleId: c.responsibleId || null,
      });

      const billingConfigsPayload = billingSplitChanged
        ? expandConfigsIntoLots(
            dedupeConfigsByCustomer(formData.customerConfigs as any).configs.map(configTerms),
            nextBillingSplit,
            quoteTaskIds,
            (formData as any).billingGroups,
          )
        : formData.customerConfigs.map((c: any) => ({
            ...(c.id && { id: c.id }),
            ...configTerms(c),
            ...(Array.isArray(c.taskIds) && c.taskIds.length > 0 ? { taskIds: c.taskIds } : {}),
          }));

      const quotePayload: any = isQuoteLocked
        ? {
            expiresAt: formData.expiresAt,
            guaranteeYears: formData.guaranteeYears,
            customGuaranteeText: formData.customGuaranteeText,
            customForecastDays: canSeeBudgetInfoStep ? formData.customForecastDays : undefined,
            simultaneousTasks: canSeeBudgetInfoStep ? formData.simultaneousTasks : undefined,
            layoutFileIds: canSeeBudgetInfoStep ? layoutFileIds : undefined,
          }
        : {
            expiresAt: formData.expiresAt,
            subtotal: formData.subtotal,
            total: formData.total,
            guaranteeYears: formData.guaranteeYears,
            customGuaranteeText: formData.customGuaranteeText,
            customForecastDays: canSeeBudgetInfoStep ? formData.customForecastDays : undefined,
            simultaneousTasks: canSeeBudgetInfoStep ? formData.simultaneousTasks : undefined,
            layoutFileIds: canSeeBudgetInfoStep ? layoutFileIds : undefined,
            services: formData.services
              .filter((s: any) => s.description?.trim())
              .map((s: any) => ({
                ...(s.id && { id: s.id }),
                description: s.description,
                observation: s.observation || null,
                amount: Number(s.amount) || 0,
                invoiceToCustomerId: s.invoiceToCustomerId || null,
              })),
            ...(billingSplitChanged ? { billingSplit: nextBillingSplit } : {}),
            customerConfigs: billingConfigsPayload,
          };

      // Status handling — two phases, deterministic:
      //  (1) The VALUE update pins the CURRENT status so the backend's
      //      auto-revert-to-PENDING (which fires only when no status is sent) is
      //      suppressed — editing values keeps the existing approval.
      //  (2) The status TRANSITION runs through the dedicated /status endpoint
      //      AFTER the values are saved, so it validates the transition graph AND
      //      its prerequisites (e.g. "total > 0") against the freshly-persisted
      //      values — this is why an immediate/pre-save status change could fail
      //      and leave the quote PENDING. It also handles BILLING_APPROVED's
      //      invoice/boleto/NFS-e generation. Forwards the optional reject reason.
      // Locked quotes (BILLING_APPROVED+) send a reduced payload with no status
      // (those statuses don't auto-revert and the generic path can't change them).
      const statusChanged = targetStatus && targetStatus !== quote.status;

      if (!isQuoteLocked) {
        quotePayload.status = quote.status;
      }

      await taskQuoteService.update(quote.id, quotePayload);

      // ═══════════════════════════════════════════════════════════════════════
      // O PEDIDO DE COMPRA — DESTE VEÍCULO
      // ═══════════════════════════════════════════════════════════════════════
      //
      // `Task.customerOrderNumber`, e só o do caminhão ABERTO. Escrito por fora
      // do orçamento de propósito: aqui ele costuma estar TRAVADO
      // (`BILLING_APPROVED` em diante) e a guarda de obrigação financeira recusa
      // o corpo inteiro — mas o número do pedido é justamente o que ainda chega
      // depois, quando o cliente o manda e a nota já está para sair.
      //
      // Enviado só quando MUDOU, inclusive vazio (`null`): limpar tem de
      // persistir, não deixar de pé o número de um pedido cancelado.
      const nextOrderNumber = (formData.customerOrderNumber ?? "").trim() || null;
      const savedOrderNumber = (task.customerOrderNumber ?? "").trim() || null;
      if (nextOrderNumber !== savedOrderNumber) {
        await updateTaskAsync({ id: task.id, data: { customerOrderNumber: nextOrderNumber } });
      }

      if (approveVehicleSlice) {
        // A aprovação de faturamento de um orçamento fatiado é um ato DAQUELE
        // veículo, e tem rota própria: `updateStatus` roteia para a aprovação SEM
        // fatia, que fatura os sessenta de uma vez. As duas exigem
        // FINANCEIRO/ADMIN e chegam ao log como linhas distintas — "faturei o
        // orçamento inteiro" e "faturei o caminhão 37" não são o mesmo ato.
        //
        // Fora do caminho de transição de propósito: da segunda fatia em diante
        // o orçamento já está em UPCOMING/DUE/PARTIAL e não há transição
        // nenhuma a replicar. Passar por `getQuoteStatusPath` ali faria a tela
        // mover o status do orçamento para trás só para poder aprovar uma fatia.
        await taskQuoteService.internalApproveSlice(quote.id, task.id);
        form.setValue("statusReason" as any, "");
      } else if (statusChanged) {
        // The dropdown gates options by the FORM status, so the user can advance
        // several steps in one session. The server only accepts single legal
        // hops, so replay the whole path hop-by-hop. Guard: never auto-pass
        // THROUGH BILLING_APPROVED as an intermediate (it triggers invoice/boleto
        // generation) — it may only be the final target.
        const path = getQuoteStatusPath(
          quote.status as TASK_QUOTE_STATUS,
          targetStatus as TASK_QUOTE_STATUS,
        );
        if (path.length === 0) {
          throw new Error(
            `Não há um caminho de status válido de "${quote.status}" até "${targetStatus}".`,
          );
        }
        if (path.slice(0, -1).includes("BILLING_APPROVED" as TASK_QUOTE_STATUS)) {
          throw new Error(
            'Aprove o faturamento como uma etapa separada antes de avançar para o próximo status.',
          );
        }
        const reason = (formData as any).statusReason?.trim() || undefined;
        for (const step of path) {
          await taskQuoteService.updateStatus(
            quote.id,
            step as TASK_QUOTE_STATUS,
            step === "PENDING" ? reason : undefined,
          );
        }
        // Clear once consumed so a later edit doesn't accidentally re-send the same reason.
        form.setValue("statusReason" as any, "");
      }

      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      queryClient.invalidateQueries({ queryKey: taskQuoteKeys.all });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboards"] });

      const isBillingApproval =
        approveVehicleSlice ||
        (targetStatus === "BILLING_APPROVED" && targetStatus !== quote.status);
      if (isBillingApproval) {
        setIsGenerating(true);
        toast.success(
          isPerVehicleBilling
            ? "Faturamento deste veículo aprovado! Gerando fatura, boleto e NFS-e..."
            : "Faturamento aprovado! Gerando faturas, boletos e NFS-e...",
          {
            description: "Aguarde a geração ser concluída.",
            duration: 6000,
          },
        );
      } else {
        // The save just succeeded, so the form is no longer worth guarding — without this the
        // guard would prompt on the way out of a successful save.
        allowNavigation();
        navigate(returnTo ?? routes.financial.billing.root);
      }
    } catch {
      // Error toast is emitted by the axios error interceptor.
    } finally {
      setIsSaving(false);
    }
  }, [
    quote?.id,
    quote?.status,
    // A aprovação de UMA fatia depende do recorte de faturamento e do veículo
    // aberto: sem os dois na lista, um `executeSave` memorizado faturaria o
    // orçamento inteiro depois de o operador trocar de veículo pelo paginador.
    isPerVehicleBilling,
    task?.id,
    form,
    queryClient,
    updateTaskAsync,
    navigate,
    layoutFiles,
    vinPlateFiles,
    canSeeBudgetInfoStep,
    returnTo,
  ]);

  // Save handler — validates and shows confirmation for BILLING_APPROVED
  const handleSave = useCallback(async () => {
    if (!quote?.id || !task?.id) return;

    const formData = form.getValues();
    const targetStatus = formData.status;

    const configs = formData.customerConfigs || [];
    const services = formData.services || [];
    if (configs.length === 0) {
      setCurrentStep(1);
      toast.error("Selecione pelo menos um cliente para faturamento");
      return;
    }
    const validServices = services.filter((s: any) => s.description?.trim());
    if (validServices.length === 0) {
      setCurrentStep(servicesStepIdx);
      toast.error("Adicione pelo menos um serviço");
      return;
    }

    if (STATUSES_REQUIRING_COMPLETE_DATA.includes(targetStatus)) {
      if (!validateCustomerData()) return;
    }

    if (targetStatus === "BILLING_APPROVED" && targetStatus !== quote.status) {
      setBillingApprovalDialogOpen(true);
      return;
    }

    await executeSave();
  }, [quote?.id, task?.id, quote?.status, form, validateCustomerData, executeSave, servicesStepIdx]);

  // Loading state
  if (isTaskLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <IconFileInvoice className="h-12 w-12" />
        <p>Tarefa não encontrada</p>
      </div>
    );
  }

  // Build PageHeader actions. Read-only review mode has no step navigation.
  // The record pager is NOT here — it renders in `headerExtra`, left of "Ver Dossiê", so it never
  // sits shoulder to shoulder with the wizard's own "Anterior / Próximo".
  const actions: any[] = [];
  if (!reviewOnly && currentStep > 1) {
    actions.push({
      key: "prev",
      label: "Anterior",
      icon: IconArrowLeft,
      onClick: prevStep,
      variant: "outline" as const,
      disabled: isSaving,
    });
  }
  // Step navigation is available to everyone (read-only viewers included) — only
  // "Salvar" is gated by canEdit. Read-only users skip the edit validation so
  // they can page through freely.
  if (!reviewOnly && currentStep < totalSteps) {
    actions.push({
      key: "next",
      label: "Próximo",
      icon: IconArrowRight,
      onClick: canEdit ? nextStep : () => setCurrentStep((prev) => Math.min(prev + 1, totalSteps)),
      variant: "default" as const,
      disabled: isSaving,
    });
  } else if (canEdit) {
    actions.push({
      key: "save",
      label: "Salvar",
      icon: isSaving ? IconLoader2 : IconCheck,
      onClick: handleSave,
      variant: "default" as const,
      disabled: isSaving,
      loading: isSaving,
    });
  }

  // Step detection: 1=Tarefa, 2=Proposta (COMMERCIAL/ADMIN only), then Serviços, Cliente(s), Resumo
  const isProposalStep = proposalStepIdx !== null && currentStep === proposalStepIdx;
  const isServicesStep = currentStep === servicesStepIdx;
  const isReviewStep = currentStep === totalSteps;

  const taskDisplayName = [task.name, task.serialNumber || task.truck?.plate]
    .filter(Boolean)
    .join(" - ");

  return (
    <PrivilegeRoute
      requiredPrivilege={[
        SECTOR_PRIVILEGES.FINANCIAL,
        SECTOR_PRIVILEGES.ADMIN,
        SECTOR_PRIVILEGES.COMMERCIAL,
        // ACCOUNTING gets read-only access: canEditQuote/canUpdateQuoteStatus
        // both exclude it, so every step input is disabled and the Save action
        // is hidden (canEdit === false).
        SECTOR_PRIVILEGES.ACCOUNTING,
      ]}
    >
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="form"
          title={`Faturamento - ${taskDisplayName}`}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Financeiro", href: routes.financial.root },
            { label: "Faturamento", href: routes.financial.billing.root },
            { label: taskDisplayName },
          ]}
          onBreadcrumbNavigate={(path) => guardedNavigate(path)}
          actions={actions}
          className="flex-shrink-0"
          headerExtra={
            <>
              {/* Left of "Ver Dossiê" on purpose: as a PageAction it lands beside the wizard's own
                  "Anterior / Próximo", and two adjacent pairs of arrows read as one control. */}
              <RecordPager nav={recordNav} keyboard={false} />
              {quote?.id && customerConfigs.length > 0 && (
                <>
                  {/* ⚠️ CLIENTES DISTINTOS, nunca faturas. O dossiê é recortado
                      por CLIENTE; listar faturas fazia um orçamento de quatro
                      veículos de um cliente só mostrar "Cliente 1..4" com o
                      mesmo nome quatro vezes — e com o MESMO `value`, que num
                      combobox é o mesmo item repetido. */}
                  {hasMultipleCustomersOf(customerConfigs) && (
                    <Combobox
                      value={dossieCustomerId}
                      onValueChange={(v) => setDossieCustomerId((v as string) || "all")}
                      options={[
                        { value: "all", label: "Completo" },
                        ...dedupeConfigsByCustomer(customerConfigs).configs.map(
                          (config: any, i: number) => {
                            const cached = customersCache.current.get(config.customerId);
                            const name =
                              cached?.fantasyName ||
                              cached?.corporateName ||
                              config.customerData?.fantasyName ||
                              `Cliente ${i + 1}`;
                            return { value: config.customerId, label: name };
                          },
                        ),
                      ]}
                      searchable={false}
                      clearable={false}
                      className="w-[260px]"
                      triggerClassName="h-8 text-sm"
                    />
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 whitespace-nowrap"
                    onClick={() => {
                      // "Completo" = no customer segment. Substituting the first
                      // config here (as this once did) opens ONE customer's dossiê
                      // while the picker still reads "Completo".
                      const custId = dossieCustomerId === "all" ? null : dossieCustomerId;
                      if (quote?.id) {
                        window.open(
                          routes.customer.serviceReport(custId, quote.id),
                          "_blank",
                        );
                      }
                    }}
                  >
                    <IconExternalLink className="h-4 w-4" />
                    Ver Dossiê
                  </Button>
                </>
              )}
            </>
          }
        />

        {!reviewOnly && <FormSteps steps={steps} currentStep={currentStep} className="flex-shrink-0" onStepClick={handleStepClick} disabled={isSaving} />}

        <div className="flex-1 overflow-y-auto pb-6">
          <FormProvider {...form}>
            {/* Tarefa, Serviços, and customer steps stay mounted (hidden via CSS) to preserve useFieldArray state */}
            {!reviewOnly && (
              <>
                <div style={{ display: currentStep === 1 ? undefined : "none" }}>
                  <BillingStepTask
                    disabled={!canEdit}
                    customersCache={customersCache}
                    initialCustomer={task?.customer}
                    vinPlateFiles={vinPlateFiles}
                    onVinPlateFilesChange={handleVinPlateFilesChange}
                    vehicles={quoteVehicleRows as any}
                  />
                </div>

                {isProposalStep && (
                  <BillingStepBudgetInfo
                    disabled={!canEdit}
                    layoutFiles={layoutFiles}
                    onLayoutFilesChange={setLayoutFiles}
                    layouts={layoutImageOptions}
                  />
                )}

                <div style={{ display: isServicesStep ? undefined : "none" }}>
                  <BillingStepServices disabled={!canEdit} />
                </div>

                {/* Customer steps — always mounted (hidden via CSS) so form values survive navigation */}
                {customerConfigs.map((config: any, i: number) => {
                  const cachedCustomer = customersCache.current.get(config.customerId);
                  return (
                    // ⚠️ A CHAVE NÃO PODE SER O CLIENTE. Num orçamento cobrado
                    // veículo a veículo as N faturas são do MESMO cliente, e
                    // `key={customerId}` repetiria a chave nas N: o React
                    // reaproveita o nó da primeira para todas, e os campos de uma
                    // fatura aparecem na tela de outra. O id da fatura é único; o
                    // índice cobre a fatura ainda não gravada.
                    <div
                      key={config.id || `${config.customerId}-${i}`}
                      style={{ display: currentStep === firstCustomerStepIdx + i ? undefined : "none" }}
                    >
                      <BillingStepCustomer
                        configIndex={i}
                        customer={cachedCustomer}
                        disabled={!canEdit}
                        quoteId={quote?.id}
                        vehicles={billingSplitVehicles}
                        coverage={(config?.taskIds as string[] | undefined) ?? []}
                        approvedBillingCount={approvedBillingCount}
                        hasRunningSignature={hasRunningSignature}
                      />
                    </div>
                  );
                })}
              </>
            )}

            {(isReviewStep || reviewOnly) && (
              <>
                <BillingStepReview
                  task={task}
                  customersCache={customersCache}
                  invoices={invoices}
                  userPrivilege={userPrivilege}
                  disabled={!canEdit}
                  isGenerating={isGenerating}
                  onApproveVehicleBilling={() => {
                    setApprovingVehicleSlice(true);
                    setBillingApprovalDialogOpen(true);
                  }}
                  filterCustomerId={
                    dossieCustomerId !== "all" ? dossieCustomerId : undefined
                  }
                />

                {/* ASSINATURA — só leitura.
                    O faturamento não emite nem cancela coleta (isso é do
                    orçamento, e oferecer o botão nos dois lugares convidaria a
                    reemitir por engano um documento já assinado). O que ele
                    PRECISA mostrar é o estado da assinatura e, sobretudo, se o
                    orçamento andou depois de assinado: aprovar faturamento é
                    irreversível, e emitir nota sobre condições que já não são as
                    do documento assinado é justamente o erro caro. */}
                {quote?.id && (
                  <div className="mt-4">
                    <SignatureEnvelopeCard quoteId={quote.id} canManage={false} />
                  </div>
                )}
              </>
            )}
          </FormProvider>
        </div>
      </div>

      {/* Billing Approval Confirmation Dialog */}
      <AlertDialog open={billingApprovalDialogOpen} onOpenChange={setBillingApprovalDialogOpen}>
        <AlertDialogContent className="max-w-3xl w-[95vw] border-red-500 border-2 max-h-[92vh] overflow-y-auto">
          <AlertDialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <IconAlertCircle className="h-7 w-7 text-red-600 dark:text-red-400" />
              </div>
              <AlertDialogTitle className="text-xl text-red-700 dark:text-red-400">
                {isPerVehicleBilling
                  ? "Faturar Este Veículo - Ação Irreversível"
                  : "Faturamento Aprovado - Ação Irreversível"}
              </AlertDialogTitle>
            </div>
          </AlertDialogHeader>

          {/* Faithful previews of the NFS-e + boletos that will be generated */}
          <div className="my-2">
            <p className="mb-2 text-sm font-medium text-foreground">
              Confira os documentos que serão gerados automaticamente:
            </p>
            {isPerVehicleBilling && (
              // O orçamento cobra veículo a veículo: o que sai daqui é a fatura
              // DESTE caminhão. Sem dizê-lo, quem aprova acha que está fechando
              // os sessenta — e o contrário também assusta.
              <p className="mb-2 text-sm font-semibold text-red-700 dark:text-red-400">
                Este orçamento cobra veículo a veículo ({quoteVehicles} veículos). Serão gerados
                apenas os documentos de{" "}
                {form.watch("serialNumber") || form.watch("plate") || "deste veículo"} — os demais
                continuam aguardando a própria aprovação.
              </p>
            )}
            <BillingDocumentPreviews
              customerConfigs={configsForPreviewAtInvoiceScale}
              services={form.watch("services")}
              nextNfseNumber={nextNfse?.nextNumber ?? null}
              orderNumbersByTask={{
                ...Object.fromEntries(
                  quoteVehicleRows.map((t) => [t.id, t.customerOrderNumber ?? null]),
                ),
                ...(task ? { [task.id]: form.watch("customerOrderNumber") ?? null } : {}),
              }}
              quoteTaskIds={quoteVehicleRows.map((t) => t.id)}
              vehiclesByTask={Object.fromEntries(
                quoteVehicleRows.map((t: any) => [
                  t.id,
                  {
                    serialNumber: t.serialNumber ?? null,
                    plate: t.truck?.plate ?? null,
                    chassisNumber: t.truck?.chassisNumber ?? null,
                    category: t.truck?.category ?? null,
                    implementType: t.truck?.implementType ?? null,
                  },
                ]),
              )}
              budgetNumber={quote?.budgetNumber ?? null}
              task={{
                plate: form.watch("plate"),
                serialNumber: form.watch("serialNumber"),
                chassisNumber: form.watch("chassisNumber"),
                category: form.watch("category"),
                implementType: form.watch("implementType"),
              }}
            />
          </div>

          <div className="rounded-lg border-2 border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30 p-4 my-2 space-y-3">
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">
              Ao confirmar, as seguintes ações serão executadas automaticamente:
            </p>
            <ul className="text-sm text-red-700 dark:text-red-400 space-y-2 list-none">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 font-bold">1.</span>
                <span>
                  <strong>Faturas</strong> serão geradas para cada cliente vinculado ao
                  {isPerVehicleBilling ? " veículo" : " orçamento"}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 font-bold">2.</span>
                <span><strong>Boletos bancários</strong> serão emitidos automaticamente no Sicredi para cada parcela</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 font-bold">3.</span>
                <span><strong>Notas Fiscais (NFS-e)</strong> serão emitidas automaticamente para cada fatura</span>
              </li>
            </ul>
          </div>

          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3 my-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Verifique antes de confirmar:
            </p>
            <ul className="text-sm text-amber-700 dark:text-amber-400 mt-1 space-y-1 list-disc list-inside">
              <li>Valores, descontos e condições de pagamento estão corretos?</li>
              <li>Os dados do(s) cliente(s) estão atualizados (CNPJ/CPF, endereço)?</li>
              <li>As parcelas e datas de vencimento estão configuradas?</li>
            </ul>
          </div>

          <AlertDialogDescription className="text-sm text-muted-foreground mt-1">
            Essa ação não pode ser desfeita facilmente. Boletos e notas fiscais emitidos precisarão
            ser cancelados manualmente caso haja algum erro.
          </AlertDialogDescription>

          <AlertDialogFooter className="mt-2">
            <AlertDialogCancel disabled={isSaving} onClick={() => setApprovingVehicleSlice(false)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isSaving}
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={async () => {
                setBillingApprovalDialogOpen(false);
                const sliceOnly = approvingVehicleSlice;
                setApprovingVehicleSlice(false);
                await executeSave(sliceOnly ? { approveVehicleSlice: true } : undefined);
              }}
            >
              {isSaving
                ? "Processando..."
                : isPerVehicleBilling
                  ? "Confirmar Faturamento Deste Veículo"
                  : "Confirmar Faturamento Aprovado"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UnsavedChangesDialog open={showDialog} onConfirm={confirmNavigation} onCancel={cancelNavigation} />
    </PrivilegeRoute>
  );
};

export default BillingDetailPage;
