import { apiClient } from "./axiosClient";
import type { QuoteChange } from "@/components/signature/quote-change-list";

/**
 * Cliente da assinatura eletrônica do orçamento.
 *
 * As rotas `/assinatura/publico/*` são autenticadas pelo TOKEN do signatário —
 * um valor opaco de 256 bits que vem no link pessoal. Não há sessão nem
 * cabeçalho de autorização envolvidos, então esta página funciona deslogada.
 */

/** Canal de entrega do convite e do código. Espelha `SignatureDeliveryChannel` na api. */
export type DeliveryChannel = "WHATSAPP" | "EMAIL";

/** Modo configurado no servidor (`SIGNATURE_DELIVERY_CHANNEL`). */
export type DeliveryMode = "whatsapp" | "email" | "both";

export interface DeliverySettings {
  mode: DeliveryMode;
  /** Canais que o modo permite. Comprimento 1 = seletor não deve aparecer. */
  channels: DeliveryChannel[];
  defaultChannel: DeliveryChannel;
}

export const DELIVERY_CHANNEL_LABELS: Record<DeliveryChannel, string> = {
  WHATSAPP: "WhatsApp",
  EMAIL: "E-mail",
};

/**
 * As seções recortáveis do orçamento. Espelha `QUOTE_SECTIONS` na api — a ORDEM
 * é canônica e define a chave de deduplicação do recorte lá.
 */
export const QUOTE_SECTIONS = [
  "VEHICLE",
  "SERVICES",
  "PRICING",
  "DELIVERY",
  "PAYMENT",
  "GUARANTEE",
  "LAYOUT",
] as const;

export type QuoteSection = (typeof QUOTE_SECTIONS)[number];

export const QUOTE_SECTION_LABELS: Record<QuoteSection, string> = {
  VEHICLE: "Identificação do veículo",
  SERVICES: "Lista de serviços",
  PRICING: "Valores e desconto",
  DELIVERY: "Prazo de entrega",
  PAYMENT: "Condições de pagamento",
  GUARANTEE: "Garantias",
  LAYOUT: "Layout",
};

/** Quem recebe o convite, por onde é possível alcançá-lo, e o que ele recebe. */
export interface PreflightRecipient {
  id: string;
  name: string;
  phoneMasked: string;
  emailMasked: string;
  hasPhone: boolean;
  hasEmail: boolean;
  /** Funções do cadastro — é delas que sai o recorte padrão. */
  roles: string[];
  rolesLabel: string;
  /**
   * O recorte PADRÃO deste contato. Vazio = ele não entra na coleta, que é o
   * estado inicial do gestor de frota e do motorista.
   */
  sections: QuoteSection[];
  sectionsLabel: string;
}

export interface PreflightChannelStatus {
  /** Todos alcançáveis por este canal (inclusive o signatário da Ankaa). */
  ready: boolean;
  /** Nomes dos responsáveis sem o contato deste canal. */
  missing: string[];
  /** Nome do representante da Ankaa, quando é ELE quem está sem o contato. */
  ankaaMissing: string | null;
}

/**
 * Tudo o que o modal de envio precisa saber ANTES do ato.
 *
 * Existe porque validar só no POST fazia o operador descobrir "fulano não tem
 * e-mail" DEPOIS de confirmar, sem meio de saber que o outro canal funcionaria.
 */
export interface DeliveryPreflight extends DeliverySettings {
  /** Impedem qualquer canal (coleta em andamento, orçamento vencido, sem responsável). */
  blockers: string[];
  recipients: PreflightRecipient[];
  /** Catálogo das seções, com rótulo e descrição — a tela desenha as caixas daqui. */
  sectionCatalog: Array<{ key: QuoteSection; label: string; description: string }>;
  ankaa: {
    name: string;
    hasPhone: boolean;
    hasEmail: boolean;
    /**
     * A Ankaa contra-assina DENTRO do sistema, em sessão autenticada. O contato
     * serve só para o aviso de que o cliente terminou — por isso a falta dele
     * deixou de impedir a emissão e virou apenas um aviso na tela.
     */
    reachable: boolean;
  } | null;
  channelStatus: Record<DeliveryChannel, PreflightChannelStatus>;
  /**
   * Identificação do veículo no momento do envio. Aviso, nunca bloqueio.
   *
   * O documento é congelado com o que existe AGORA: placa e chassi preenchidos
   * depois não entram nele — nem podem, é o documento que foi assinado. É o caso
   * comum do implemento 0 km, orçado antes de emplacar.
   */
  vehicle: { plate: string | null; chassisNumber: string | null; missing: string[] } | null;
}

export interface PublicSignerState {
  envelope: {
    id: string;
    status: string;
    budgetNumber: number;
    /**
     * `null` quando o recorte deste signatário NÃO exibe valores.
     *
     * A página imprimia este total no cabeçalho, e mostrá-lo a quem recebeu um
     * documento sem preço desfaria a decisão inteira de não lhe mostrar o valor.
     */
    total: string | null;
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
  /** O recorte que ESTE signatário recebeu. */
  document: {
    sections: QuoteSection[];
    /** "Documento completo", "Layout", "Somente texto básico"… */
    label: string;
    isFull: boolean;
    sha256: string;
  };
  signer: {
    id: string;
    name: string;
    /**
     * `INTERNAL` é o lado da Ankaa, que contra-assina no painel do orçamento com
     * a sessão autenticada — sem CPF, sem cargo e sem código. A página pública
     * dele serve só para conferir o documento.
     */
    ceremony: "OTP" | "INTERNAL";
    /** @deprecated Use `contactMasked` — vale só quando `channel === "EMAIL"`. */
    emailMasked: string;
    /** @deprecated Use `contactParts` — vale só quando `channel === "EMAIL"`. */
    emailParts: { prefix: string; hiddenLength: number; suffix: string; domain: string };
    /**
     * Canal em que ESTA coleta foi emitida. Gravado no signatário na emissão,
     * não lido da configuração atual: uma coleta em andamento continua no canal
     * em que nasceu mesmo que o servidor mude de modo depois.
     */
    channel: DeliveryChannel;
    /** Contato mascarado do canal — e-mail ou telefone, conforme `channel`. */
    contactMasked: string;
    /**
     * Partes da máscara do contato, para o campo de confirmação parcial.
     * `domain` vem vazio no WhatsApp (telefone não tem domínio).
     */
    contactParts: { prefix: string; hiddenLength: number; suffix: string; domain: string };
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
  /** Só em `ceremony === "INTERNAL"`: diz onde o ato de fato acontece. */
  internalNotice?: string;
}

/** Um dos PDFs congelados por uma coleta. */
export interface EnvelopeDocumentSummary {
  id: string;
  variantKey: string;
  sections: QuoteSection[];
  label: string;
  isFull: boolean;
  originalSha256: string;
  finalSha256: string | null;
  padesLevel: string | null;
  sealedAt: string | null;
  /** Nomes dos signatários amarrados a este recorte. */
  signers: string[];
}

export const signatureService = {
  // ---- público (token do signatário) ----
  getPublicState: (token: string) => apiClient.get(`/assinatura/publico/${token}`),

  documentUrl: (token: string) =>
    `${apiClient.defaults.baseURL ?? ""}/assinatura/publico/${token}/document.pdf`,

  requestCode: (
    token: string,
    data: { cpf: string; cargo: string; contactConfirm: string },
  ) =>
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
  /**
   * Modo de entrega configurado no servidor.
   *
   * A tela precisa disto ANTES de desenhar o botão de envio: no modo fixo não há
   * seletor, no modo `both` há. Rota sem parâmetro de propósito — não depende do
   * orçamento.
   */
  getDeliverySettings: () => apiClient.get(`/signature-envelopes/delivery-settings`),

  /**
   * Canais permitidos + quem está alcançável em cada um, para ESTE orçamento.
   *
   * Chamado ao abrir o modal, não no carregamento da página: é uma leitura do
   * grafo da tarefa e só interessa a quem vai de fato enviar.
   */
  getDeliveryPreflight: (quoteId: string) =>
    apiClient.get(`/signature-envelopes/quote/${quoteId}/delivery-preflight`),

  /**
   * Emite a coleta. `channel` só é honrado quando o servidor está em `both`;
   * nos modos fixos ele é ignorado e o canal configurado prevalece.
   */
  /**
   * Emite a coleta. `channel` só é honrado quando o servidor está em `both`;
   * nos modos fixos ele é ignorado e o canal configurado prevalece.
   *
   * `signers` é MAPA DE EXCEÇÕES, não roster: mandar só os contatos cujo recorte
   * o operador mexeu. Quem não vier cai no padrão das funções — e é isso que
   * impede uma tela aberta antes de alguém acrescentar um responsável de emitir
   * a coleta sem ele.
   */
  createEnvelope: (
    quoteId: string,
    data?: {
      channel?: DeliveryChannel | null;
      signers?: Array<{ responsibleId: string; sections: QuoteSection[] }>;
    },
  ) => apiClient.post(`/signature-envelopes/quote/${quoteId}`, data ?? {}),

  /**
   * Contra-assinatura da Ankaa — um POST, sem código.
   *
   * A autenticação é a sessão do próprio sistema; o servidor confere que quem
   * chama é O signatário designado do envelope.
   */
  countersign: (envelopeId: string) =>
    apiClient.post(`/signature-envelopes/${envelopeId}/contra-assinar`),

  listForQuote: (quoteId: string) => apiClient.get(`/signature-envelopes/quote/${quoteId}`),

  auditTrail: (envelopeId: string) => apiClient.get(`/signature-envelopes/${envelopeId}/audit-trail`),

  cancel: (envelopeId: string) => apiClient.post(`/signature-envelopes/${envelopeId}/cancel`),

  /** Reenvia o convite para um signatário, no canal em que a coleta foi emitida. */
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
  openInternalDocument: async (envelopeId: string, documentId?: string | null): Promise<void> => {
    const res: any = await apiClient.get(
      `/signature-envelopes/${envelopeId}/document.pdf`,
      {
        responseType: "blob",
        metadata: { suppressToast: true },
        // `?recorte=` serve UM dos PDFs congelados. Sem ele vem o completo, que
        // é o instrumento e o que o operador quer ver por padrão.
        ...(documentId ? { params: { recorte: documentId } } : {}),
      } as any,
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
