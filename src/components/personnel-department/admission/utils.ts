// Shared helpers for the Admission (Admissões) module.
// Mirrors the server status machine at api/src/modules/personnel-department/admission/admission.service.ts

import { ADMISSION_STATUS, ADMISSION_DOCUMENT_STATUS, ADMISSION_DOCUMENT_TYPE } from "../../../constants";
import type { Admission, AdmissionDocument } from "../../../types/admission";

// ---- Admission document checklist (single source of truth, mirrors the API) ----
// Only these document types belong to the admission. Everything else (LGPD,
// employment contract, transport voucher, military certificate, voter id, PIS…)
// is NOT part of the admission — it can be added later on the collaborator page.
export const ADMISSION_CHECKLIST_DOC_TYPES: ADMISSION_DOCUMENT_TYPE[] = [
  ADMISSION_DOCUMENT_TYPE.CPF,
  ADMISSION_DOCUMENT_TYPE.RG,
  ADMISSION_DOCUMENT_TYPE.DRIVER_LICENSE, // CNH — alternativa ao RG
  ADMISSION_DOCUMENT_TYPE.CTPS,
  ADMISSION_DOCUMENT_TYPE.PROOF_OF_RESIDENCE,
  ADMISSION_DOCUMENT_TYPE.BIRTH_MARRIAGE_CERTIFICATE,
  ADMISSION_DOCUMENT_TYPE.PHOTO,
];

// Sempre obrigatórios.
export const ADMISSION_HARD_REQUIRED_DOC_TYPES: ADMISSION_DOCUMENT_TYPE[] = [ADMISSION_DOCUMENT_TYPE.CPF, ADMISSION_DOCUMENT_TYPE.CTPS];
// Obrigatório "um destes": RG OU CNH.
export const ADMISSION_EITHER_REQUIRED_DOC_TYPES: ADMISSION_DOCUMENT_TYPE[] = [ADMISSION_DOCUMENT_TYPE.RG, ADMISSION_DOCUMENT_TYPE.DRIVER_LICENSE];

/** Only the documents that belong to the admission checklist (hides legacy extras). */
export function getAdmissionChecklistDocuments(documents?: AdmissionDocument[]): AdmissionDocument[] {
  return (documents || []).filter((doc) => ADMISSION_CHECKLIST_DOC_TYPES.includes(doc.type));
}

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

/** Previous status in the chain, or null when there is none (first step / CANCELLED). */
export function getPreviousAdmissionStatus(status: ADMISSION_STATUS): ADMISSION_STATUS | null {
  const index = ADMISSION_STATUS_CHAIN.indexOf(status);
  if (index <= 0) return null;
  return ADMISSION_STATUS_CHAIN[index - 1];
}

/**
 * Mirrors the server guard. An admission cannot leave DOCS_PENDING (forward)
 * while a REQUIRED document is still PENDING. Required = CPF + CTPS (hard) AND
 * at least one of RG / CNH. Legacy document types are ignored (they are no
 * longer part of the admission), so old admissions are never stuck on them.
 */
export function hasBlockingRequiredDocs(admission: Pick<Admission, "status"> & { documents?: AdmissionDocument[] }): boolean {
  if (admission.status !== ADMISSION_STATUS.DOCS_PENDING) return false;
  const docs = admission.documents || [];

  const hardPending = docs.some((doc) => ADMISSION_HARD_REQUIRED_DOC_TYPES.includes(doc.type) && doc.status === ADMISSION_DOCUMENT_STATUS.PENDING);

  const eitherDocs = docs.filter((doc) => ADMISSION_EITHER_REQUIRED_DOC_TYPES.includes(doc.type));
  // Satisfied when no RG/CNH rows exist (legacy) or at least one is provided.
  const eitherSatisfied = eitherDocs.length === 0 || eitherDocs.some((doc) => doc.status !== ADMISSION_DOCUMENT_STATUS.PENDING);

  return hardPending || !eitherSatisfied;
}

/** Progress over the admission checklist only (legacy extras excluded). */
export function getDocumentProgress(documents?: AdmissionDocument[]): { done: number; total: number } {
  const docs = getAdmissionChecklistDocuments(documents);
  return {
    done: docs.filter((doc) => doc.status !== ADMISSION_DOCUMENT_STATUS.PENDING).length,
    total: docs.length,
  };
}
