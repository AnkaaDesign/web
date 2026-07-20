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

export interface AirbrushingCustomerInfo {
  id: string;
  name: string;
  fantasyName?: string;
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
