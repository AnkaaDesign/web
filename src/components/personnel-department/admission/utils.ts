// Shared helpers for the Admission (Admissões) module.
// Mirrors the server status machine at api/src/modules/human-resources/admission/admission.service.ts

import { ADMISSION_STATUS, ADMISSION_DOCUMENT_STATUS } from "../../../constants";
import type { Admission, AdmissionDocument } from "../../../types/admission";

/** Linear status chain (CANCELLED is reachable from any non-final status, but is not part of the chain). */
export const ADMISSION_STATUS_CHAIN: ADMISSION_STATUS[] = [
  ADMISSION_STATUS.DOCS_PENDING,
  ADMISSION_STATUS.MEDICAL_EXAM,
  ADMISSION_STATUS.CONTRACT,
  ADMISSION_STATUS.REGISTRATION,
  ADMISSION_STATUS.COMPLETED,
];

/** True when the admission can no longer be advanced or cancelled. */
export function isAdmissionFinal(status: ADMISSION_STATUS): boolean {
  return status === ADMISSION_STATUS.COMPLETED || status === ADMISSION_STATUS.CANCELLED;
}

/** Next status in the chain, or null when there is none (COMPLETED/CANCELLED). */
export function getNextAdmissionStatus(status: ADMISSION_STATUS): ADMISSION_STATUS | null {
  const index = ADMISSION_STATUS_CHAIN.indexOf(status);
  if (index === -1 || index === ADMISSION_STATUS_CHAIN.length - 1) return null;
  return ADMISSION_STATUS_CHAIN[index + 1];
}

/**
 * Mirrors the server guard: an admission cannot leave DOCS_PENDING (forward)
 * while ANY document with required && status === PENDING exists.
 */
export function hasBlockingRequiredDocs(admission: Pick<Admission, "status"> & { documents?: AdmissionDocument[] }): boolean {
  if (admission.status !== ADMISSION_STATUS.DOCS_PENDING) return false;
  return (admission.documents || []).some((doc) => doc.required && doc.status === ADMISSION_DOCUMENT_STATUS.PENDING);
}

/** Progress = documents that are no longer PENDING over total. */
export function getDocumentProgress(documents?: AdmissionDocument[]): { done: number; total: number } {
  const docs = documents || [];
  return {
    done: docs.filter((doc) => doc.status !== ADMISSION_DOCUMENT_STATUS.PENDING).length,
    total: docs.length,
  };
}
