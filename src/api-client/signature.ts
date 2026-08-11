import { apiClient } from "./axiosClient";
import type { QuoteChange } from "@/components/signature/quote-change-list";

/**
 * Cliente da assinatura eletrônica do orçamento.
 *
 * As rotas `/assinatura/publico/*` são autenticadas pelo TOKEN do signatário —
 * um valor opaco de 256 bits que vem no link pessoal. Não há sessão nem
 * cabeçalho de autorização envolvidos, então esta página funciona deslogada.
 */

export interface PublicSignerState {
  envelope: {
    id: string;
    status: string;
    budgetNumber: number;
    total: string;
    deadlineAt: string;
    verificationCode: string;
    acceptanceClause: string;
    /** Preenchido quando a coleta caiu por alteração material do orçamento. */
    invalidatedReason?: string | null;
    /**
     * O que mudou desde que este documento foi congelado.
     *
     * Vem para o signatário pela mesma razão que vem para o operador: quem foi
     * desvinculado por uma alteração tem o direito de conferir qual foi.
     */
    changes?: QuoteChange[];
  };
  signer: {
    id: string;
    name: string;
    /** Sempre mascarado. O signatário confirma o número, nunca o escolhe. */
    emailMasked: string;
    /** Partes da máscara, para o campo de confirmação parcial. */
    emailParts: { prefix: string; hiddenLength: number; suffix: string; domain: string };
    /**
     * Âncoras do CPF cadastrado (3 primeiros + 2 verificadores), para a
     * confirmação parcial. Null quando o cadastro não tem CPF — aí o signatário
     * informa o documento inteiro.
     */
    cpfParts: { prefix: string; hiddenLength: number; suffix: string } | null;
    /** CPF do CADASTRO, já mascarado pelo servidor. Existe antes da conferência. */
    cpfMasked: string | null;
    status: string;
    cargo: string | null;
    /** Cargo vindo do cadastro (Responsible.roles). Null quando não há função registrada. */
    registryCargo: string | null;
    signedAt: string | null;
  };
  company: { name: string; cnpj: string | null };
  declarations: Array<{ key: string; text: string }>;
  canSign: boolean;
}

export const signatureService = {
  // ---- público (token do signatário) ----
  getPublicState: (token: string) => apiClient.get(`/assinatura/publico/${token}`),

  documentUrl: (token: string) =>
    `${apiClient.defaults.baseURL ?? ""}/assinatura/publico/${token}/document.pdf`,

  requestCode: (token: string, data: { cpf: string; cargo: string; emailConfirm: string }) =>
    // `suppressToast`: o interceptor de sucesso do axiosClient toasta TODO write,
    // e esta rota não devolve `message` — então o cliente via um "Criado com
    // sucesso" genérico por cima do "Código enviado para +55 43 9****-2403" que
    // a página já mostra. A página é dona da mensagem aqui.
    apiClient.post(`/assinatura/publico/${token}/codigo`, data, {
      metadata: { suppressToast: true },
    } as any),

  sign: (
    token: string,
    data: {
      challengeId: string;
      code: string;
      declarations: string[];
      clientTimestamp?: string;
      geo?: { lat: number; lon: number; accuracy?: number } | null;
    },
  ) => apiClient.post(`/assinatura/publico/${token}/assinar`, data),

  /**
   * Recusa — exige o MESMO desafio OTP verificado que a assinatura exige
   * (`signatureRefuseSchema` no servidor). Sem isso, quem recebesse o link
   * encaminhado matava o negócio anonimamente.
   */
  refuse: (token: string, data: { challengeId: string; code: string; reason: string }) =>
    apiClient.post(`/assinatura/publico/${token}/recusar`, data),

  verify: (code: string) => apiClient.get(`/assinatura/verificar/${code}`),

  /**
   * Dossiê montado no SERVIDOR: páginas do orçamento assinado + dossiê
   * fotográfico + notas + boletos, com o PDF assinado anexado.
   *
   * `responseType: "blob"` e não uma URL direta: a rota é autenticada, e um
   * `window.open` não carregaria o cabeçalho de autorização.
   *
   * `customerId` recorta nota e boleto para um dos clientes do faturamento —
   * sem ele, um faturamento de dois clientes entrega a nota e o boleto dos dois
   * a quem pediu o dossiê de um só.
   */
  downloadDossier: (quoteId: string, customerId?: string | null) =>
    apiClient.get(`/signature-envelopes/quote/${quoteId}/dossie.pdf`, {
      responseType: "blob",
      ...(customerId ? { params: { cliente: customerId } } : {}),
    }),

  /** Resumo da coleta pela chave do orçamento — alimenta /cliente/orcamento/:id. */
  getQuoteSummary: (quoteId: string) => apiClient.get(`/assinatura/publico/orcamento/${quoteId}`),

  /** PDF da coleta corrente. Rota pública: mesma capability da página (o UUID do orçamento). */
  quoteDocumentUrl: (quoteId: string) =>
    `${apiClient.defaults.baseURL ?? ""}/assinatura/publico/orcamento/${quoteId}/documento.pdf`,

  // ---- interno ----
  createEnvelope: (quoteId: string) => apiClient.post(`/signature-envelopes/quote/${quoteId}`),

  listForQuote: (quoteId: string) => apiClient.get(`/signature-envelopes/quote/${quoteId}`),

  auditTrail: (envelopeId: string) => apiClient.get(`/signature-envelopes/${envelopeId}/audit-trail`),

  cancel: (envelopeId: string) => apiClient.post(`/signature-envelopes/${envelopeId}/cancel`),

  /** Reenvia o convite por e-mail para um signatário. */
  resendInvitation: (signerId: string) =>
    apiClient.post(`/signature-envelopes/signers/${signerId}/resend`),

  /**
   * Abre o PDF interno numa nova aba.
   *
   * NÃO pode ser um `<a href>`: a rota interna está atrás do AuthGuard global,
   * que lê o token do cabeçalho Authorization, e uma navegação de topo não envia
   * cabeçalho nenhum — dava 401. Buscar como blob pelo axios (que injeta o
   * token) e abrir um object URL resolve, e de quebra o PDF nunca trafega numa
   * URL que possa vazar em histórico ou referer.
   */
  openInternalDocument: async (envelopeId: string): Promise<void> => {
    const res: any = await apiClient.get(
      `/signature-envelopes/${envelopeId}/document.pdf`,
      { responseType: "blob", metadata: { suppressToast: true } } as any,
    );
    const blob = res?.data instanceof Blob ? res.data : new Blob([res?.data], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank", "noopener");
    if (!win) {
      // Bloqueador de pop-up: cai para download.
      //
      // O nome vem do `Content-Disposition` que a rota manda (razão social +
      // "Orçamento" + número), e NÃO é remontado aqui: quem chama esta função
      // tem o id do envelope e mais nada — era por isso que o fallback gravava
      // `orcamento-assinado-3f2a1b8c.pdf`, um nome que não dizia de quem era o
      // orçamento nem qual era o número.
      const a = document.createElement("a");
      a.href = url;
      a.download = filenameFromDisposition(res?.headers?.["content-disposition"]) ?? "Orçamento.pdf";
      a.click();
    }
    // Revoga depois que o navegador teve tempo de carregar.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  },
};

/**
 * Nome de arquivo anunciado pelo servidor no `Content-Disposition`.
 *
 * `filename*` primeiro: é o parâmetro que carrega UTF-8 (RFC 5987), e razão
 * social brasileira tem acento. O `filename=` puro é o recuo, e vem sem acento
 * por construção — a especificação o define como ISO-8859-1.
 */
export function filenameFromDisposition(header: unknown): string | null {
  if (typeof header !== "string") return null;
  const utf8 = /filename\*=UTF-8''([^;]+)/i.exec(header);
  if (utf8?.[1]) {
    try {
      return decodeURIComponent(utf8[1].trim());
    } catch {
      /* cai para o filename simples */
    }
  }
  return /filename="([^"]+)"/i.exec(header)?.[1] ?? null;
}
