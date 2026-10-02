import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import {
  IconArrowLeft,
  IconArrowRight,
  IconLoader2,
  IconCheck,
} from "@tabler/icons-react";
import {
  routes,
  TASK_STATUS,
  SERVICE_ORDER_STATUS,
  SERVICE_ORDER_TYPE,
  FAVORITE_PAGES,
} from "@/constants";
import { budgetKeys } from "@/hooks/production/use-budget";
import {
  canEditQuote,
} from "@/utils/permissions/quote-permissions";
import { validateResponsibleRows, syncResponsibleRoles } from "@/components/administration/customer/responsible";
import { useAuth } from "@/contexts/auth-context";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { FormSteps } from "@/components/ui/form-steps";
import { toast } from "@/components/ui/sonner";
import { uploadSingleFile } from "@/api-client/file";
import { createAirbrushingsForTask } from "@/utils/airbrushing-submit";
import { useAirbrushingCreationGuard } from "@/hooks/production/use-airbrushing-creation-guard";
import { getCustomers, getTaskById } from "@/api-client";
import { customerService } from "@/api-client/customer";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useUnsavedChangesGuard } from "@/hooks/common/use-unsaved-changes-guard";
import { UnsavedChangesDialog } from "@/components/ui/unsaved-changes-dialog";
import type { FileWithPreview } from "@/components/common/file";
import type { ResponsibleRowData } from "@/types/responsible";

// Os passos — os MESMOS do detalhe (ver `utils/budget-wizard.ts`).
import { BudgetWizardStepTask } from "@/components/financial/budget/wizard/budget-wizard-step-task";
import { BudgetWizardStepVehicles } from "@/components/financial/budget/wizard/budget-wizard-step-vehicles";
import { BudgetWizardStepBilling } from "@/components/financial/budget/wizard/budget-wizard-step-billing";
import { BudgetStepServices } from "@/components/financial/budget/steps/budget-step-services";
import { BudgetStepReview } from "@/components/financial/budget/steps/budget-step-review";
import { batchCreateTasksWithQuote } from "@/api-client/task";
import { vehicleCombinations, vehicleCombinationCount } from "@/utils/vehicle-combinations";
import {
  BUDGET_WIZARD_STEP,
  budgetWizardSteps,
  checkBudgetStep,
  firstFailingStep,
  resolveStepJump,
  type BudgetWizardStep,
} from "@/utils/budget-wizard";
import { customerUpdatePatch, newPayerConfig } from "@/utils/budget-payers";
import { measurePayloadOf, measuresWidthError, type MeasureLayout } from "@/utils/implement-measures";
import { FACE_LABEL, FACE_MEASURE_FIELD, type ImplementFace } from "@/constants/implement-faces";
import { applyArtToImplements } from "@/utils/implement-art-upload";

function getDefaultExpiresAt() {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  date.setHours(23, 59, 59, 999);
  return date;
}

// Per-file ceiling for the uploads that run inside the submit. The api-client
// default is 3 minutes, which on a flaky link means the Salvar button sits at
// "Salvando..." for three silent minutes before anything is reported.
const UPLOAD_TIMEOUT_MS = 90_000;
const UPLOAD_PROGRESS_TOAST_ID = "budget-create-upload-progress";

/** Axios surfaces a timeout as a bare "timeout of Nms exceeded" — translate it. */
function describeUploadError(error: any): string {
  if (error?.code === "ECONNABORTED" || /timeout/i.test(error?.message ?? "")) {
    return "o envio demorou demais e foi interrompido. Verifique a conexão e tente novamente.";
  }
  if (!error?.response) {
    return "falha de conexão durante o envio.";
  }
  return error?.message ?? "erro desconhecido";
}

export const FinancialBudgetCreatePage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  usePageTracker({ title: "Orçamento - Cadastrar", icon: "file-invoice" });

  // Mutations

  // Permissions
  const userRole = user?.sector?.privileges || "";
  const canEdit = canEditQuote(userRole);

  // State
  const [currentStep, setCurrentStep] = useState<BudgetWizardStep>(BUDGET_WIZARD_STEP.TASK);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Re-entrancy guard for handleSubmit — see the comment there. `disabled: isSubmitting` alone can't
  // stop a rapid second click, because the state update hasn't re-rendered the button yet.
  const isSubmittingRef = useRef<boolean>(false);
  const guardAirbrushingCreation = useAirbrushingCreationGuard();
  const customersCache = useRef<Map<string, any>>(new Map());
  const [selectedCustomers, setSelectedCustomers] = useState<Map<string, any>>(
    new Map(),
  );

  // Task-specific state
  const [showResponsibleErrors, setShowResponsibleErrors] = useState(false);
  const [responsibleRows, setResponsibleRows] = useState<ResponsibleRowData[]>([{
    id: `temp-${Date.now()}-0`,
    name: '',
    phone: '',
    email: '',
    // Sem função pré-selecionada — quem cadastra escolhe.
    roles: [],
    isActive: true,
    isNew: true,
    isEditing: false,
    isSaving: false,
    error: null,
  }]);
  const [baseFiles, setBaseFiles] = useState<FileWithPreview[]>([]);
  const [baseFileIds, setBaseFileIds] = useState<string[]>([]);

  const handleBaseFilesChange = useCallback((files: FileWithPreview[]) => {
    setBaseFiles(files);
    setBaseFileIds(files.filter(f => f.uploaded && f.uploadedFileId).map(f => f.uploadedFileId!));
  }, []);

  // LAYOUT — "uma imagem para todos": entra como RASCUNHO na arte de cada veículo
  // DEPOIS que o orçamento nasce (a arte é do implemento, Modelo C).
  const [pendingArtFiles, setPendingArtFiles] = useState<FileWithPreview[]>([]);

  // MEDIDAS DO IMPLEMENTO — as mesmas para todos os veículos que vão nascer. Só as
  // faces que o operador mexeu viajam (as outras, o implemento nasce sem).
  const [measureLayouts, setMeasureLayouts] = useState<Partial<Record<ImplementFace, MeasureLayout>>>({});
  const [modifiedMeasureSides, setModifiedMeasureSides] = useState<Set<ImplementFace>>(new Set());
  const handleMeasureChange = useCallback((side: ImplementFace, layout: MeasureLayout) => {
    setMeasureLayouts((prev) => ({ ...prev, [side]: layout }));
    setModifiedMeasureSides((prev) => (prev.has(side) ? prev : new Set(prev).add(side)));
  }, []);
  const measuresError = useMemo(() => measuresWidthError(measureLayouts), [measureLayouts]);

  const handleResponsibleRowsChange = useCallback((rows: ResponsibleRowData[]) => {
    setResponsibleRows(rows);
    if (showResponsibleErrors && validateResponsibleRows(rows)) {
      setShowResponsibleErrors(false);
    }
  }, [showResponsibleErrors]);

  // Paints created inline via the quick-create dialog. If one is still selected
  // at submit time, a "Formular Cor" ARTWORK service order is added so the arts
  // team formulates the new color.
  const createdPaintIdsRef = useRef<Set<string>>(new Set());
  const handlePaintCreated = useCallback((paint: { id: string }) => {
    createdPaintIdsRef.current.add(paint.id);
  }, []);

  // Form - Combined task + budget fields
  const form = useForm({
    mode: "onChange",
    defaultValues: {
      // Task fields
      status: TASK_STATUS.PREPARATION,
      name: "",
      customerId: "",
      details: "",
      plates: [] as string[],
      serialNumbers: [] as number[],
      /**
       * O PEDIDO DE COMPRA DO CLIENTE — UM campo para os N veículos que vão
       * nascer (`Task.customerOrderNumber` em cada um).
       *
       * Fica no passo 1, ao lado da placa e da série, porque é disso que ele é
       * irmão: identifica a ENTREGA. O caso comum é o cliente comprar os quatro
       * implementos num pedido só; quando os pedidos diferem, cada tarefa se
       * corrige depois na tela dela.
       */
      customerOrderNumber: null as string | null,
      category: "",
      // Vazio (D-25). O padrão era REFRIGERATED e todo orçamento criado por aqui gravava
      // "Refrigerado" no implemento, escolhido ou não — o dado de tipo não é confiável por isso.
      implementType: "",
      forecastDate: null as Date | null,
      term: null as Date | null,
      paintId: null as string | null,
      paintIds: [] as string[],
      // ⚠️ SEM a O.S. comercial "Em Negociação".
      //
      // Toda tarefa nascia com ela, `IN_PROGRESS`, e a descrição — TEXTO LIVRE —
      // era o que o sistema lia para saber que o orçamento estava em negociação:
      // concluí-la APROVAVA o orçamento e reabri-la o rebaixava de APPROVED para
      // PENDING. O estado virou `TASK_QUOTE_STATUS.IN_NEGOTIATION` em
      // 20/09/2026, com máquina de transições, e o acoplamento saiu dos dois
      // lados. Continuar enviando a O.S. daqui recriaria em cada tarefa nova
      // justamente as linhas que a migration removeu — o cliente é quem manda
      // `serviceOrders`, então apagar o servidor não basta.
      serviceOrders: [
        {
          description: "Elaborar Layout",
          type: SERVICE_ORDER_TYPE.ARTWORK,
          status: SERVICE_ORDER_STATUS.PENDING,
          statusOrder: 1,
          assignedToId: null,
        },
        {
          description: "Elaborar Projeto",
          type: SERVICE_ORDER_TYPE.ARTWORK,
          status: SERVICE_ORDER_STATUS.PENDING,
          statusOrder: 1,
          assignedToId: null,
        },
        {
          description: "Preparar Arquivos para Plotagem",
          type: SERVICE_ORDER_TYPE.ARTWORK,
          status: SERVICE_ORDER_STATUS.PENDING,
          statusOrder: 1,
          assignedToId: null,
        },
        {
          description: "Checklist Entrada",
          type: SERVICE_ORDER_TYPE.LOGISTIC,
          status: SERVICE_ORDER_STATUS.PENDING,
          statusOrder: 1,
          assignedToId: null,
        },
        {
          description: "Checklist Saída",
          type: SERVICE_ORDER_TYPE.LOGISTIC,
          status: SERVICE_ORDER_STATUS.PENDING,
          statusOrder: 1,
          assignedToId: null,
        },
      ] as any[],

      // Budget fields
      expiresAt: getDefaultExpiresAt(),
      budgetStatus: "PENDING" as string,
      subtotal: 0,
      total: 0,
      guaranteeYears: null as number | null,
      customGuaranteeText: null as string | null,
      customForecastDays: null as number | null,
      simultaneousTasks: null as number | null,
      /**
       * Junto ou separado — só faz diferença quando o orçamento cobre mais de um
       * veículo, e é por isso que o seletor só aparece nesse caso.
       *
       * `JOINT` (padrão): uma fatura para os N veículos, um plano de parcelas,
       * uma NFS-e. `PER_TASK`: uma fatura por veículo, e o financeiro aprova
       * veículo a veículo — o que os sessenta implementos do Marquespan pedem, já
       * que não terminam no mesmo dia.
       */
      billingSplit: "JOINT" as "JOINT" | "PER_TASK" | "CUSTOM",
      /**
       * A partição dos veículos entre as faturas.
       *
       * Sempre VAZIA na criação: as tarefas nascem no save (produto placas ×
       * séries) e não há id para agrupar. O controle de faturamento sabe disso e
       * não oferece lotes aqui — quem cria um orçamento de sessenta implementos
       * agrupa depois, quando sabe quais entregou.
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
      // Managed by MultiAirbrushingSelector (rich runtime objects incl. File instances).
      airbrushings: [] as any[],
    },
  });

  // Unsaved changes guard — prevents losing wizard data on back/cancel/breadcrumb/refresh
  const { showDialog, confirmNavigation, cancelNavigation, guardedNavigate, allowNavigation } = useUnsavedChangesGuard({
    isDirty: form.formState.isDirty,
    isSubmitting,
  });

  // Auto-populate billing customer from task customer
  const watchedCustomerId = form.watch("customerId");
  const autoSetBillingRef = useRef<string | null>(null);

  useEffect(() => {
    if (!watchedCustomerId) return;
    const currentConfigs = form.getValues("customerConfigs") || [];
    // Only auto-set if no billing customers selected yet, or if we previously auto-set this
    const shouldAutoSet = currentConfigs.length === 0 ||
      (currentConfigs.length === 1 && autoSetBillingRef.current === currentConfigs[0]?.customerId);
    if (!shouldAutoSet) return;

    autoSetBillingRef.current = watchedCustomerId;

    // Fetch customer data if not cached
    const cached = customersCache.current.get(watchedCustomerId);
    const setConfig = (customerData: any) => {
      // Sem o cadastro (falhou a busca), o pagador não nasce: a cópia viria vazia
      // e o Salvar não teria contra o que comparar. O passo Faturamento pede.
      if (!customerData) return;
      form.setValue("customerConfigs", [newPayerConfig(customerData)], { shouldDirty: true });
      setSelectedCustomers(new Map([[watchedCustomerId, customerData]]));
    };

    if (cached) {
      setConfig(cached);
    } else {
      getCustomers({ where: { id: watchedCustomerId }, take: 1, include: { logo: true } })
        .then((response) => {
          const customer = response.data?.[0];
          if (customer) {
            customersCache.current.set(customer.id, customer);
            setConfig(customer);
          } else {
            setConfig(null);
          }
        })
        .catch(() => setConfig(null));
    }
  }, [watchedCustomerId, form, setSelectedCustomers]);

  // Build pseudo-task for review step (customer from cache)
  const reviewTaskCustomer = watchedCustomerId
    ? customersCache.current.get(watchedCustomerId)
    : null;
  const pseudoTask = useMemo(() => ({
    customer: reviewTaskCustomer ? {
      corporateName: reviewTaskCustomer.corporateName,
      fantasyName: reviewTaskCustomer.fantasyName,
    } : undefined,
  }), [reviewTaskCustomer]);

  // ═══════════════════════════════════════════════════════════════════════
  // OS CINCO PASSOS — Tarefa · Veículos · Serviços · Faturamento · Resumo
  // ═══════════════════════════════════════════════════════════════════════
  // A criação anda em linha: "Próximo" confere o passo, e o clique no marcador
  // confere todos os passos do caminho (ver `resolveStepJump`).
  const customerConfigs = form.watch("customerConfigs");
  const watchedPlates = form.watch("plates");
  const watchedSerials = form.watch("serialNumbers");
  const vehicleCount = vehicleCombinationCount(watchedPlates ?? [], (watchedSerials ?? []) as (string | number)[]);
  const steps = useMemo(
    () => budgetWizardSteps({ vehicleCount, payerCount: (customerConfigs ?? []).length }),
    [vehicleCount, customerConfigs],
  );
  const totalSteps = BUDGET_WIZARD_STEP.REVIEW;
  const wizardContext = useMemo(() => ({ measuresError }), [measuresError]);

  const nextStep = useCallback(() => {
    const check = checkBudgetStep(currentStep, form.getValues() as any, wizardContext);
    if (!check.ok) {
      toast.error(check.message);
      return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, totalSteps) as BudgetWizardStep);
  }, [currentStep, form, wizardContext, totalSteps]);

  const prevStep = useCallback(() => {
    setCurrentStep((prev) => Math.max(prev - 1, 1) as BudgetWizardStep);
  }, []);

  const handleStepClick = useCallback(
    (step: number) => {
      if (step === currentStep) return;
      const jump = resolveStepJump(currentStep, step, form.getValues() as any, wizardContext, "linear");
      if (jump.refusal) toast.error(jump.refusal);
      setCurrentStep(jump.step);
    },
    [currentStep, form, wizardContext],
  );

  // Handle form submission
  const handleSubmit = useCallback(async () => {
    // Re-entrancy guard. This handler awaits file uploads, then creates task + quote + nested
    // airbrushings per row — a second pass would create a duplicate set. The REF is what blocks;
    // React state updates are async, so the disabled button alone loses the race.
    if (isSubmittingRef.current) return;
    // Aerografia marcada "Já aprovada" exige aerografista — antes de gravar tarefa e orçamento.
    if (!guardAirbrushingCreation(form, ["airbrushings"])) return;
    // O Salvar confere os cinco passos e pára no primeiro com problema — o
    // clique no marcador "Resumo" já conferiu, mas o formulário pode ter mudado
    // depois (voltar e apagar a validade, tirar um pagador).
    const failing = firstFailingStep(form.getValues() as any, wizardContext);
    if (failing) {
      setCurrentStep(failing.step);
      toast.error(failing.message);
      return;
    }
    isSubmittingRef.current = true;

    const data = form.getValues();

    setIsSubmitting(true);
    try {
      // Persist inline role edits on already-registered contacts. These rows are
      // not part of the task payload (only `newResponsibles` is), so the change
      // has to be written onto the Responsible itself -- that is what makes it
      // appear on this task, on its quote, and on every other task sharing the
      // contact. Runs before the task save so a failure aborts cleanly.
      // Validate responsibles
      if (!validateResponsibleRows(responsibleRows)) {
        setShowResponsibleErrors(true);
        setCurrentStep(BUDGET_WIZARD_STEP.TASK);
        toast.error("Preencha o nome, telefone e ao menos uma função dos responsáveis.");
        setIsSubmitting(false);
        return;
      }

      // VALIDAR ANTES DE GRAVAR. `syncResponsibleRoles` escreve direto no
      // Responsible; rodá-lo antes da validação fazia a função de um contato ser
      // gravada e o resto do submit abortar logo em seguida — escrita parcial num
      // envio que o usuário viu como cancelado, e que ele não tem como desfazer.
      await syncResponsibleRoles(responsibleRows);

      // Validate services
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
      if (
        (data.customerConfigs || []).length >= 2 &&
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

      // A ARTE NÃO NASCE AQUI: ela é do IMPLEMENTO (Modelo C) e entra depois de o
      // orçamento existir, pelo painel da arte, com estado e decisão próprios.

      // Every upload below runs INSIDE the submit, so each second one hangs is a
      // second the button sits at "Salvando..." saying nothing. One stalled
      // upload used to hold it there for minutes (the client default is 3), and
      // the user reloaded to escape — losing the whole form. Narrate the
      // progress and cap each file, so a dead connection surfaces as a message
      // instead of a frozen button.
      const pendingUploads =
        baseFiles.filter((f) => !f.uploaded && !f.error).length +
        [...modifiedMeasureSides].filter((side) => measureLayouts[side]?.photoFile instanceof File).length;
      let uploadIndex = 0;
      const narrateUpload = (name: string) => {
        uploadIndex += 1;
        if (pendingUploads > 0) {
          toast.loading("Salvando orçamento", {
            id: UPLOAD_PROGRESS_TOAST_ID,
            description: `Enviando arquivo ${uploadIndex} de ${pendingUploads}: ${name}`,
          });
        }
      };

      // 1. Upload base files
      const uploadedBaseFileIds: string[] = [...baseFileIds];
      for (const file of baseFiles) {
        if (!file.uploaded && !file.error) {
          try {
            narrateUpload(file.name);
            const response = await uploadSingleFile(file, {
              fileContext: 'taskBaseFiles',
              timeout: UPLOAD_TIMEOUT_MS,
            });
            if (response.success && response.data) {
              uploadedBaseFileIds.push(response.data.id);
            }
          } catch (error: any) {
            toast.error(`Erro ao enviar arquivo base ${file.name}: ${describeUploadError(error)}`);
          }
        }
      }

      // 2. As fotos das faces das medidas (a da traseira, em geral). Sobem UMA vez
      // e o id vai na medida de cada veículo do lote.
      const uploadedMeasurePhotoIds: Partial<Record<ImplementFace, string>> = {};
      for (const side of modifiedMeasureSides) {
        const photoFile = measureLayouts[side]?.photoFile;
        if (!(photoFile instanceof File)) continue;
        try {
          narrateUpload(photoFile.name);
          const response = await uploadSingleFile(photoFile, {
            fileContext: "implementMeasurePhotos",
            timeout: UPLOAD_TIMEOUT_MS,
          });
          if (response.success && response.data) uploadedMeasurePhotoIds[side] = response.data.id;
        } catch (error: any) {
          toast.error(`Erro ao enviar a foto da face ${FACE_LABEL[side]}: ${describeUploadError(error)}`);
        }
      }
      const measureData: Record<string, unknown> = {};
      for (const side of modifiedMeasureSides) {
        const layout = measureLayouts[side];
        if (layout?.sections?.length) {
          measureData[FACE_MEASURE_FIELD[side]] = measurePayloadOf(layout, uploadedMeasurePhotoIds[side]);
        }
      }
      const hasMeasures = Object.keys(measureData).length > 0;

      // 4. Build responsible data
      const existingRepIds = responsibleRows
        .filter(row => !row.isNew && row.id && row.id.trim() !== '')
        .map(row => row.id);
      const newResponsibles = responsibleRows
        .filter(row => row.isNew && row.name?.trim() && row.phone?.trim())
        .map(row => ({
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

      // 5. Build service orders
      const serviceOrdersRaw = data.serviceOrders || [];
      const serviceOrders = serviceOrdersRaw.filter(
        (so: any) => so && so.description && so.description.trim().length >= 3
      );

      if (
        data.paintId &&
        createdPaintIdsRef.current.has(data.paintId) &&
        !serviceOrders.some(
          (so: any) => (so.description || "").trim().toLowerCase() === "formular cor"
        )
      ) {
        serviceOrders.push({
          description: "Formular Cor",
          type: SERVICE_ORDER_TYPE.ARTWORK,
          status: SERVICE_ORDER_STATUS.PENDING,
          statusOrder: 1,
          assignedToId: null,
        });
      }

      // 6. Build implement data
      const { plates, category, implementType } = data;
      const hasImplementFields = (plates && plates.length > 0) || category || implementType || hasMeasures;
      // A série é SÓ do implemento (NOMENCLATURA.md §5): vai em `implement.serialNumber`,
      // nunca no topo do corpo (o schema da API é estrito e responde 400).
      const buildImplementData = (plate?: string, serialNumber?: string) => {
        // Sem nenhum campo, o implemento nasce VAZIO (objeto vazio), como nascia
        // quando o tipo tinha "Refrigerado" de padrão (antes do D-25): cada
        // tarefa tem exatamente um implemento (DD1); só o tipo não se inventa.
        return {
          implement:
            hasImplementFields || plate || serialNumber
              ? {
                  ...(serialNumber && { serialNumber }),
                  ...(plate && { plate }),
                  category: category || undefined,
                  type: implementType || undefined,
                  ...measureData,
                }
              : {},
        };
      };

      // 7. Build plate/serial number combinations
      //
      // A MESMA função que o passo de faturamento usou para montar a tabela de
      // pedidos de compra (`vehicleCombinations`). Duas cópias da regra
      // deslizariam no primeiro ajuste, e o sintoma — o pedido de um implemento
      // gravado noutro — só apareceria na nota fiscal.
      const combinations = vehicleCombinations(plates, data.serialNumbers);
      // O PEDIDO DE COMPRA vale para TODOS os veículos deste orçamento: o campo
      // do passo 1 é um só, e o caso comum é a compra num pedido único. Cada
      // tarefa se corrige depois, individualmente, na tela dela.
      const customerOrderNumber = (data.customerOrderNumber ?? "").trim();

      // ═══════════════════════════════════════════════════════════════════════
      // 8. OS PAYLOADS DAS TAREFAS — nenhuma é criada aqui
      // ═══════════════════════════════════════════════════════════════════════
      //
      // Antes este laço fazia uma requisição por combinação (com um aviso verde
      // na tela para cada uma) e o orçamento vinha numa última. Quando a última
      // falhava, as N tarefas já estavam gravadas: onze avisos de sucesso, um de
      // erro, e a saída oferecida — "abra uma delas e crie o orçamento por ela" —
      // criaria um orçamento de UM veículo, deixando os outros dez de fora.
      //
      // Agora o laço só MONTA; quem grava é `POST /tasks/batch-with-quote`, numa
      // transação só: ou as N tarefas e o orçamento nascem juntos, ou nada nasce.
      let successCount = 0;
      let firstCreatedTaskId: string | undefined;
      const createdTaskIds: string[] = [];
      const taskPayloads: any[] = [];

      for (let i = 0; i < combinations.length; i++) {
        const { plate, serialNumber } = combinations[i];
        const implementData = buildImplementData(plate, serialNumber);

        const taskData: any = {
          status: data.status,
          name: data.name || undefined,
          customerId: data.customerId || undefined,
          details: data.details || undefined,
          forecastDate: data.forecastDate || undefined,
          term: data.term || undefined,
          paintId: data.paintId || undefined,
          paintIds: data.paintIds && data.paintIds.length > 0 ? data.paintIds : undefined,
          baseFileIds: uploadedBaseFileIds.length > 0 ? uploadedBaseFileIds : undefined,
          responsibleIds: existingRepIds.length > 0 ? existingRepIds : undefined,
          serviceOrders: serviceOrders.length > 0 ? serviceOrders.map((so: any) => ({
            description: so.description,
            type: so.type,
            status: so.status || SERVICE_ORDER_STATUS.PENDING,
            statusOrder: so.statusOrder || 1,
            assignedToId: so.assignedToId || null,
            startedAt: so.status === SERVICE_ORDER_STATUS.IN_PROGRESS ? new Date() : null,
          })) : undefined,
          ...implementData,
        };

        if (customerOrderNumber) taskData.customerOrderNumber = customerOrderNumber;

        // Os responsáveis NOVOS viajam uma vez só. O servidor os cria uma vez
        // para o lote (deduplicados por nome + telefone) e liga o id em TODAS as
        // tarefas — antes isso era feito aqui, mandando-os na primeira
        // requisição e reaproveitando os ids nas seguintes, uma dança que só
        // existia porque as tarefas nasciam uma a uma.
        if (i === 0 && newResponsibles.length > 0) {
          taskData.newResponsibles = newResponsibles;
        }

        taskPayloads.push(taskData);
      }

      // ═══════════════════════════════════════════════════════════════════════
      // 9. AS TAREFAS E O ORÇAMENTO — UM COMMIT SÓ
      // ═══════════════════════════════════════════════════════════════════════
      //
      // Antes o orçamento era criado DENTRO do laço, um por tarefa. Duas placas e
      // dois números de série produziam quatro tarefas e QUATRO orçamentos, com
      // quatro números, quatro PDFs e quatro cerimônias de assinatura para o
      // mesmo trabalho. O Marquespan de 02/09 saiu assim: orçamentos 642 a 701,
      // sessenta números para sessenta implementos idênticos.
      //
      // Depois virou um só — mas em N+1 requisições, e a falha da última deixava
      // as N tarefas órfãs. Agora é uma requisição: `POST /tasks/batch-with-quote`
      // grava as tarefas e o orçamento na MESMA transação. Ou tudo, ou nada.
      //
      // O preço dos serviços é POR VEÍCULO e o documento imprime o "× N" e o
      // total geral; a API multiplica (ver `computeQuoteMoney`).
      const quoteData: any = {
        billingSplit: data.billingSplit ?? "JOINT",
        expiresAt: data.expiresAt,
        // Sem `status`: o servidor decide o nascimento (D-34) — sempre Pendente.
        subtotal: data.subtotal || 0,
        total: data.total || 0,
        guaranteeYears: data.guaranteeYears || null,
        customGuaranteeText: data.customGuaranteeText || null,
        customForecastDays: data.customForecastDays || null,
        simultaneousTasks: data.simultaneousTasks || null,
        customerConfigs: data.customerConfigs || [],
        services: validServices.map((item: any) => ({
          ...item,
          amount: item.amount ?? 0,
        })),
      };

      try {
        const created = await batchCreateTasksWithQuote({ tasks: taskPayloads, quote: quoteData });
        const createdTasks = created?.data?.tasks ?? [];
        for (const t of createdTasks) {
          createdTaskIds.push(t.id);
          if (!firstCreatedTaskId) firstCreatedTaskId = t.id;
        }
        successCount = createdTasks.length;

        // ═══════════════════════════════════════════════════════════════════
        // 10. O CADASTRO DO CLIENTE — DEPOIS, e só se o orçamento nasceu
        // ═══════════════════════════════════════════════════════════════════
        //
        // Os dados fiscais são do CLIENTE, não da tarefa: gravá-los dentro do
        // laço repetia a mesma escrita uma vez por implemento.
        //
        // E vêm DEPOIS da criação de propósito. Enquanto vinham antes, uma falha
        // na criação deixava o cadastro do cliente já alterado e a tela mostrava
        // "Cliente atualizado com sucesso" seguido do erro — dois avisos verdes
        // e um vermelho para uma operação em que nada do que o operador pediu
        // foi criado. O orçamento é atômico; o que o acompanha só faz sentido
        // depois que ele existe.
        // SÓ O QUE MUDOU, e no cliente CERTO: a cópia do cadastro é comparada
        // com o cadastro como foi carregado (`customerUpdatePatch`); nada mudou,
        // nada se grava. Ver `utils/budget-payers.ts`.
        for (const config of data.customerConfigs || []) {
          if (!config?.customerId || !config.customerData) continue;
          const record = customersCache.current.get(config.customerId);
          if (!record) continue;
          const patch = customerUpdatePatch(record, config.customerData);
          if (Object.keys(patch).length === 0) continue;
          try {
            await customerService.updateCustomer(config.customerId, patch as any);
          } catch {
            // Error toast is emitted by the axios error interceptor.
          }
        }

        // O LAYOUT — "uma imagem para todos": sobe no primeiro veículo e o lote
        // ATÔMICO da API (`{ budgetId, fileId }`) a aplica a todos, como
        // rascunho. Não bloqueia: o orçamento já existe; uma falha vira aviso e a
        // arte pode ser enviada depois, no passo Veículos.
        const budgetId = (created?.data?.quote as any)?.id as string | undefined;
        if (pendingArtFiles.length > 0 && createdTaskIds.length > 0) {
          try {
            let firstImplementId = (createdTasks[0] as any)?.implement?.id as string | undefined;
            if (!firstImplementId) {
              const first: any = await getTaskById(createdTaskIds[0], { include: { implement: true } } as any);
              firstImplementId = first?.data?.implement?.id;
            }
            if (firstImplementId) {
              await applyArtToImplements([firstImplementId], pendingArtFiles as File[], { budgetId });
            }
          } catch {
            toast.warning("Orçamento criado, mas o layout não foi anexado. Envie a arte pelo passo Veículos.");
          }
        }

        // As aerografias vêm DEPOIS e são não-bloqueantes: são entidades
        // próprias, com o seu ciclo de pagamento, e uma falha ali não pode
        // desfazer o orçamento (a tarefa e o contrato já existem).
        if ((data.airbrushings?.length ?? 0) > 0) {
          for (const taskId of createdTaskIds) {
            try {
              await createAirbrushingsForTask(taskId, data.airbrushings);
            } catch {
              toast.warning("Tarefa criada, mas houve um erro ao criar as aerografias.");
            }
          }
        }
      } catch (error: any) {
        // A mensagem da API já sai pelo interceptor do axios — e agora ela nomeia
        // a causa quando é traduzível. Nada foi gravado: não há tarefa órfã para
        // avisar, nem instrução de recuperação a dar.
        console.error("Error creating tasks + quote:", error);
      }

      if (successCount > 0) {
        queryClient.invalidateQueries({ queryKey: budgetKeys.all });
        allowNavigation();
        navigate(firstCreatedTaskId
          ? routes.production.preparation.details(firstCreatedTaskId)
          : routes.financial.budget.root
        );
      }
    } catch (error: any) {
      // Error toast is emitted by the axios error interceptor.
      console.error("Error in budget creation:", error);
    } finally {
      toast.dismiss(UPLOAD_PROGRESS_TOAST_ID);
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }, [
    form,
    guardAirbrushingCreation,
    wizardContext,
    responsibleRows,
    baseFiles,
    baseFileIds,
    modifiedMeasureSides,
    measureLayouts,
    pendingArtFiles,
    queryClient,
    navigate,
    allowNavigation,
  ]);

  const isLastStep = currentStep === totalSteps;

  // Permission check
  if (!canEdit) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-muted-foreground">
          Você não tem permissão para criar orçamentos.
        </p>
        <button
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          onClick={() => navigate(-1)}
        >
          <IconArrowLeft className="h-4 w-4" />
          Voltar
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <PageHeader
        variant="form"
        title="Cadastrar Orçamento"
        favoritePage={FAVORITE_PAGES.FINANCEIRO_ORCAMENTO_CADASTRAR}
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Financeiro", href: routes.financial.root },
          { label: "Orçamento", href: routes.financial.budget.root },
          { label: "Cadastrar" },
        ]}
        onBreadcrumbNavigate={(path) => guardedNavigate(path)}
        actions={[
          {
            key: "cancel",
            label: "Cancelar",
            onClick: () => guardedNavigate(routes.financial.budget.root),
            variant: "outline" as const,
          },
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
          isLastStep
            ? {
                key: "save",
                label: isSubmitting ? "Salvando..." : "Salvar",
                onClick: handleSubmit,
                variant: "default" as const,
                icon: isSubmitting ? IconLoader2 : IconCheck,
                disabled: isSubmitting,
                loading: isSubmitting,
              }
            : {
                key: "next",
                label: "Próximo",
                onClick: nextStep,
                variant: "default" as const,
                icon: IconArrowRight,
              },
        ]}
      />

      <FormSteps steps={steps} currentStep={currentStep} onStepClick={handleStepClick} disabled={isSubmitting} />

      <div className="flex-1 overflow-y-auto pb-6">
        <FormProvider {...form}>
          {/* Os passos ficam MONTADOS (escondidos por CSS): o estado local de cada
              um (useFieldArray, o CPF/CNPJ do pagador, a "Data específica") tem de
              sobreviver ao vai e volta. */}
          <div style={{ display: currentStep === BUDGET_WIZARD_STEP.TASK ? undefined : "none" }}>
            <BudgetWizardStepTask
              mode="create"
              disabled={isSubmitting}
              responsibleRows={responsibleRows}
              onResponsibleRowsChange={handleResponsibleRowsChange}
              showResponsibleErrors={showResponsibleErrors}
              baseFiles={baseFiles}
              onBaseFilesChange={handleBaseFilesChange}
              onPaintCreated={handlePaintCreated}
              pendingArtFiles={pendingArtFiles}
              onPendingArtFilesChange={setPendingArtFiles}
            />
          </div>

          <div style={{ display: currentStep === BUDGET_WIZARD_STEP.VEHICLES ? undefined : "none" }}>
            <BudgetWizardStepVehicles
              mode="create"
              disabled={isSubmitting}
              canEditMeasures={canEdit}
              measures={{
                layouts: measureLayouts,
                modifiedSides: modifiedMeasureSides,
                onSideChange: handleMeasureChange,
                error: measuresError,
              }}
            />
          </div>

          <div style={{ display: currentStep === BUDGET_WIZARD_STEP.SERVICES ? undefined : "none" }}>
            <BudgetStepServices
              task={null}
              disabled={isSubmitting}
              selectedCustomers={selectedCustomers}
              isCreateMode
            />
          </div>

          <div style={{ display: currentStep === BUDGET_WIZARD_STEP.BILLING ? undefined : "none" }}>
            <BudgetWizardStepBilling
              disabled={isSubmitting}
              customersCache={customersCache}
              setSelectedCustomers={setSelectedCustomers}
              vehicleCount={vehicleCount}
            />
          </div>

          {currentStep === BUDGET_WIZARD_STEP.REVIEW && (
            <>
              {/* A FAIXA DOS QUATRO EIXOS NÃO APARECE NA CRIAÇÃO. Valor, arte,
                  assinatura e cobrança são estados DO ORÇAMENTO, e ele ainda não
                  existe: uma faixa de "rascunho" mostraria quatro "pendente" que
                  não dizem nada. Ela aparece no detalhe, logo depois do Salvar. */}
              <p className="mb-4 rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                Ao salvar, o orçamento nasce <span className="font-medium text-foreground">Pendente</span>. O valor, a
                arte, a assinatura e a cobrança passam a ser acompanhados no detalhe dele.
              </p>
              <BudgetStepReview
                task={pseudoTask}
                disabled={isSubmitting}
                userRole={userRole}
                selectedCustomers={selectedCustomers}
                isCreateMode
              />
            </>
          )}
        </FormProvider>
      </div>

      <UnsavedChangesDialog open={showDialog} onConfirm={confirmNavigation} onCancel={cancelNavigation} />
    </div>
  );
};

export default FinancialBudgetCreatePage;
