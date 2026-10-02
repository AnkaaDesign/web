// web/src/components/cliente/orcamento/waiting-on.ts
//
// "O QUE ESPERA POR MIM" — a coluna que o cliente lê primeiro.
//
// É DERIVADA do estado, não um campo. A máquina de estados do orçamento (§1 do
// contrato, §4.2 do desenho) já responde "quem está devendo" em quase todos os
// valores; guardar isso numa coluna criaria um segundo lugar onde a resposta
// pode ficar velha.
//
// ⚠️ NÃO redeclara rótulo nem cor de estado: quem faz isso é
// `QUOTE_STATUS_CONFIG`. Aqui é a OUTRA pergunta — o estado diz onde o
// orçamento está, isto diz de quem é a vez.
import type { TASK_QUOTE_STATUS } from "@/types/budget";

/**
 * `mine` = a bola está com o cliente (ele tem algo a fazer).
 * `ankaa` = a bola está com a Ankaa.
 * `none` = ninguém está devendo nada nesta tela.
 */
export type PortalWaitingTone = "mine" | "ankaa" | "none";

export interface PortalWaitingOn {
  /** O texto curto da coluna da lista. */
  label: string;
  /** A frase inteira, para o `title` da célula e para o detalhe. */
  detail: string;
  tone: PortalWaitingTone;
}

/**
 * ⚠️ `IN_NEGOTIATION` é do CLIENTE, e é a razão de ser do portal: é nele que o
 * contato do cliente APROVA O VALOR ou recusa (D-35). Aprovado, a bola volta
 * para a Ankaa: arte de cada veículo e emissão da coleta de assinatura — a
 * assinatura é um eixo próprio, lido do segundo argumento de `portalWaitingOn`.
 */
export const PORTAL_WAITING_BY_STATUS: Record<TASK_QUOTE_STATUS, PortalWaitingOn> = {
  REQUESTED: {
    label: "Com a Ankaa",
    detail: "Requisição recebida. A Ankaa está montando o orçamento.",
    tone: "ankaa",
  },
  EXPIRED: {
    label: "Com a Ankaa",
    detail: "A validade venceu sem assinatura. O orçamento voltou para reanálise da Ankaa.",
    tone: "ankaa",
  },
  IN_NEGOTIATION: {
    label: "Com você",
    detail: "Aguardando a sua aprovação do valor — ou a recusa, que devolve o orçamento para ser refeito.",
    tone: "mine",
  },
  // Em montagem ou revisão pela Ankaa (no Modelo C, PENDING não é mais "em coleta").
  PENDING: {
    label: "Com a Ankaa",
    detail: "A Ankaa está montando ou revisando o orçamento.",
    tone: "ankaa",
  },
  // LEGADO: nenhum orçamento é gravado assim desde que a assinatura virou eixo próprio.
  SIGNED: {
    label: "Com a Ankaa",
    detail: "Assinado. Falta a Ankaa concluir.",
    tone: "ankaa",
  },
  // ⚠️ O ÚNICO QUE A DEDUÇÃO NÃO RESOLVE SOZINHA — ver `portalWaitingOn` abaixo:
  // valor aprovado, e a vez depende da ASSINATURA (emitida? falta a minha?).
  APPROVED: {
    label: "Em andamento",
    detail: "Valor aprovado — daqui em diante andam a arte, a assinatura, a produção e a cobrança.",
    tone: "none",
  },
  CANCELLED: {
    label: "—",
    detail: "Orçamento cancelado.",
    tone: "none",
  },
};

const UNKNOWN: PortalWaitingOn = { label: "—", detail: "", tone: "none" };

/** Aguardando a MINHA assinatura — o caso em que a vez é mesmo desta pessoa. */
const MINHA_ASSINATURA: PortalWaitingOn = {
  label: "Com você",
  detail: "O documento está emitido e aguarda a SUA assinatura.",
  tone: "mine",
};

/** Valor aprovado e documento ainda não emitido: a bola está com a Ankaa. */
const NAO_EMITIDO: PortalWaitingOn = {
  label: "Com a Ankaa",
  detail: "Valor aprovado. A Ankaa vai emitir o documento para assinatura.",
  tone: "ankaa",
};

/**
 * De quem é a vez.
 *
 * O estado do VALOR responde "onde o orçamento está", e para quase todos os
 * valores isso basta. Para `APPROVED` não: o valor está aprovado, e a vez passa
 * a depender da ASSINATURA — emitida e esperando a minha (`mine`), emitida e
 * esperando outro (`none`), ou ainda não emitida (`ankaa`). Por isso o segundo
 * argumento, OPCIONAL: sem ele a função devolve a leitura pelo estado.
 */
export function portalWaitingOn(
  status: TASK_QUOTE_STATUS | string | null | undefined,
  signature?: { emitted: boolean; awaitingMe: boolean } | null,
): PortalWaitingOn {
  if (!status) return UNKNOWN;
  const chave = String(status).toUpperCase() as TASK_QUOTE_STATUS;

  if (chave === "APPROVED" && signature) {
    if (signature.awaitingMe) return MINHA_ASSINATURA;
    if (!signature.emitted) return NAO_EMITIDO;
  }

  return PORTAL_WAITING_BY_STATUS[chave] ?? UNKNOWN;
}

/** As classes da etiqueta de "de quem é a vez". Discreta de propósito: a cor forte da linha é a do ESTADO. */
export const PORTAL_WAITING_TONE_CLASS: Record<PortalWaitingTone, string> = {
  mine: "text-foreground font-medium",
  ankaa: "text-muted-foreground",
  none: "text-muted-foreground",
};
