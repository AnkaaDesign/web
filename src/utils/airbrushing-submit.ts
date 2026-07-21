import { airbrushingService } from "../api-client/airbrushing";
import { createAirbrushingFormData } from "./form-data-helper";

// Shared "create the airbrushings for a freshly-created task" routine, used by the task
// CREATE form and the BUDGET form. Mirrors the create branch of the task-edit form's
// airbrushing reconciliation: already-uploaded files ride as *Ids, brand-new File objects
// ride as multipart (receipts/invoices/layouts). Airbrushing layouts carry no status.

const uploadedIds = (files: any[]): string[] =>
  (files || []).filter((f) => f?.uploaded).map((f) => f.uploadedFileId || f.id).filter(Boolean);
const newFilesOf = (files: any[]): File[] =>
  (files || []).filter((f) => f instanceof File && !(f as any).uploaded) as File[];

// Skip the empty default row the selector may seed — only create rows carrying real data.
const isMeaningful = (a: any): boolean =>
  a.price != null || !!a.startDate || !!a.finishDate || !!a.startedAt || !!a.finishedAt || !!a.painterId ||
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
  price?: number | null;
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
  const hasLayoutStatuses = !!config.layoutStatuses && Object.keys(config.layoutStatuses).length > 0;

  const results: any[] = [];
  for (const task of tasks) {
    const base: Record<string, any> = {
      status: config.status,
      paymentStatus: config.paymentStatus,
      price: config.price ?? null,
      startDate: config.startDate ?? null,
      finishDate: config.finishDate ?? null,
      startedAt: config.startedAt ?? null,
      finishedAt: config.finishedAt ?? null,
      painterId: config.painterId ?? null,
      receiptIds: config.receiptIds ?? [],
      invoiceIds: config.invoiceIds ?? [],
      layoutIds: config.layoutIds ?? [],
      taskId: task.id,
    };

    if (hasNewFiles) {
      const data = {
        ...base,
        // Wrap in an array for multipart serialization (backend preprocess unwraps).
        layoutStatuses: hasLayoutStatuses ? [config.layoutStatuses] : undefined,
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
      const data = { ...base, layoutStatuses: hasLayoutStatuses ? config.layoutStatuses : undefined };
      results.push(await createFn(data));
    }
  }
  return results;
}

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
      const data: Record<string, any> = {
        status: a.status,
        paymentStatus: a.paymentStatus,
        price: a.price ?? null,
        startDate: a.startDate ?? null,
        finishDate: a.finishDate ?? null,
        startedAt: a.startedAt ?? null,
        finishedAt: a.finishedAt ?? null,
        painterId: a.painterId ?? null,
        receiptIds: uploadedIds(a.receiptFiles),
        invoiceIds: uploadedIds(a.invoiceFiles),
        layoutIds: uploadedIds(a.layouts),
        taskId: task.id,
      };
      const files = {
        receipts: newFilesOf(a.receiptFiles),
        invoices: newFilesOf(a.invoiceFiles),
        layouts: newFilesOf(a.layouts),
      };
      const hasFiles = files.receipts.length > 0 || files.invoices.length > 0 || files.layouts.length > 0;
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
    const data: Record<string, any> = {
      status: a.status,
      paymentStatus: a.paymentStatus,
      price: a.price ?? null,
      startDate: a.startDate ?? null,
      finishDate: a.finishDate ?? null,
      startedAt: a.startedAt ?? null,
      finishedAt: a.finishedAt ?? null,
      painterId: a.painterId ?? null,
      receiptIds: uploadedIds(a.receiptFiles),
      invoiceIds: uploadedIds(a.invoiceFiles),
      layoutIds: uploadedIds(a.layouts),
      taskId,
    };
    const files = {
      receipts: newFilesOf(a.receiptFiles),
      invoices: newFilesOf(a.invoiceFiles),
      layouts: newFilesOf(a.layouts),
    };
    const hasFiles = files.receipts.length > 0 || files.invoices.length > 0 || files.layouts.length > 0;
    if (hasFiles) {
      const formData = createAirbrushingFormData(data, files, customerInfo);
      await airbrushingService.createAirbrushing(formData as any);
    } else {
      await airbrushingService.createAirbrushing(data as any);
    }
  }
}
