import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useForm, useWatch, FormProvider } from "react-hook-form";
import {
  IconArrowLeft,
  IconArrowRight,
  IconLoader2,
  IconCheck,
  IconExternalLink,
} from "@tabler/icons-react";
import { isQuoteValidityExpired } from "@/components/financial/budget/validity";
import { routes } from "@/constants";
import { useTaskDetail, useTaskMutations, taskKeys } from "@/hooks";
import {
  useBudgetByTask,
  useCreateBudget,
  useUpdateBudget,
  budgetKeys,
} from "@/hooks/production/use-budget";
import { budgetService } from "@/api-client/budget";
import {
  canViewQuote,
  canEditQuote,
} from "@/utils/permissions/quote-permissions";
import type { Budget, TASK_QUOTE_STATUS } from "@/types/budget";
import { validateResponsibleRows, syncResponsibleRoles } from "@/components/administration/customer/responsible";
import { useAuth } from "@/contexts/auth-context";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { FormSteps } from "@/components/ui/form-steps";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading";
import { toast } from "@/components/ui/sonner";
import { useAirbrushingCreationGuard } from "@/hooks/production/use-airbrushing-creation-guard";
import { uploadSingleFile } from "@/api-client/file";
import { getCustomerById, getCustomers, getPaintById, getTaskById } from "@/api-client";
import { customerService } from "@/api-client/customer";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useUnsavedChangesGuard } from "@/hooks/common/use-unsaved-changes-guard";
import { UnsavedChangesDialog } from "@/components/ui/unsaved-changes-dialog";
import { readReturnTo } from "@/hooks/common/use-return-to";
import type { FileWithPreview } from "@/components/common/file";
import type { ResponsibleRowData } from "@/types/responsible";
import { getResponsibleRoles } from "@/types/responsible";
// Os passos — os MESMOS da criação (ver `utils/budget-wizard.ts`).
import {
  BudgetWizardStepTask,
  BUDGET_TASK_ANCHORS,
  type BudgetApplyField,
} from "@/components/financial/budget/wizard/budget-wizard-step-task";
import {
  BudgetWizardStepVehicles,
  BUDGET_VEHICLES_ART_ANCHOR,
  type BudgetVehicleApplyField,
} from "@/components/financial/budget/wizard/budget-wizard-step-vehicles";
import { BudgetWizardStepBilling } from "@/components/financial/budget/wizard/budget-wizard-step-billing";
import { BudgetStepServices } from "@/components/financial/budget/steps/budget-step-services";
import { BudgetStepReview } from "@/components/financial/budget/steps/budget-step-review";
import {
  BUDGET_WIZARD_STEP,
  budgetWizardSteps,
  firstFailingStep,
  resolveStepJump,
  type BudgetWizardStep,
} from "@/utils/budget-wizard";
import { customerUpdatePatch } from "@/utils/budget-payers";
import {
  measureLayoutFromSaved,
  measurePayloadOf,
  measuresWidthError,
  type MeasureLayout,
} from "@/utils/implement-measures";
import { FACE_LABEL, FACE_MEASURE_FIELD, IMPLEMENT_FACES, type ImplementFace } from "@/constants/implement-faces";
import { SignatureEnvelopeCard } from "@/components/financial/budget/signature-envelope-card";
import { BudgetRequestCard } from "@/components/financial/budget/budget-request-card";
import { BudgetStateActions } from "@/components/financial/budget/budget-state-actions";
import { BudgetAxesStrip } from "@/components/financial/budget/budget-axes-strip";
import { BudgetValueApprovalCard } from "@/components/financial/budget/budget-value-approval-card";
import { OfflineSignatureCard } from "@/components/financial/budget/offline-signature-card";
import type { BudgetAxisTarget } from "@/utils/budget-axes";
import {
  envelopeGlanceOf,
  useQuoteEnvelopes,
} from "@/components/financial/budget/use-quote-envelopes";

import { budgetRequestOf } from "@/types/budget-request";
// Imported from the filters module rather than the table barrel so the detail route does not pull
// the whole list page into its bundle.
import { BUDGET_FALLBACK_LIST_QUERY } from "@/components/financial/budget/table/budget-table-filters";
import { readQuoteSiblingState, useBudgetSiblingIds } from "@/components/financial/shared/quote-sibling-nav";
import { toAttentionQuoteEntityFromParts } from "@/components/financial/shared/quote-attention";
import { useAttentionEntity, useAttentionField } from "@/lib/attention";
import { hasCompleteBillingCustomerData } from "@/lib/billing-customer-data";
import { useRecordNavigation } from "@/components/ui/detailpage/use-record-navigation";
import { RecordPager } from "@/components/ui/detailpage/record-pager-action";
import {
  quoteVehicleCount,
  quoteTasks,
  perVehicleAmount,
  dedupeConfigsByCustomer,
  hasMultipleCustomers,
  billingApprovedAtOf,
  billingIdOf,
} from "@/utils/quote-tasks";
import { expandConfigsIntoLots } from "@/components/financial/shared/billing-split-field";
import {
  useBudgetVehicles,
  BUDGET_VEHICLE_TASK_INCLUDE,
} from "@/components/financial/budget/vehicles/use-budget-vehicles";
import { BudgetVehicleTabs } from "@/components/financial/budget/vehicles/budget-vehicle-tabs";
import type { ImplementArtVehicle } from "@/components/production/implement-art/vehicles-art-section";
import { approvedArtFilesOf, implementArtStateOf } from "@/utils/implement-art";
import {
  planAirbrushingReconciliation,
  applyAirbrushingPlan,
  airbrushingsToFormValue,
} from "@/utils/airbrushing-reconcile";
import { useImplementMeasuresByImplement } from "@/hooks";
import { airbrushingKeys } from "@/hooks/common/query-keys";
import { getApiBaseUrl } from "@/config/api";

/**
 * O que é de CADA veículo no passo 1 — o resto do passo é comum ao orçamento.
 *
 * Decisão do dono (23/09/2026, caso Carlotti nº 990): mesmo orçamento é mesmo preço,
 * mesmo tamanho, mesma categoria e mesmo implemento, com os mesmos responsáveis e os
 * mesmos arquivos base; mas cada implemento tem a sua identificação, a sua previsão, a
 * sua pintura geral, o seu layout e a sua aerografia.
 */
interface VehicleFormValues {
  taskId: string;
  serialNumber: string;
  plate: string;
  chassisNumber: string;
  /**
   * O PEDIDO DE COMPRA DO CLIENTE, DESTE veículo (`Task.customerOrderNumber`).
   *
   * Irmão da placa e da série: o pedido identifica a ENTREGA. É assim que se corrige
   * um dos quatro sem tocar nos outros três. Na CRIAÇÃO o campo equivalente vale para
   * todos os que nascerem de uma vez.
   */
  customerOrderNumber: string | null;
  // Foto da plaqueta (VIN). `null` é o valor EXPLÍCITO de "removida" — `undefined` faria a
  // API pular o campo e a foto antiga sobreviveria a uma remoção.
  vinPlateId: string | null;
  forecastDate: Date | null;
  term: Date | null;
  details: string;
  paintId: string | null;
  airbrushings: any[];
}

function toVehicleFormValues(task: any, airbrushings: any[] | undefined): VehicleFormValues {
  return {
    taskId: task.id,
    serialNumber: task.implement?.serialNumber || "",
    plate: task.implement?.plate || "",
    chassisNumber: task.implement?.chassisNumber || "",
    customerOrderNumber: task.customerOrderNumber || null,
    vinPlateId: task.implement?.vinPlateId || null,
    forecastDate: task.forecastDate ? new Date(task.forecastDate) : null,
    term: task.term ? new Date(task.term) : null,
    details: task.details || "",
    paintId: task.paintId || null,
    airbrushings: airbrushingsToFormValue(airbrushings),
  };
}

/** Como o operador chama o implemento: série, senão placa, senão a posição. */
function vehicleLabelOf(values: Partial<VehicleFormValues> | undefined, index: number): string {
  return (values?.serialNumber || "").trim() || (values?.plate || "").trim() || `Veículo ${index + 1}`;
}

/** A foto de plaqueta gravada, na forma do campo de upload. */
function vinPlateFilesOf(task: any): FileWithPreview[] {
  const persisted = task?.implement?.vinPlate;
  return persisted
    ? [
        {
          id: persisted.id,
          name: persisted.originalName || persisted.filename || "plaqueta",
          size: persisted.size || 0,
          type: persisted.mimetype || "image/jpeg",
          lastModified: Date.now(),
          uploaded: true,
          uploadProgress: 100,
          uploadedFileId: persisted.id,
          thumbnailUrl: persisted.thumbnailUrl,
        } as FileWithPreview,
      ]
    : [];
}

/**
 * A ÂNCORA DA ASSINATURA ELETRÔNICA, no fim do passo de Resumo. Um id e não um
 * ref porque quem rola é o card de ações, que não conhece este componente.
 */
const SIGNATURE_ANCHOR_ID = "assinatura-eletronica";

/**
 * O PASSO E A ÂNCORA DA ARTE DO IMPLEMENTO.
 *
 * O orçamento não escolhe arte (Modelo C, P12): o documento leva a APROVADA de
 * cada implemento. Quando a emissão diz "arte pendente", o caminho é o cartão do
 * veículo, no passo Veículos.
 */
const ARTWORK_STEP = BUDGET_WIZARD_STEP.VEHICLES;
const ARTWORK_ANCHOR_ID = BUDGET_VEHICLES_ART_ANCHOR;
/** Os atos e o registro da aprovação do valor, no Resumo. */
const VALUE_ANCHOR_ID = "valor-do-orcamento";

function getDefaultExpiresAt() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  date.setHours(23, 59, 59, 999);
  return date;
}

/**
 * Remount the wizard whenever the record changes.
 *
 * Prev/next paging swaps `:taskId` under a component that would otherwise stay mounted, and this
 * page carries a LOT of per-record state that is seeded by "if the new record has some, replace
 * mine" effects: `form.reset(..., { keepDirtyValues })`, the responsáveis rows, the layout files
 * and their DRAFT/APPROVED statuses, the base files, the wizard step, and the unsaved-changes
 * guard's durable bypass. Every one of those is correct for a background REFETCH of the same
 * record and wrong for a different record — a task with no layouts would have kept the previous
 * task's, and `handleSubmit` builds its payload from `dirtyFields`, so pressing Salvar would have
 * written record A's edits onto record B.
 *
 * A `key` is the whole fix: React tears the subtree down and every one of those states is seeded
 * from scratch, which is exactly what "a different record" means.
 */
export const FinancialBudgetDetailPage = () => {
  const { taskId } = useParams<{ taskId: string }>();
  return <FinancialBudgetDetailPageInner key={taskId ?? "novo"} />;
};

const FinancialBudgetDetailPageInner = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  // Where to return after save/cancel — set by whoever sent the user here.
  const returnTo = readReturnTo(location.state);
  // Prev/next pager context. `ids` is a fast path (the list handed it over on row click); when it
  // is absent or is only the loaded page, the sibling hook rebuilds the list from `listQuery`, so
  // the pager renders no matter how the user got here — refresh, Back, direct URL, new tab,
  // notification, deep link, the reconciliation badge, or the task detail's "Editar".
  const siblingState = readQuoteSiblingState(location.state);
  const { user } = useAuth();
  const queryClient = useQueryClient();

  usePageTracker({ title: "Orçamento - Detalhes", icon: "file-invoice" });

  // Fetch task data
  // O MESMO `include` de cada veículo do orçamento (ver `BUDGET_VEHICLE_TASK_INCLUDE`):
  // a tarefa aberta é uma delas, e a chave de cache igual evita buscá-la duas vezes.
  const { data: taskResponse, isLoading: taskLoading } = useTaskDetail(
    taskId || "",
    { include: BUDGET_VEHICLE_TASK_INCLUDE as any },
  );
  const task = taskResponse?.data;

  // Fetch existing quote
  const { data: quoteResponse, isLoading: quoteLoading } =
    useBudgetByTask(taskId || "");
  // Unwrap the API response: backend may wrap as { data: quote } or return the quote directly.
  // Guard with .id to prevent treating an empty wrapper object ({ data: null }) as a valid quote.
  const rawQuote = quoteResponse?.data?.data || quoteResponse?.data;
  const existingQuote = rawQuote?.id ? rawQuote : null;

  // Mutations
  const createQuoteMutation = useCreateBudget();
  const updateQuoteMutation = useUpdateBudget();
  const { updateAsync: updateTaskAsync } = useTaskMutations();

  // Permissions
  const userRole = user?.sector?.privileges || "";
  const canView = canViewQuote(userRole);
  const canEdit = canEditQuote(userRole);

  // ═══════════════════════════════════════════════════════════════════════
  // OS VEÍCULOS DO ORÇAMENTO
  // ═══════════════════════════════════════════════════════════════════════
  //
  // A rota continua sendo por TAREFA (links, notificações, o pager), mas a tela
  // edita o orçamento INTEIRO: todos os veículos vivem no mesmo formulário, em
  // `vehicles[i]`, e um "Salvar" grava todos. Antes o passo 1 era só da tarefa
  // aberta, e os irmãos só se editavam por um desvio pela Agenda — foi assim que
  // a Carlotti (nº 990) teve a pintura de cada implemento acertada.
  //
  // Sem orçamento ainda (criando o orçamento de uma tarefa avulsa), o único
  // veículo é a própria tarefa.
  const vehicleTaskIds = useMemo(
    () =>
      existingQuote
        ? quoteTasks(existingQuote as any).map((t: any) => t.id as string)
        : taskId
          ? [taskId]
          : [],
    [existingQuote, taskId],
  );
  const vehicles = useBudgetVehicles(vehicleTaskIds, vehicleTaskIds.length > 0);
  const vehicleTasks = vehicles.tasks;
  const vehicleCount = vehicleTaskIds.length;
  const multiVehicle = vehicleCount > 1;
  const vehiclesReady = vehicles.tasksLoaded && vehicles.airbrushingsLoaded;

  // State
  const [currentStep, setCurrentStep] = useState<BudgetWizardStep>(BUDGET_WIZARD_STEP.TASK);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const guardAirbrushingCreation = useAirbrushingCreationGuard();
  // Tracks whether the form has received its first server-data reset.
  // Ref: used inside the effect (always current, no stale closure).
  // State: signals child components that need to wait before running side-effects.
  const formInitializedRef = useRef(false);
  const [formInitialized, setFormInitialized] = useState(false);
  const customersCache = useRef<Map<string, any>>(new Map());
  const [selectedCustomers, setSelectedCustomers] = useState<Map<string, any>>(
    new Map(),
  );

  // Task-specific state
  const [showResponsibleErrors, setShowResponsibleErrors] = useState(false);
  const [responsibleRows, setResponsibleRows] = useState<ResponsibleRowData[]>([]);
  // O veículo de que falam detalhes, tinta e aerografia no passo Tarefa. Começa
  // pelo da rota.
  const [activeVehicleId, setActiveVehicleId] = useState<string>(taskId ?? "");
  // O cartão aberto no passo Veículos (com N veículos, um de cada vez).
  const [openVehicleId, setOpenVehicleId] = useState<string | null>(taskId ?? null);
  const activeVehicleIndex = Math.max(0, vehicleTaskIds.indexOf(activeVehicleId));
  const [baseFiles, setBaseFiles] = useState<FileWithPreview[]>([]);
  // Foto da plaqueta (VIN) — imagem única POR VEÍCULO, espelhando o campo do formulário de Tarefa.
  const [vinPlateFilesByTask, setVinPlateFilesByTask] = useState<Record<string, FileWithPreview[]>>({});
  // O operador pediu para igualar os campos comuns que divergem entre os veículos.
  const [equalizeCommon, setEqualizeCommon] = useState(false);
  // Snapshots of the relation sets as loaded from the tasks. Used at submit time to
  // tell whether the user actually changed each set; if not, we OMIT the key so
  // the API preserves it (absence = preserve). Sending an empty array would WIPE
  // the relation (finding I40).
  const loadedBaseFileIdsRef = useRef<string[]>([]);
  const loadedResponsibleIdsRef = useRef<string[]>([]);

  const handleBaseFilesChange = useCallback((files: FileWithPreview[]) => {
    setBaseFiles(files);
  }, []);

  const handleResponsibleRowsChange = useCallback(
    (rows: ResponsibleRowData[]) => {
      setResponsibleRows(rows);
      if (showResponsibleErrors && validateResponsibleRows(rows)) {
        setShowResponsibleErrors(false);
      }
    },
    [showResponsibleErrors],
  );

  // Form - task fields + quote fields (flat, no prefix)
  const form = useForm({
    mode: "onChange",
    defaultValues: {
      // ─── Campos COMUNS a todos os veículos ────────────────────────────────
      // Mesmo orçamento, mesmo preço, mesmo implemento: logomarca, cliente,
      // categoria e implemento valem para os N veículos, e o save os grava em
      // todos (só quando mudaram — ou quando o operador pede para igualar).
      name: "" as string,
      customerId: "" as string,
      category: "" as string,
      // Do NOT default to a concrete enum — an unset implementType must stay
      // empty so an untouched budget save never clobbers the implement's real value
      // (the load effect below seeds it from the task; submit only sends it when
      // the user actually changed it). See findings I39/I40.
      implementType: "" as string,
      // ─── Campos DE CADA veículo ───────────────────────────────────────────
      // Um item por tarefa, na ordem canônica do orçamento (`quoteTasks`). Ver
      // `VehicleFormValues`.
      vehicles: [] as VehicleFormValues[],
      serviceOrders: [] as any[],
      // Quote fields
      expiresAt: getDefaultExpiresAt(),
      status: "PENDING" as string,
      subtotal: 0,
      total: 0,
      guaranteeYears: null as number | null,
      customGuaranteeText: null as string | null,
      customForecastDays: null as number | null,
      simultaneousTasks: null as number | null,
      /**
       * Junto ou separado. Editável DEPOIS da criação porque a escolha errada
       * só se revela quando o faturamento chega: um orçamento de sessenta
       * implementos criado como `JOINT` que precisa fechar veículo a veículo
       * ficaria travado para sempre se este campo só existisse na criação.
       */
      billingSplit: "JOINT" as "JOINT" | "PER_TASK" | "CUSTOM",
      /**
       * A PARTIÇÃO dos veículos entre as faturas — só relevante em lotes.
       *
       * Campo do ORÇAMENTO e não de cada cliente: a mesma repartição vale para
       * todos (um lote é uma unidade de cobrança, não um negócio diferente), e
       * é o save que a transforma em `customerConfigs[].taskIds`.
       */
      billingGroups: [] as string[][],
      customerConfigs: [] as any[],
      services: [
        {
          description: "",
          amount: null,
          observation: null,
          invoiceToCustomerId: null,
        },
      ] as any[],
    },
  });

  /**
   * Foto da plaqueta — imagem única, só o ÚLTIMO arquivo vale (`maxFiles={1}` já limita a seleção,
   * mas o estado é normalizado aqui de qualquer forma).
   *
   * Um arquivo JÁ ENVIADO viaja como `implement.vinPlateId`; um arquivo novo ainda não tem id, então
   * `vinPlateId` fica `null` até o submit fazer o upload e preencher. Limpar o campo manda `null`
   * explícito — é assim que a foto é removida.
   */
  const handleVinPlateFilesChange = useCallback(
    (vehicleId: string, files: FileWithPreview[]) => {
      const index = vehicleTaskIds.indexOf(vehicleId);
      if (index < 0) return;
      const picked = files.slice(-1);
      setVinPlateFilesByTask((prev) => ({ ...prev, [vehicleId]: picked }));
      const existing = picked.find((f) => f.uploaded);
      form.setValue(
        `vehicles.${index}.vinPlateId` as never,
        (existing?.uploadedFileId || existing?.id || null) as never,
        { shouldDirty: true },
      );
    },
    [form, vehicleTaskIds],
  );

  // Unsaved changes guard — prevents losing edits on back/cancel/breadcrumb/refresh
  const { showDialog, confirmNavigation, cancelNavigation, guardedNavigate, allowNavigation } = useUnsavedChangesGuard({
    isDirty: form.formState.isDirty,
    isSubmitting,
  });

  // Ordered sibling ids + the prev/next widget. Routed through `guardedNavigate` so paging away
  // from a dirty wizard prompts (the guard's pushState patch would catch a bare navigate too, but
  // it replays only the URL and would drop the id list).
  /**
   * OS VEÍCULOS deste orçamento, na forma que o controle de faturamento precisa.
   *
   * Série, placa e pedido de compra: é assim que quem opera identifica um
   * implemento, e é o que precisa aparecer ao lado do lote para a escolha não
   * virar adivinhação.
   */
  const budgetSplitVehicles = useMemo(
    () =>
      quoteTasks(existingQuote as any).map((t: any) => ({
        id: t.id,
        name: t.name ?? null,
        serialNumber: t.implement?.serialNumber ?? null,
        plate: t.implement?.plate ?? null,
        customerOrderNumber: t.customerOrderNumber ?? null,
      })),
    [existingQuote],
  );

  /**
   * Quantos FATURAMENTOS já foram aprovados — com um que seja, a divisão congela.
   *
   * A conta é por FATURAMENTO, não por pagador: dois pagadores do mesmo recorte
   * são duas linhas de UMA cobrança, e contá-los diria "dois" sobre um.
   *
   * ⚠️ Lia `config.billingApprovedAt`, coluna que saiu do banco quando o estado
   * passou para `Billing.approvedAt`. O resultado virou ZERO em todo orçamento —
   * o seletor de junto/separado/lotes deixou de travar e a tela parou de avisar
   * "há fatura aprovada". O servidor continuava recusando com 4xx, então nada de
   * errado foi gravado; o que se perdeu foi o aviso ANTES do clique. A bateria
   * (fase 6 M2 e fase 5 C3) pegou.
   */
  const approvedBillingCount = useMemo(() => {
    const aprovados = new Set<string>();
    for (const c of ((existingQuote?.customerConfigs ?? []) as any[])) {
      if (!billingApprovedAtOf(c)) continue;
      aprovados.add(billingIdOf(c) ?? c?.id ?? "");
    }
    return aprovados.size;
  }, [existingQuote]);

  // A lista de Orçamentos tem UMA LINHA POR ORÇAMENTO, então o recuo do pager
  // (quando o usuário não veio da lista) também percorre ORÇAMENTOS e traduz
  // cada um para a sua tarefa ÂNCORA — a rota continua sendo por tarefa. Pelo
  // hook antigo, que percorre tarefas, "próximo" repetia o mesmo orçamento uma
  // vez por veículo; e `BUDGET_FALLBACK_LIST_QUERY` agora é um `where` de
  // Budget, que `/tasks` recusaria com 400.
  const { ids: siblingIds, complete: siblingIdsComplete } = useBudgetSiblingIds(BUDGET_FALLBACK_LIST_QUERY, taskId ?? "", siblingState);
  const recordNav = useRecordNavigation({
    ids: siblingIds,
    currentId: taskId ?? "",
    toRoute: (rid) => routes.financial.budget.details(rid),
    // Carried forward on every hop so the pager, the "voltar" target and the reconstructed list
    // all survive paging.
    state: { returnTo, listQuery: siblingState.listQuery, idsComplete: siblingIdsComplete },
    // No ←/→ here: this is a form. The hook's guard only skips a FOCUSED input, so an arrow key
    // pressed with focus on the page body would page away mid-edit.
    keyboard: false,
    enabled: !!taskId,
    onNavigate: guardedNavigate,
  });

  // Attention: register this quote so its rules evaluate and honour their ack policy — the same
  // entity the Orçamento list registers, in the same shape, so a record behaves identically
  // whether it was loaded here or there. Task and quote arrive from two separate queries on this
  // page, hence the "from parts" builder.
  const quoteAttentionEntity = useMemo(
    () =>
      toAttentionQuoteEntityFromParts(
        existingQuote,
        task ? { id: task.id, status: task.status, customerOrderNumber: task.customerOrderNumber } : null,
      ),
    [existingQuote, task],
  );
  // Deliberately gated on BOTH queries having landed. Task and quote load independently here, and
  // the quote usually wins; registering on the quote alone would hand the engine a bare `{ id }`
  // stub, which it reads as "this record is locally observed and no longer matches" — i.e. as
  // RESOLVED. That clears the ack, so a rule the user snoozed re-arms and bips a moment later.
  useAttentionEntity("TASK_QUOTE", quoteAttentionEntity ? existingQuote?.id : undefined, quoteAttentionEntity);

  // Populate form when task, quote and EVERY vehicle have loaded. Semeia de uma vez:
  // um reset parcial (só a tarefa aberta) seguido de outro com os irmãos faria o
  // segundo perder o que o operador tivesse começado a digitar.
  useEffect(() => {
    // O orçamento também: sem ele a lista de veículos ainda é só a tarefa aberta.
    if (!task || !vehiclesReady || quoteLoading) return;
    const loadedVehicles = vehicleTasks.filter(Boolean) as any[];

    // Seed each vehicle's Plaqueta photo from its persisted implement relation.
    setVinPlateFilesByTask(
      Object.fromEntries(loadedVehicles.map((t) => [t.id, vinPlateFilesOf(t)])),
    );

    // Os COMUNS saem da tarefa aberta (se divergirem dos irmãos, a tela avisa — ver
    // `commonDivergence`); os de CADA veículo, de cada tarefa.
    const taskFields = {
      name: task.name || "",
      customerId: task.customerId || "",
      category: task.implement?.category || "",
      // Seed from the loaded implement; leave empty when absent. NEVER default to a
      // concrete enum here — that silently rewrites the implement's implementType to
      // REFRIGERATED on every save (finding I39).
      implementType: task.implement?.type || "",
      vehicles: loadedVehicles.map((t) =>
        toVehicleFormValues(t, vehicles.airbrushingsByTask[t.id]),
      ),
      serviceOrders: task.serviceOrders || [],
    };

    if (!existingQuote) {
      form.reset({
        ...taskFields,
        expiresAt: getDefaultExpiresAt(),
        status: "PENDING",
        subtotal: 0,
        total: 0,
        guaranteeYears: null,
        customGuaranteeText: null,
        customForecastDays: null,
        simultaneousTasks: null,
        billingSplit: "JOINT",
        billingGroups: [],
        customerConfigs: [],
        services: [
          {
            description: "",
            amount: null,
            observation: null,
            invoiceToCustomerId: null,
          },
        ],
      });
      formInitializedRef.current = true;
      setFormInitialized(true);
      return;
    }

    form.reset({
      ...taskFields,
      expiresAt: existingQuote.expiresAt
        ? new Date(existingQuote.expiresAt)
        : getDefaultExpiresAt(),
      status: existingQuote.status || "PENDING",
      // POR VEÍCULO, não o contrato. `Budget.subtotal/total` guardam o valor
      // do CONTRATO (`por veículo × N`), mas o formulário — e o resumo que lê
      // dele — trabalham em valor de UM veículo: o resumo aplica o "× N" ele
      // mesmo. Semear com o contrato fazia o "× N" incidir sobre um número que
      // já o continha, e um orçamento de 4 veículos a R$ 0,20 exibia
      // "Total por veículo R$ 0,80 · × 4 · Total geral R$ 3,20" — quatro vezes
      // o contrato, na tela em que o comercial confere o preço. O documento
      // sempre esteve certo (R$ 0,20 · × 4 · R$ 0,80), então as duas telas
      // discordavam. Não afeta a gravação: `recalcQuoteTotals` reescreve os dois
      // campos a partir dos serviços, e o valor enviado é provisório por desenho.
      subtotal: perVehicleAmount(existingQuote.subtotal, quoteVehicleCount(existingQuote)),
      total: perVehicleAmount(existingQuote.total, quoteVehicleCount(existingQuote)),
      guaranteeYears: existingQuote.guaranteeYears || null,
      customGuaranteeText: existingQuote.customGuaranteeText || null,
      customForecastDays: existingQuote.customForecastDays || null,
      simultaneousTasks: existingQuote.simultaneousTasks || null,
      billingSplit:
        ((existingQuote as any).billingSplit as "JOINT" | "PER_TASK" | "CUSTOM") || "JOINT",
      // Os LOTES como estão gravados — a cobertura de cada fatura, na ordem em
      // que elas existem. Sem hidratar, abrir e salvar um orçamento em lotes o
      // devolveria ao modo declarado e os lotes sumiriam sem ninguém pedir.
      billingGroups: dedupeConfigsByCustomer(existingQuote.customerConfigs ?? [])
        .coverageGroups,
      // ⚠️ UM PASSO POR CLIENTE, não por FATURA. Num orçamento cobrado veículo a
      // veículo há uma fatura por implemento, todas do mesmo cliente: mapear 1:1
      // produzia "Cliente 1..4" com o mesmo nome quatro vezes, e o save
      // reenviava os quatro objetos — o último gravando por cima dos outros
      // três, levando desconto e condição de pagamento junto. A repartição dos
      // veículos vive em `billingGroups`, acima.
      customerConfigs:
        dedupeConfigsByCustomer(existingQuote.customerConfigs ?? []).configs.map((c: any) => ({
          id: c.id,
          customerId: c.customerId || c.id,
          subtotal: c.subtotal ?? 0,
          total: c.total ?? 0,
          discountType: c.discountType || "NONE",
          discountValue: c.discountValue != null ? Number(c.discountValue) : null,
          discountReference: c.discountReference || null,
          paymentCondition: c.paymentCondition || null,
          paymentConfig: c.paymentConfig ?? null,
          customPaymentText: c.customPaymentText || null,
          generateInvoice:
            c.generateInvoice !== undefined ? c.generateInvoice : true,
          generateBankSlip:
            c.generateBankSlip !== undefined ? c.generateBankSlip : true,
          customerData: {
            corporateName: c.customer?.corporateName || "",
            fantasyName: c.customer?.fantasyName || "",
            cnpj: c.customer?.cnpj || "",
            cpf: c.customer?.cpf || "",
            address: c.customer?.address || "",
            addressNumber: c.customer?.addressNumber || "",
            addressComplement: c.customer?.addressComplement || "",
            neighborhood: c.customer?.neighborhood || "",
            city: c.customer?.city || "",
            state: c.customer?.state || "",
            zipCode: c.customer?.zipCode || "",
            stateRegistration: c.customer?.stateRegistration || "",
            municipalRegistration: c.customer?.municipalRegistration || "",
            // Contato só para a pré-visualização da NFS-e — não é editado nem reenviado no save.
            email: c.customer?.email || "",
            phones: c.customer?.phones || [],
            streetType: c.customer?.streetType || null,
            registrationStatus: c.customer?.registrationStatus || null,
          },
          installments:
            c.installments?.map((inst: any) => ({
              number: inst.number,
              dueDate: inst.dueDate ? new Date(inst.dueDate) : new Date(),
              amount:
                typeof inst.amount === "number"
                  ? inst.amount
                  : Number(inst.amount) || 0,
            })) || [],
        })) || [],
      services:
        existingQuote.services && existingQuote.services.length > 0
          ? existingQuote.services.map((item: any) => ({
              id: item.id,
              description: item.description || "",
              observation: item.observation || null,
              amount:
                typeof item.amount === "number"
                  ? item.amount
                  : item.amount
                    ? Number(item.amount)
                    : 0,
              invoiceToCustomerId: item.invoiceToCustomerId || null,
            }))
          : [
              {
                description: "",
                amount: null,
                observation: null,
                invoiceToCustomerId: null,
              },
            ],
    // On first load keepDirtyValues is false so server data always wins.
    // On subsequent resets (e.g. background refetch) it's true to preserve unsaved edits.
    }, { keepDirtyValues: formInitializedRef.current });
    formInitializedRef.current = true;
    setFormInitialized(true);

    // Initialize customers cache from existing configs, then fetch full data
    if (existingQuote.customerConfigs?.length > 0) {
      const partialCustomers = existingQuote.customerConfigs
        .map((c: any) => c.customer)
        .filter(Boolean);
      partialCustomers.forEach((c: any) =>
        customersCache.current.set(c.id, c),
      );
      setSelectedCustomers(
        new Map(partialCustomers.map((c: any) => [c.id, c])),
      );

      const customerIds = partialCustomers.map((c: any) => c.id);
      getCustomers({
        where: { id: { in: customerIds } },
        take: customerIds.length,
      })
        .then((response) => {
          const fullCustomers = response.data || [];
          if (fullCustomers.length > 0) {
            fullCustomers.forEach((c: any) =>
              customersCache.current.set(c.id, c),
            );
            setSelectedCustomers(
              new Map(fullCustomers.map((c: any) => [c.id, c])),
            );

            // Update form customerData with full customer info
            const currentConfigs = form.getValues("customerConfigs");
            currentConfigs.forEach((config: any, idx: number) => {
              const full = fullCustomers.find(
                (c: any) => c.id === config.customerId,
              );
              if (full) {
                const d = config.customerData || {};
                form.setValue(
                  `customerConfigs.${idx}.customerData`,
                  {
                    corporateName: d.corporateName || full.corporateName || "",
                    fantasyName: d.fantasyName || full.fantasyName || "",
                    cnpj: d.cnpj || full.cnpj || "",
                    cpf: d.cpf || full.cpf || "",
                    address: d.address || full.address || "",
                    addressNumber:
                      d.addressNumber || full.addressNumber || "",
                    addressComplement:
                      d.addressComplement || full.addressComplement || "",
                    neighborhood: d.neighborhood || full.neighborhood || "",
                    city: d.city || full.city || "",
                    state: d.state || full.state || "",
                    zipCode: d.zipCode || full.zipCode || "",
                    stateRegistration:
                      d.stateRegistration || full.stateRegistration || "",
                    municipalRegistration:
                      d.municipalRegistration || full.municipalRegistration || "",
                    email: d.email || full.email || "",
                    phones: d.phones || full.phones || [],
                    streetType: d.streetType || full.streetType || null,
                  },
                );
              }
            });
          }
        })
        .catch(() => {
          /* keep partial data */
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id, existingQuote?.id, vehiclesReady, quoteLoading]); // use IDs — object refs change on every refetch and would wipe unsaved edits

  // Initialize the COMMON state that lives outside the form (responsáveis,
  // arquivos base) once every vehicle has loaded.
  useEffect(() => {
    if (!task || !vehiclesReady || quoteLoading) return;

    // Responsáveis — COMUNS ao orçamento; semeados da tarefa aberta.
    if (task.responsibles && task.responsibles.length > 0) {
      setResponsibleRows(
        task.responsibles.map((r: any) => ({
          id: r.id,
          name: r.name || "",
          phone: r.phone || "",
          email: r.email || "",
          cpf: r.cpf ?? null,
          roles: getResponsibleRoles(r),
          // Retrato do cadastro: sem ele `syncResponsibleRoles` trataria toda
          // linha como alterada e daria PUT em todo contato do orçamento.
          originalRoles: getResponsibleRoles(r),
          isActive: r.isActive ?? true,
          isNew: false,
          isEditing: false,
          isSaving: false,
          error: null,
        })),
      );
    }
    loadedResponsibleIdsRef.current = (task.responsibles || []).map(
      (r: any) => r.id,
    );

    // Base files — COMUNS; semeados da tarefa aberta.
    if ((task as any).baseFiles && (task as any).baseFiles.length > 0) {
      setBaseFiles(
        (task as any).baseFiles.map((file: any) => ({
          id: file.id,
          name: file.filename || file.originalName || "arquivo",
          size: file.size || 0,
          type: file.mimetype || "application/octet-stream",
          lastModified: Date.now(),
          uploaded: true,
          uploadProgress: 100,
          uploadedFileId: file.id,
          thumbnailUrl: file.thumbnailUrl,
        }) as FileWithPreview),
      );
    }
    // Snapshot the loaded base-file ids (empty when the task has none) so submit
    // can detect a real user change and avoid sending an empty wipe array.
    loadedBaseFileIdsRef.current = ((task as any).baseFiles || []).map(
      (file: any) => file.id,
    );
    // Seed editable state by IDENTITY only — NOT the full task objects, which change
    // on every react-query background refetch. Re-running on a refetch called
    // setBaseFiles and WIPED unsaved uploads the user had just added. Mirrors the
    // sibling effect's id-only guard.
  }, [task?.id, vehiclesReady, quoteLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── A REQUISIÇÃO DO PORTAL ───────────────────────────────────────────────
  //
  // `null` em todo orçamento nascido por dentro — que é a imensa maioria —, e o
  // painel simplesmente não é desenhado. Ver `budgetRequestOf`: ausência da
  // relação quer dizer "não perguntei", nunca "não houve requisição".
  const budgetRequest = useMemo(() => budgetRequestOf(existingQuote), [existingQuote]);

  // ── A COLETA DE ASSINATURAS, PARA QUEM DECIDE O ENCAMINHAMENTO ────────────
  //
  // ⛔ O `status` do orçamento NÃO basta para decidir o que oferecer: há
  // orçamentos em `REQUESTED` com coleta `RUNNING` e assinaturas colhidas, e a
  // tela oferecia "Enviar para aprovação do cliente" a um documento já assinado. A
  // MESMA consulta do `SignatureEnvelopeCard` (mesma chave, uma requisição só),
  // para que as duas metades desta página nunca discordem.
  const { data: quoteEnvelopes } = useQuoteEnvelopes(existingQuote?.id);
  const envelopeGlance = useMemo(() => envelopeGlanceOf(quoteEnvelopes), [quoteEnvelopes]);

  /**
   * DO AVISO ATÉ O LUGAR DE RESOLVER.
   *
   * "Arte pendente" é o impedimento mais comum da emissão, e ele dizia o que
   * falta sem dizer onde. Leva ao quadro da arte de cada veículo, no passo 1.
   *
   * `setCurrentStep` direto, e não `handleStepClick`: voltar é sempre livre (a
   * validação só barra quem PULA para a frente).
   */
  const goToArtworkStep = useCallback(() => {
    setCurrentStep(ARTWORK_STEP);
    // O passo já está MONTADO (fica no DOM, escondido por CSS), mas só fica
    // VISÍVEL no commit seguinte, e `scrollIntoView` num elemento com
    // `display:none` não rola coisa alguma. Daí o atraso.
    window.setTimeout(() => {
      document
        .getElementById(ARTWORK_ANCHOR_ID)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  }, []);

  /** Rola até a Assinatura eletrônica, no fim do próprio passo de Resumo. */
  const scrollToSignature = useCallback(() => {
    document
      .getElementById(SIGNATURE_ANCHOR_ID)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  /**
   * `emission` ("para emitir falta…") e `valueApproval` (quem aprovou o valor)
   * vêm na MESMA leitura por tarefa que alimenta o formulário (desde 02/10 a API
   * os traz em `GET /budgets/task/:taskId`) — a segunda leitura por id saiu.
   */
  const budgetDetail = existingQuote as Budget | null;

  // ═══════════════════════════════════════════════════════════════════════
  // OS CINCO PASSOS — Tarefa · Veículos · Serviços · Faturamento · Resumo
  // ═══════════════════════════════════════════════════════════════════════
  // O detalhe se navega LIVRE: o orçamento é revisitado várias vezes (precificar,
  // enviar, arte, emitir, cobrar), e o Salvar confere todos os passos.
  const customerConfigs = form.watch("customerConfigs");
  const steps = useMemo(
    () => budgetWizardSteps({ vehicleCount, payerCount: (customerConfigs ?? []).length }),
    [vehicleCount, customerConfigs],
  );
  const totalSteps = BUDGET_WIZARD_STEP.REVIEW;

  /**
   * DA FAIXA DOS EIXOS ATÉ O LUGAR DE RESOLVER. A faixa não age; ela leva ao
   * passo e ao cartão do ato (valor, arte, assinatura) — ou ao faturamento,
   * quando a cobrança está liberada.
   */
  const goToStepAnchor = useCallback((step: BudgetWizardStep, anchorId?: string) => {
    setCurrentStep(step);
    if (!anchorId) return;
    // Mesmo atraso de `goToArtworkStep`: o passo só fica visível no commit seguinte.
    window.setTimeout(() => {
      document.getElementById(anchorId)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  }, []);

  const handleAxisNavigate = useCallback(
    (target: BudgetAxisTarget) => {
      switch (target) {
        case "art":
          goToArtworkStep();
          return;
        case "value":
          goToStepAnchor(totalSteps, VALUE_ANCHOR_ID);
          return;
        case "signature":
          goToStepAnchor(totalSteps, SIGNATURE_ANCHOR_ID);
          return;
        case "billing":
          if (budgetDetail?.billable && taskId) navigate(routes.financial.billing.details(taskId));
          else goToStepAnchor(BUDGET_WIZARD_STEP.BILLING);
          return;
        case "validity":
          goToStepAnchor(BUDGET_WIZARD_STEP.TASK, BUDGET_TASK_ANCHORS.terms);
          return;
        case "responsibles":
          goToStepAnchor(BUDGET_WIZARD_STEP.TASK, BUDGET_TASK_ANCHORS.responsibles);
          return;
      }
    },
    [goToArtworkStep, goToStepAnchor, totalSteps, budgetDetail?.billable, taskId, navigate],
  );

  // Attention: open on the customer step that a rule is asking about.
  //
  // Without this the signal is unreachable. Both fields it can point at — the N° do Pedido and the
  // cadastro for the NFS-e — are editable only on a customer step; every customer step is mounted
  // but `display: none` unless it is the current one, and the page opens on step 1. So the user
  // would follow a blinking row into a page with nothing highlighted anywhere, and leaving acks
  // the rule for four hours. Runs once per record (the page is keyed by `:taskId`, so a prev/next
  // hop remounts and this ref starts false again).
  const orderNumberAttention = useAttentionField("TASK_QUOTE", existingQuote?.id, "orderNumber");
  const orderNumberAttentionActive = !!orderNumberAttention?.active;
  const customerDataAttention = useAttentionField("TASK_QUOTE", existingQuote?.id, "customerData");
  const customerDataAttentionActive = !!customerDataAttention?.active;
  const attentionStepChosen = useRef(false);
  useEffect(() => {
    if (attentionStepChosen.current) return;
    if (!orderNumberAttentionActive && !customerDataAttentionActive) return;
    // Wait for the configs to hydrate — latching on an empty list would spend the one-shot before
    // there is anything to point at.
    if (!customerConfigs?.length) return;
    // Latch FIRST, unconditionally. `customerConfigs` is a `form.watch`, so it is a fresh array on
    // every keystroke; leaving the latch inside the `idx >= 0` branch meant that while nothing
    // matched, the effect stayed live forever — and the moment the user cleared a field to retype
    // it, `idx` flipped and this teleported them off the step mid-edit.
    attentionStepChosen.current = true;
    // First config the active rule(s) actually name — a multi-customer quote must land on the
    // one with the gap, not on whichever customer happens to be first.
    // ⚠️ A REGRA DO PEDIDO DE COMPRA NÃO APONTA MAIS PARA O PASSO DO CLIENTE.
    //
    // A condição era `!c?.orderNumber` numa FATIA, e `orderNumber` deixou de ser
    // campo da fatia em `20260909170000` — o número do pedido é do VEÍCULO
    // (`Task.customerOrderNumber`). `undefined` é sempre falsy, então a condição
    // era sempre verdadeira: a regra levava ao passo do cliente, onde o campo não
    // existe mais. Quem seguia a linha piscando chegava a um passo sem nada aceso
    // — e sair da tela dá quatro horas de silêncio à regra.
    //
    // O campo mora no cartão de cada veículo (passo Veículos), e é para lá que
    // a regra manda. O cartão do pagador (passo Faturamento) continua sendo o
    // destino da regra de CADASTRO do tomador, que é de fato da fatia.
    if (orderNumberAttentionActive) {
      setCurrentStep(BUDGET_WIZARD_STEP.VEHICLES);
      return;
    }
    const idx = customerConfigs.findIndex((c: any) => {
      if (c?.generateInvoice === false) return false; // no nota, so neither rule applies to it
      return customerDataAttentionActive && !hasCompleteBillingCustomerData(c?.customerData);
    });
    if (idx < 0) return;
    // Os pagadores são cartões do passo Faturamento: abre nele, no cartão certo.
    goToStepAnchor(BUDGET_WIZARD_STEP.BILLING, `pagador-${idx}`);
  }, [orderNumberAttentionActive, customerDataAttentionActive, customerConfigs, goToStepAnchor]);

  const nextStep = useCallback(() => {
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps) as BudgetWizardStep);
  }, [totalSteps]);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 1) as BudgetWizardStep);
  }, []);

  // Navegação LIVRE (ver `resolveStepJump`): nada se perde revisitando, e o Salvar
  // confere tudo antes de gravar.
  const handleStepClick = useCallback(
    (step: number) => {
      if (step === currentStep) return;
      setCurrentStep(resolveStepJump(currentStep, step, {}, {}, "free").step);
    },
    [currentStep],
  );

  /**
   * CAMPOS COMUNS QUE HOJE DIVERGEM entre os veículos.
   *
   * Logomarca, cliente, categoria, implemento, responsáveis e arquivos base são do
   * orçamento — mas moram em cada tarefa, e o acervo tem tarefas editadas uma a uma
   * (pelo formulário de tarefa, ou por esta tela quando o passo 1 era só da aberta).
   * A tela mostra os valores da tarefa aberta; se um irmão tem outro, ela avisa e deixa
   * o operador igualar. Sem o aviso, salvar sem tocar no campo manteria a divergência
   * calada; tocar nele igualaria sem ninguém saber que havia algo diferente.
   */
  const commonDivergence = useMemo(() => {
    const none = { keys: [] as string[], labels: [] as string[] };
    if (!multiVehicle || !task || !vehiclesReady) return none;
    const others = (vehicleTasks.filter(Boolean) as any[]).filter((t) => t.id !== task.id);
    const idsOf = (list: any[] | undefined) => (list || []).map((x: any) => x.id).sort().join("|");
    const checks: Array<[string, string, (t: any) => string]> = [
      ["name", "Logomarca", (t) => t.name || ""],
      ["customerId", "Cliente", (t) => t.customerId || ""],
      ["category", "Categoria", (t) => t.implement?.category || ""],
      ["implementType", "Implemento", (t) => t.implement?.type || ""],
      ["responsibles", "Responsáveis", (t) => idsOf(t.responsibles)],
      ["baseFiles", "Arquivos base", (t) => idsOf(t.baseFiles)],
    ];
    const keys: string[] = [];
    const labels: string[] = [];
    for (const [key, label, read] of checks) {
      const mine = read(task);
      if (others.some((t) => read(t) !== mine)) {
        keys.push(key);
        labels.push(label);
      }
    }
    return { keys, labels };
  }, [multiVehicle, task, vehiclesReady, vehicleTasks]);

  // ═══════════════════════════════════════════════════════════════════════
  // AS MEDIDAS DO IMPLEMENTO — comuns, no desenho estilizado do formulário de tarefa
  // ═══════════════════════════════════════════════════════════════════════
  // Mesmo orçamento, mesmo implemento: as medidas são gravadas no implemento da
  // tarefa aberta e a API as replica aos irmãos do orçamento. Só as faces que o
  // operador mexeu viajam no Salvar.
  const openImplementId = ((task?.implement as any)?.id as string | undefined) ?? "";
  const { data: measuresData } = useImplementMeasuresByImplement(openImplementId, { enabled: !!openImplementId });
  const savedMeasureLayouts = useMemo(() => {
    const saved: Partial<Record<ImplementFace, MeasureLayout>> = {};
    for (const face of IMPLEMENT_FACES) {
      const layout = measureLayoutFromSaved((measuresData as any)?.[FACE_MEASURE_FIELD[face]]);
      if (layout) saved[face] = layout;
    }
    return saved;
  }, [measuresData]);
  const savedMeasureSides = useMemo(
    () => new Set(Object.keys(savedMeasureLayouts) as ImplementFace[]),
    [savedMeasureLayouts],
  );
  const [editedMeasureLayouts, setEditedMeasureLayouts] = useState<Partial<Record<ImplementFace, MeasureLayout>>>({});
  const [modifiedMeasureSides, setModifiedMeasureSides] = useState<Set<ImplementFace>>(new Set());
  const handleMeasureChange = useCallback((side: ImplementFace, layout: MeasureLayout) => {
    setEditedMeasureLayouts((prev) => ({ ...prev, [side]: layout }));
    setModifiedMeasureSides((prev) => (prev.has(side) ? prev : new Set(prev).add(side)));
  }, []);
  // O que o editor mostra: o editado por cima do gravado.
  const measureLayouts = useMemo(
    () => ({ ...savedMeasureLayouts, ...editedMeasureLayouts }),
    [savedMeasureLayouts, editedMeasureLayouts],
  );
  const measuresError = useMemo(() => measuresWidthError(measureLayouts), [measureLayouts]);

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    const data = form.getValues();
    if (!taskId) return;

    // 0. OS CINCO PASSOS — a navegação é livre, então é aqui que cada passo é
    // conferido; o primeiro com problema é aberto, com o motivo.
    const failing = firstFailingStep(data as any, { measuresError });
    if (failing) {
      setCurrentStep(failing.step);
      toast.error(failing.message);
      return;
    }

    // 0a. Responsáveis: as demais telas (criar tarefa, editar tarefa, criar
    // orçamento) validam aqui e avisam. Esta não validava, então apagar todas as
    // funções de um contato salvava "com sucesso" sem gravar nada —
    // `syncResponsibleRoles` ignora linha sem função — e sem nenhuma mensagem.
    if (!validateResponsibleRows(responsibleRows)) {
      setShowResponsibleErrors(true);
      goToStepAnchor(BUDGET_WIZARD_STEP.TASK, BUDGET_TASK_ANCHORS.responsibles);
      toast.error("Preencha o nome, telefone e ao menos uma função dos responsáveis.");
      return;
    }

    // 0a'. Aerografia NOVA marcada "Já aprovada" exige aerografista — em cada veículo.
    const airbrushingListNames = (((data as any).vehicles || []) as unknown[]).map((_, index) => `vehicles.${index}.airbrushings`);
    if (!guardAirbrushingCreation(form, airbrushingListNames)) return;

    setIsSubmitting(true);
    try {
      // 0b. Edição inline de função em contato JÁ CADASTRADO.
      // Essas linhas não fazem parte do payload da tarefa (só `newResponsibles`
      // entra), então sem esta escrita a alteração se perdia em silêncio — que
      // é exatamente o que acontecia nesta página até agora.
      await syncResponsibleRoles(responsibleRows);

      const vehicleValues = ((data as any).vehicles || []) as VehicleFormValues[];
      const dirtyFields = form.formState.dirtyFields as Record<string, any>;
      const dirtyVehicles = (dirtyFields.vehicles || []) as Array<Record<string, unknown> | undefined>;
      const sameIdSet = (a: string[], b: string[]) =>
        a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");
      // A ARTE NÃO SE GRAVA AQUI: ela é do IMPLEMENTO e tem rotas próprias
      // (`/implements/:id/layouts`), com estado e decisão. O orçamento só a mostra.

      // 1a. Upload each newly picked Plaqueta photo, so the implement payload below can send
      // its id. A failure here must NOT abort the save: the rest of the orçamento is what
      // the user came for, and the interceptor already toasted. `vinPlateId` then stays at
      // whatever it was.
      const vinPlateIdByTask: Record<string, string | null> = {};
      const pendingVinPlateByTask: Record<string, boolean> = {};
      for (const v of vehicleValues) vinPlateIdByTask[v.taskId] = v.vinPlateId ?? null;
      for (const vehicleId of vehicleTaskIds) {
        const pendingVinPlate = (vinPlateFilesByTask[vehicleId] ?? []).find((f) => !f.uploaded);
        if (!pendingVinPlate) continue;
        pendingVinPlateByTask[vehicleId] = true;
        try {
          const response = await uploadSingleFile(pendingVinPlate, { fileContext: "implementVinPlate" });
          if (response.success && response.data) {
            vinPlateIdByTask[vehicleId] = response.data.id;
            // Keep the File instance (blob intact) but mark it uploaded, so a retry after a
            // later failure does not upload the same bytes twice.
            const uploadedId = response.data.id;
            setVinPlateFilesByTask((prev) => ({
              ...prev,
              [vehicleId]: (prev[vehicleId] ?? []).map((f) =>
                f === pendingVinPlate
                  ? (Object.assign(f, {
                      uploaded: true,
                      uploadedFileId: uploadedId,
                      uploadProgress: 100,
                    }) as FileWithPreview)
                  : f,
              ),
            }));
          }
        } catch (error: any) {
          toast.error(`Erro ao enviar a foto da plaqueta: ${error.message}`);
        }
      }

      // 1a'. As fotos das faces das medidas que mudaram (a da traseira, em geral).
      const uploadedMeasurePhotoIds: Partial<Record<ImplementFace, string>> = {};
      for (const side of modifiedMeasureSides) {
        const photoFile = editedMeasureLayouts[side]?.photoFile;
        if (!(photoFile instanceof File)) continue;
        try {
          const response = await uploadSingleFile(photoFile, { fileContext: "implementMeasurePhotos" });
          if (response.success && response.data) uploadedMeasurePhotoIds[side] = response.data.id;
        } catch (error: any) {
          toast.error(`Erro ao enviar a foto da face ${FACE_LABEL[side]}: ${error.message}`);
        }
      }

      // 1b. Upload new base files (already-uploaded ones keep their id) — COMUNS.
      const uploadedBaseFileIds: string[] = [];
      const baseLocalIdToRealFileId: Record<string, string> = {};
      for (const file of baseFiles) {
        if (file.uploaded && file.uploadedFileId) {
          uploadedBaseFileIds.push(file.uploadedFileId);
          baseLocalIdToRealFileId[file.id] = file.uploadedFileId;
        } else if (!file.error) {
          try {
            const response = await uploadSingleFile(file, {
              fileContext: "taskBaseFiles",
            });
            if (response.success && response.data) {
              uploadedBaseFileIds.push(response.data.id);
              baseLocalIdToRealFileId[file.id] = response.data.id;
            }
          } catch (error: any) {
            toast.error(`Erro ao enviar arquivo ${file.name}: ${error.message}`);
          }
        }
      }

      // Persist the just-uploaded state back onto the file lists so a retry (after a
      // later step fails) does NOT re-upload the same bytes and create duplicate File
      // records. Mutate IN PLACE (Object.assign) to keep each File instance — a spread
      // would drop the blob. `localIdToRealFileId` is keyed by each file's local id.
      const markUploaded = (
        list: FileWithPreview[],
        idMap: Record<string, string>,
      ): FileWithPreview[] =>
        list.map((f) => {
          const realId = idMap[f.id];
          if (realId && !f.uploaded) {
            return Object.assign(f, {
              uploaded: true,
              uploadedFileId: realId,
              uploadProgress: 100,
            }) as FileWithPreview;
          }
          return f;
        });
      setBaseFiles((prev) => markUploaded(prev, baseLocalIdToRealFileId));

      // 3. Build responsible data — COMUNS a todos os veículos.
      const existingRepIds = responsibleRows
        .filter((row) => !row.isNew && row.id && !row.id.startsWith("temp-"))
        .map((row) => row.id);
      const newResponsibles = responsibleRows
        .filter(
          (row) => row.isNew && row.name?.trim() && row.phone?.trim(),
        )
        .map((row) => ({
          name: row.name.trim(),
          phone: row.phone.trim(),
          // E-mail é opcional no cadastro — vazio vira undefined para não
          // enviar string vazia no payload.
          email: (row.email ?? '').trim().toLowerCase() || undefined,
          cpf: (row.cpf || '').replace(/\D/g, '') || undefined,
          roles: row.roles,
          isActive: row.isActive,
          customerId: data.customerId || undefined,
        }));
      const loadedResponsibleIds = loadedResponsibleIdsRef.current;
      const responsibleIdsChanged =
        existingRepIds.length !== loadedResponsibleIds.length ||
        existingRepIds.some((id) => !loadedResponsibleIds.includes(id)) ||
        loadedResponsibleIds.some((id) => !existingRepIds.includes(id));

      // ═══════════════════════════════════════════════════════════════════════
      // 4. AS TAREFAS — O QUE É COMUM VAI PARA TODAS, O QUE É DE CADA UMA, SÓ PARA ELA
      // ═══════════════════════════════════════════════════════════════════════
      //
      // Só o que MUDOU. This page used to be a full-replace form that always called
      // updateTask with every field, so correctness hinged entirely on the query
      // `include` being complete; a missing include or empty array silently WIPED
      // data (findings I39/I40). Each payload is built from the dirty fields only and
      // OMITS anything unchanged, so the API's "absence = preserve" semantics protect
      // untouched data.
      //
      // Um campo COMUM é gravado quando o operador o mudou — ou quando pediu para
      // igualar os veículos que divergem —, e só nas tarefas em que o valor é
      // diferente do mostrado. Um campo DO VEÍCULO vai só para a tarefa dele.
      const divergentKeys = new Set(equalizeCommon ? commonDivergence.keys : []);
      const writeCommon = (key: string) => !!dirtyFields[key] || divergentKeys.has(key);
      const loadedBaseFileIds = loadedBaseFileIdsRef.current;
      const baseFilesChanged =
        uploadedBaseFileIds.length !== loadedBaseFileIds.length ||
        uploadedBaseFileIds.some((id, i) => id !== loadedBaseFileIds[i]);
      const writeBaseFiles = baseFilesChanged || divergentKeys.has("baseFiles");
      const writeResponsibles =
        newResponsibles.length > 0 ||
        (existingRepIds.length > 0 && (responsibleIdsChanged || divergentKeys.has("responsibles")));

      const payloadFor = (vehicleTask: any, index: number): Record<string, any> => {
        const payload: Record<string, any> = {};
        const vData = (vehicleValues[index] ?? {}) as Partial<VehicleFormValues>;
        const vDirty = (dirtyVehicles[index] ?? {}) as Record<string, unknown>;
        const implementPayload: Record<string, unknown> = {};

        // ── Comuns ──
        if (writeCommon("name") && (vehicleTask.name || "") !== (data.name || ""))
          payload.name = data.name || undefined;
        if (writeCommon("customerId") && (vehicleTask.customerId || "") !== (data.customerId || ""))
          payload.customerId = data.customerId || undefined;
        if (writeCommon("category") && (vehicleTask.implement?.category || "") !== (data.category || ""))
          implementPayload.category = data.category || undefined;
        if (
          writeCommon("implementType") &&
          (vehicleTask.implement?.type || "") !== (data.implementType || "")
        )
          implementPayload.type = data.implementType || undefined;
        if (writeBaseFiles) {
          const current = ((vehicleTask.baseFiles || []) as any[]).map((f) => f.id);
          // Na tarefa aberta vale a comparação de sempre (inclui reordenar); nos irmãos,
          // o conjunto.
          const differs =
            vehicleTask.id === taskId ? baseFilesChanged : !sameIdSet(current, uploadedBaseFileIds);
          if (differs) {
            payload.baseFileIds = uploadedBaseFileIds;
          }
        }

        // ── Do veículo ──
        if (vDirty.details)
          // Send null (not undefined) when cleared so the API actually clears it.
          // `details` is an optional description: the API schema transforms "" → undefined
          // and the repository skips undefined, so "" or undefined would silently persist
          // the old value. Only an explicit null clears the column.
          payload.details = vData.details?.trim() ? vData.details : null;
        if (vDirty.forecastDate) payload.forecastDate = vData.forecastDate || undefined;
        if (vDirty.term) payload.term = vData.term || undefined;
        if (vDirty.paintId) payload.paintId = vData.paintId || null;
        // O PEDIDO DE COMPRA — deste veículo. Enviado sempre que MUDOU, inclusive
        // vazio (`null`): limpar o campo tem de persistir, não deixar o número antigo
        // de pé num pedido cancelado.
        const nextOrderNumber = (vData.customerOrderNumber ?? "").trim() || null;
        const savedOrderNumber = (vehicleTask.customerOrderNumber ?? "").trim() || null;
        if (nextOrderNumber !== savedOrderNumber) payload.customerOrderNumber = nextOrderNumber;
        // Série, placa e chassi limpos vão como null EXPLÍCITO, nunca undefined: undefined
        // é como se diz "não mexe" à API, então apagar o campo mantinha o valor antigo.
        // A série é SÓ do implemento (NOMENCLATURA.md §5): vai em `implement.serialNumber`.
        if (vDirty.serialNumber) implementPayload.serialNumber = vData.serialNumber || null;
        if (vDirty.plate) implementPayload.plate = vData.plate || null;
        if (vDirty.chassisNumber) implementPayload.chassisNumber = vData.chassisNumber || null;
        // Plaqueta: send an EXPLICIT null when the photo was cleared. `vDirty.vinPlateId`
        // misses the pick-a-brand-new-photo case — setValue writes null there, which
        // equals the default when there was no photo before — hence the pending arm.
        if (vDirty.vinPlateId || pendingVinPlateByTask[vehicleTask.id]) {
          implementPayload.vinPlateId = vinPlateIdByTask[vehicleTask.id] ?? null;
        }
        // AS MEDIDAS — só no implemento da tarefa aberta; a API as replica aos
        // irmãos do orçamento (`implement-measure-replication`).
        if (vehicleTask.id === taskId) {
          for (const side of modifiedMeasureSides) {
            const layout = editedMeasureLayouts[side];
            if (layout?.sections?.length) {
              implementPayload[FACE_MEASURE_FIELD[side]] = measurePayloadOf(layout, uploadedMeasurePhotoIds[side]);
            }
          }
        }
        if (Object.keys(implementPayload).length > 0) payload.implement = implementPayload;

        return payload;
      };

      // A tarefa ABERTA primeiro: é nela que os responsáveis NOVOS nascem, e os irmãos
      // precisam dos ids que o servidor deu a eles para ligar os MESMOS contatos —
      // mandar `newResponsibles` a cada tarefa cadastraria o mesmo contato N vezes.
      const writeOrder = [taskId, ...vehicleTaskIds.filter((id) => id !== taskId)];
      let sharedResponsibleIds: string[] | null = null;
      for (const vehicleId of writeOrder) {
        const index = vehicleTaskIds.indexOf(vehicleId);
        const vehicleTask = (index >= 0 ? vehicleTasks[index] : task) as any;
        if (!vehicleTask) continue;
        const payload = payloadFor(vehicleTask, Math.max(0, index));
        if (writeResponsibles) {
          if (vehicleId === taskId) {
            if (newResponsibles.length > 0) payload.newResponsibles = newResponsibles;
            // The existing-id set is sent only when it differs from what was loaded (an
            // add/removal), so an untouched save never re-writes the responsible list.
            if (responsibleIdsChanged && existingRepIds.length > 0) payload.responsibleIds = existingRepIds;
          } else if (sharedResponsibleIds && sharedResponsibleIds.length > 0) {
            const current = ((vehicleTask.responsibles || []) as any[]).map((r) => r.id);
            if (!sameIdSet(current, sharedResponsibleIds)) payload.responsibleIds = sharedResponsibleIds;
          }
        }
        // Only hit the task endpoint when something task-owned actually changed.
        if (Object.keys(payload).length > 0) {
          try {
            await updateTaskAsync({ id: vehicleId, data: payload });
          } catch {
            // Error toast is emitted by the axios error interceptor. Com N veículos, diga
            // até onde foi: os anteriores JÁ estão gravados.
            if (multiVehicle && vehicleId !== taskId) {
              toast.error(
                `O veículo ${vehicleLabelOf(vehicleValues[index], index)} não foi salvo. ` +
                  "Os veículos anteriores já foram gravados — corrija e salve de novo.",
              );
            }
            setIsSubmitting(false);
            return;
          }
        }
        if (vehicleId === taskId && writeResponsibles) {
          if (newResponsibles.length > 0) {
            const fresh: any = await getTaskById(taskId, { include: { responsibles: true } } as any);
            sharedResponsibleIds = (((fresh?.data?.responsibles ?? []) as any[]) || []).map((r) => r.id);
          } else {
            sharedResponsibleIds = existingRepIds;
          }
        }
      }

      // 4b. AEROGRAFIAS — de cada veículo, pela mesma reconciliação do formulário de
      // tarefa (criar o que é novo, atualizar o que mudou, remover o que saiu). Esta
      // tela mostrava a seção e não carregava nem gravava nada dela.
      const customerInfo = task?.customer
        ? {
            id: task.customer.id,
            name: task.customer.corporateName || task.customer.fantasyName,
            fantasyName: task.customer.fantasyName,
          }
        : undefined;
      try {
        for (let index = 0; index < vehicleTaskIds.length; index++) {
          const vehicleId = vehicleTaskIds[index];
          const plan = planAirbrushingReconciliation(
            vehicles.airbrushingsByTask[vehicleId] ?? [],
            ((form.getValues(`vehicles.${index}.airbrushings` as never) as unknown) as any[]) || [],
          );
          if (plan.hasChanges) await applyAirbrushingPlan(plan, vehicleId, customerInfo as any);
        }
      } catch (airbrushingError: any) {
        // Make the UI reflect what actually persisted before surfacing the error.
        await queryClient.invalidateQueries({ queryKey: airbrushingKeys.all });
        toast.error(
          airbrushingError?.message ||
            "Não foi possível salvar todas as aerografias. Verifique e tente novamente.",
        );
        setIsSubmitting(false);
        return;
      }

      // 5. O CADASTRO DOS PAGADORES — só o que mudou, e no cliente CERTO.
      //
      // A cópia editável (`customerData`) é comparada com o cadastro como foi
      // carregado (`customerUpdatePatch`): nada mudou, nada se grava; documento só
      // em cadastro sem documento. Antes o Salvar regravava todos os campos de
      // todo pagador a cada gravação. Ver `utils/budget-payers.ts`.
      for (const config of data.customerConfigs || []) {
        if (!config?.customerId || !config.customerData) continue;
        let record = customersCache.current.get(config.customerId);
        if (!record) {
          try {
            record = ((await getCustomerById(config.customerId)) as any)?.data;
            if (record) customersCache.current.set(record.id, record);
          } catch {
            record = null;
          }
        }
        if (!record) continue;
        const patch = customerUpdatePatch(record, config.customerData);
        if (Object.keys(patch).length === 0) continue;
        try {
          await customerService.updateCustomer(config.customerId, patch as any);
        } catch {
          // Error toast is emitted by the axios error interceptor (o 409 do
          // documento de outro cliente diz de quem é).
        }
      }

      // 6. Validate and save quote
      const validServices = (data.services || []).filter(
        (item: any) => item.description && item.description.trim().length > 0,
      );

      if (validServices.length === 0) {
        toast.error("Adicione pelo menos um serviço ao orçamento.");
        setIsSubmitting(false);
        return;
      }

      // With 2+ billing customers every service MUST be assigned to one — an
      // unassigned service is excluded from every per-customer total, so its
      // amount would silently vanish from the budget (and the API's billing-
      // approval guard blocks approval anyway). Block the save here.
      //
      // ⚠️ CLIENTES DISTINTOS, nunca faturas. A lista do formulário já vem
      // deduplicada por cliente (ver a hidratação), mas contar `length` aqui
      // voltaria a ser errado no dia em que ela deixar de vir — e o erro seria
      // uma recusa impossível de obedecer, porque o seletor "Faturar Para" só
      // aparece com mais de um cliente.
      if (
        hasMultipleCustomers(data.customerConfigs || []) &&
        validServices.some((item: any) => !item.invoiceToCustomerId)
      ) {
        toast.error(
          "Atribua um cliente a todos os serviços antes de salvar (orçamento com múltiplos clientes).",
        );
        setIsSubmitting(false);
        return;
      }

      if (!data.expiresAt) {
        toast.error("A data de validade é obrigatória.");
        setIsSubmitting(false);
        return;
      }

      // TRAVADO POR DINHEIRO? — a pergunta é da COBRANÇA, não do status do orçamento.
      //
      // Espelha `isQuoteMoneyLocked(billings)` no servidor: trava = ALGUMA cobrança com
      // `approvedAt`. A fatura, os boletos e a nota saíram sobre o preço atual, e o
      // servidor RECUSA O CORPO INTEIRO se ele trouxer qualquer chave fora de
      // `QUOTE_SAFE_AFTER_BILLING_FIELDS`. É a mesma conta que a tela de Faturamento faz
      // (`billing/details/[id].tsx`) e que o app faz (`budget_form_screen.dart`).
      const isQuoteLocked = approvedBillingCount > 0;

      /**
       * ⚠️ `taskId` NÃO VAI NO CORPO, travado ou não.
       *
       * A FK do vínculo mora em `Task` (`task Task? @relation("TASK_QUOTE")`) —
       * `Budget` não tem essa coluna, e o `update` do servidor nem lê a chave (ele
       * reconcilia por `taskIds`). Mandá-la custava duas coisas, as duas ruins:
       *   • `filterToMaterialChanges` compara com `existing.taskId`, que é sempre
       *     `undefined`, então a chave SEMPRE parecia alterada — o "Nenhuma alteração
       *     detectada" do servidor virava inalcançável e toda gravação forçava
       *     reconcile + changelog completos;
       *   • com cobrança aprovada a guarda recusa por PRESENÇA de chave, e `taskId`
       *     não está na lista segura — então TODA gravação desta tela dava 400,
       *     inclusive a que só prorrogava a validade.
       *
       * Os outros dois clientes já fazem assim. Este era o único que ainda mandava.
       */
      const quoteData: any = isQuoteLocked
        ? {
            // SÓ O QUE A LISTA SEGURA ACEITA. `subtotal`/`total` ficam de fora não só
            // pela trava: eles vão em escala POR VEÍCULO e nunca batem com o contrato,
            // então sobreviveriam ao filtro de mudança material e derrubariam o corpo
            // mesmo numa gravação que não mexeu em preço nenhum.
            expiresAt: data.expiresAt,
            guaranteeYears: data.guaranteeYears || null,
            customGuaranteeText: data.customGuaranteeText || null,
            customForecastDays: data.customForecastDays || null,
            simultaneousTasks: data.simultaneousTasks || null,
          }
        : {
            expiresAt: data.expiresAt,
            subtotal: data.subtotal || 0,
            total: data.total || 0,
            guaranteeYears: data.guaranteeYears || null,
            customGuaranteeText: data.customGuaranteeText || null,
            customForecastDays: data.customForecastDays || null,
            simultaneousTasks: data.simultaneousTasks || null,
            billingSplit: data.billingSplit || "JOINT",
            // ─── OS LOTES VIRAM COBERTURA ────────────────────────────────────────
            //
            // O formulário guarda UMA fatura por cliente e a repartição num campo
            // só. A API recebe uma fatura por (cliente × lote), cada uma com a
            // cobertura explícita. A expansão acontece aqui, no save, e só quando há
            // lotes: nos outros modos a cobertura é derivável e mandá-la seria
            // payload inútil — e uma segunda fonte de verdade sobre quem cobra quem.
            customerConfigs: expandConfigsIntoLots(
              data.customerConfigs || [],
              (data.billingSplit || "JOINT") as "JOINT" | "PER_TASK" | "CUSTOM",
              quoteTasks(existingQuote as any).map((t: any) => t.id),
              data.billingGroups,
            ),
            services: validServices.map((item: any) => ({
              ...item,
              amount: item.amount ?? 0,
            })),
          };

      if (existingQuote?.id) {
        // Short-circuit: skip the quote update entirely when no quote-form
        // field is dirty. Prevents Task-only edits (e.g. implement plate) from
        // round-tripping through the quote endpoint. The API also filters
        // no-ops defensively, but skipping the call is cheaper.
        const dirty = form.formState.dirtyFields as Record<string, unknown>;
        // Detect service reordering via ordered comparison of service ids vs the
        // persisted ones. A pure drag-reorder does not flip dirty.services (RHF
        // carries each item's dirty state along when it moves), so the dirty-flag
        // check alone would miss it.
        const persistedServiceIds = (existingQuote.services || []).map(
          (s: any) => s.id,
        ) as string[];
        const currentServiceIds = validServices.map((s: any) => s.id);
        const servicesReordered =
          currentServiceIds.length !== persistedServiceIds.length ||
          currentServiceIds.some((id: any, i: number) => id !== persistedServiceIds[i]);
        // ─── A RECOMPOSIÇÃO DE LOTES ────────────────────────────────────────
        //
        // Comparação de CONTEÚDO, como a dos serviços logo acima, e não
        // `dirty.billingGroups`: o campo é `string[][]`, e o dirty de um array
        // aninhado no react-hook-form é uma estrutura que o `Boolean()` lê como
        // verdadeira até quando nada mudou — o gate passaria a disparar uma
        // gravação de orçamento em toda edição só da tarefa, que é exatamente o
        // que ele existe para evitar.
        //
        // Sem esta linha o gate ignorava lote: mover veículos entre lotes num
        // orçamento que JÁ é `CUSTOM` não toca em mais nenhum campo do
        // orçamento, então `quoteFieldDirty` saía falso, o `PUT` inteiro era
        // pulado e a tela ainda redirecionava como se tivesse gravado. Trocar o
        // MODO continuava funcionando (`dirty.billingSplit`), o que escondia o
        // defeito justamente na única operação que ajusta um lote existente.
        //
        // Normalizado dos dois lados — ordenado dentro do grupo e entre grupos —
        // porque a identidade de um agrupamento é QUEM está com QUEM, não a
        // ordem em que as faturas nasceram. É a mesma normalização que a v6 do
        // recorte material aplica em `billingGroups`, e sem ela uma reordenação
        // sem efeito nenhum para o cliente gravaria de novo e derrubaria as
        // assinaturas já colhidas.
        const normalizeGroups = (groups: unknown): string => {
          const list = Array.isArray(groups) ? (groups as string[][]) : [];
          return JSON.stringify(
            list
              .map((g) => [...(Array.isArray(g) ? g : [])].sort())
              .filter((g) => g.length > 0)
              .sort((a, b) => (a[0] ?? "").localeCompare(b[0] ?? "")),
          );
        };
        const billingGroupsChanged =
          normalizeGroups(data.billingGroups) !==
          normalizeGroups(
            dedupeConfigsByCustomer(existingQuote.customerConfigs ?? []).coverageGroups,
          );
        const quoteFieldDirty =
          servicesReordered ||
          billingGroupsChanged ||
          Boolean(
            dirty.expiresAt ||
              dirty.subtotal ||
              dirty.total ||
              dirty.guaranteeYears ||
              dirty.customGuaranteeText ||
              dirty.customForecastDays ||
              dirty.simultaneousTasks ||
              dirty.billingSplit ||
              dirty.customerConfigs ||
              dirty.services,
          );
        // ⚠️ O QUE NÃO VAI SER GRAVADO, DITO EM VOZ ALTA.
        //
        // Com cobrança aprovada o corpo é reduzido à lista segura, e os campos de
        // dinheiro ficam de fora — se fossem, o servidor recusaria a gravação inteira.
        // Sem este aviso, o operador editaria o preço, veria o toast de sucesso da
        // prorrogação de validade e sairia achando que o preço mudou. O formulário
        // não desabilita esses campos (ainda), então quem avisa é aqui.
        if (
          isQuoteLocked &&
          (billingGroupsChanged ||
            servicesReordered ||
            Boolean(
              dirty.subtotal ||
                dirty.total ||
                dirty.services ||
                dirty.customerConfigs ||
                dirty.billingSplit,
            ))
        ) {
          toast.warning("Valores não alterados: o faturamento já foi aprovado", {
            description:
              "Preço, serviços, clientes e divisão só mudam depois de reverter o " +
              "faturamento na tela de Faturamento. O restante foi salvo.",
          });
        }

        // ─── O "PIN" DE STATUS FICOU SÓ PARA `APPROVED` ─────────────────────
        //
        // ⚠️ DECISÃO DO DONO, 2026-05, RECONFIRMADA EM 2026-06-10, registrada no
        // cabeçalho de `task-quote.guards.ts`: "pinning" é intencional — editar
        // valores NÃO deve derrubar a aprovação quando o cliente fixa o status.
        // Ela continua valendo e está preservada abaixo.
        //
        // O que MUDOU é o recorte, por um fato que aquela decisão não tinha como
        // prever: `SIGNED` só passou a existir em 09/2026. Fixar o status de um
        // orçamento ASSINADO enquanto se muda o preço deixa a tela afirmando
        // assinaturas válidas para um valor que o cliente nunca viu — e o
        // envelope é derrubado no pós-commit de qualquer jeito, então o pin não
        // salva a coleta, só esconde que ela caiu. Em `EXPIRED` vale o mesmo: o
        // valor está voltando para a mesa, que é a definição do estado.
        //
        // Os três motivos que o agente levantou para tirar o pin por inteiro
        // estão abaixo; o primeiro é o que a decisão do dono responde, os outros
        // dois continuam de pé e são o que restringe o pin a `APPROVED`:
        //
        // Esta gravação mandava `status: existingQuote.status` em TODA gravação
        // suja. `status` presente — mesmo igual ao atual — é o cliente dizendo
        // "mantenha este estado", e o servidor então NÃO roda o auto-revert
        // `APPROVED|SIGNED|EXPIRED → PENDING` da edição de valor. Pela web ele
        // nunca rodava: editar o preço de um orçamento ASSINADO o deixava
        // assinado, com o envelope afirmando um valor que o cliente nunca viu.
        //
        // E o pin só tem efeito exatamente no caso em que ele não devia ter:
        // o auto-revert só dispara quando `services` ou `customerConfigs` vão
        // no corpo. Sem essas chaves o pin é inerte — e não é inócuo, porque
        // `existingQuote` é lido uma vez na abertura da página: se o estado
        // mudou no servidor nesse meio-tempo (aprovação feita noutra tela), o
        // pin deixa de ser no-op e REGRAVA o estado velho. É o mesmo defeito
        // que o app corrigiu lendo o estado da cópia recarregada.
        //
        // Num orçamento TRAVADO há ainda a terceira razão, que é a do app:
        // sobre orçamento travado o servidor recusa `status` vindo de fora
        // ("Use o endpoint de atualização de status") e a gravação inteira cai.
        //
        // A TRANSIÇÃO escolhida no seletor continua sendo aplicada logo abaixo,
        // pelo endpoint próprio, depois dos valores — que é o que a torna
        // validada contra o preço recém-gravado.
        let statusAfterSave = existingQuote.status as TASK_QUOTE_STATUS;
        if (quoteFieldDirty) {
          // O PIN, no recorte acima: só `APPROVED`, e só com o orçamento
          // destravado (sobre travado o servidor recusa `status` vindo de fora e
          // a gravação inteira cai).
          const payload =
            !isQuoteLocked && existingQuote.status === "APPROVED"
              ? { ...quoteData, status: "APPROVED" }
              : quoteData;
          const saved: any = await updateQuoteMutation.mutateAsync({
            id: existingQuote.id,
            data: payload,
          });
          // O estado DEPOIS da gravação — pode ter mudado agora mesmo, pelo
          // auto-revert. Reproduzir os saltos a partir do estado lido na
          // abertura pediria ao servidor um caminho que não existe mais.
          //
          // ⚠️ O interceptor do axios devolve a RESPOSTA inteira, não o envelope:
          // o orçamento está em `res.data.data`. Ler `res.status` traria 200 — o
          // código HTTP —, que passaria adiante como se fosse um estado.
          const quoteSalva = (saved as any)?.data?.data ?? (saved as any)?.data ?? null;
          if (typeof quoteSalva?.status === "string") {
            statusAfterSave = quoteSalva.status as TASK_QUOTE_STATUS;
          }
        }

        // O ESTADO NÃO SE ESCOLHE NO FORMULÁRIO (Modelo C). Enviar ao cliente,
        // retirar, aprovar o valor em nome do cliente e reprovar são ATOS, com
        // botão próprio que chama a rota na hora (`BudgetStateActions`). O Salvar
        // grava só dados — com uma exceção, a de sempre:
        //
        // VALIDADE NOVA TIRA DE "AGUARDANDO REANÁLISE". O vencimento é o que
        // levou o orçamento a EXPIRED; dar a ele uma validade futura é o comercial
        // dizendo que a proposta continua de pé. Mesma regra do
        // `PUT /budgets/:id/validity`.
        const servidorMoveuOEstado = statusAfterSave !== (existingQuote.status as TASK_QUOTE_STATUS);
        if (servidorMoveuOEstado) {
          // A gravação derrubou as assinaturas e o servidor devolveu o orçamento a
          // Pendente (nº 984, 17/09). Dizer em voz alta o que aconteceu.
          toast.info(
            "O orçamento voltou para Pendente: a alteração invalidou as assinaturas já colhidas. " +
              "Reenvie para assinatura antes de aprovar de novo.",
          );
        } else if (
          statusAfterSave === "EXPIRED" &&
          dirty.expiresAt &&
          data.expiresAt &&
          !isQuoteValidityExpired(data.expiresAt)
        ) {
          await budgetService.updateStatus(existingQuote.id, "PENDING");
        }
      } else {
        quoteData.status = "PENDING";
        // ⚠️ O VEÍCULO. `taskQuoteCreateSchema` exige `taskId` OU `taskIds`, e este
        // corpo não levava nenhum dos dois — toda criação de orçamento por esta
        // tela respondia 400.
        //
        // O `taskId` ficou de fora quando a chave foi removida do corpo de
        // ATUALIZAÇÃO (ali ela é um fantasma: a coluna mudou de lado, `Budget`
        // não a tem, e mandá-la derrubava qualquer gravação de orçamento com
        // cobrança aprovada). A remoção foi aplicada aos dois ramos, e no de
        // criação ela é obrigatória: é a ÚNICA coisa que diz de qual implemento é o
        // orçamento que está nascendo.
        quoteData.taskIds = [taskId];
        await createQuoteMutation.mutateAsync(quoteData);
      }

      queryClient.invalidateQueries({ queryKey: budgetKeys.all });
      // Tasks embed quote data (budget value + status badges). When only the quote
      // half changed, updateTaskAsync above is skipped, so invalidate tasks explicitly.
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      queryClient.invalidateQueries({ queryKey: airbrushingKeys.all });
      allowNavigation();
      // Honor an explicit returnTo (e.g. the budget list sets it); otherwise land on the
      // task detail page so a budget saved from the prep-board right-click ends up there.
      if (returnTo) navigate(returnTo);
      else navigate(routes.production.preparation.details(taskId));
    } catch (error: any) {
      console.error("Error saving budget:", error);
      toast.error(
        error?.response?.data?.message || "Erro ao salvar orçamento.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    form,
    guardAirbrushingCreation,
    measuresError,
    goToStepAnchor,
    modifiedMeasureSides,
    editedMeasureLayouts,
    taskId,
    task,
    existingQuote,
    vinPlateFilesByTask,
    vehicleTaskIds,
    vehicleTasks,
    vehicles.airbrushingsByTask,
    multiVehicle,
    equalizeCommon,
    commonDivergence,
    baseFiles,
    approvedBillingCount,
    responsibleRows,
    queryClient,
    createQuoteMutation,
    updateQuoteMutation,
    updateTaskAsync,
    navigate,
    returnTo,
    allowNavigation,
  ]);

  // Status changes are NOT persisted immediately from the dropdown anymore — that
  // raced unsaved value edits (the backend validates prerequisites like "total > 0"
  // against the persisted quote, so an immediate call before saving could fail and
  // leave the quote PENDING). The dropdown only updates the form; the transition is
  // committed on Save, after the values are persisted (see handleSubmit).

  // ═══════════════════════════════════════════════════════════════════════
  // O QUE AS ABAS, O PASSO 2 E O RESUMO MOSTRAM DE CADA VEÍCULO
  // ═══════════════════════════════════════════════════════════════════════
  const watchedVehicles =
    (useWatch({ control: form.control, name: "vehicles" }) as VehicleFormValues[] | undefined) ?? [];

  // A pintura geral de cada implemento, pelo nome e pela cor. A gravada vem com a tarefa;
  // uma trocada agora é buscada (e fica no cache do react-query).
  const knownPaints = useMemo(() => {
    const map = new Map<string, { name: string; hex: string | null }>();
    for (const t of vehicleTasks) {
      const p = (t as any)?.generalPainting;
      if (p?.id) map.set(p.id, { name: p.name, hex: p.hex ?? null });
    }
    return map;
  }, [vehicleTasks]);
  const unknownPaintIds = useMemo(
    () => [
      ...new Set(
        watchedVehicles
          .map((v) => v?.paintId)
          .filter((id): id is string => !!id && !knownPaints.has(id)),
      ),
    ],
    [watchedVehicles, knownPaints],
  );
  const fetchedPaints = useQueries({
    queries: unknownPaintIds.map((id) => ({
      queryKey: ["paints", "budget-vehicle-summary", id],
      queryFn: async () =>
        ((await getPaintById(id, { select: { id: true, name: true, hex: true } } as any)) as any)?.data ?? null,
      staleTime: 1000 * 60 * 5,
    })),
  });
  const fetchedPaintsStamp = fetchedPaints.map((q) => q.dataUpdatedAt).join(",");
  const paintById = useMemo(() => {
    const map = new Map(knownPaints);
    for (const q of fetchedPaints) {
      const p = q.data as any;
      if (p?.id) map.set(p.id, { name: p.name, hex: p.hex ?? null });
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knownPaints, fetchedPaintsStamp]);

  const dirtyVehicleFields = ((form.formState.dirtyFields as any)?.vehicles ?? []) as any[];
  const vehicleTabs = useMemo(
    () =>
      vehicleTaskIds.map((id, index) => {
        const values = watchedVehicles[index];
        const paint = values?.paintId ? paintById.get(values.paintId) : null;
        const serial = (values?.serialNumber || "").trim();
        const plate = (values?.plate || "").trim();
        const dirtyEntry = dirtyVehicleFields[index];
        return {
          taskId: id,
          label: vehicleLabelOf(values, index),
          detail: serial && plate ? plate : null,
          paintName: paint?.name ?? null,
          paintHex: paint?.hex ?? null,
          dirty: !!dirtyEntry && Object.keys(dirtyEntry).length > 0,
        };
      }),
    [vehicleTaskIds, watchedVehicles, paintById, dirtyVehicleFields],
  );

  // "Aplicar aos demais" — copia o valor de um veículo para todos os outros.
  const applyFromVehicle = useCallback(
    (field: BudgetApplyField | BudgetVehicleApplyField, fromIndex: number) => {
      const value = form.getValues(`vehicles.${fromIndex}.${field}` as never) as unknown;
      vehicleTaskIds.forEach((_, index) => {
        if (index === fromIndex) return;
        form.setValue(
          `vehicles.${index}.${field}` as never,
          (value instanceof Date ? new Date(value) : value) as never,
          { shouldDirty: true },
        );
      });
      const others = vehicleTaskIds.length - 1;
      toast.success(`Aplicado ${others === 1 ? "ao outro veículo" : `aos outros ${others} veículos`}.`);
    },
    [form, vehicleTaskIds],
  );
  // No passo Tarefa (detalhes, tinta): a partir do veículo escolhido nas abas.
  const applyFromActiveVehicle = useCallback(
    (field: BudgetApplyField) => applyFromVehicle(field, activeVehicleIndex),
    [applyFromVehicle, activeVehicleIndex],
  );

  // ─── A ARTE DE CADA VEÍCULO (só leitura) ───────────────────────────────
  //
  // A arte é do IMPLEMENTO (Modelo C): o orçamento não a escolhe nem a grava, e o
  // documento leva a APROVADA de cada veículo. Aqui só se lê o que o `include`
  // trouxe (`implement.layouts`), para o passo 1 e para o Resumo.
  const artVehicles = useMemo(
    () =>
      vehicleTabs.map((tab, index) => ({
        taskId: tab.taskId,
        label: tab.label,
        implement: ((vehicleTasks[index] as any)?.implement ?? null) as ImplementArtVehicle["implement"],
      })),
    [vehicleTabs, vehicleTasks],
  );

  // O que o Resumo mostra de cada veículo além da identificação: a pintura e a
  // arte APROVADA do implemento.
  const artThumbOf = (file: { id: string; thumbnailUrl?: string | null }): string =>
    file.thumbnailUrl || `${getApiBaseUrl()}/files/thumbnail/${file.id}`;
  const reviewVehicleExtras = useMemo(
    () =>
      Object.fromEntries(
        vehicleTabs.map((t, index) => [
          t.taskId,
          {
            paintName: t.paintName,
            paintHex: t.paintHex,
            layoutThumbs: approvedArtFilesOf(artVehicles[index]).map(artThumbOf),
          },
        ]),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [vehicleTabs, artVehicles],
  );
  // A arte do Resumo agrupada pelos veículos que a usam — a mesma leitura do
  // documento ("Veículos 39088, 39089"). Um grupo só quando todos têm a mesma.
  const reviewLayoutGroups = useMemo(() => {
    const groups = new Map<string, { labels: string[]; thumbs: string[] }>();
    artVehicles.forEach((vehicle) => {
      const files = approvedArtFilesOf(vehicle);
      if (files.length === 0) return;
      const key = files.map((f) => f.id).join("|");
      if (!groups.has(key)) groups.set(key, { labels: [], thumbs: files.map(artThumbOf) });
      groups.get(key)!.labels.push(vehicle.label);
    });
    const list = Array.from(groups.values());
    if (list.length === 1 && list[0].labels.length === artVehicles.length) {
      return [{ label: "", thumbs: list[0].thumbs }];
    }
    return list.map((g) => ({
      label:
        (g.labels.length === 1 ? "Veículo " : "Veículos ") +
        (g.labels.length <= 3 ? g.labels.join(", ") : `${g.labels.slice(0, 2).join(", ")} +${g.labels.length - 2}`),
      thumbs: g.thumbs,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artVehicles]);
  // Do Resumo (ou do resumo da arte no passo Tarefa) ao cartão do veículo.
  const openVehicleCard = useCallback(
    (vehicleId: string) => {
      setActiveVehicleId(vehicleId);
      setOpenVehicleId(vehicleId);
      goToStepAnchor(BUDGET_WIZARD_STEP.VEHICLES, ARTWORK_ANCHOR_ID);
    },
    [goToStepAnchor],
  );
  const handleReviewVehicleSelect = openVehicleCard;

  // Os cartões do passo Veículos.
  const vehicleCards = useMemo(
    () =>
      vehicleTabs.map((tab, index) => ({
        taskId: tab.taskId,
        label: tab.label,
        detail: tab.detail,
        dirty: tab.dirty,
        art: artVehicles[index],
        status: (vehicles.tasks[index] as any)?.status ?? null,
        purchaseOrderId: (vehicles.tasks[index] as any)?.purchaseOrderId ?? null,
        purchaseOrder: (vehicles.tasks[index] as any)?.purchaseOrder ?? null,
      })),
    [vehicleTabs, artVehicles, vehicles.tasks],
  );

  // Build header info
  const taskName = task?.name || task?.implement?.plate || "Tarefa";
  const taskDisplayName = [taskName, task?.implement?.serialNumber || task?.implement?.plate]
    .filter(Boolean)
    .join(" - ");
  // Com N veículos o título é do ORÇAMENTO: a série de um implemento ali parecia
  // identificar o orçamento inteiro.
  const budgetNumber = (existingQuote as any)?.budgetNumber as number | undefined;
  const pageTitle =
    multiVehicle && budgetNumber
      ? `Orçamento nº ${budgetNumber} - ${taskName} (${vehicleCount} veículos)`
      : `Orçamento - ${taskDisplayName}`;

  // Loading state — espera TODOS os veículos: o formulário é semeado de uma vez.
  if (taskLoading || quoteLoading || (vehicleTaskIds.length > 0 && !vehiclesReady && !vehicles.isError)) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner />
      </div>
    );
  }

  // Task not found
  if (!task) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-muted-foreground">Tarefa não encontrada.</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <IconArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>
    );
  }

  // Permission check
  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-muted-foreground">
          Você não tem permissão para visualizar orçamentos.
        </p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <IconArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>
    );
  }

  const isLastStep = currentStep === totalSteps;

  /**
   * QUANTO DA REQUISIÇÃO DESENHAR NESTE PASSO — `null` = nada.
   *
   * Tarefa e Resumo: ficha inteira (montar a tarefa a partir do pedido; e
   * conferir o montado contra o pedido). Veículos e Serviços: faixa de uma
   * linha — o pedido traz os veículos e o briefing é o insumo de QUE serviços
   * cobrar, mas quem digita placa ou preço não precisa da ficha. Faturamento:
   * nada. Ver `budget-request-card.tsx`.
   */
  const requestVariant: "full" | "summary" | null =
    currentStep === BUDGET_WIZARD_STEP.TASK || currentStep === BUDGET_WIZARD_STEP.REVIEW
      ? "full"
      : currentStep === BUDGET_WIZARD_STEP.VEHICLES || currentStep === BUDGET_WIZARD_STEP.SERVICES
        ? "summary"
        : null;

  // Public "Ver Orçamento" link — lives in the page header (mirrors the invoice
  // page's "Ver Dossiê"), not in a body card.
  const budgetCustomerId = task?.customer?.id || task?.customerId;
  const publicBudgetUrl =
    existingQuote?.id && budgetCustomerId
      ? routes.customer.budget(budgetCustomerId, existingQuote.id)
      : null;

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <PageHeader
        variant="form"
        title={pageTitle}
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Financeiro", href: routes.financial.root },
          { label: "Orçamento", href: routes.financial.budget.root },
          { label: taskName },
        ]}
        onBreadcrumbNavigate={(path) => guardedNavigate(path)}
        headerExtra={
          <>
            {/* Left of "Ver Orçamento" on purpose: as a PageAction it lands beside the wizard's own
                "Anterior / Próximo", and two adjacent pairs of arrows read as one control. */}
            <RecordPager nav={recordNav} keyboard={false} />
            {publicBudgetUrl && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 whitespace-nowrap"
                onClick={() => window.open(publicBudgetUrl, "_blank")}
              >
                <IconExternalLink className="h-4 w-4" />
                Ver Orçamento
              </Button>
            )}
          </>
        }
        actions={[
          // The record pager is NOT here — it renders in `headerExtra`, left of "Ver Orçamento", so
          // it never sits shoulder to shoulder with the wizard's own "Anterior / Próximo".
          ...(currentStep > 1
            ? [
                {
                  key: "prev",
                  label: "Anterior",
                  onClick: prevStep,
                  variant: "outline" as const,
                  icon: IconArrowLeft,
                },
              ]
            : []),
          ...(!isLastStep && canView
            ? [
                {
                  key: "next",
                  label: "Próximo",
                  onClick: nextStep,
                  variant: "default" as const,
                  icon: IconArrowRight,
                },
              ]
            : []),
          ...(isLastStep && canEdit
            ? [
                {
                  key: "save",
                  label: isSubmitting ? "Salvando..." : "Salvar",
                  onClick: handleSubmit,
                  variant: "default" as const,
                  icon: isSubmitting ? IconLoader2 : IconCheck,
                  disabled: isSubmitting,
                  loading: isSubmitting,
                },
              ]
            : []),
        ]}
      />

      <FormSteps steps={steps} currentStep={currentStep} onStepClick={handleStepClick} disabled={isSubmitting} />

      <div className="flex-1 overflow-y-auto pb-6">
        {/* OS QUATRO EIXOS — valor, arte, assinatura e cobrança, cada um com o
            próximo passo, e "para emitir falta…". Em todos os passos: é o
            mapa do orçamento, e cada atalho leva ao lugar de resolver. */}
        {existingQuote?.id && (
          <BudgetAxesStrip
            className="mb-4"
            status={budgetDetail?.status ?? existingQuote.status}
            signatureStatus={budgetDetail?.signatureStatus ?? (existingQuote as any).signatureStatus}
            billable={budgetDetail?.billable ?? (existingQuote as any).billable}
            emission={budgetDetail?.emission}
            artStates={artVehicles.map((vehicle) => implementArtStateOf(vehicle))}
            onNavigate={handleAxisNavigate}
          />
        )}

        {/* A REQUISIÇÃO — acima dos passos, e não dentro de um deles, porque
            não é campo de passo nenhum: é leitura. Fora do `FormProvider` pelo
            mesmo motivo. Só aparece quando o orçamento nasceu no portal; um
            orçamento feito por dentro não tem `request`.

            ⚠️ E NÃO EM TODOS OS PASSOS. Desenhada inteira nos cinco, ela virava
            moldura — quem preenchia prazos ou condição de pagamento relia pela
            quinta vez quem pediu e a tabela de placas. Onde cada forma aparece
            está em `requestVariant`, logo abaixo; o porquê de cada uma, no
            cabeçalho de `budget-request-card.tsx`.

            ⚠️ SÓ LEITURA. As ações de estado ("Enviar para pré-aprovação",
            "Enviar para assinatura") saíram daqui para o ÚLTIMO passo
            (`BudgetStateActions`, abaixo), onde a decisão se consuma. */}
        {budgetRequest && requestVariant && (
          <div className="mb-4">
            <BudgetRequestCard
              request={budgetRequest}
              status={existingQuote?.status}
              task={task}
              variant={requestVariant}
              // OS VEÍCULOS vêm do ORÇAMENTO, não de `task`: a tela é aberta
              // pelo id de UM implemento e o orçamento cobre N. `quoteTasks`
              // também cobre a forma legada (`quote.task` singular).
              vehicles={quoteTasks(existingQuote)}
            />
          </div>
        )}

        <FormProvider {...form}>
          {/* Os passos ficam MONTADOS (escondidos por CSS): o estado local de cada
              um (useFieldArray, o CPF/CNPJ do pagador, a "Data específica") tem de
              sobreviver ao vai e volta.

              ⚠️ E só montam DEPOIS da primeira carga do formulário. Com as seções
              abertas (sem acordeão), o seletor de aerografia montava com a lista
              vazia e, quando o `form.reset` trazia as do servidor, devolvia-as ao
              formulário como edição — o veículo abria "alterado" sem ninguém mexer,
              e o aviso de alterações não salvas disparava ao sair. */}
          {!formInitialized ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <LoadingSpinner />
            </div>
          ) : (
          <>
          <div style={{ display: currentStep === BUDGET_WIZARD_STEP.TASK ? undefined : "none" }}>
            <BudgetWizardStepTask
              mode="edit"
              disabled={isSubmitting || !canEdit}
              responsibleRows={responsibleRows}
              onResponsibleRowsChange={handleResponsibleRowsChange}
              showResponsibleErrors={showResponsibleErrors}
              baseFiles={baseFiles}
              onBaseFilesChange={handleBaseFilesChange}
              artVehicles={artVehicles}
              budgetId={existingQuote?.id}
              onOpenVehicle={openVehicleCard}
              vehicleFieldPrefix={`vehicles.${activeVehicleIndex}.`}
              vehicleKey={activeVehicleId}
              vehicleCount={vehicleCount}
              activeVehicleLabel={vehicleTabs[activeVehicleIndex]?.label}
              vehicleTabs={
                multiVehicle ? (
                  <BudgetVehicleTabs
                    vehicles={vehicleTabs}
                    activeTaskId={activeVehicleId}
                    onSelect={setActiveVehicleId}
                  />
                ) : undefined
              }
              onApplyToOtherVehicles={applyFromActiveVehicle}
              commonDivergence={
                commonDivergence.labels.length > 0
                  ? {
                      fields: commonDivergence.labels,
                      equalized: equalizeCommon,
                      onEqualize: () => setEqualizeCommon(true),
                    }
                  : null
              }
            />
          </div>

          <div style={{ display: currentStep === BUDGET_WIZARD_STEP.VEHICLES ? undefined : "none" }}>
            <BudgetWizardStepVehicles
              mode="edit"
              disabled={isSubmitting || !canEdit}
              canEditMeasures={canEdit}
              measures={{
                layouts: measureLayouts,
                modifiedSides: modifiedMeasureSides,
                savedSides: savedMeasureSides,
                onSideChange: handleMeasureChange,
                error: measuresError,
              }}
              vehicles={vehicleCards}
              openVehicleId={openVehicleId}
              onOpenVehicleChange={setOpenVehicleId}
              vinPlateFilesByTask={vinPlateFilesByTask}
              onVinPlateFilesChange={handleVinPlateFilesChange}
              onApplyToOtherVehicles={applyFromVehicle}
            />
          </div>

          <div style={{ display: currentStep === BUDGET_WIZARD_STEP.SERVICES ? undefined : "none" }}>
            <BudgetStepServices
              task={task}
              disabled={isSubmitting || !canEdit}
              selectedCustomers={selectedCustomers}
              formInitialized={formInitialized}
            />
          </div>

          <div style={{ display: currentStep === BUDGET_WIZARD_STEP.BILLING ? undefined : "none" }}>
            <BudgetWizardStepBilling
              disabled={isSubmitting || !canEdit}
              customersCache={customersCache}
              setSelectedCustomers={setSelectedCustomers}
              quoteId={existingQuote?.id}
              vehicleCount={existingQuote ? quoteVehicleCount(existingQuote) : vehicleCount}
              // OS VEÍCULOS, com id — é o que permite compor lotes.
              existingVehicles={budgetSplitVehicles}
              approvedBillingCount={approvedBillingCount}
            />
          </div>

          {currentStep === BUDGET_WIZARD_STEP.REVIEW && (
            <>
              {/* AS AÇÕES DE ESTADO, no passo em que a decisão se consuma — o
                  mesmo passo do "Salvar" do cabeçalho. Ver o cabeçalho de
                  `budget-state-actions.tsx`. */}
              <div id={VALUE_ANCHOR_ID}>
              <BudgetValueApprovalCard
                budgetId={existingQuote?.id}
                status={existingQuote?.status}
                valueApproval={budgetDetail?.valueApproval}
                userRole={userRole}
                disabled={isSubmitting || !canEdit}
                hasUnsavedChanges={form.formState.isDirty}
              />
              <BudgetStateActions
                budgetId={existingQuote?.id}
                status={existingQuote?.status}
                // ⛔ Coleta viva cala os atos: ver o cabeçalho de
                // `budget-state-actions.tsx`.
                envelope={envelopeGlance}
                userRole={userRole}
                disabled={isSubmitting || !canEdit}
                hasUnsavedChanges={form.formState.isDirty}
                onGoToSignature={scrollToSignature}
              />
              </div>

              <BudgetStepReview
                task={task}
                disabled={isSubmitting || !canEdit}
                existingQuote={existingQuote}
                userRole={userRole}
                selectedCustomers={selectedCustomers}
                vehicleExtras={multiVehicle ? reviewVehicleExtras : undefined}
                onVehicleSelect={multiVehicle ? handleReviewVehicleSelect : undefined}
                layoutGroups={reviewLayoutGroups}
              />

              {/* Assinatura eletrônica: fica na revisão porque é o passo em que o
                  orçamento está fechado e pronto para ir ao cliente. Só aparece
                  depois que a quote existe — não há o que congelar antes disso. */}
              <OfflineSignatureCard
                budgetId={existingQuote?.id}
                status={existingQuote?.status}
                signatureStatus={budgetDetail?.signatureStatus ?? (existingQuote as any)?.signatureStatus}
                hasLiveEnvelope={!!envelopeGlance?.live}
                userRole={userRole}
                disabled={isSubmitting || !canEdit}
              />

              {existingQuote?.id && (
                <div className="mt-6" id={SIGNATURE_ANCHOR_ID}>
                  <SignatureEnvelopeCard
                    quoteId={existingQuote.id}
                    canManage={canEdit}
                    // O IMPEDIMENTO DA ARTE TEM ENDEREÇO: o quadro da arte de
                    // cada veículo, no passo 1 deste mesmo assistente. Sem isto o
                    // modal de envio dizia o que falta e não dizia onde resolver.
                    onResolveLayout={goToArtworkStep}
                  />
                </div>
              )}
            </>
          )}
          </>
          )}
        </FormProvider>
      </div>

      <UnsavedChangesDialog open={showDialog} onConfirm={confirmNavigation} onCancel={cancelNavigation} />
    </div>
  );
};

export default FinancialBudgetDetailPage;
