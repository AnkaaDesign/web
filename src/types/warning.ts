// packages/interfaces/src/warning.ts

import type { BaseEntity, BaseGetUniqueResponse, BaseGetManyResponse, BaseCreateResponse, BaseUpdateResponse, BaseDeleteResponse, BaseBatchResponse } from "./common";
import type { WARNING_CATEGORY, WARNING_SEVERITY, ORDER_BY_DIRECTION } from "../constants";
import type { User, UserIncludes, UserOrderBy } from "./user";
import type { File, FileIncludes } from "./file";

// =====================
// Main Entity Interface
// =====================

// =====================
// Signature Types
// =====================

// COLLABORATOR = the warned employee; WITNESS = a witness to the warning act.
export type WarningSignerRole = "COLLABORATOR" | "WITNESS";

// Biometric method used during the mobile in-app signature.
export type WarningSignatureBiometricMethod = "FINGERPRINT" | "FACE_ID" | "IRIS" | "DEVICE_PIN" | "NONE";

// One in-app signature event captured on mobile for a warning.
// Verification code shown to users = first 16 hex chars of `hmacSignature` (uppercase).
export interface WarningSignature extends BaseEntity {
  warningId: string;
  signerRole: WarningSignerRole;
  signedByUserId: string;
  signedByCpf: string;

  // Refusal flow: collaborator took notice but refused to sign (CLT — recusa de assinatura).
  refused: boolean;
  refusedReason: string | null;
  // The HR/witness user who registered the refusal on the collaborator's behalf.
  registeredById: string | null;

  biometricMethod: WarningSignatureBiometricMethod;
  biometricSuccess: boolean;
  clientTimestamp: Date;
  serverTimestamp: Date;
  hmacSignature: string;

  // PAdES seal (ICP-Brasil) applied server-side after the biometric/HMAC flow.
  padesSealed: boolean;
  padesSealedAt: Date | null;
  certSubject: string | null;
  certCnpj: string | null;

  signedDocumentId: string | null;

  // Relations
  signedByUser?: Pick<User, "id" | "name"> & Partial<User>;
  registeredBy?: (Pick<User, "id" | "name"> & Partial<User>) | null;
  signedDocument?: File | null;
}

// Shape of an item in WarningSignatureVerifyResponse.signatures.
export interface WarningSignatureEvent {
  signatureId: string;
  signerRole: WarningSignerRole;
  valid: boolean;
}

export interface WarningSignatureVerifyResponse {
  valid: boolean;
  signatures: WarningSignatureEvent[];
  details?: string;
}

export interface Warning extends BaseEntity {
  severity: WARNING_SEVERITY;
  severityOrder: number; // 1=Verbal, 2=Escrita, 3=Suspensão, 4=Advertência Final
  category: WARNING_CATEGORY;
  reason: string;
  description: string | null;
  isActive: boolean;
  collaboratorId: string;
  supervisorId: string;
  // Dias de suspensão (severity = SUSPENSION). CLT art. 474 limita a 30 dias.
  suspensionDays: number | null;
  // Rescisão por justa causa que esta advertência fundamenta (opcional).
  terminationId: string | null;
  followUpDate: Date;
  hrNotes: string | null;
  resolvedAt: Date | null;
  // When true, the warning auto-resolves once followUpDate passes without recurrence.
  // Never honored for SUSPENSION / FINAL_WARNING (grave measures require manual closure).
  autoResolve: boolean;
  // Set by the API when the warning was closed automatically by decurso de prazo.
  autoResolved: boolean;

  // Relations (optional, populated based on query)
  collaborator?: User;
  supervisor?: User;
  witness?: User[];
  attachments?: File[];
  // Returned by GET /warnings/:id by default.
  signatures?: WarningSignature[];
}

// =====================
// Include Types
// =====================

export interface WarningIncludes {
  collaborator?:
    | boolean
    | {
        include?: UserIncludes;
      };
  supervisor?:
    | boolean
    | {
        include?: UserIncludes;
      };
  witness?:
    | boolean
    | {
        include?: UserIncludes;
      };
  attachments?:
    | boolean
    | {
        include?: FileIncludes;
      };
}

// =====================
// Order By Types
// =====================

export interface WarningOrderBy {
  id?: ORDER_BY_DIRECTION;
  severity?: ORDER_BY_DIRECTION;
  category?: ORDER_BY_DIRECTION;
  reason?: ORDER_BY_DIRECTION;
  description?: ORDER_BY_DIRECTION;
  isActive?: ORDER_BY_DIRECTION;
  followUpDate?: ORDER_BY_DIRECTION;
  hrNotes?: ORDER_BY_DIRECTION;
  resolvedAt?: ORDER_BY_DIRECTION;
  createdAt?: ORDER_BY_DIRECTION;
  updatedAt?: ORDER_BY_DIRECTION;
  collaboratorId?: ORDER_BY_DIRECTION;
  supervisorId?: ORDER_BY_DIRECTION;
  collaborator?: UserOrderBy;
  supervisor?: UserOrderBy;
}

// =====================
// Response Interfaces
// =====================

export interface WarningGetUniqueResponse extends BaseGetUniqueResponse<Warning> {}
export interface WarningGetManyResponse extends BaseGetManyResponse<Warning> {}
export interface WarningCreateResponse extends BaseCreateResponse<Warning> {}
export interface WarningUpdateResponse extends BaseUpdateResponse<Warning> {}
export interface WarningDeleteResponse extends BaseDeleteResponse {}

// =====================
// Batch Operation Responses
// =====================

export interface WarningBatchCreateResponse<T> extends BaseBatchResponse<Warning, T> {}
export interface WarningBatchUpdateResponse<T> extends BaseBatchResponse<Warning, T & { id: string }> {}
export interface WarningBatchDeleteResponse extends BaseBatchResponse<{ id: string; deleted: boolean }, { id: string }> {}
