import type { BadgeProps } from "@/components/ui/badge";

export const DOC_TYPE_LABEL: Record<string, string> = {
  NFE: "NF-e",
  NFSE: "NFS-e",
  CTE: "CT-e",
  NFCE: "NFC-e",
  CFE: "CF-e",
};

/**
 * Distinct hue per document family so the type column reads at a glance —
 * NFe (mercadoria) ≠ NFSe (serviço) ≠ CTe (transporte).
 */
export const DOC_TYPE_VARIANT: Record<string, BadgeProps["variant"]> = {
  NFE: "blue",
  NFSE: "purple",
  CTE: "teal",
  NFCE: "cyan",
  CFE: "pink",
};

export function docTypeVariant(docType: string): BadgeProps["variant"] {
  return DOC_TYPE_VARIANT[docType] ?? "blue";
}

export function docTypeLabel(docType: string): string {
  return DOC_TYPE_LABEL[docType] ?? docType;
}
