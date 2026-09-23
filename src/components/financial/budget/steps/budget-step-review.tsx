import { useContext, useMemo, useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Combobox } from "@/components/ui/combobox";
import { CustomerLogoDisplay } from "@/components/ui/avatar-display";
import { QuoteStatusBadge, quoteStatusTriggerClass } from "@/components/production/task/quote/quote-status-badge";
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
import {
  IconFileInvoice,
  IconBuilding,
  IconTruck,
  IconCreditCard,
  IconCalendar,
  IconReceipt,
  IconShieldCheck,
  IconPhoto,
  IconExternalLink,
} from "@tabler/icons-react";
import { FileThumbnail, FileViewerContext } from "@/components/common/file";
import { formatCurrency, formatDate, formatChassis } from "@/utils";
import { TRUCK_CATEGORY_LABELS, IMPLEMENT_TYPE_LABELS } from "@/constants/enum-labels";
import { generatePaymentText, generateGuaranteeText } from "@/utils/quote-text-generators";
import { getApiBaseUrl } from "@/config/api";
import { routes } from "@/constants";
import { TASK_QUOTE_STATUS_LABELS } from "@/constants/enum-labels";
import { canUpdateQuoteStatus, getAvailableQuoteStatusTransitions } from "@/utils/permissions/quote-permissions";
import { cn } from "@/lib/utils";
import { attentionFieldClass, useAttentionField } from "@/lib/attention";
import { PINNED_CUSTOMERS } from "@/config/company";
import {
  NFSE_DOCUMENT_KEY,
  NFSE_REQUIRED_CUSTOMER_FIELDS,
  missingBillingCustomerKeys,
  missingBillingCustomerLabels,
} from "@/lib/billing-customer-data";
import { round2 } from "@/utils/quote-money";
import type { TASK_QUOTE_STATUS, Budget } from "@/types/budget";
import { hasMultipleCustomers as hasMultipleCustomersOf, orderNumberLabel, sortQuoteTasks } from "@/utils/quote-tasks";
import { vehicleCombinations } from "@/utils/vehicle-combinations";
/** Os destinos que ESTE passo oferece. Curados de propósito: o passo de
 *  Orçamento move entre pendente e aprovado, e nada mais. */
const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "PENDING", label: "Pendente" },
  // "Aprovado", sem o prefixo "Orçamento": a tela já se chama Orçamento, e o estado de faturamento
  // mudou de entidade — repetir a palavra era desambiguar de algo que não mora mais aqui.
  { value: "APPROVED", label: "Aprovado" },
];

/**
 * Os destinos curados MAIS o status atual, quando ele não é um deles.
 *
 * `SIGNED` e `EXPIRED` são escritos pela CERIMÔNIA, nunca escolhidos num menu —
 * por isso não são destino em `VALID_TRANSITIONS` e nunca estiveram na lista
 * acima. Só que o Combobox rotula o gatilho procurando o valor ATUAL entre as
 * opções: assim que o cliente assinava, o orçamento ia para `SIGNED`, o valor
 * sumia da lista e o badge virava o placeholder "Selecione uma opção" — sem
 * rótulo e sem cor, justamente na tela onde se confere o que está faltando.
 *
 * O atual entra só para o gatilho ter o que mostrar, e sai desabilitado (ninguém
 * transiciona para onde já está). Mesma forma de `billing-step-review`, que
 * também cura os destinos por fase e apenas garante a presença do atual.
 */
const statusOptionsFor = (
  current: string | null | undefined,
): Array<{ value: string; label: string }> => {
  if (!current || STATUS_OPTIONS.some((o) => o.value === current)) return STATUS_OPTIONS;
  return [
    {
      value: current,
      label: TASK_QUOTE_STATUS_LABELS[current as keyof typeof TASK_QUOTE_STATUS_LABELS] ?? current,
    },
    ...STATUS_OPTIONS,
  ];
};

/**
 * A cor do gatilho vem de `quoteStatusTriggerClass`, a MESMA fonte do badge.
 *
 * ⚠️ Era uma tabela própria aqui, e divergiu: "Assinado" saía verde-água neste
 * combobox e verde no badge da tabela, e "Aprovado" saía verde aqui e azul lá.
 * Como o seletor aparece para quem PODE editar e o badge para quem não pode, a
 * mesma situação tinha duas cores conforme o usuário — que é exatamente o que a
 * duplicação sempre produz. Não recriar o mapa: trocar a variante em
 * `QUOTE_STATUS_CONFIG` troca as duas superfícies juntas.
 */

interface BudgetStepReviewProps {
  task?: any;
  disabled?: boolean;
  existingQuote?: any;
  userRole?: string;
  selectedCustomers: Map<string, any>;
  onStatusChange?: (status: string) => void;
  layoutFiles?: Array<{ thumbnailUrl?: string; uploadedFileId?: string; id?: string; preview?: string | null }>;
  isCreateMode?: boolean;
  /**
   * Orçamento de N veículos: a pintura geral e as miniaturas do layout de cada um,
   * para a relação de veículos mostrar o que muda de caminhão para caminhão.
   */
  vehicleExtras?: Record<
    string,
    { paintName?: string | null; paintHex?: string | null; layoutThumbs?: string[] }
  >;
  /** Clicar numa linha da relação de veículos leva à aba dele no passo 1. */
  onVehicleSelect?: (taskId: string) => void;
  /**
   * Layout por veículo: as artes agrupadas pelos veículos que as usam. Ausente = o
   * layout compartilhado de sempre (`layoutFiles`).
   */
  layoutGroups?: Array<{ label: string; thumbs: string[] }>;
}

export function BudgetStepReview({
  task,
  existingQuote,
  userRole = "",
  selectedCustomers,
  onStatusChange,
  layoutFiles,
  disabled,
  isCreateMode,
  vehicleExtras,
  onVehicleSelect,
  layoutGroups,
}: BudgetStepReviewProps) {
  const navigate = useNavigate();
  const { control, setValue } = useFormContext();

  // The form's status field is the single source of truth here: it reflects the
  // user's selection immediately, and the save always sends the status inline
  // with value edits so the backend never auto-reverts behind it (which would
  // otherwise make this copy stale). Driving the display off the server value
  // instead would lag the async refetch and show a stale status.
  const currentStatus = useWatch({ control, name: "status" }) || "";
  const services = useWatch({ control, name: "services" });
  const customerConfigs = useWatch({ control, name: "customerConfigs" });
  const guaranteeYears = useWatch({ control, name: "guaranteeYears" });
  const customGuaranteeText = useWatch({ control, name: "customGuaranteeText" });
  const customForecastDays = useWatch({ control, name: "customForecastDays" });
  const simultaneousTasks = useWatch({ control, name: "simultaneousTasks" });
  const subtotalValue = useWatch({ control, name: "subtotal" });
  const totalValue = useWatch({ control, name: "total" });
  // O MODO e a REPARTIÇÃO do faturamento — o que decide sobre quantos veículos a
  // cláusula de pagamento fala. Sem eles a cláusula deste resumo era montada
  // como se o orçamento tivesse UM veículo, e o número que o comercial confere
  // aqui, na última tela antes de salvar, saía dividido por N. Ver
  // `paymentPlans` mais abaixo.
  const billingSplitValue = useWatch({ control, name: "billingSplit" }) as
    | "JOINT"
    | "PER_TASK"
    | "CUSTOM"
    | undefined;
  const billingGroupsValue = useWatch({ control, name: "billingGroups" }) as
    | string[][]
    | undefined;
  const expiresAt = useWatch({ control, name: "expiresAt" });
  const layoutFileIds = (useWatch({ control, name: "layoutFileIds" }) as string[] | undefined) || [];

  // QUANTOS VEÍCULOS — a mesma conta do passo 1 e do seletor de faturamento.
  //
  // O preço dos serviços é POR VEÍCULO (ver `utils/quote-money.ts`). Sem o "× N"
  // e o total geral, esta tela mostra R$ 12.170,40 como TOTAL de um orçamento de
  // sessenta caminhões que vale R$ 730.224,00 — e é ESTA a tela em que o
  // operador confere antes de mandar criar. O documento assinado já imprime as
  // duas linhas; a conferência tem de ver o mesmo número que o cliente verá.
  const platesWatch = (useWatch({ control, name: "plates" }) as string[] | undefined) ?? [];
  // Na criação, categoria e implemento são UM par para todos os veículos que vão
  // nascer — o passo 1 os pede uma vez só.
  const formCategory = useWatch({ control, name: "category" }) as string | undefined;
  const formImplementType = useWatch({ control, name: "implementType" }) as string | undefined;
  const serialNumbersWatch =
    (useWatch({ control, name: "serialNumbers" }) as unknown[] | undefined) ?? [];
  /**
   * QUAIS veículos, e não só quantos.
   *
   * Na criação, é o mesmo produto cartesiano que a API vai receber (placas ×
   * números de série); na edição, as tarefas que o orçamento já cobre. A
   * conferência é a última tela antes de sessenta tarefas nascerem sob um número
   * de orçamento só — ver "60 veículos" sem poder ler QUE sessenta é confiar no
   * que se digitou em outro passo.
   */
  const vehicleLabels = useMemo(() => {
    const existing = existingQuote?.tasks ?? [];
    if (existing.length > 0) {
      return sortQuoteTasks(existing).map(
        (t) => t.serialNumber || (t as any).truck?.plate || "—",
      );
    }
    const plates = platesWatch.filter(Boolean);
    const serials = serialNumbersWatch.map((s) => String(s ?? "")).filter(Boolean);
    if (plates.length > 0 && serials.length > 0) {
      // A MESMA ordem do laço da criação: placa por placa, série por série.
      return plates.flatMap((plate) => serials.map((sn) => `${sn} · ${plate}`));
    }
    if (plates.length > 0) return plates;
    return serials;
  }, [existingQuote, platesWatch, serialNumbersWatch]);

  const vehicleCount = useMemo(() => {
    const existingCount = existingQuote?.tasks?.length;
    if (existingCount && existingCount > 0) return existingCount;
    if (vehicleLabels.length > 0) return vehicleLabels.length;
    return 1;
  }, [existingQuote, vehicleLabels]);

  /**
   * SOBRE QUANTOS VEÍCULOS CADA FATURA FALA — uma entrada por PLANO de cobrança.
   *
   * Espelha `paymentScope` do documento (`api/.../signature/document/quote-text.ts`)
   * e a mesma leitura do assistente de Faturamento. As fatias são agrupadas por
   * TAMANHO DA COBERTURA, não por fatura: num `PER_TASK` de sessenta veículos as
   * sessenta faturas têm o mesmo plano e produzem UMA frase ("para cada um dos
   * 60 veículos… 240 cobranças"), não sessenta parágrafos.
   *
   * `JOINT` cobre todos, `PER_TASK` cobre um, e em lotes cada grupo cobre o
   * tamanho dele — com lotes desiguais saindo mais de uma frase, como no PDF.
   */
  const paymentPlans = useMemo<Array<{ covered: number; prefix: string | null }>>(() => {
    const uniform = (covered: number) => [{ covered, prefix: null }];
    if (vehicleCount <= 1) return uniform(1);
    const split = billingSplitValue ?? "JOINT";
    if (split === "PER_TASK") return uniform(1);
    if (split !== "CUSTOM") return uniform(vehicleCount);

    const groups = (billingGroupsValue ?? []).filter(
      (g) => Array.isArray(g) && g.length > 0,
    );
    // Sem lotes compostos ainda, a intenção declarada é a fatura conjunta — que
    // é também o que o save faz quando `billingGroups` chega vazio.
    if (groups.length === 0) return uniform(vehicleCount);
    const sizes = [...new Set(groups.map((g) => g.length))];
    // LOTES IGUAIS são um plano só: sessenta faturas de um caminhão produzem
    // UMA frase ("para cada um dos 60 veículos… 240 cobranças"), não sessenta
    // parágrafos. É o que o documento faz, e o que mantém o acervo byte a byte
    // igual ao de antes da feature.
    if (sizes.length === 1) return uniform(sizes[0]);

    // LOTES DESIGUAIS: uma frase por LOTE, prefixada pelos veículos dele e sem
    // escopo nem contagem de cobranças — cada uma fala só dos SEUS. É como o
    // documento escreve ("Veículos 8101, 8102, 8104: Fica acertado…"), e é a
    // única forma honesta: "para cada grupo de 3" e "serão 6 cobranças" são
    // extrapolações que só valem quando todos os lotes têm o mesmo tamanho.
    const byId = new Map(
      ((existingQuote?.tasks ?? []) as any[]).map((t: any) => [t.id, t]),
    );
    const labelOf = (taskId: string) => {
      const t = byId.get(taskId);
      return (
        (t?.serialNumber || undefined) ??
        (t?.truck?.plate || undefined) ??
        (t?.name || undefined) ??
        taskId.slice(0, 8)
      );
    };
    return groups.map((g) => {
      const labels = g.map(labelOf);
      const shown =
        labels.length <= 3
          ? labels.join(", ")
          : `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
      return {
        covered: g.length,
        prefix: `${g.length === 1 ? "Veículo" : "Veículos"} ${shown}: `,
      };
    });
  }, [vehicleCount, billingSplitValue, billingGroupsValue, existingQuote]);

  // O que está no CAMPO é o do veículo aberto (ou, na criação, o de todos os que
  // vão nascer). Os irmãos vêm do registro — é o que o documento vai imprimir.
  const formOrderNumber = useWatch({ control, name: "customerOrderNumber" }) as string | null | undefined;
  const openTaskId = (task as { id?: string } | null | undefined)?.id ?? null;
  // Na edição de um orçamento de N veículos, cada caminhão está no formulário
  // (`vehicles[i]`) — o que acabou de ser digitado em QUALQUER aba, não só na aberta.
  const formVehicles = useWatch({ control, name: "vehicles" }) as
    | Array<{
        taskId: string;
        serialNumber?: string;
        plate?: string;
        chassisNumber?: string;
        customerOrderNumber?: string | null;
      }>
    | undefined;
  const formVehicleById = useMemo(
    () => new Map((formVehicles ?? []).map((v) => [v.taskId, v])),
    [formVehicles],
  );

  /**
   * OS VEÍCULOS EM TABELA — as MESMAS colunas do documento e da página pública.
   *
   * Eram etiquetas ("48888 48889 48890 48891"): cabem quatro, não cabem
   * sessenta, e não dizem placa, chassi nem pedido de compra. A conferência que
   * este passo existe para permitir é a mesma que o cliente vai fazer na página
   * pública — então mostra o mesmo quadro.
   *
   * Na CRIAÇÃO as tarefas ainda não existem: as linhas vêm do produto cartesiano
   * do passo 1 (a mesma função que o submit usa) e o pedido de compra é o valor
   * único do campo, que vale para todas. Na EDIÇÃO vêm do registro, com o valor
   * do formulário no lugar do veículo aberto — é o que acabou de ser digitado.
   */
  const vehicleRows = useMemo(() => {
    const label = (map: Record<string, string>, value?: string | null) =>
      value ? (map[value as keyof typeof map] ?? value) : null;
    const existing = existingQuote?.tasks ?? [];
    if (existing.length > 0) {
      return sortQuoteTasks(existing as any[]).map((t: any) => {
        const live = formVehicleById.get(t.id);
        return {
          key: t.id,
          serialNumber: (live ? live.serialNumber : t.serialNumber) || null,
          plate: (live ? live.plate : t.truck?.plate) || null,
          chassis: (live ? live.chassisNumber : t.truck?.chassisNumber) || null,
          orderNumber: live
            ? ((live.customerOrderNumber ?? "").trim() || null)
            : t.id === openTaskId
              ? ((formOrderNumber ?? "").trim() || null)
              : ((t.customerOrderNumber ?? "").trim() || null),
          category: label(TRUCK_CATEGORY_LABELS as any, t.truck?.category),
          implement: label(IMPLEMENT_TYPE_LABELS as any, t.truck?.implementType),
        };
      });
    }
    // Na CRIAÇÃO os caminhões ainda não existem: categoria e implemento são os
    // do formulário e valem para todos os que vão nascer, como o nº do pedido.
    const typed = (formOrderNumber ?? "").trim() || null;
    const category = label(TRUCK_CATEGORY_LABELS as any, formCategory);
    const implement = label(IMPLEMENT_TYPE_LABELS as any, formImplementType);
    return vehicleCombinations(platesWatch, serialNumbersWatch as (string | number)[]).map(
      (combo, i) => ({
        key: `${combo.plate ?? ""}|${combo.serialNumber ?? ""}|${i}`,
        serialNumber: combo.serialNumber ?? null,
        plate: combo.plate ?? null,
        chassis: null as string | null,
        orderNumber: typed,
        category,
        implement,
      }),
    );
  }, [
    existingQuote,
    platesWatch,
    serialNumbersWatch,
    formOrderNumber,
    openTaskId,
    formCategory,
    formImplementType,
    formVehicleById,
  ]);

  // Cada coluna só existe se ALGUM veículo a tiver — a mesma regra do documento
  // e da página pública: uma coluna inteira de travessões não informa nada.
  const anyVehicleOrderNumber = vehicleRows.some((v) => !!v.orderNumber);
  const anyVehicleChassis = vehicleRows.some((v) => !!v.chassis);
  const anyVehicleCategory = vehicleRows.some((v) => !!v.category);
  const anyVehicleImplement = vehicleRows.some((v) => !!v.implement);

  // ── O PEDIDO DE COMPRA, POR VEÍCULO ──────────────────────────────────────
  //
  // Uma linha para o orçamento, não uma por cliente: o pedido mora em
  // `Task.customerOrderNumber` e é da ENTREGA. Quando os N veículos citam o
  // mesmo número — o caso comum — sai um número; quando diferem, sai a lista.
  //
  // A linha é renderizada VAZIA ("Pendente") quando uma regra a está cobrando:
  // um valor que falta e não tem nó no DOM é um sinal sem para onde apontar.
  const orderNumberAttention = useAttentionField("TASK_QUOTE", existingQuote?.id, "orderNumber");
  const orderNumberText = useMemo(() => {
    if (formVehicles && formVehicles.length > 0) {
      return orderNumberLabel(
        formVehicles.map((v) => ({ customerOrderNumber: v.customerOrderNumber ?? null })),
      );
    }
    const siblings = ((existingQuote?.tasks ?? []) as Array<{ id: string; customerOrderNumber?: string | null }>)
      .filter((t) => t.id !== openTaskId);
    return orderNumberLabel([{ customerOrderNumber: formOrderNumber ?? null }, ...siblings]);
  }, [formOrderNumber, existingQuote, openTaskId, formVehicles]);
  const billsIbipora = (customerConfigs ?? []).some(
    (c: any) => c?.customerId === PINNED_CUSTOMERS.IBIPORA && c?.generateInvoice !== false,
  );
  const orderNumberAttentionClass =
    orderNumberAttention?.active && billsIbipora && !orderNumberText
      ? attentionFieldClass(orderNumberAttention)
      : "";
  // ── É UMA LINHA DO RESUMO DO VEÍCULO, NÃO UMA SEÇÃO ──────────────────────
  //
  // Saía como cartão próprio no meio do Resumo — entre "Condições de Pagamento"
  // e "Prazo de Entrega" —, e era ALI que o anel de atenção piscava. Um número
  // que pertence ao veículo, cobrado num lugar onde o veículo não está, manda o
  // operador procurar o campo na seção errada: ele fica em "Dados da tarefa",
  // ao lado da placa e do chassi. Agora a linha mora no mesmo quadro que Série,
  // Chassi e Plaqueta, que é onde o leitor a procura — e o anel pisca lá.
  const purchaseOrderRow =
    orderNumberText || orderNumberAttentionClass ? (
      <div
        className={cn(
          "flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5",
          orderNumberAttentionClass,
        )}
        title={orderNumberAttentionClass ? orderNumberAttention?.match.rule.name : undefined}
      >
        <span className="text-sm text-muted-foreground">N° do Pedido</span>
        <span className={cn("text-sm font-medium", orderNumberText ? "" : "text-muted-foreground")}>
          {orderNumberText || "Pendente"}
        </span>
      </div>
    ) : null;

  // The cadastro half of the same story. The Faturamento Resumo has had this since the rule
  // landed; the Orçamento one did not — which is backwards, because
  // `task-quote.billing-customer-incomplete` fires at APPROVED, a status set on THIS wizard.
  const customerDataAttention = useAttentionField("TASK_QUOTE", existingQuote?.id, "customerData");
  const attentionCustomerFor = (config: any, keys: string[]): string => {
    if (!customerDataAttention?.active) return "";
    if (config?.generateInvoice === false) return "";
    const missing = missingBillingCustomerKeys(config?.customerData);
    return keys.some((k) => missing.includes(k)) ? attentionFieldClass(customerDataAttention) : "";
  };
  /** Every key the rule can be about — this Resumo has one line, not one per field. */
  const NFSE_ATTENTION_KEYS = [NFSE_DOCUMENT_KEY, ...NFSE_REQUIRED_CUSTOMER_FIELDS.map((f) => f.key)];

  // In create mode, read task fields directly from the form
  const formPlates = useWatch({ control, name: "plates" });
  const formSerialNumbers = useWatch({ control, name: "serialNumbers" });
  const formName = useWatch({ control, name: "name" });

  // Merge task prop with form-derived task data in create mode
  const resolvedTask = useMemo(() => {
    if (!isCreateMode) return task;
    const plates = Array.isArray(formPlates) ? formPlates.filter(Boolean) : [];
    const serialNumbers = Array.isArray(formSerialNumbers) ? formSerialNumbers.filter((v: any) => v != null) : [];
    return {
      ...task,
      name: task?.name || formName || undefined,
      serialNumber: task?.serialNumber || (serialNumbers.length > 0 ? serialNumbers.join(", ") : undefined),
      truck: task?.truck || (plates.length > 0 ? { plate: plates.join(", ") } : undefined),
    };
  }, [isCreateMode, task, formPlates, formSerialNumbers, formName]);

  // Contexto direto (e não `useFileViewer`) porque o hook LANÇA quando não há provider,
  // e este passo é montado tanto dentro quanto fora do FileViewerProvider.
  const fileViewer = useContext(FileViewerContext);

  const [customerFilter, setCustomerFilter] = useState<string>("all");

  const validServices = useMemo(
    () => (services || []).filter((s: any) => s.description?.trim()),
    [services],
  );

  // ⚠️ CLIENTES distintos, não fatias: sem isto um orçamento `PER_TASK` de
  // quatro caminhões para um cliente abria um filtro "Completo / Cliente 1 /
  // Cliente 2 / Cliente 3 / Cliente 4" com o MESMO cliente quatro vezes.
  const hasMultipleCustomers = hasMultipleCustomersOf(customerConfigs);

  // Customer filter options for multi-customer
  const customerFilterOptions = useMemo(() => {
    if (!hasMultipleCustomers) return [];
    const options = [{ value: "all", label: "Completo" }];
    (customerConfigs || []).forEach((config: any, i: number) => {
      const customer = selectedCustomers.get(config.customerId);
      const name = customer?.corporateName || customer?.fantasyName || `Cliente ${i + 1}`;
      options.push({ value: config.customerId, label: `Cliente ${i + 1}: ${name}` });
    });
    return options;
  }, [hasMultipleCustomers, customerConfigs, selectedCustomers]);

  // Filter services based on selected customer
  const filteredServices = useMemo(() => {
    if (customerFilter === "all" || !hasMultipleCustomers) return validServices;
    return validServices.filter((s: any) => s.invoiceToCustomerId === customerFilter);
  }, [validServices, customerFilter, hasMultipleCustomers]);

  // Group services by customer for multi-customer view
  const customerGroups = useMemo(() => {
    if (!hasMultipleCustomers || customerFilter !== "all") return null;
    const groups = new Map<string, { name: string; services: any[] }>();
    // Use customerConfigs order for consistent numbering
    for (const config of customerConfigs || []) {
      const customer = selectedCustomers.get(config.customerId);
      const name = customer?.fantasyName || customer?.corporateName || "Sem cliente";
      groups.set(config.customerId, { name, services: [] });
    }
    for (const svc of validServices) {
      const customerId = svc.invoiceToCustomerId || "__unassigned__";
      if (groups.has(customerId)) {
        groups.get(customerId)!.services.push(svc);
      }
    }
    return groups;
  }, [hasMultipleCustomers, validServices, selectedCustomers, customerConfigs, customerFilter]);

  // Compute totals based on filter
  const { displaySubtotal, displayTotal, discountAmount } = useMemo(() => {
    if (customerFilter === "all" || !hasMultipleCustomers) {
      const sub = subtotalValue || 0;
      const tot = totalValue || 0;
      return { displaySubtotal: sub, displayTotal: tot, discountAmount: Math.max(0, sub - tot) };
    }
    const config = (customerConfigs || []).find((c: any) => c.customerId === customerFilter);
    if (config) {
      const sub = typeof config.subtotal === "number" ? config.subtotal : Number(config.subtotal) || 0;
      const tot = typeof config.total === "number" ? config.total : Number(config.total) || 0;
      return { displaySubtotal: sub, displayTotal: tot, discountAmount: Math.max(0, sub - tot) };
    }
    return { displaySubtotal: 0, displayTotal: 0, discountAmount: 0 };
  }, [customerFilter, hasMultipleCustomers, subtotalValue, totalValue, customerConfigs]);

  const canChangeStatus = canUpdateQuoteStatus(userRole);

  // Allowed next statuses for the current state + role.
  const allowedNextStatuses = useMemo(() => {
    if (!currentStatus) return [] as string[];
    return getAvailableQuoteStatusTransitions(
      currentStatus as TASK_QUOTE_STATUS,
      userRole,
    );
  }, [currentStatus, userRole]);

  // Reject-reason dialog: required when reverting from APPROVED to PENDING.
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [pendingRejectStatus, setPendingRejectStatus] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {/* Task Info Summary — with inline status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <IconTruck className="h-4 w-4 text-muted-foreground" />
              Resumo da Tarefa
            </CardTitle>
            {!isCreateMode && (
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
                        // Reject path — require a reason when stepping back to PENDING.
                        if (v === "PENDING" && currentStatus && currentStatus !== "PENDING") {
                          setPendingRejectStatus(v);
                          setRejectReason("");
                          setRejectDialogOpen(true);
                          return;
                        }
                        setValue("status", v, { shouldDirty: true });
                        onStatusChange?.(v);
                      }
                    }}
                    options={statusOptionsFor(currentStatus).map((s) => {
                      const isCurrent = s.value === currentStatus;
                      const allowed = isCurrent || allowedNextStatuses.includes(s.value as TASK_QUOTE_STATUS);
                      return {
                        ...s,
                        disabled: isCurrent || !allowed,
                      };
                    })}
                    searchable={false}
                    clearable={false}
                    disabled={disabled}
                    className="w-[220px]"
                    triggerClassName={cn("font-medium h-9", quoteStatusTriggerClass(currentStatus))}
                  />
                ) : (
                  <QuoteStatusBadge status={currentStatus as TASK_QUOTE_STATUS} size="lg" />
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {resolvedTask?.name && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                <span className="text-sm text-muted-foreground">Logomarca</span>
                <span className="text-sm font-medium">{resolvedTask.name}</span>
              </div>
            )}
            {resolvedTask?.customer && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                <span className="text-sm text-muted-foreground">Cliente</span>
                <span className="text-sm font-medium">{resolvedTask.customer.corporateName || resolvedTask.customer.fantasyName}</span>
              </div>
            )}
            {/* ═══════════════════════════════════════════════════════════════
                A IDENTIFICAÇÃO — UMA LINHA OU A RELAÇÃO INTEIRA

                Com um veículo, as linhas de sempre: placa, série, chassi.

                Com N, elas dariam a identidade de UM caminhão no resumo de um
                orçamento que cobre quatro — e o Resumo é exatamente a tela em
                que se confere o conjunto antes de mandar ao cliente. Então vira
                a MESMA tabela do documento e da página pública.

                O passo 1 continua sendo o da tarefa ABERTA: é lá que se define
                aquele caminhão, e nada do que se grava lá alcança os irmãos.
                ═══════════════════════════════════════════════════════════ */}
            {vehicleRows.length > 1 ? (
              <div className="rounded-lg bg-muted/50 px-4 py-3">
                <div className="mb-2 text-sm text-muted-foreground">
                  Veículos <span className="font-medium text-foreground">({vehicleRows.length})</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
                    <thead>
                      <tr className="text-muted-foreground">
                        <th className="w-8 pb-1 pr-2 text-left text-[0.65rem] font-semibold uppercase tracking-wide">#</th>
                        <th className="pb-1 pr-3 text-left text-[0.65rem] font-semibold uppercase tracking-wide">Nº de série</th>
                        <th className="pb-1 pr-3 text-left text-[0.65rem] font-semibold uppercase tracking-wide">Placa</th>
                        {anyVehicleChassis && (
                          <th className="pb-1 pr-3 text-left text-[0.65rem] font-semibold uppercase tracking-wide">Chassi</th>
                        )}
                        {anyVehicleOrderNumber && (
                          <th className="pb-1 pr-3 text-left text-[0.65rem] font-semibold uppercase tracking-wide">Nº do pedido</th>
                        )}
                        {anyVehicleCategory && (
                          <th className="pb-1 pr-3 text-left text-[0.65rem] font-semibold uppercase tracking-wide">Categoria</th>
                        )}
                        {anyVehicleImplement && (
                          <th className="pb-1 pr-3 text-left text-[0.65rem] font-semibold uppercase tracking-wide">Implemento</th>
                        )}
                        {vehicleExtras && (
                          <th className="pb-1 pr-3 text-left text-[0.65rem] font-semibold uppercase tracking-wide">Pintura</th>
                        )}
                        {vehicleExtras && (
                          <th className="pb-1 text-left text-[0.65rem] font-semibold uppercase tracking-wide">Layout</th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {vehicleRows.map((v, i) => (
                        <tr
                          key={v.key}
                          className={cn(
                            "border-t border-border/40",
                            onVehicleSelect && "cursor-pointer hover:bg-muted",
                          )}
                          onClick={onVehicleSelect ? () => onVehicleSelect(v.key) : undefined}
                          title={onVehicleSelect ? "Editar este veículo" : undefined}
                        >
                          <td className="py-1 pr-2 tabular-nums text-muted-foreground">{i + 1}</td>
                          <td className="py-1 pr-3 font-medium">{v.serialNumber || <span className="italic text-muted-foreground">a registrar</span>}</td>
                          <td className="py-1 pr-3 font-medium">{v.plate || <span className="italic text-muted-foreground">a registrar</span>}</td>
                          {anyVehicleChassis && (
                            <td className="py-1 pr-3 font-mono text-xs">{v.chassis ? formatChassis(v.chassis) : <span className="italic text-muted-foreground">a registrar</span>}</td>
                          )}
                          {anyVehicleOrderNumber && (
                            <td className="py-1 pr-3 font-medium tabular-nums">{v.orderNumber || <span className="text-muted-foreground">—</span>}</td>
                          )}
                          {anyVehicleCategory && (
                            <td className="py-1 pr-3 font-medium">{v.category || <span className="text-muted-foreground">—</span>}</td>
                          )}
                          {anyVehicleImplement && (
                            <td className="py-1 pr-3 font-medium">{v.implement || <span className="text-muted-foreground">—</span>}</td>
                          )}
                          {vehicleExtras && (
                            <td className="py-1 pr-3 font-medium">
                              {vehicleExtras[v.key]?.paintName ? (
                                <span className="flex items-center gap-1.5">
                                  {vehicleExtras[v.key]?.paintHex && (
                                    <span
                                      className="h-2.5 w-2.5 shrink-0 rounded-full border border-border"
                                      style={{ backgroundColor: vehicleExtras[v.key]?.paintHex ?? undefined }}
                                    />
                                  )}
                                  {vehicleExtras[v.key]?.paintName}
                                </span>
                              ) : (
                                <span className="italic text-muted-foreground">a definir</span>
                              )}
                            </td>
                          )}
                          {vehicleExtras && (
                            <td className="py-1">
                              {(vehicleExtras[v.key]?.layoutThumbs ?? []).length > 0 ? (
                                <span className="flex gap-1">
                                  {(vehicleExtras[v.key]?.layoutThumbs ?? []).map((src, k) => (
                                    <img
                                      key={k}
                                      src={src}
                                      alt="Layout"
                                      className="h-8 w-14 rounded border border-border bg-background object-contain"
                                    />
                                  ))}
                                </span>
                              ) : (
                                <span className="italic text-muted-foreground">sem layout</span>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <>
                {resolvedTask?.truck?.plate && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                    <span className="text-sm text-muted-foreground">Placa</span>
                    <span className="text-sm font-medium">{resolvedTask.truck.plate}</span>
                  </div>
                )}
                {resolvedTask?.serialNumber && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                    <span className="text-sm text-muted-foreground">Nº de Série</span>
                    <span className="text-sm font-medium">{resolvedTask.serialNumber}</span>
                  </div>
                )}
                {resolvedTask?.truck?.chassisNumber && (
                  <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                    <span className="text-sm text-muted-foreground">Chassi</span>
                    <span className="text-sm font-mono font-medium">{formatChassis(resolvedTask.truck.chassisNumber)}</span>
                  </div>
                )}
              </>
            )}
            {/* O PEDIDO DE COMPRA, no quadro a que pertence.
                Some quando a TABELA de veículos já o mostra linha a linha
                (`anyVehicleOrderNumber`) — dizer a mesma coisa duas vezes na
                mesma tela —, e quando o Resumo está filtrado por um cliente,
                porque o pedido é da ENTREGA e não do pagador. */}
            {customerFilter === "all" && !anyVehicleOrderNumber && purchaseOrderRow}
            {/* Plaqueta — é uma FOTO (truck.vinPlate -> File), não texto. Só aparece quando
                existe: no create ainda não há caminhão gravado. */}
            {resolvedTask?.truck?.vinPlate && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                <span className="text-sm text-muted-foreground">Plaqueta</span>
                <FileThumbnail file={resolvedTask.truck.vinPlate} size="sm" onClick={() => fileViewer?.actions?.viewFiles?.([resolvedTask.truck!.vinPlate!] as never, 0)} />
              </div>
            )}
            {/* Categoria e implemento: linha própria com UM veículo, COLUNA da
                tabela com vários — repetir "Toco / Refrigerado" abaixo de uma
                tabela que já traz as duas em cada linha é dizer a mesma coisa
                duas vezes na mesma tela. */}
            {vehicleRows.length <= 1 && resolvedTask?.truck?.category && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                <span className="text-sm text-muted-foreground">Categoria</span>
                <span className="text-sm font-medium">{TRUCK_CATEGORY_LABELS[resolvedTask.truck.category as keyof typeof TRUCK_CATEGORY_LABELS] || resolvedTask.truck.category}</span>
              </div>
            )}
            {vehicleRows.length <= 1 && resolvedTask?.truck?.implementType && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                <span className="text-sm text-muted-foreground">Implemento</span>
                <span className="text-sm font-medium">{IMPLEMENT_TYPE_LABELS[resolvedTask.truck.implementType as keyof typeof IMPLEMENT_TYPE_LABELS] || resolvedTask.truck.implementType}</span>
              </div>
            )}
            {resolvedTask?.finishedAt && (
              <div className="flex justify-between items-center bg-muted/50 rounded-lg px-4 py-2.5">
                <span className="text-sm text-muted-foreground">Finalizado em</span>
                <span className="text-sm font-medium">{formatDate(resolvedTask.finishedAt)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Services */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <IconFileInvoice className="h-5 w-5 text-muted-foreground" />
              Serviços ({filteredServices.length})
            </CardTitle>
            {hasMultipleCustomers && (
              <Combobox
                value={customerFilter}
                onValueChange={(v) => setCustomerFilter(String(v ?? "all"))}
                options={customerFilterOptions}
                searchable={false}
                clearable={false}
                className="w-[240px]"
              />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Budget Number and Validity */}
          <div className="flex flex-wrap gap-3">
            {existingQuote?.budgetNumber && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
                <IconReceipt className="h-4 w-4" />
                <span>
                  Orçamento Nº:{" "}
                  <span className="font-medium text-foreground">
                    {String(existingQuote.budgetNumber).padStart(4, "0")}
                  </span>
                </span>
              </div>
            )}
            {expiresAt && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
                <IconCalendar className="h-4 w-4" />
                <span>
                  Validade:{" "}
                  <span className="font-medium text-foreground">
                    {formatDate(expiresAt)}
                  </span>
                </span>
              </div>
            )}
          </div>

          {/* Services Table */}
          {(() => {
            // Multi-customer grouped layout (only when filter is "all")
            if (hasMultipleCustomers && customerGroups) {
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 items-stretch gap-3">
                  {Array.from(customerGroups.entries()).map(
                    ([customerId, group], groupIndex) => (
                      <div
                        key={customerId}
                        className="border border-border dark:border-border/30 rounded-lg overflow-hidden"
                      >
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/40 border-b border-border dark:border-border/30">
                          <IconBuilding className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-semibold">
                            <span className="text-muted-foreground font-medium">Cliente {groupIndex + 1}:</span>{" "}
                            {group.name}
                          </span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {formatCurrency(
                              group.services.reduce(
                                (sum: number, s: any) => sum + (Number(s?.amount) || 0),
                                0,
                              ),
                            )}
                          </span>
                        </div>
                        <div>
                          <table className="w-full">
                            <thead className="bg-muted/50">
                              <tr>
                                <th className="px-4 py-2.5 text-left text-sm font-semibold text-muted-foreground">
                                  Descrição
                                </th>
                                <th className="px-4 py-2.5 text-right text-sm font-semibold text-muted-foreground w-28">
                                  Valor
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border dark:divide-border/30">
                              {group.services.map((svc: any, idx: number) => (
                                <ServiceTableRow key={idx} service={svc} />
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              );
            }

            // Single customer / filtered / flat table
            return (
              <div className="border border-border dark:border-border/30 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-muted-foreground">
                        Descrição
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold text-muted-foreground w-32">
                        Valor
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border dark:divide-border/30">
                    {filteredServices.map((svc: any, idx: number) => (
                      <ServiceTableRow key={idx} service={svc} />
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}

          {/* Pricing Summary */}
          {(() => {
            // O "× N" só entra na visão GERAL (sem filtro de cliente): ali
            // `displayTotal` é o total por veículo, vindo do formulário. Filtrado
            // por cliente, o número vem da configuração daquele cliente, que em
            // `JOINT` já é o valor geral — multiplicar de novo cobraria sessenta
            // vezes o que já está contado sessenta vezes.
            const showPerVehicle = customerFilter === "all" && vehicleCount > 1;
            // `round2(total × N)`, a MESMA conta do PDF e da fatura — nunca o
            // desconto recalculado sobre a soma. Ver `utils/quote-money.ts`.
            const grandTotal = round2(displayTotal * vehicleCount);
            return (
              <div className="bg-muted/20 border border-border dark:border-border/30 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Subtotal{showPerVehicle ? " por veículo" : ""}
                  </span>
                  <span className="font-medium">
                    {formatCurrency(displaySubtotal)}
                  </span>
                </div>

                {discountAmount > 0 && (
                  <div className="flex items-center justify-between text-sm text-destructive">
                    <span>Desconto{showPerVehicle ? " por veículo" : ""}</span>
                    <span className="font-medium">
                      - {formatCurrency(discountAmount)}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-border dark:border-border/30">
                  <span className="text-base font-bold text-foreground">
                    {showPerVehicle ? "TOTAL POR VEÍCULO" : "TOTAL"}
                  </span>
                  <span
                    className={
                      showPerVehicle
                        ? "text-base font-bold text-foreground"
                        : "text-xl font-bold text-primary"
                    }
                  >
                    {formatCurrency(displayTotal)}
                  </span>
                </div>

                {showPerVehicle && (
                  <>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Veículos</span>
                      <span className="font-medium">&times; {vehicleCount}</span>
                    </div>
                    {/* A RELAÇÃO DOS VEÍCULOS não fica aqui: este bloco é de
                        DINHEIRO, e o que ele precisa dizer é "× 4". A relação
                        está no Resumo da Tarefa, acima, onde se confere o
                        conjunto — duas tabelas iguais na mesma tela é o tipo de
                        repetição que faz o leitor parar de ler as duas. */}
                    <div className="flex items-center justify-between pt-3 border-t border-border dark:border-border/30">
                      <span className="text-base font-bold text-foreground">
                        TOTAL GERAL
                      </span>
                      <span className="text-xl font-bold text-primary">
                        {formatCurrency(grandTotal)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Per-Customer Config Cards */}
      {Array.isArray(customerConfigs) && customerConfigs.length > 0 && (() => {
        const configs = customerFilter !== "all"
          ? (customerConfigs || []).filter((c: any) => c.customerId === customerFilter)
          : hasMultipleCustomers ? customerConfigs : [];
        if (configs.length === 0 && customerFilter === "all") return null;

        // Single customer payment (when only 1 config and filter is "all")
        if (configs.length === 0 && customerFilter !== "all") return null;

        return (
          <div className={configs.length >= 2 ? "grid grid-cols-1 md:grid-cols-2 items-stretch gap-3" : "space-y-3"}>
            {configs.map((config: any, i: number) => {
              const customer = selectedCustomers.get(config.customerId);
              const configSubtotal =
                typeof config.subtotal === "number"
                  ? config.subtotal
                  : Number(config.subtotal) || 0;
              const configTotal =
                typeof config.total === "number"
                  ? config.total
                  : Number(config.total) || 0;
              const configDiscountAmount = Math.max(0, configSubtotal - configTotal);
              // Mesma leitura do cartão de cliente único logo abaixo: o valor do
              // formulário é POR VEÍCULO, e a frase precisa falar do que a fatura
              // daquele plano cobra. Sem `vehicleCount`/`coveredVehicleCount` a
              // cláusula saía como se o orçamento fosse de um caminhão só.
              const configPaymentTexts = paymentPlans
                .map(({ covered, prefix }) => {
                  const text = generatePaymentText({
                    customPaymentText: config.customPaymentText,
                    paymentConfig: config.paymentConfig,
                    paymentCondition: config.paymentCondition,
                    total: round2(configTotal * covered),
                    vehicleCount: prefix ? 1 : vehicleCount,
                    coveredVehicleCount: prefix ? 1 : covered,
                  });
                  return text ? `${prefix ?? ""}${text}` : "";
                })
                .filter(Boolean);

              // Find original index for consistent numbering
              const originalIndex = (customerConfigs || []).findIndex((c: any) => c.customerId === config.customerId);

              return (
                <div
                  key={config.customerId || i}
                  className="bg-muted/30 rounded-lg p-4 space-y-2 flex flex-col"
                >
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    {customer && (
                      <CustomerLogoDisplay
                        logo={customer.logo}
                        customerName={customer.fantasyName}
                        size="xs"
                        shape="rounded"
                      />
                    )}
                    {!customer && (
                      <IconBuilding className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-muted-foreground font-medium">Cliente {originalIndex + 1}:</span>
                    {customer?.corporateName || customer?.fantasyName || "Cliente"}
                  </div>

                  {(() => {
                    // Same principle as the N° do Pedido line below: when a rule is asking for the
                    // cadastro, the Resumo has to have somewhere to point. It names the missing
                    // fields rather than just glowing, because they are fixed on another step.
                    const attnCls = attentionCustomerFor(config, NFSE_ATTENTION_KEYS);
                    if (!attnCls) return null;
                    return (
                      <div
                        className={cn("text-sm rounded-md px-2 py-1", attnCls)}
                        title={customerDataAttention?.match.rule.name}
                      >
                        Cadastro incompleto:{" "}
                        <span className="font-medium text-muted-foreground">
                          {missingBillingCustomerLabels(config?.customerData).join(", ")}
                        </span>
                      </div>
                    );
                  })()}

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">{formatCurrency(configSubtotal)}</span>
                  </div>

                  {configDiscountAmount > 0 && (
                    <div className="flex items-center justify-between text-sm text-destructive">
                      <span>Desconto</span>
                      <span className="font-medium">- {formatCurrency(configDiscountAmount)}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-border dark:border-border/30">
                    <span className="text-sm font-bold text-foreground">Total</span>
                    <span className="text-base font-bold text-primary">{formatCurrency(configTotal)}</span>
                  </div>

                  {configPaymentTexts.length > 0 && (
                    <div className="pt-2 space-y-1">
                      <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-1">
                        <IconCreditCard className="h-4 w-4 text-muted-foreground" />
                        Condições de Pagamento
                      </div>
                      {configPaymentTexts.map((text, k) => (
                        <p key={k} className="text-sm text-muted-foreground">
                          {text}
                        </p>
                      ))}
                    </div>
                  )}

                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ── O PEDIDO DE COMPRA, POR VEÍCULO ─────────────────────────────────────
          Fora dos cartões de cliente de propósito: o pedido é da ENTREGA
          (`Task.customerOrderNumber`), não do cliente. Num orçamento de dois
          clientes ele aparecia duas vezes, com o mesmo valor, como se fossem
          dois pedidos diferentes. */}

      {/* Single customer: payment conditions */}
      {/* Um cliente só — inclusive quando ele tem N fatias (`PER_TASK`).
          `length === 1` escondia as condições de pagamento de TODO orçamento
          multitarefa faturado veículo a veículo. */}
      {Array.isArray(customerConfigs) &&
        !hasMultipleCustomers &&
        customerConfigs.length > 0 &&
        customerFilter === "all" &&
        (() => {
          const config = customerConfigs[0];
          const configTotal = typeof config.total === "number" ? config.total : Number(config.total) || 0;
          // UMA FRASE POR PLANO, sobre o valor que a fatura daquele plano cobra.
          //
          // `config.total` neste formulário é o valor de UM veículo (ver o
          // `form.reset` da tela de detalhe, que semeia com `perVehicleAmount`),
          // então o total da fatura é `por veículo × cobertos` — a mesma conta do
          // documento. Sem isso a frase saía sobre o valor de um caminhão: um
          // orçamento conjunto de 4 veículos a R$ 1.750 anunciava "3 parcelas de
          // R$ 583,33" quando a fatura é de R$ 7.000 e a parcela, R$ 2.333,33.
          const paymentTexts = paymentPlans
            .map(({ covered, prefix }) => {
              const text = generatePaymentText({
                customPaymentText: config.customPaymentText,
                paymentConfig: config.paymentConfig,
                paymentCondition: config.paymentCondition,
                total: round2(configTotal * covered),
                // Com prefixo, a frase já diz de quem fala: mandar escopo junto
                // produziria "Veículos 8101, 8102: … para cada grupo de 2
                // veículos", que diz a mesma coisa duas vezes e erra na segunda.
                vehicleCount: prefix ? 1 : vehicleCount,
                coveredVehicleCount: prefix ? 1 : covered,
              });
              return text ? `${prefix ?? ""}${text}` : "";
            })
            .filter(Boolean);
          // `attentionOrderNumberFor` keeps the block alive when a rule is pointing at the missing
          // pedido — otherwise the whole card would be skipped and there would be nothing to blink.
          if (paymentTexts.length === 0) return null;
          return (
            <div className="bg-muted/30 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <IconCreditCard className="h-4 w-4 text-muted-foreground" />
                Condições de Pagamento
              </div>
              {paymentTexts.map((text, i) => (
                <p key={i} className="text-sm text-muted-foreground">
                  {text}
                </p>
              ))}
            </div>
          );
        })()}

      {/* Delivery Deadline */}
      {(customForecastDays || (simultaneousTasks && simultaneousTasks > 1)) && (
        <div className="bg-muted/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
            <IconTruck className="h-4 w-4 text-muted-foreground" />
            Prazo de Entrega
          </div>
          <p className="text-sm text-muted-foreground">
            {customForecastDays && (
              <>O prazo de entrega é de {customForecastDays} dias úteis a partir da data de liberação.</>
            )}
            {simultaneousTasks && simultaneousTasks > 1 && (
              <>{customForecastDays ? " " : ""}Capacidade de produção: {simultaneousTasks} tarefas simultâneas.</>
            )}
          </p>
        </div>
      )}

      {/* Guarantee */}
      {(guaranteeYears || customGuaranteeText) && (
        <div className="bg-muted/30 rounded-lg p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
            <IconShieldCheck className="h-4 w-4 text-muted-foreground" />
            Garantia
          </div>
          <p className="text-sm text-muted-foreground">
            {generateGuaranteeText({ guaranteeYears, customGuaranteeText } as Budget)}
          </p>
        </div>
      )}

      {/* Layout por veículo: as artes agrupadas pelos caminhões que as usam. */}
      {layoutGroups && layoutGroups.length > 0 && (
        <div className="bg-muted/30 rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <IconPhoto className="h-4 w-4 text-muted-foreground" />
            Layout
          </div>
          {layoutGroups.map((group, g) => (
            <div key={g} className="space-y-2">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{group.label}</div>
              <div className={cn("grid gap-3", group.thumbs.length <= 1 ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2")}>
                {group.thumbs.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt={`Layout — ${group.label}`}
                    className="w-full max-h-[420px] rounded-lg bg-background object-contain shadow-sm"
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Layout Preview (renders the layoutFiles array, up to 2) */}
      {!layoutGroups && (() => {
        // A persisted File id is a UUID; a not-yet-uploaded file carries a local temp
        // id (`<timestamp>-<random>`) the thumbnail endpoint would 404 on (→ broken
        // image). So resolve a local object-URL preview first, then a server
        // thumbnailUrl, and only fall back to the thumbnail endpoint for a real UUID.
        const isUuid = (id: string) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        const thumbFor = (slotFileId: string | null | undefined, slot?: any) => {
          if (slot?.preview) return slot.preview as string;
          if (slot?.thumbnailUrl) return slot.thumbnailUrl as string;
          const realId =
            (slot?.uploadedFileId && isUuid(slot.uploadedFileId) && slot.uploadedFileId) ||
            (slotFileId && isUuid(slotFileId) && slotFileId) ||
            null;
          if (realId) return `${getApiBaseUrl()}/files/thumbnail/${realId}`;
          return null;
        };
        // Prefer the resolved layoutFiles array (has thumbnails); fall back to ids.
        const count = Math.max(layoutFiles?.length || 0, layoutFileIds.length);
        const slots = Array.from({ length: count })
          .map((_, i) => thumbFor(layoutFileIds[i], layoutFiles?.[i]))
          .filter(Boolean) as string[];
        if (slots.length === 0) return null;
        return (
          <div className="bg-muted/30 rounded-lg p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
              <IconPhoto className="h-4 w-4 text-muted-foreground" />
              Layout
            </div>
            {/* Near full-width preview: a single layout spans the whole row; two split
                into a responsive 2-up grid. object-contain keeps the wrap's aspect. */}
            <div
              className={cn(
                "grid gap-3",
                slots.length <= 1 ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2",
              )}
            >
              {slots.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt="Layout referência"
                  className="w-full max-h-[420px] rounded-lg bg-background object-contain shadow-sm"
                />
              ))}
            </div>
          </div>
        );
      })()}

      {/* Reject reason dialog — required when reverting to PENDING.
          NOTE: parent FinancialBudgetDetailPage submits via budgetService.update +
          updateStatus on save; the reason is stored in form ("statusReason") and forwarded. */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Orçamento</DialogTitle>
            <DialogDescription>
              Informe o motivo da rejeição. O status do orçamento voltará para Pendente.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-2">
            <Label htmlFor="budget-reject-reason" className="text-sm font-medium">
              Motivo da rejeição <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="budget-reject-reason"
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
                setPendingRejectStatus(null);
                setRejectReason("");
              }}
            >
              Voltar
            </Button>
            <Button
              variant="destructive"
              disabled={rejectReason.trim().length < 5}
              onClick={() => {
                if (rejectReason.trim().length < 5 || !pendingRejectStatus) return;
                setValue("statusReason", rejectReason.trim(), { shouldDirty: true });
                setValue("status", pendingRejectStatus, { shouldDirty: true });
                onStatusChange?.(pendingRejectStatus);
                setRejectDialogOpen(false);
                setPendingRejectStatus(null);
                setRejectReason("");
              }}
            >
              Confirmar Rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =====================
// Service Table Row
// =====================

function ServiceTableRow({ service }: { service: any }) {
  const amount =
    typeof service.amount === "number"
      ? service.amount
      : Number(service.amount) || 0;
  const isOutrosWithObservation =
    service.description === "Outros" && !!service.observation;
  const displayDescription = isOutrosWithObservation
    ? service.observation
    : service.description;

  return (
    <tr className="hover:bg-muted/30 transition-colors h-[3.75rem]">
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
