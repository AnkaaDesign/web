// web/src/components/cliente/orcamento/waiting-on.ts
//
// "O QUE ESPERA POR MIM" — a coluna que o cliente lê primeiro.
//
// É DERIVADA do estado, não um campo. A máquina de estados do orçamento (§1 do
// contrato, §4.2 do desenho) já responde "quem está devendo" em cada um dos oito
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
 * vendedor do cliente pré-aprova ou recusa. Foi o estado que o desenho chamou
 * de `PRE_APPROVAL`; `PRE_APPROVED` é o RESULTADO, e aí a bola volta para a
 * Ankaa emitir a coleta de assinatura.
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
    detail: "Aguardando sua pré-aprovação — ou a recusa, que devolve o orçamento para ser refeito.",
    tone: "mine",
  },
  PRE_APPROVED: {
    label: "Com a Ankaa",
    detail: "Pré-aprovado. A Ankaa vai emitir o documento para assinatura.",
    tone: "ankaa",
  },
  // ⚠️ ESTE É O ÚNICO ESTADO QUE A DEDUÇÃO NÃO RESOLVE — ver
  // `portalWaitingOn` abaixo. O que está aqui é o caso em que a coleta foi
  // emitida e a assinatura é de OUTRO responsável: o estado é do cliente, mas
  // a vez não é desta pessoa.
  PENDING: {
    label: "Em coleta",
    detail: "O documento está em coleta de assinaturas. Nada depende de você aqui.",
    tone: "none",
  },
  SIGNED: {
    label: "Com a Ankaa",
    detail: "Assinado. Falta a aprovação interna da Ankaa para o serviço entrar na fila.",
    tone: "ankaa",
  },
  APPROVED: {
    label: "Em andamento",
    detail: "Aprovado — daqui em diante quem anda é a produção e a cobrança.",
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

/** Emitido? Não: então a bola voltou para a Ankaa, por mais que o estado diga "Aguardando Assinatura". */
const NAO_EMITIDO: PortalWaitingOn = {
  label: "Com a Ankaa",
  detail: "A Ankaa ainda não emitiu o documento para assinatura.",
  tone: "ankaa",
};

/**
 * De quem é a vez.
 *
 * ⛔ `PENDING` É A EXCEÇÃO, e foi ela que provou que a dedução pura não basta.
 * O estado responde "onde o orçamento está", e para sete dos oito valores isso
 * é suficiente. Para `PENDING` não é, de duas maneiras ao mesmo tempo:
 *
 *   1. "Aguardando a assinatura dos responsáveis" não quer dizer ESTE
 *      responsável — quem já assinou continuava lendo "Com você";
 *   2. e um orçamento pode estar em `PENDING` sem coleta nenhuma emitida. No
 *      acervo do dono eram **18 de 18** assim. A lista anunciava dezoito
 *      documentos esperando por ele, e a tela de Assinaturas — que olha a
 *      realidade, e não o estado — dizia, corretamente, "Nada para assinar".
 *
 * Por isso o segundo argumento. Ele é OPCIONAL de propósito: sem ele a função
 * devolve a leitura pelo estado, que é o que ela sempre fez e continua correto
 * para os outros sete. Quem tem o fato na mão (`budget.signature`, vindo do
 * servidor) passa e recebe a verdade.
 */
export function portalWaitingOn(
  status: TASK_QUOTE_STATUS | string | null | undefined,
  signature?: { emitted: boolean; awaitingMe: boolean } | null,
): PortalWaitingOn {
  if (!status) return UNKNOWN;
  const chave = String(status).toUpperCase() as TASK_QUOTE_STATUS;

  if (chave === "PENDING" && signature) {
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
