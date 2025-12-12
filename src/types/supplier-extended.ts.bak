/**
 * Extended Supplier Types
 *
 * This file contains extended supplier types that include document management fields.
 * These types are used when the supplier schema includes document relations.
 *
 * Note: The backend schema needs to be updated to include these fields.
 * This file serves as a forward-compatible type definition.
 */

import type { Supplier } from "./supplier";
import type { File as AnkaaFile } from "./file";

/**
 * Extended supplier type with document support
 */
export interface SupplierWithDocuments extends Supplier {
  // Contract documents (e.g., service agreements, purchase contracts)
  contracts?: AnkaaFile[];
  contractIds?: string[];

  // Certificate documents (e.g., quality certificates, compliance docs)
  certificates?: AnkaaFile[];
  certificateIds?: string[];

  // Other documents (e.g., invoices, receipts, misc documents)
  otherDocuments?: AnkaaFile[];
  otherDocumentIds?: string[];
}

/**
 * Document category type for supplier documents
 */
export type SupplierDocumentCategory = "contract" | "certificate" | "other";

/**
 * Document upload data for supplier forms
 */
export interface SupplierDocumentUpload {
  category: SupplierDocumentCategory;
  files: File[];
}

/**
 * Helper type for form data with document uploads
 */
export interface SupplierFormDataWithDocuments {
  // Standard supplier fields
  fantasyName: string;
  cnpj?: string | null;
  corporateName?: string | null;
  email?: string | null;
  address?: string | null;
  addressNumber?: string | null;
  addressComplement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  site?: string | null;
  phones?: string[];
  logoId?: string | null;
  logoFile?: File | null;

  // Document fields
  contractFiles?: File[];
  certificateFiles?: File[];
  otherDocumentFiles?: File[];

  // Existing document IDs (for updates)
  contractIds?: string[];
  certificateIds?: string[];
  otherDocumentIds?: string[];
}
