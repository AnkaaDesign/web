/**
 * Contrato da verificação de autenticidade (`GET /assinatura/verificar/:code`).
 *
 * Compartilhado entre o portal público (`/v/:code`) e o validador interno em
 * Ferramentas — os dois leem a MESMA resposta e precisam dizer a mesma coisa
 * sobre o mesmo código. Rótulos divergentes entre as telas seriam o pior bug
 * possível numa ferramenta cuja única função é afirmar se um documento vale.
 */

export interface VerificationData {
  verificationCode: string;
  status: string;
  budgetNumber: number;
  issuer: { name: string; cnpj: string };
  customer: { name: string | null; cnpj: string | null };
  originalSha256: string;
  finalSha256: string | null;
  sealedAt: string | null;
  padesLevel: string | null;
  certSerialNumber: string | null;
  auditChain: { valid: boolean; events: number; reason: string | null };
  /**
   * Os RECORTES desta coleta — um PDF cada, com hash próprio.
   *
   * Sem esta lista o portal só conhecia o hash do documento completo e diria
   * "não confere" para o artefato legítimo de um signatário que recebeu um
   * recorte — o pior resultado possível numa página cuja única função é dizer se
   * um documento é verdadeiro. Ausente em envelopes servidos por uma API
   * anterior ao recurso.
   */
  /**
   * O ADITIVO de identificação do veículo, quando existe.
   *
   * Entra no portal porque ele É parte do instrumento: quem confere o orçamento
   * assinado de um implemento 0 km encontra "a registrar" no lugar do chassi, e
   * precisa saber que existe uma folha selada declarando qual é.
   */
  addendum?: {
    sha256: string | null;
    sealedAt: string | null;
    padesLevel: string | null;
  } | null;
  documents?: Array<{
    label: string;
    isFull: boolean;
    originalSha256: string;
    finalSha256: string | null;
    padesLevel: string | null;
    sealedAt: string | null;
  }>;
  signers: Array<{
    name: string;
    cargo: string | null;
    cpfMasked: string | null;
    status: string;
    signedAt: string | null;
    authMethod: string;
  }>;
}

/** Rótulos legíveis — não vaze o enum cru para quem verifica o documento. */
export const AUTH_LABEL: Record<string, string> = {
  EMAIL_OTP: "Código de uso único via e-mail",
  // WHATSAPP_OTP e SMS_OTP ficam para sempre: documentos assinados antes da
  // troca de canal precisam continuar exibindo o método que de fato os autenticou.
  WHATSAPP_OTP: "Código de uso único via WhatsApp",
  SMS_OTP: "Código de uso único via SMS",
  INTERNAL_SESSION: "Sessão autenticada Ankaa",
};

export type Tone = "ok" | "warn" | "bad";

export const STATUS_LABEL: Record<string, { text: string; tone: Tone }> = {
  COMPLETED: { text: "Assinado e selado", tone: "ok" },
  RUNNING: { text: "Aguardando assinaturas", tone: "warn" },
  INVALIDATED: { text: "Invalidado por alteração do orçamento", tone: "bad" },
  REFUSED: { text: "Recusado por um signatário", tone: "bad" },
  EXPIRED: { text: "Prazo expirado", tone: "bad" },
  CANCELLED: { text: "Cancelado", tone: "bad" },
  SUPERSEDED: { text: "Substituído por versão mais recente", tone: "warn" },
  DRAFT: { text: "Rascunho", tone: "warn" },
};

/**
 * Estado de cada signatário no roster. Sem isto, um signatário que RECUSOU
 * aparecia como "Pendente" — a página dizia "Recusado por um signatário" no
 * veredito e, logo abaixo, mostrava todo mundo como pendente, sem apontar quem.
 */
export const SIGNER_STATE: Record<string, { label: string; icon: "ok" | "bad" | "wait" }> = {
  SIGNED: { label: "Assinado", icon: "ok" },
  REFUSED: { label: "Recusou", icon: "bad" },
  VOIDED: { label: "Anulado", icon: "bad" },
  EXPIRED: { label: "Expirado", icon: "wait" },
  VIEWED: { label: "Visualizado", icon: "wait" },
};
