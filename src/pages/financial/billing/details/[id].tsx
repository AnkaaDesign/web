import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useForm, FormProvider } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { useTaskDetail, useCurrentUser, useTaskMutations, taskKeys } from "@/hooks";
import { useTaskBillingInvoices } from "@/hooks/production/use-invoice";
import { BillingCoveredVehicles } from "@/components/financial/billing/steps/billing-covered-vehicles";
import { billingKeys, useBilling, useBillingByTask } from "@/hooks/financial/use-billing";
import { billingService } from "@/api-client/billing";
import { taskQuoteKeys } from "@/hooks/production/use-task-quote";
import { taskQuoteService } from "@/api-client/task-quote";
import { customerService } from "@/api-client/customer";
import { uploadSingleFile } from "@/api-client/file";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { FormSteps } from "@/components/ui/form-steps";
import { BillingStepInfo } from "@/components/financial/billing/steps/billing-step-info";
import { BillingStepServices } from "@/components/financial/billing/steps/billing-step-services";
import { BillingStepCustomer } from "@/components/financial/billing/steps/billing-step-customer";
import { BillingStepReview } from "@/components/financial/billing/steps/billing-step-review";
import { SignatureEnvelopeCard } from "@/components/financial/budget/signature-envelope-card";
import { BillingStepBudgetInfo } from "@/components/financial/billing/steps/billing-step-budget-info";
import { SECTOR_PRIVILEGES, IMPLEMENT_TYPE, routes } from "@/constants";
import type { FileWithPreview } from "@/components/common/file/file-uploader";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { canUpdateQuoteStatus, canEditQuote } from "@/utils/permissions/quote-permissions";
import {
  quoteTasks,
  quoteVehicleCount,
  coverageSummary,
  coveredTaskCount,
  coveredTaskIds,
  billingApprovedAtOf,
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
/**
 * DESEMBRULHA a resposta, seja qual for a camada que chegou.
 *
 * O cliente HTTP deste projeto às vezes entrega a `AxiosResponse` inteira e às
 * vezes só o corpo, e o corpo é um envelope `{ success, message, data }`. Um
 * `?.data` sozinho parava NO ENVELOPE — e um envelope é um objeto, então nada
 * estourava: o id vinha `undefined` e o redirecionamento nunca disparava.
 * O critério de "achei" é ter `id`, não ter vindo por um caminho específico.
 */
const unwrapBilling = (r: any): any | null =>
  [r?.data?.data, r?.data, r].find(
    (c) => c && typeof c === "object" && typeof c.id === "string",
  ) ?? null;

export const BillingDetailPage = () => {
  const { id: routeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // ═══════════════════════════════════════════════════════════════════════════
  // O ENDEREÇO DESTA TELA É O FATURAMENTO — e é resolvido ANTES de montar nada
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // Era o veículo, e não podia ser outra coisa: enquanto "faturamento" foi uma
  // lista pendurada no orçamento, não havia id que significasse a cobrança. Num
  // orçamento de quatro caminhões cobrados JUNTOS isso dava QUATRO endereços para
  // UMA cobrança — quatro URLs, quatro favoritos, o mesmo conteúdo.
  //
  // A rota aceita os dois ids e CONVERGE. O que obriga a resolução a acontecer
  // AQUI, no invólucro, e não lá dentro: o componente é remontado por `key`, e
  // um redirecionamento disparado depois de a tela ficar interativa remonta o
  // assistente no meio do uso — o operador (e o teste de tela) perde o passo em
  // que estava. Enquanto o endereço não é o canônico, nada é montado.
  // O VEÍCULO por onde se entrou (ou que se estava vendo), guardado no estado da
  // navegação. É ele que dá o caminho de volta quando o faturamento da URL some.
  const stateTaskId = (location.state as any)?.openTaskId as string | undefined;

  const byId = useBilling(routeId);
  // ── QUANDO A URL NÃO RESOLVE, DUAS COISAS PODEM TER ACONTECIDO ─────────────
  //
  //  1. A URL é de um VEÍCULO — todo link que existe hoje (notificação, app,
  //     favorito, e-mail, a lista) endereça assim. Traduz e converge.
  //  2. O FATURAMENTO DEIXOU DE EXISTIR. Não é erro: é o modelo. Trocar "uma
  //     fatura para os quatro" por "uma por veículo" DESTRÓI a cobrança aberta e
  //     cria quatro — entidade que morre, não campo que muda de valor. No
  //     instante em que o operador salva, a URL em que ele está fica órfã.
  //
  // Nos dois casos a pergunta é a mesma: qual cobrança cobre ESTE veículo? No (1)
  // o veículo é o próprio id da rota; no (2) é o que estava aberto. Tentar os
  // dois, nessa ordem, resolve os dois sem a tela precisar saber qual era.
  const byTask = useBillingByTask(routeId, { enabled: byId.isError });
  const bySucessor = useBillingByTask(stateTaskId, {
    enabled: byId.isError && byTask.isError && !!stateTaskId && stateTaskId !== routeId,
  });
  const billing =
    unwrapBilling(byId.data) ?? unwrapBilling(byTask.data) ?? unwrapBilling(bySucessor.data);
  const billingId: string | null = billing?.id ?? null;
  const arrivedByTask = !!billingId && billingId !== routeId;

  useEffect(() => {
    if (!arrivedByTask || !billingId) return;
    navigate(routes.financial.billing.details(billingId), {
      replace: true,
      state: { ...((location.state as any) ?? {}), openTaskId: routeId },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrivedByTask, billingId]);

  const resolvendo =
    arrivedByTask ||
    (!billingId &&
      (byId.isLoading ||
        byTask.isLoading ||
        byTask.isFetching ||
        bySucessor.isLoading ||
        bySucessor.isFetching));

  // Esgotadas as três tentativas, a cobrança não existe mesmo — e aí a tela diz
  // isso, em vez de ficar girando.
  const naoExiste = !billingId && byId.isError && byTask.isError && !bySucessor.isFetching;

  if (resolvendo) {
    return (
      <div className="h-full flex items-center justify-center">
        <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (naoExiste) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <IconFileInvoice className="h-12 w-12" />
        <p>Esta cobrança não existe mais.</p>
        <Button variant="outline" onClick={() => navigate(routes.financial.billing.root)}>
          Ir para a lista de faturamento
        </Button>
      </div>
    );
  }

  return (
    <BillingDetailPageInner
      key={billingId ?? routeId ?? "novo"}
      billing={billing}
      routeId={routeId}
    />
  );
};

const BillingDetailPageInner = ({
  billing: resolvedBilling,
  routeId,
}: {
  /** A COBRANÇA desta página, já resolvida pelo invólucro. */
  billing: any | null;
  /** O id que veio na URL — só para o recuo quando a cobrança não tem veículo. */
  routeId?: string;
}) => {
  const navigate = useNavigate();
  const location = useLocation();

  const resolvedBillingId: string | null = resolvedBilling?.id ?? null;

  /**
   * O VEÍCULO ABERTO — o pedido (quando se chegou por um), senão a âncora da
   * cobertura.
   *
   * Qual caminhão está aberto é uma PREFERÊNCIA DE VISTA dentro da cobrança, não
   * a identidade da coisa que se está vendo: por isso viaja em
   * `location.state.openTaskId` e não na URL.
   */
  const openTaskId = useMemo<string | undefined>(() => {
    const fromState = (location.state as any)?.openTaskId as string | undefined;
    if (fromState) return fromState;
    const covered = (resolvedBilling?.tasks ?? []) as Array<{ taskId: string }>;
    if (covered[0]?.taskId) return covered[0].taskId;
    // COBRANÇA SEM VEÍCULO — o orçamento que ainda não tem tarefa vinculada.
    // Recuar para o id da rota mandaria o id do FATURAMENTO para a consulta de
    // TAREFA, que responderia 404 e a tela mostraria "tarefa não encontrada"
    // sobre uma cobrança que existe. O primeiro veículo do orçamento é a resposta
    // honesta: a tela abre, e a grade mostra que esta cobrança não cobre nenhum.
    const doOrcamento = (resolvedBilling?.quote?.tasks ?? []) as Array<{ id: string }>;
    return doOrcamento[0]?.id ?? routeId;
  }, [location.state, resolvedBilling, routeId]);

  /** O id que as consultas de TAREFA usam. Nunca o da rota — a rota é do faturamento. */
  const id = openTaskId;

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
  // ⚠️ SAIU `approvingVehicleSlice`. Ele existia para a confirmação e o `executeSave` saberem se o
  // clique era "aprovar o orçamento inteiro" ou "aprovar esta fatia" — duas rotas diferentes que
  // a tela precisava distinguir porque uma delas era uma transição de status. Hoje há um ato só.
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
          // OS FATURAMENTOS — as entidades, não a lista de pagadores.
          //
          // Esta tela é aberta por um VEÍCULO e precisa saber de qual cobrança ele
          // é. Antes isso era deduzido casando índices de `customerConfigs` com a
          // cobertura; agora a resposta está no modelo: o `Billing` que tem este
          // veículo em `tasks`. Os configs dele são os pagadores desta página, e
          // os outros `Billing` do orçamento são as outras páginas.
          //
          // `select` e não `include`: `approvedAt` é ESCALAR, e o Prisma recusa
          // escalar dentro de `include` ("Invalid scalar field `approvedAt` for
          // include statement on model Billing"). Com `include` o servidor
          // devolvia 500 em TODA abertura desta tela.
          billings: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              approvedAt: true,
              // O ESTADO PRÓPRIO da cobrança — é o que o cabeçalho do Resumo mostra e o que
              // decide quais ações o seletor oferece. Derivado no servidor; ninguém o digita.
              status: true,
              statusOrder: true,
              createdAt: true,
              tasks: { select: { taskId: true } },
              customerConfigs: { select: { id: true, customerId: true } },
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
      const covered = coveredTaskCount(c as any);
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
    () => ((quote as any)?.billings ?? []).filter((b: any) => b?.approvedAt).length,
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
      //
      // `status` é o do ORÇAMENTO e esta tela NÃO o altera — ele é lido para o Resumo mostrar de
      // que contrato é esta cobrança, e reenviado na gravação só para suprimir o auto-revert a
      // PENDING do servidor. Rejeitar/reverter o orçamento é no assistente de Orçamento.
      status: "" as string,
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
    const configs = ((formConfigsForPreview ?? []) as any[]).filter(
      (c) => !billingApprovedAtOf(c as any),
    );
    if (!isPerVehicleBilling || !task?.id) return configs;
    const covering = configs.filter((c) => {
      const ids: string[] =
        (Array.isArray(c?.taskIds) && c.taskIds.length > 0
          ? c.taskIds
          : coveredTaskIds(c as any)) ?? [];
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
            : coveredTaskCount(c as any)) || quoteVehicles || 1;
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
        taskIds: coveredTaskIds(config as any),
        billingId: (config as any).billingId ?? (config as any).billing?.id ?? null,
        billing: (config as any).billing ?? null,
        // Quando ESTA fatura foi aprovada. Fatura aprovada tem a cobertura
        // congelada e não se refatia — a tela precisa saber para não oferecer.
        billingApprovedAt: billingApprovedAtOf(config as any),
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

  // ═══════════════════════════════════════════════════════════════════════════
  // ESTA PÁGINA É DE UMA COBRANÇA, NÃO DE TODAS
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // A rota é `/financeiro/faturamento/detalhes/:taskId` — um VEÍCULO. Mas a tela
  // montava um passo para CADA fatia do orçamento: num orçamento de quatro
  // caminhões cobrados um a um, o operador abria o caminhão 46990 e via
  // "Fatura 1 · Fatura 2 · Fatura 3 · Fatura 4" na mesma página, com o passo
  // "Tarefa" editando um veículo só. Quatro cobranças separadas, uma página,
  // um veículo editável: as três coisas em desacordo.
  //
  // Agora a página mostra a(s) cobrança(s) que cobrem O VEÍCULO ABERTO. Com dois
  // clientes de faturamento o mesmo veículo é cobrado duas vezes, e as duas
  // aparecem — são as duas cobranças DELE. As demais continuam MONTADAS (o
  // formulário as reenvia inteiras na gravação, e escondê-las do DOM as tiraria
  // do payload e a reconciliação as apagaria); o que muda é que elas não ganham
  // passo próprio aqui. Cada uma tem a sua página, e o navegador abaixo leva até ela.
  //
  // Recuo deliberado: fatia sem cobertura gravada (acervo anterior à migração de
  // cobertura) não casa com veículo nenhum — nesse caso mostramos todas, como antes.
  /** Os faturamentos do orçamento, como o servidor os entrega. */
  const billings = useMemo<any[]>(() => ((quote as any)?.billings ?? []) as any[], [quote]);

  /** O FATURAMENTO desta página: o que cobre o veículo aberto. */
  const currentBilling = useMemo<any | null>(() => {
    // O RESOLVIDO PELA ROTA manda. A rota endereça o faturamento, então ele é a
    // resposta autoritativa — inclusive para uma cobrança SEM cobertura (o
    // orçamento que ainda não tem veículo), que a busca por tarefa não acharia.
    if (resolvedBillingId) {
      return billings.find((b: any) => b.id === resolvedBillingId) ?? resolvedBilling;
    }
    if (!task?.id) return null;
    return (
      billings.find((b: any) =>
        (b?.tasks ?? []).some((t: any) => t.taskId === task.id),
      ) ?? null
    );
  }, [billings, task?.id, resolvedBillingId, resolvedBilling]);

  /**
   * OS VEÍCULOS QUE ESTA COBRANÇA COBRE — não os do orçamento.
   *
   * É o recorte do DOCUMENTO: placa, chassi e pedido destes saem na mesma nota
   * fiscal. Sem cobertura gravada recai nos do orçamento, que é a leitura que a
   * ausência sempre teve.
   */
  const coveredVehicleRows = useMemo(() => {
    const ids = new Set(
      ((currentBilling?.tasks ?? []) as Array<{ taskId: string }>).map((t) => t.taskId),
    );
    if (ids.size === 0) return quoteVehicleRows as any[];
    return (quoteVehicleRows as any[]).filter((v: any) => ids.has(v.id));
  }, [currentBilling, quoteVehicleRows]);

  const visibleConfigIdx = useMemo<number[]>(() => {
    const todos = customerConfigs.map((_: any, i: number) => i);
    if (customerConfigs.length <= 1) return todos;

    // CAMINHO NOVO: os pagadores DESTE faturamento, lidos da entidade.
    if (currentBilling) {
      const doBilling = new Set(
        ((currentBilling.customerConfigs ?? []) as any[]).map((c: any) => c.id),
      );
      const idx = customerConfigs
        .map((c: any, i: number) => ({ c, i }))
        .filter(({ c }: any) => c?.id && doBilling.has(c.id))
        .map(({ i }: any) => i);
      if (idx.length > 0) return idx;
    }

    // RECUO: orçamento aberto antes de a entidade existir, ou fatia ainda não
    // gravada (sem `id`). Cai no casamento por cobertura, que é o que a tela
    // fazia antes — errado como modelo, certo como resposta.
    if (!task?.id) return todos;
    const covering = customerConfigs
      .map((c: any, i: number) => ({ c, i }))
      .filter(({ c }: any) => Array.isArray(c?.taskIds) && c.taskIds.includes(task.id))
      .map(({ i }: any) => i);
    return covering.length > 0 ? covering : todos;
  }, [customerConfigs, task?.id, currentBilling]);

  // ── AS COBRANÇAS IRMÃS NÃO APARECEM AQUI ────────────────────────────────
  //
  // Havia um aviso no topo — "o orçamento tem N faturamentos; os outros têm
  // páginas próprias" — com um botão para cada. Saiu: esta página é de UMA
  // cobrança, e ficar explicando as outras é a tela ainda falando pelo
  // orçamento. As irmãs se alcançam pela lista de Faturamento e pelo navegador
  // de registros do cabeçalho, como qualquer outro registro do sistema.

  // Skip to summary step when invoices already exist
  const hasInitializedStep = useRef(false);
  // No per-record reset needed here: the page is keyed by `:id` (see BillingDetailPage), so a
  // prev/next hop remounts and this ref starts false again.
  const steps = useMemo(() => {
    // ═══════════════════════════════════════════════════════════════════════
    // NÃO HÁ PASSO "TAREFA" AQUI — e é o ponto inteiro desta separação.
    // ═══════════════════════════════════════════════════════════════════════
    //
    // Havia, e era um editor de TAREFA morando na tela de cobrança: nome,
    // categoria, implemento, série, placa, chassi, pedido, plaqueta, data de
    // conclusão, detalhes. Um caminhão só — o aberto —, enquanto a fatura cobra
    // N. Depois que a grade "Veículos desta cobrança" passou a existir, o mesmo
    // veículo tinha placa, chassi e número de pedido em DOIS lugares na MESMA
    // tela, com o de cima escrevendo por cima do de baixo ao salvar.
    //
    // O que a nota fiscal precisa — placa, chassi, pedido — está na grade, no
    // recorte certo: os veículos DESTA cobrança. O resto é produção, e mora lá.
    //
    // Sobrou: Veículos, Fatura/Cliente 1..N, e Resumo.
    //
    // "Veículos" NÃO é o passo antigo com outro nome: ali não há nada da tarefa.
    // É a grade dos caminhões que ESTA cobrança cobre, com os três campos que a
    // nota fiscal exige — placa, chassi e número do pedido —, um por linha, no
    // recorte do documento.
    const base: Array<{ id: number; name: string; description: string }> = [
      {
        id: 1,
        name: "Veículos",
        description:
          coveredVehicleRows.length === 1
            ? "O veículo desta cobrança"
            : `Os ${coveredVehicleRows.length} veículos desta cobrança`,
      },
    ];
    // ═══════════════════════════════════════════════════════════════════════
    // "PROPOSTA" E "SERVIÇOS" NÃO SÃO DESTA TELA
    // ═══════════════════════════════════════════════════════════════════════
    //
    // Validade, garantia, prazo, layout, lista de serviços e preço são o que foi
    // VENDIDO — vivem no Orçamento, são o que o cliente assinou, e mudá-los
    // depois de faturado é recusado de qualquer jeito. Tê-los aqui fazia a tela
    // de cobrança parecer uma segunda tela de orçamento, com dois caminhos de
    // escrita para o mesmo dado e nenhum aviso de qual vencia.
    //
    // Os dois componentes seguem MONTADOS e escondidos logo abaixo: o
    // formulário é um só, o payload da gravação sai dele, e `BillingStepServices`
    // ainda é quem recalcula `customerConfigs[].total` quando a cobertura muda.
    // O que sai é a NAVEGAÇÃO — ninguém mais chega neles por aqui. Para mexer no
    // que foi vendido há o botão "Ver Orçamento" no cabeçalho.
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
    visibleConfigIdx.forEach((i: number) => {
      const config: any = customerConfigs[i];
      if (!config) return;
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
  }, [customerConfigs, visibleConfigIdx, canSeeBudgetInfoStep, quoteVehicles, quoteVehicleRows, coveredVehicleRows]);

  const totalSteps = steps.length;

  // ═══════════════════════════════════════════════════════════════════════════
  // JÁ FATURADO → ABRE NO RESUMO. E o Resumo é `steps.length`, nada além disso.
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // Este salto era calculado por uma SOMA que reconstruía a lista de passos de
  // cabeça: `2 + N + (proposta ? 1 : 0) + 1`. A soma envelheceu quando "Proposta"
  // e "Serviços" saíram da navegação — passou a apontar DOIS passos além do
  // último, e o corpo da tela, que só renderiza o passo corrente, ficava
  // COMPLETAMENTE EM BRANCO. O cabeçalho e a trilha continuavam lá, então a tela
  // parecia carregada: era o Resumo vazio, com o seletor de status junto.
  //
  // Só aparecia DEPOIS de haver fatura — que é exatamente quando a tela importa.
  //
  // Agora não há soma: quem sabe quantos passos existem é `steps`, que é quem os
  // monta. Uma fonte, uma resposta.
  //
  // Roda aqui e não junto das outras inicializações porque depende de `steps`.
  useEffect(() => {
    if (hasInitializedStep.current) return;
    if (invoices.length > 0 && customerConfigs.length > 0) {
      setCurrentStep(totalSteps);
      hasInitializedStep.current = true;
    }
  }, [invoices, customerConfigs, totalSteps]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── CINTO DE SEGURANÇA: passo fora da faixa NUNCA vira tela em branco ──────
  //
  // O corpo desta tela renderiza só o passo corrente. Um `currentStep` maior que
  // o número de passos — por aritmética errada, por uma cobrança que encolheu
  // depois de uma recomposição, por um estado guardado de outra página — não
  // mostra um erro: mostra NADA, com o cabeçalho e a trilha de passos intactos
  // por cima. É a falha mais cara possível, porque parece uma tela carregada.
  //
  // Aconteceu duas vezes por caminhos diferentes. Uma correção que conserte só a
  // conta deixa a terceira em aberto; esta impede a classe inteira.
  useEffect(() => {
    // ⚠️ SÓ DEPOIS DE HIDRATAR. `customerConfigs` é um `form.watch`: na primeira
    // renderização ele é uma lista VAZIA, e aí `steps` tem só Tarefa e Resumo.
    // Clampar nesse instante prendia quem estava no Resumo um passo atrás — e
    // como o clamp escreve o estado, a lista crescer depois já não o soltava.
    // O cinto virou tropeço, e o teste de tela (fase 5 C1) pegou na primeira
    // corrida. Enquanto a tela carrega, não há faixa a respeitar.
    if (isTaskLoading || customerConfigs.length === 0) return;
    if (totalSteps > 0 && currentStep > totalSteps) setCurrentStep(totalSteps);
    if (currentStep < 1) setCurrentStep(1);
  }, [currentStep, totalSteps, isTaskLoading, customerConfigs.length]);

  // A tela é: 1..N=Fatura(s) DESTA cobrança, N+1=Resumo. Não há passo de Tarefa,
  // nem de Proposta, nem de Serviços — os três editam o que foi VENDIDO ou o que
  // foi PRODUZIDO, e nenhum dos dois é assunto desta tela.
  //
  // `proposalStepIdx`/`servicesStepIdx` ficam nulos: os componentes seguem
  // montados e escondidos (o formulário é um só e o payload da gravação sai
  // dele; `BillingStepServices` ainda recalcula o total da fatia quando a
  // cobertura muda), mas não têm posição na navegação.
  const proposalStepIdx: number | null = null;
  const servicesStepIdx: number | null = null;
  const firstCustomerStepIdx = 2;

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
    // ⚠️ A REGRA DO PEDIDO DE COMPRA NÃO APONTA MAIS PARA O PASSO DO CLIENTE.
    //
    // A condição era `!c?.orderNumber` numa FATIA, e `orderNumber` deixou de ser
    // campo da fatia em `20260909170000` — o número do pedido é do VEÍCULO
    // (`Task.customerOrderNumber`). `undefined` é sempre falsy, então a condição
    // era sempre verdadeira: a regra levava ao passo do cliente, onde o campo não
    // existe mais. Quem seguia a linha piscando chegava a um passo sem nada aceso
    // — e sair da tela dá quatro horas de silêncio à regra.
    //
    // O passo 1 é onde o campo mora (a grade de veículos no faturamento, o passo
    // Tarefa no orçamento), e é para lá que a regra manda agora. O passo do
    // cliente continua sendo o destino da regra de CADASTRO do tomador, que é de
    // fato da fatia.
    if (orderNumberAttentionActive) {
      setCurrentStep(1);
      return;
    }
    const idx = customerConfigs.findIndex((c: any) => {
      if (c?.generateInvoice === false) return false; // no nota, so neither rule applies to it
      return customerDataAttentionActive && !hasCompleteBillingCustomerData(c?.customerData);
    });
    if (idx < 0) return;
    // O passo é a posição entre as cobranças VISÍVEIS, não entre todas as do
    // orçamento: esta página mostra as do veículo aberto. Apontar pelo índice
    // global mandava para um passo que não existe — e o corpo da tela, que só
    // renderiza o passo corrente, ficava em branco.
    const pos = visibleConfigIdx.indexOf(idx);
    if (pos < 0) return;
    setCurrentStep(firstCustomerStepIdx + pos);
  }, [orderNumberAttentionActive, customerDataAttentionActive, invoices.length, customerConfigs, firstCustomerStepIdx]);

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

  /**
   * O que a APROVAÇÃO DA COBRANÇA exige: serviços com valor válido, atribuição de cliente quando
   * há mais de um pagador, e cadastro completo de quem vai receber nota.
   *
   * Chamada só no caminho de aprovar — era disparada por `status === "BILLING_APPROVED"`, um
   * estado do orçamento que deixou de existir. O ato é o mesmo; o gatilho agora é o ato em si.
   */
  const validateCustomerData = useCallback((): boolean => {
    const configs = form.getValues("customerConfigs") || [];
    const services = form.getValues("services") || [];
    const validServices = services.filter((s: any) => s.description?.trim());

    const negativeAmountServices = validServices.filter((s: any) => Number(s.amount) < 0);
    if (negativeAmountServices.length > 0) {
      if (servicesStepIdx !== null) setCurrentStep(servicesStepIdx);
      toast.error("Serviços com valor negativo", {
        description: `${negativeAmountServices.length} serviço(s) com valor negativo. Serviços não podem ter valor negativo para faturamento.`,
      });
      return false;
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
        if (servicesStepIdx !== null) setCurrentStep(servicesStepIdx);
        toast.error("Serviços sem cliente atribuído", {
          description: "Todos os serviços devem ter um cliente selecionado em 'Faturar Para'",
        });
        return false;
      }
    }

    // ⚠️ SÓ OS PAGADORES DESTA COBRANÇA.
    //
    // Varria `configs` inteiro, que é a lista do ORÇAMENTO: num orçamento com quatro cobranças,
    // aprovar a primeira era recusado porque o cliente da QUARTA estava sem CNPJ — e o toast
    // mandava o operador para um passo que esta página nem renderiza (os passos são construídos a
    // partir de `visibleConfigIdx`, então `firstCustomerStepIdx + i` com `i` GLOBAL aponta para
    // fora). Aprovar uma cobrança não pode depender das outras; é a mesma regra que fez a rota
    // deixar de ser do orçamento.
    const scoped =
      visibleConfigIdx.length > 0 ? visibleConfigIdx : configs.map((_: any, i: number) => i);

    for (let pos = 0; pos < scoped.length; pos++) {
      const i = scoped[pos];
      const config = configs[i];
      if (!config) continue;
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
        // A POSIÇÃO entre os passos VISÍVEIS, não o índice global — ver o comentário acima.
        setCurrentStep(firstCustomerStepIdx + pos);
        const name = data.fantasyName || data.corporateName || `Cliente ${i + 1}`;
        // Com mais de uma fatura o nome do cliente se repete, e a mensagem
        // mandava o operador para "um passo do mesmo cliente" sem dizer qual.
        // O veículo desempata.
        const where =
          scoped.length > 1 && coveredTaskCount(config) > 0
            ? `${name} (${coverageSummary(config, quoteVehicles, quoteVehicleRows as any)})`
            : name;
        toast.error(`${where} - campos obrigatórios`, { description: errors.join(", ") });
        return false;
      }
    }

    return true;
  }, [form, servicesStepIdx, firstCustomerStepIdx, quoteVehicles, quoteVehicleRows, visibleConfigIdx]);

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


  // Core save logic
  const executeSave = useCallback(async (options?: { approveBilling?: boolean }) => {
    if (!quote?.id || !task?.id) return;

    const formData = form.getValues();
    /**
     * ESTA GRAVAÇÃO APROVA A COBRANÇA?
     *
     * UMA porta só. Eram duas — a transição de status `BUDGET_APPROVED →
     * BILLING_APPROVED` (que aprovava o orçamento inteiro) e uma ação sintética
     * do seletor para as fatias 2..N, que existia porque depois da primeira
     * aprovação o status já tinha andado e não servia mais de gatilho. Com a
     * cobrança sendo uma entidade, aprovar é sempre o mesmo ato sobre a mesma
     * coisa: `PUT /billings/:id/approve`.
     */
    const approveBilling = !!options?.approveBilling && !!currentBilling?.id;

    setIsSaving(true);
    try {
      // 1. A TAREFA NÃO É GRAVADA DAQUI — e não é omissão, é o limite da tela.
      //
      // Havia um `PUT /tasks/:id` com nome, cliente, série, placa, chassi,
      // categoria, implemento, plaqueta e detalhes, montado a partir do
      // formulário do passo "Tarefa". O passo saiu: nada disso é assunto de
      // cobrança. Manter a gravação seria pior que inútil — ela reenviaria os
      // valores CARREGADOS e passaria por cima do que a grade "Veículos desta
      // cobrança" acabou de escrever, campo a campo, em cada caminhão.
      //
      // O que a nota precisa (placa, chassi, número do pedido) a grade grava, uma
      // linha por vez, no veículo certo. O resto é produção, e se edita em
      // Produção.

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
      // TRAVADO POR DINHEIRO? — a pergunta é da COBRANÇA, não do status do orçamento.
      //
      // Era uma lista de estados (`BILLING_APPROVED`..`SETTLED`), o que num orçamento faturado
      // veículo a veículo travava os cinquenta e nove que ainda nem tinham sido cobrados assim que
      // o primeiro saía. Espelha `isQuoteMoneyLocked(billings)` no servidor: trava = ALGUMA
      // cobrança com `approvedAt` — a fatura, os boletos e a nota saíram sobre o preço atual, e o
      // servidor recusa o corpo inteiro se ele trouxer campo estrutural.
      const isQuoteLocked = approvedBillingCount > 0;

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

      // O STATUS DO ORÇAMENTO NÃO SE EDITA DESTA TELA — ela é a da cobrança.
      //
      // O que continua sendo necessário é FIXAR o status atual no corpo: o auto-revert do servidor
      // devolve o orçamento a PENDING quando uma gravação mexe em valores e NÃO manda status, e
      // editar a cobrança não pode desfazer a aprovação comercial. Num orçamento travado o corpo
      // reduzido não leva status nenhum (nada ali auto-reverte).
      //
      // ⚠️ Saiu daqui a segunda fase, que replicava hop a hop um caminho de transição até
      // `BILLING_APPROVED` (com uma guarda para nunca ATRAVESSAR aquele estado, porque atravessá-lo
      // emitia nota). Aprovar cobrança é uma chamada, a `PUT /billings/:id/approve`, logo abaixo.
      if (!isQuoteLocked) {
        quotePayload.status = quote.status;
      }

      await taskQuoteService.update(quote.id, quotePayload);

      // ═══════════════════════════════════════════════════════════════════════
      // O PEDIDO DE COMPRA NÃO PASSA MAIS POR AQUI
      // ═══════════════════════════════════════════════════════════════════════
      //
      // Era gravado neste ponto, do formulário, e só para o caminhão ABERTO —
      // numa fatura que cobra quatro. A grade "Veículos desta cobrança" grava o
      // de CADA UM, ao sair do campo, direto na tarefa daquele veículo. Manter as
      // duas escritas era garantir que a de baixo perdesse para a de cima.
      //
      // O motivo de a gravação ser por fora do orçamento continua valendo e mora
      // na grade: aqui o orçamento costuma estar TRAVADO (`BILLING_APPROVED` em
      // diante) e a guarda de obrigação financeira recusaria o corpo inteiro —
      // mas o número do pedido é justamente o que chega depois, quando o cliente
      // o manda e a nota já está para sair.

      if (approveBilling) {
        // APROVAR ESTA COBRANÇA — e nenhuma outra. `PUT /billings/:id/approve` emite a fatura, a
        // NFS-e e os boletos DELA. Endereçar por id é a diferença que faz: os sessenta caminhões
        // do Marquespan não terminam no mesmo dia, e cada aprovação conta o vencimento a partir
        // dela; o orçamento só grava `billingApprovedAt` quando a última fecha.
        await billingService.approve(currentBilling.id);
      }

      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      queryClient.invalidateQueries({ queryKey: taskQuoteKeys.all });
      queryClient.invalidateQueries({ queryKey: billingKeys.all });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["dashboards"] });

      if (approveBilling) {
        setIsGenerating(true);
        toast.success(
          isPerVehicleBilling
            ? "Faturamento desta cobrança aprovado! Gerando fatura, boleto e NFS-e..."
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
    isPerVehicleBilling,
    // A COBRANÇA aberta: sem ela na lista, um `executeSave` memorizado aprovaria a cobrança
    // ANTERIOR depois de o operador trocar de página pelo paginador de irmãs.
    currentBilling?.id,
    approvedBillingCount,
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

    const configs = formData.customerConfigs || [];
    const services = formData.services || [];
    if (configs.length === 0) {
      setCurrentStep(1);
      toast.error("Selecione pelo menos um cliente para faturamento");
      return;
    }
    const validServices = services.filter((s: any) => s.description?.trim());
    if (validServices.length === 0) {
      if (servicesStepIdx !== null) setCurrentStep(servicesStepIdx);
      toast.error("Adicione pelo menos um serviço");
      return;
    }

    // Gravar é só gravar: o cadastro completo é exigência de APROVAR, e a aprovação tem o seu
    // próprio caminho (o seletor do Resumo → `handleApproveBilling`). Exigi-lo aqui impedia salvar
    // um rascunho de cobrança enquanto se espera o CNPJ do cliente.
    await executeSave();
  }, [quote?.id, task?.id, form, executeSave, servicesStepIdx]);

  /**
   * APROVAR ESTA COBRANÇA — a porta única, vinda do seletor do Resumo.
   *
   * Roda as guardas (cadastro do tomador, serviços atribuídos) e abre a confirmação irreversível;
   * quem chama a rota é `executeSave({ approveBilling: true })`, depois de gravar os valores — a
   * nota sai sobre o que está persistido, não sobre o que está na tela.
   */
  const handleApproveBilling = useCallback(() => {
    if (!currentBilling?.id) {
      toast.error("Esta cobrança ainda não foi criada. Salve antes de aprovar.");
      return;
    }
    if (!validateCustomerData()) return;
    setBillingApprovalDialogOpen(true);
  }, [currentBilling?.id, validateCustomerData]);

  /** LIQUIDAR À MÃO — `PUT /billings/:id/settle`, o orçamento direto pago à vista. */
  const handleSettleBilling = useCallback(async () => {
    if (!currentBilling?.id) return;
    const ok = window.confirm(
      "Marcar esta cobrança como liquidada? As parcelas dela serão dadas por pagas e os boletos em aberto, cancelados.",
    );
    if (!ok) return;
    setIsSaving(true);
    try {
      await billingService.settle(currentBilling.id);
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      queryClient.invalidateQueries({ queryKey: taskQuoteKeys.all });
      queryClient.invalidateQueries({ queryKey: billingKeys.all });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Faturamento liquidado.");
    } catch {
      // O interceptor do axios já emite o toast de erro.
    } finally {
      setIsSaving(false);
    }
  }, [currentBilling?.id, queryClient]);

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
  const isServicesStep = servicesStepIdx !== null && currentStep === servicesStepIdx;
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
                {/* PASSO 1 — OS VEÍCULOS DESTA COBRANÇA.
                    Nada de tarefa aqui: o editor de tarefa que morava neste
                    passo (nome, categoria, implemento, série, plaqueta,
                    conclusão, detalhes) foi embora — é produção, e mora em
                    Produção. Ficaram os três campos que a NOTA exige, um por
                    veículo, no recorte do documento. */}
                <div style={{ display: currentStep === 1 ? undefined : "none" }}>
                  {/* ⚠️ `approved` NÃO é `disabled`. A cobrança aprovada muda o aviso do
                      cartão, não o direito de escrever: placa, chassi e nº do pedido
                      chegam tarde por natureza — o pedido de compra em especial, que a
                      API deixou de fora das guardas do orçamento exatamente por isso.
                      Travar aqui desfazia na tela o que o servidor abriu de propósito e
                      mandava quem emite a nota corrigir cada caminhão em Produção. */}
                  <BillingCoveredVehicles
                    vehicles={coveredVehicleRows as any}
                    disabled={!canEdit}
                    approved={!!currentBilling?.approvedAt}
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

                {/* Customer steps — always mounted (hidden via CSS) so form values survive navigation.
                    TODAS ficam montadas, inclusive as que não são desta página: o payload da
                    gravação é montado a partir do formulário, e desmontar uma fatia a tiraria
                    do envio — a reconciliação leria "esta fatia saiu" e a APAGARIA. O que muda
                    é que só as de `visibleConfigIdx` ganham posição de passo; as demais ficam
                    permanentemente escondidas e são alcançadas pela página delas. */}
                {customerConfigs.map((config: any, i: number) => {
                  const cachedCustomer = customersCache.current.get(config.customerId);
                  const stepPos = visibleConfigIdx.indexOf(i);
                  const isThisStep = stepPos >= 0 && currentStep === firstCustomerStepIdx + stepPos;
                  return (
                    // ⚠️ A CHAVE NÃO PODE SER O CLIENTE. Num orçamento cobrado
                    // veículo a veículo as N faturas são do MESMO cliente, e
                    // `key={customerId}` repetiria a chave nas N: o React
                    // reaproveita o nó da primeira para todas, e os campos de uma
                    // fatura aparecem na tela de outra. O id da fatura é único; o
                    // índice cobre a fatura ainda não gravada.
                    <div
                      key={config.id || `${config.customerId}-${i}`}
                      style={{ display: isThisStep ? undefined : "none" }}
                    >
                      {/* "FATURAR PARA" e os RESPONSÁVEIS — uma vez por página,
                          no primeiro passo de pagador. São da COBRANÇA inteira,
                          não de um pagador: repeti-los em cada passo faria a
                          mesma pergunta aparecer N vezes com N respostas
                          possíveis para uma só. */}
                      {stepPos === 0 && (
                        <div className="mb-4">
                          <BillingStepInfo
                            disabled={!canEdit}
                            customersCache={customersCache}
                            vehicles={quoteVehicleRows as any}
                            // O RECORTE: os pagadores desta cobrança, não os do
                            // orçamento. Sem isto, três caminhões do mesmo
                            // cliente apareciam como "3 selecionados" do mesmo
                            // CNPJ numa página que cobra um.
                            configIdx={visibleConfigIdx}
                          />
                        </div>
                      )}
                      <BillingStepCustomer
                        configIndex={i}
                        // O seletor junto/separado/lotes vive UMA vez por página,
                        // no primeiro passo MOSTRADO — não no índice 0, que pode
                        // não estar visível (ver `visibleConfigIdx`).
                        isFirstVisibleBilling={stepPos === 0}
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
                  // A COBRANÇA desta página — o estado que o cabeçalho mostra e o alvo das ações.
                  billing={currentBilling}
                  onApproveBilling={handleApproveBilling}
                  onSettleBilling={handleSettleBilling}
                  filterCustomerId={
                    dossieCustomerId !== "all" ? dossieCustomerId : undefined
                  }
                  // O ESCOPO DESTA PÁGINA. `filterCustomerId` não bastava: num
                  // orçamento cobrado veículo a veículo as N cobranças são do
                  // MESMO CNPJ, então filtrar por cliente não cortava nada e o
                  // Resumo desenhava as três lado a lado — que é exatamente a
                  // tela de uma cobrança mostrando as cobranças das outras.
                  visibleConfigIdx={visibleConfigIdx}
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
            <AlertDialogCancel disabled={isSaving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isSaving}
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={async () => {
                setBillingApprovalDialogOpen(false);
                await executeSave({ approveBilling: true });
              }}
            >
              {isSaving
                ? "Processando..."
                : isPerVehicleBilling
                  ? "Confirmar Faturamento Desta Cobrança"
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
