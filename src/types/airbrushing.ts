// packages/interfaces/src/airbrushing.ts

import type { BaseEntity, BaseGetUniqueResponse, BaseGetManyResponse, BaseCreateResponse, BaseUpdateResponse, BaseDeleteResponse, BaseBatchResponse } from "./common";
import type {
  AIRBRUSHING_STATUS,
  AIRBRUSHING_PAYMENT_STATUS,
  AIRBRUSHING_DUE_DATE_RULE,
  AIRBRUSHING_QUOTE_STATUS,
  AIRBRUSHING_QUOTE_PARTY,
  AIRBRUSHING_QUOTE_ACTION,
  EXECUTION_TIME_UNIT,
  PAYMENT_METHOD,
  ORDER_BY_DIRECTION,
  NFSE_STATUS,
  NFSE_ENVIRONMENT,
} from "../constants";
import type { Task, TaskIncludes, TaskOrderBy } from "./task";
import type { File, FileIncludes } from "./file";
import type { User, UserIncludes } from "./user";

// =====================
// Main Entity Interface
// =====================

export interface Airbrushing extends BaseEntity {
  startDate: Date | null; // Expected/planned start date
  finishDate: Date | null; // Expected/planned finish date — derived by the API from startDate + execution time when both exist
  /** Tempo de execução (inteiro 1–999). Com a unidade, a API deriva `finishDate` do `startDate`. */
  executionTime?: number | null;
  executionTimeUnit?: EXECUTION_TIME_UNIT | null;
  startedAt: Date | null; // Actual start timestamp
  finishedAt: Date | null; // Actual finish timestamp
  price: number | null;
  /** Free-text job spec / notes for the airbrushing. */
  description: string | null;
  status: AIRBRUSHING_STATUS; // "Pendente", "Em Produção", "Finalizado", "Cancelado"
  statusOrder: number; // 1=Pendente, 2=Em Produção, 3=Finalizado, 4=Cancelado
  paymentStatus: AIRBRUSHING_PAYMENT_STATUS;
  /** Stamped when paymentStatus becomes PAID — windows "paid this month" on Contas a Pagar. */
  paidAt?: Date | null;
  /** Como o pintor é pago — alimenta a coluna "Forma" de Contas a Pagar. */
  paymentMethod?: PAYMENT_METHOD | null;
  /** Regra que deriva `dueDate` do término. */
  dueDateRule?: AIRBRUSHING_DUE_DATE_RULE;
  /** Prazo em dias da regra DAYS_AFTER_FINISH; null usa o padrão histórico de 7. */
  paymentTermDays?: number | null;
  /** Dia fixo (1-31) da regra DAY_OF_MONTH, truncado ao último dia do mês. */
  dueDayOfMonth?: number | null;
  /** Vencimento efetivo, materializado pelo servidor. É o que Contas a Pagar exibe. */
  dueDate?: Date | null;
  taskId: string;
  painterId?: string | null;

  // Relations (optional, populated based on query)
  task?: Task;
  painter?: User | null;
  receipts?: File[];
  invoices?: File[];
  layouts?: File[];
  /** NFS-e emitida automaticamente para o aerografista quando a aerografia é concluída. */
  nfse?: AirbrushingNfse | null;
  /** Quando entrou em cotação (criada sem aerografista, ou reaberta). */
  quotationOpenedAt?: Date | null;
  /** Quando os aerografistas foram avisados da cotação. */
  quotationNotifiedAt?: Date | null;
  /** Quando a cotação terminou (seleção ou cancelamento). */
  quotationClosedAt?: Date | null;
  /** Orçamento de abertura da cotação (valor que a empresa já tem). Só existe em cotação. */
  quotationOfferAmount?: number | null;
  /** Tempo do orçamento de abertura — opcional mesmo quando há valor. */
  quotationOfferExecutionTime?: number | null;
  quotationOfferExecutionTimeUnit?: EXECUTION_TIME_UNIT | null;
  /**
   * Negociações da cotação, uma por aerografista. A API recorta por papel:
   * ADMIN/COMMERCIAL/FINANCIAL veem todas; os demais recebem `[]`.
   */
  quotes?: AirbrushingQuote[];
}

// =====================
// Cotação (negociação por aerografista)
// =====================

/** Negociação de um aerografista numa aerografia em cotação. */
export interface AirbrushingQuote {
  id: string;
  airbrushingId: string;
  painterId: string;
  status: AIRBRUSHING_QUOTE_STATUS;
  /**
   * Valor em jogo: em PROPOSED é o lance do aerografista; em COUNTERED/ACCEPTED é a
   * contraproposta do comercial; em SELECTED é o valor fechado. `null` só quando ele
   * recusou sem nunca propor.
   */
  amount: number | null;
  /** Tempo em jogo (mesma regra do `amount`). Null em negociações anteriores ao tempo de execução. */
  executionTime?: number | null;
  executionTimeUnit?: EXECUTION_TIME_UNIT | null;
  createdAt: Date;
  updatedAt: Date;
  painter?: { id: string; name: string; avatarId?: string | null } | null;
  /** Linha do tempo, em ordem cronológica crescente. */
  events?: AirbrushingQuoteEvent[];
}

/** Um lance ou decisão dentro da negociação. */
export interface AirbrushingQuoteEvent {
  id: string;
  quoteId: string;
  party: AIRBRUSHING_QUOTE_PARTY;
  action: AIRBRUSHING_QUOTE_ACTION;
  amount: number | null;
  /** O tempo que aquele lance disse (null quando o lance não falou de tempo). */
  executionTime?: number | null;
  executionTimeUnit?: EXECUTION_TIME_UNIT | null;
  note: string | null;
  userId: string | null;
  createdAt: Date;
  user?: { id: string; name: string } | null;
}

/** GET /airbrushing-quotes/airbrushing/:id — visão do comercial. */
export interface AirbrushingQuoteOverview {
  airbrushing: {
    id: string;
    status: AIRBRUSHING_STATUS;
    price: number | null;
    painterId: string | null;
    quotationOpenedAt: Date | null;
    quotationNotifiedAt: Date | null;
    quotationClosedAt: Date | null;
    startDate?: Date | null;
    executionTime?: number | null;
    executionTimeUnit?: EXECUTION_TIME_UNIT | null;
    quotationOfferAmount?: number | null;
    quotationOfferExecutionTime?: number | null;
    quotationOfferExecutionTimeUnit?: EXECUTION_TIME_UNIT | null;
  };
  /** Mais recentes primeiro (updatedAt desc). */
  quotes: AirbrushingQuote[];
  /** Aerografistas que ainda não responderam — só enquanto a aerografia está em cotação. */
  pendingPainters: { id: string; name: string; avatarId: string | null }[];
}

export interface AirbrushingQuoteOverviewResponse extends BaseGetUniqueResponse<AirbrushingQuoteOverview> {}
export interface AirbrushingQuoteActionResponse extends BaseUpdateResponse<AirbrushingQuote> {}

// =====================
// NFS-e do Aerografista
// =====================

/**
 * Nota emitida na SEFIN nacional com o PINTOR como prestador (MEI) e a empresa como
 * tomador. Reaproveita o enum NFSE_STATUS já usado pelas notas da própria empresa.
 *
 * NÃO estende BaseEntity: o `select` do endpoint devolve `createdAt` mas não `updatedAt`.
 */
export interface AirbrushingNfse {
  id: string;
  createdAt: Date;
  status: NFSE_STATUS;
  environment: NFSE_ENVIRONMENT;
  serie: string | null;
  /** Número do DPS (string — pode ter zeros à esquerda). */
  nDps: string | null;
  dpsId: string | null;
  accessKey: string | null;
  nfseNumber: string | null;
  issuedAt: Date | null;
  competence: Date | null;
  serviceAmount: number | null;
  errorMessage: string | null;
  errorCode: string | null;
  errorCount: number;
  retryAfter: Date | null;
  lastAttemptAt: Date | null;
  cancelledAt: Date | null;
  cancelReason: string | null;
  cancelReasonCode: number | null;

  // ─── Artefatos arquivados ──────────────────────────────────────────────────
  // O endpoint GET /airbrushings/:id/nfse já devolve os três; são o que permite
  // separar o documento GERADO pelo sistema dos anexos que o usuário subiu à mão.
  /**
   * File do DANFSe (PDF). O servidor o conecta TAMBÉM na relação AIRBRUSHING_INVOICES,
   * ou seja: ele aparece dentro de `airbrushing.invoices`. É por este id que a tela o
   * filtra para fora dos anexos manuais. `null` em notas antigas (anteriores ao
   * arquivamento) — nesse caso o PDF permanece indistinguível na lista de anexos.
   */
  pdfFileId?: string | null;
  /** File do XML autorizado — guarda obrigatória. NÃO entra em `invoices`. */
  xmlFileId?: string | null;
  /** Documento fiscal de ENTRADA gerado a partir do XML. */
  fiscalDocumentId?: string | null;

  // Relations
  painter?: { id: string; name: string } | null;
  profile?: { cnpj: string; corporateName: string } | null;
}

/**
 * Resultado do POST /airbrushings/:id/nfse/emit. `status` NÃO é um NFSE_STATUS: além de
 * AUTHORIZED/ERROR o servidor devolve SKIPPED (nota já autorizada, emissor desligado…).
 */
export interface AirbrushingNfseEmitResult {
  nfseId: string;
  status: "AUTHORIZED" | "SKIPPED" | "ERROR";
  reason?: string | null;
  accessKey?: string | null;
}

/** Resultado do PUT /airbrushings/:id/nfse/cancel — o servidor devolve o desfecho, não a nota. */
export interface AirbrushingNfseCancelResult {
  cancelled: boolean;
  message?: string | null;
}

/** Resultado do GET /airbrushings/:id/nfse/xml. */
export interface AirbrushingNfseXml {
  accessKey: string | null;
  xml: string;
}

export interface AirbrushingNfseGetResponse extends BaseGetUniqueResponse<AirbrushingNfse | null> {}
export interface AirbrushingNfseXmlResponse extends BaseGetUniqueResponse<AirbrushingNfseXml> {}
export interface AirbrushingNfseEmitResponse extends BaseCreateResponse<AirbrushingNfseEmitResult> {}
export interface AirbrushingNfseCancelResponse extends BaseUpdateResponse<AirbrushingNfseCancelResult> {}

// =====================
// Include Types
// =====================

export interface AirbrushingIncludes {
  task?:
    | boolean
    | {
        include?: TaskIncludes;
      };
  receipts?:
    | boolean
    | {
        include?: FileIncludes;
      };
  invoices?:
    | boolean
    | {
        include?: FileIncludes;
      };
  layouts?:
    | boolean
    | {
        include?: FileIncludes;
      };
  painter?:
    | boolean
    | {
        include?: UserIncludes;
      };
  nfse?: boolean;
  /** Qualquer forma vira, na API, o include completo (painter + events). */
  quotes?: boolean | { include?: { painter?: boolean; events?: boolean } };
}

// =====================
// Order By Types
// =====================

export interface AirbrushingOrderBy {
  id?: ORDER_BY_DIRECTION;
  startDate?: ORDER_BY_DIRECTION;
  finishDate?: ORDER_BY_DIRECTION;
  startedAt?: ORDER_BY_DIRECTION;
  finishedAt?: ORDER_BY_DIRECTION;
  price?: ORDER_BY_DIRECTION;
  status?: ORDER_BY_DIRECTION;
  statusOrder?: ORDER_BY_DIRECTION;
  paymentStatus?: ORDER_BY_DIRECTION;
  painterId?: ORDER_BY_DIRECTION;
  createdAt?: ORDER_BY_DIRECTION;
  updatedAt?: ORDER_BY_DIRECTION;
  task?: TaskOrderBy;
  painter?: { name?: ORDER_BY_DIRECTION };
}

// =====================
// Response Interfaces
// =====================

export interface AirbrushingGetUniqueResponse extends BaseGetUniqueResponse<Airbrushing> {}
export interface AirbrushingGetManyResponse extends BaseGetManyResponse<Airbrushing> {}
export interface AirbrushingCreateResponse extends BaseCreateResponse<Airbrushing> {}
export interface AirbrushingUpdateResponse extends BaseUpdateResponse<Airbrushing> {}
export interface AirbrushingDeleteResponse extends BaseDeleteResponse {}

// =====================
// Batch Operation Responses
// =====================

export interface AirbrushingBatchCreateResponse<T> extends BaseBatchResponse<Airbrushing, T> {}
export interface AirbrushingBatchUpdateResponse<T> extends BaseBatchResponse<Airbrushing, T & { id: string }> {}
export interface AirbrushingBatchDeleteResponse extends BaseBatchResponse<{ id: string; deleted: boolean }, { id: string }> {}
