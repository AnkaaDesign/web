import { airbrushingService } from "../api-client/airbrushing";
import { createAirbrushingFormData } from "./form-data-helper";
import { AIRBRUSHING_DUE_DATE_RULE, AIRBRUSHING_PAYMENT_STATUS, AIRBRUSHING_STATUS } from "../constants";

// Shared "create the airbrushings for a freshly-created task" routine, used by the task
// CREATE form and the BUDGET form. Mirrors the create branch of the task-edit form's
// airbrushing reconciliation: already-uploaded files ride as *Ids, brand-new File objects
// ride as multipart (receipts/invoices/layouts).

const uploadedIds = (files: any[]): string[] =>
  (files || []).filter((f) => f?.uploaded).map((f) => f.uploadedFileId || f.id).filter(Boolean);
const newFilesOf = (files: any[]): File[] =>
  (files || []).filter((f) => f instanceof File && !(f as any).uploaded) as File[];

/**
 * ÚNICA definição do payload escalar de uma aerografia.
 *
 * Todo caminho de submissão (assistente de aerografia, formulário de tarefa, orçamento e a
 * reconciliação da edição de tarefa) passa por aqui — antes eram QUATRO listas escritas à
 * mão e um campo novo precisava ser lembrado nas quatro, o que fez a configuração de
 * pagamento inteira ser descartada em silêncio no cadastro.
 *
 * Aceita tanto uma linha do `MultiAirbrushingSelector` quanto os valores do react-hook-form:
 * os nomes dos campos são os mesmos nos dois.
 */
export const buildAirbrushingPayload = (a: any): Record<string, any> => ({
  status: a.status,
  paymentStatus: a.paymentStatus,
  paymentMethod: a.paymentMethod ?? null,
  // `undefined` (e não null): o campo é NOT NULL no banco com default próprio, então omiti-lo
  // deixa o servidor decidir em vez de tentar gravar null.
  dueDateRule: a.dueDateRule ?? undefined,
  paymentTermDays: a.paymentTermDays ?? null,
  dueDayOfMonth: a.dueDayOfMonth ?? null,
  dueDate: a.dueDate ?? null,
  price: a.price ?? null,
  // `|| null` (não `??`): colapsa "" em null para que um campo em branco limpe o valor em vez
  // de mandar string vazia pelo helper de FormData.
  description: typeof a.description === "string" ? a.description.trim() || null : (a.description ?? null),
  startDate: a.startDate ?? null,
  finishDate: a.finishDate ?? null,
  startedAt: a.startedAt ?? null,
  finishedAt: a.finishedAt ?? null,
  painterId: a.painterId ?? null,
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Mapa `fileId → status` de layout, já filtrado para chaves que são File IDs reais — o schema
 * exige UUID, e um id temporário de arquivo ainda não enviado derrubaria a requisição inteira.
 * Devolve `undefined` quando não há nada a enviar.
 */
export const airbrushingLayoutStatuses = (a: any): Record<string, string> | undefined => {
  const raw = a?.layoutStatuses;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const entries = Object.entries(raw as Record<string, unknown>).filter(([fileId, status]) => UUID_RE.test(fileId) && typeof status === "string" && !!status);
  return entries.length > 0 ? (Object.fromEntries(entries) as Record<string, string>) : undefined;
};

/**
 * A linha carrega alguma configuração que FOGE dos padrões (pagamento ou status)?
 *
 * Sem isto, uma linha preenchida SÓ com forma de pagamento/vencimento era considerada vazia e
 * descartada inteira. Os padrões (Preparação / Pendente / "dias após o término" sem prazo) não
 * contam — senão a linha vazia que o seletor semeia viraria uma aerografia fantasma.
 */
export const hasNonDefaultAirbrushingConfig = (a: any): boolean =>
  !!a?.paymentMethod ||
  a?.paymentTermDays != null ||
  a?.dueDayOfMonth != null ||
  !!a?.dueDate ||
  (!!a?.dueDateRule && a.dueDateRule !== AIRBRUSHING_DUE_DATE_RULE.DAYS_AFTER_FINISH) ||
  (!!a?.status && a.status !== AIRBRUSHING_STATUS.PREPARATION) ||
  (!!a?.paymentStatus && a.paymentStatus !== AIRBRUSHING_PAYMENT_STATUS.PENDING);

// Skip the empty default row the selector may seed — only create rows carrying real data.
const isMeaningful = (a: any): boolean =>
  a.price != null || !!a.startDate || !!a.finishDate || !!a.startedAt || !!a.finishedAt || !!a.painterId ||
  !!a.description?.trim() ||
  hasNonDefaultAirbrushingConfig(a) ||
  uploadedIds(a.layouts).length > 0 || newFilesOf(a.layouts).length > 0 ||
  uploadedIds(a.receiptFiles).length > 0 || newFilesOf(a.receiptFiles).length > 0 ||
  uploadedIds(a.invoiceFiles).length > 0 || newFilesOf(a.invoiceFiles).length > 0;

/** Public predicate — a `MultiAirbrushingSelector` row that carries real data (worth creating). */
export const isMeaningfulAirbrushing = (a: any): boolean => isMeaningful(a);

export interface AirbrushingCustomerInfo {
  id: string;
  name: string;
  fantasyName?: string;
}

type LayoutStatusMap = Record<string, string>;

/**
 * One airbrushing configuration to be copied across N tasks. `taskId` is filled in per target task,
 * so everything here is the SHARED config: the scalar fields, the already-uploaded file ids, and the
 * brand-new File blobs (which are re-uploaded per task so every airbrushing gets its OWN copies —
 * File entities belong to a single airbrushing, so blobs must not be shared by id).
 */
export interface AirbrushingConfig {
  status?: any;
  paymentStatus?: any;
  /** Forma de pagamento + regra de vencimento — viram as colunas Forma/Vencimento em Contas a Pagar. */
  paymentMethod?: string | null;
  dueDateRule?: string | null;
  paymentTermDays?: number | null;
  dueDayOfMonth?: number | null;
  dueDate?: any;
  price?: number | null;
  description?: string | null;
  startDate?: any;
  finishDate?: any;
  startedAt?: any;
  finishedAt?: any;
  painterId?: string | null;
  /** Ids of already-uploaded files to link (typically empty in the create wizard — files ride as blobs). */
  receiptIds?: string[];
  invoiceIds?: string[];
  layoutIds?: string[];
  /** fileId → layout status, applied to the linked (existing) layout files. */
  layoutStatuses?: LayoutStatusMap;
  /** Brand-new File blobs, uploaded fresh for EACH task. */
  newReceipts?: File[];
  newInvoices?: File[];
  newLayouts?: File[];
}

/** A single target for the copy: the task plus its customer (for file-organization context). */
export interface AirbrushingTaskTarget {
  id: string;
  customer?: AirbrushingCustomerInfo;
}

/**
 * Copy ONE airbrushing configuration onto EACH of the given tasks — the multi-select "create a copy
 * of the config for every task I picked" flow. Delegates the actual create to the caller's mutation
 * fn (so cache invalidation / toasts stay in the hook layer). Sequential so a failure surfaces
 * early; returns the created results in target order.
 *
 * Reusable by any "pick N tasks → fan a config out to each" flow (not just airbrushing).
 */
export async function createAirbrushingForTasks(
  tasks: AirbrushingTaskTarget[],
  config: AirbrushingConfig,
  createFn: (data: any) => Promise<any>,
): Promise<any[]> {
  const newReceipts = config.newReceipts ?? [];
  const newInvoices = config.newInvoices ?? [];
  const newLayouts = config.newLayouts ?? [];
  const hasNewFiles = newReceipts.length > 0 || newInvoices.length > 0 || newLayouts.length > 0;
  const layoutStatuses = airbrushingLayoutStatuses(config);

  const results: any[] = [];
  for (const task of tasks) {
    const base: Record<string, any> = {
      ...buildAirbrushingPayload(config),
      receiptIds: config.receiptIds ?? [],
      invoiceIds: config.invoiceIds ?? [],
      layoutIds: config.layoutIds ?? [],
      taskId: task.id,
    };

    if (hasNewFiles) {
      const data = {
        ...base,
        // Wrap in an array for multipart serialization (backend preprocess unwraps).
        layoutStatuses: layoutStatuses ? [layoutStatuses] : undefined,
      };
      const formData = createAirbrushingFormData(
        data,
        {
          receipts: newReceipts.length > 0 ? newReceipts : undefined,
          invoices: newInvoices.length > 0 ? newInvoices : undefined,
          layouts: newLayouts.length > 0 ? newLayouts : undefined,
        },
        task.customer,
      );
      results.push(await createFn(formData));
    } else {
      const data = { ...base, layoutStatuses };
      results.push(await createFn(data));
    }
  }
  return results;
}

/** Payload completo de UMA linha do seletor para UMA tarefa (escalares + ids de arquivo + status de layout). */
const buildRowPayload = (a: any, taskId: string, multipart: boolean): Record<string, any> => {
  const layoutStatuses = airbrushingLayoutStatuses(a);
  return {
    ...buildAirbrushingPayload(a),
    receiptIds: uploadedIds(a.receiptFiles),
    invoiceIds: uploadedIds(a.invoiceFiles),
    layoutIds: uploadedIds(a.layouts),
    // Multipart exige o mapa embrulhado num array (o preprocess do backend desembrulha).
    layoutStatuses: layoutStatuses ? (multipart ? [layoutStatuses] : layoutStatuses) : undefined,
    taskId,
  };
};

/**
 * Fan a `MultiAirbrushingSelector` config array out over EACH selected task — the standalone
 * airbrushing wizard's multi-config create (analogous to the cut wizard's task × plan × quantity).
 * For every task, every MEANINGFUL config produces one airbrushing (empty seed rows are skipped),
 * so the total is `meaningfulConfigs × tasks`. New File blobs are re-uploaded per task so each
 * airbrushing owns its own file copies. Per-item toasts are suppressed (the caller shows one
 * aggregate toast + invalidation); returns the created results in order.
 */
export async function createAirbrushingsForTasks(
  tasks: AirbrushingTaskTarget[],
  airbrushings: any[] | undefined,
): Promise<any[]> {
  const meaningful = (airbrushings || []).filter(isMeaningful);
  const results: any[] = [];
  for (const task of tasks) {
    for (const a of meaningful) {
      const files = {
        receipts: newFilesOf(a.receiptFiles),
        invoices: newFilesOf(a.invoiceFiles),
        layouts: newFilesOf(a.layouts),
      };
      const hasFiles = files.receipts.length > 0 || files.invoices.length > 0 || files.layouts.length > 0;
      const data = buildRowPayload(a, task.id, hasFiles);
      if (hasFiles) {
        const formData = createAirbrushingFormData(data, files, task.customer);
        results.push(await airbrushingService.createAirbrushing(formData as any, undefined, { suppressToast: true }));
      } else {
        results.push(await airbrushingService.createAirbrushing(data as any, undefined, { suppressToast: true }));
      }
    }
  }
  return results;
}

/**
 * Create every meaningful airbrushing from a form's `airbrushings` field for the given task.
 * Throws on the first failure so the caller can surface a warning (task itself is already saved).
 */
export async function createAirbrushingsForTask(
  taskId: string,
  airbrushings: any[] | undefined,
  customerInfo?: AirbrushingCustomerInfo,
): Promise<void> {
  for (const a of airbrushings || []) {
    if (!isMeaningful(a)) continue;
    const files = {
      receipts: newFilesOf(a.receiptFiles),
      invoices: newFilesOf(a.invoiceFiles),
      layouts: newFilesOf(a.layouts),
    };
    const hasFiles = files.receipts.length > 0 || files.invoices.length > 0 || files.layouts.length > 0;
    const data = buildRowPayload(a, taskId, hasFiles);
    if (hasFiles) {
      const formData = createAirbrushingFormData(data, files, customerInfo);
      await airbrushingService.createAirbrushing(formData as any);
    } else {
      await airbrushingService.createAirbrushing(data as any);
    }
  }
}
