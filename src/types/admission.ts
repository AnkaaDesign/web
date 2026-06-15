// packages/interfaces/src/admission.ts
// Admissões (Departamento Pessoal)

import type {
  BaseEntity,
  BaseGetUniqueResponse,
  BaseGetManyResponse,
  BaseCreateResponse,
  BaseUpdateResponse,
  BaseDeleteResponse,
  BaseBatchResponse,
} from "./common";
import type { ADMISSION_STATUS, ADMISSION_DOCUMENT_TYPE, ADMISSION_DOCUMENT_STATUS, ORDER_BY_DIRECTION } from "../constants";
import type { User, UserIncludes } from "./user";
import type { File, FileIncludes } from "./file";
import type { MedicalExam } from "./medical-exam";

// =====================
// Main Entity Interfaces
// =====================

export interface Admission extends BaseEntity {
  userId: string;
  status: ADMISSION_STATUS;
  statusOrder: number;
  hireDate: Date | null;
  notes: string | null;
  /** Quando cancelada: a etapa em que o processo estava + o porquê não foi concluída. */
  cancelledFromStatus: ADMISSION_STATUS | null;
  cancellationReason: string | null;
  createdById: string | null;

  // Relations (optional, populated based on query)
  user?: User;
  createdBy?: User;
  documents?: AdmissionDocument[];
  /** The admissional ASO linked to this process (1:1 via MedicalExam.admissionId). */
  admissionExam?: MedicalExam | null;
}

export interface AdmissionDocument extends BaseEntity {
  admissionId: string;
  type: ADMISSION_DOCUMENT_TYPE;
  required: boolean;
  status: ADMISSION_DOCUMENT_STATUS;
  fileId: string | null;
  expiresAt: Date | null;
  note: string | null;

  // ---- In-app electronic signature (mobile/biometric) ----
  // Populated when a signable document (e.g. LGPD_TERM) is signed in the app.
  // The signed/sealed PDF (≠ fileId, which is the original uploaded document).
  signedFileId: string | null;
  signedByUserId: string | null;
  signedAt: Date | null;
  // PAdES (ICP-Brasil) server-side seal applied over the signed PDF.
  padesSealed: boolean;
  padesSealedAt: Date | null;

  // Relations (optional, populated based on query)
  admission?: Admission;
  file?: File;
  signedFile?: File;
  signedBy?: User;
}

// =====================
// Include Types
// =====================

export interface AdmissionIncludes {
  user?: boolean | { include?: UserIncludes };
  createdBy?: boolean | { include?: UserIncludes };
  documents?: boolean | { include?: AdmissionDocumentIncludes; orderBy?: any };
  admissionExam?: boolean | { include?: any };
}

export interface AdmissionDocumentIncludes {
  admission?: boolean | { include?: AdmissionIncludes };
  file?: boolean | { include?: FileIncludes };
  signedFile?: boolean | { include?: FileIncludes };
  signedBy?: boolean | { include?: UserIncludes };
}

// =====================
// Order By Types
// =====================

export interface AdmissionOrderBy {
  id?: ORDER_BY_DIRECTION;
  status?: ORDER_BY_DIRECTION;
  statusOrder?: ORDER_BY_DIRECTION;
  hireDate?: ORDER_BY_DIRECTION;
  notes?: ORDER_BY_DIRECTION;
  userId?: ORDER_BY_DIRECTION;
  createdById?: ORDER_BY_DIRECTION;
  createdAt?: ORDER_BY_DIRECTION;
  updatedAt?: ORDER_BY_DIRECTION;
  user?: { name?: ORDER_BY_DIRECTION };
}

// =====================
// Response Interfaces
// =====================

export interface AdmissionGetUniqueResponse extends BaseGetUniqueResponse<Admission> {}
export interface AdmissionGetManyResponse extends BaseGetManyResponse<Admission> {}
export interface AdmissionCreateResponse extends BaseCreateResponse<Admission> {}
export interface AdmissionUpdateResponse extends BaseUpdateResponse<Admission> {}
export interface AdmissionDeleteResponse extends BaseDeleteResponse {}

export interface AdmissionDocumentGetUniqueResponse extends BaseGetUniqueResponse<AdmissionDocument> {}
export interface AdmissionDocumentUpdateResponse extends BaseUpdateResponse<AdmissionDocument> {}

// =====================
// Batch Operation Responses
// =====================

export interface AdmissionBatchCreateResponse<T> extends BaseBatchResponse<Admission, T> {}
export interface AdmissionBatchUpdateResponse<T> extends BaseBatchResponse<Admission, T & { id: string }> {}
export interface AdmissionBatchDeleteResponse extends BaseBatchResponse<{ id: string; deleted: boolean }, { id: string }> {}
