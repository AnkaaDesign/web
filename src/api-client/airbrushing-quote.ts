// packages/api-client/src/airbrushing-quote.ts
//
// Cotação da aerografia — lado do comercial. A aerografia criada sem aerografista
// nasce "Em Cotação"; cada aerografista abre uma negociação (AirbrushingQuote) e o
// comercial contrapropõe ou seleciona. As rotas do aerografista (`requests/*`) são
// do app e não têm cliente aqui.

import { apiClient } from "./axiosClient";
import type { AirbrushingQuoteOverviewResponse, AirbrushingQuoteActionResponse } from "../types";
import type { EXECUTION_TIME_UNIT } from "../constants";

// =====================
// Form Data Types
// =====================

/** Corpo do POST /airbrushing-quotes/:quoteId/counter (por negociação — a UI não oferece mais). */
export interface AirbrushingQuoteCounterData {
  amount?: number | null;
  executionTime?: number | null;
  executionTimeUnit?: EXECUTION_TIME_UNIT | null;
  note?: string | null;
}

/**
 * Corpo do POST /airbrushing-quotes/airbrushing/:airbrushingId/counter — contraproposta
 * para TODOS os que têm proposta aguardando resposta (PROPOSED/COUNTERED). Pelo menos
 * valor OU tempo; tempo e unidade vão juntos. O que não vier continua o de cada negociação.
 */
export interface AirbrushingQuoteCounterAllData {
  amount?: number | null;
  executionTime?: number | null;
  executionTimeUnit?: EXECUTION_TIME_UNIT | null;
  note?: string | null;
}

/** Corpo do POST /airbrushing-quotes/:quoteId/select. */
export interface AirbrushingQuoteSelectData {
  note?: string | null;
}

// =====================
// Airbrushing Quote Service Class
// =====================

export class AirbrushingQuoteService {
  private readonly basePath = "/airbrushing-quotes";

  /** Todas as negociações da aerografia + quem ainda não respondeu. */
  async getAirbrushingQuotes(airbrushingId: string): Promise<AirbrushingQuoteOverviewResponse> {
    const response = await apiClient.get<AirbrushingQuoteOverviewResponse>(`${this.basePath}/airbrushing/${airbrushingId}`);
    return response.data;
  }

  async counterAirbrushingQuote(quoteId: string, data: AirbrushingQuoteCounterData): Promise<AirbrushingQuoteActionResponse> {
    const response = await apiClient.post<AirbrushingQuoteActionResponse>(`${this.basePath}/${quoteId}/counter`, data);
    return response.data;
  }

  /** Contraproposta para todos; devolve a mesma visão do GET. */
  async counterAllAirbrushingQuotes(airbrushingId: string, data: AirbrushingQuoteCounterAllData): Promise<AirbrushingQuoteOverviewResponse> {
    const response = await apiClient.post<AirbrushingQuoteOverviewResponse>(`${this.basePath}/airbrushing/${airbrushingId}/counter`, data);
    return response.data;
  }

  /** Grava aerografista + valor da negociação na aerografia e encerra a cotação. */
  async selectAirbrushingQuote(quoteId: string, data: AirbrushingQuoteSelectData = {}): Promise<AirbrushingQuoteActionResponse> {
    const response = await apiClient.post<AirbrushingQuoteActionResponse>(`${this.basePath}/${quoteId}/select`, data);
    return response.data;
  }

  /** Tira aerografista e valor e volta a aerografia para Em Cotação, reavisando todos. */
  async reopenAirbrushingQuotation(airbrushingId: string): Promise<AirbrushingQuoteOverviewResponse> {
    const response = await apiClient.post<AirbrushingQuoteOverviewResponse>(`${this.basePath}/airbrushing/${airbrushingId}/reopen`);
    return response.data;
  }
}

// =====================
// Export service instance
// =====================

export const airbrushingQuoteService = new AirbrushingQuoteService();

// =====================
// Export individual functions
// =====================

export const getAirbrushingQuotes = (airbrushingId: string) => airbrushingQuoteService.getAirbrushingQuotes(airbrushingId);
export const counterAirbrushingQuote = (quoteId: string, data: AirbrushingQuoteCounterData) => airbrushingQuoteService.counterAirbrushingQuote(quoteId, data);
export const counterAllAirbrushingQuotes = (airbrushingId: string, data: AirbrushingQuoteCounterAllData) =>
  airbrushingQuoteService.counterAllAirbrushingQuotes(airbrushingId, data);
export const selectAirbrushingQuote = (quoteId: string, data?: AirbrushingQuoteSelectData) => airbrushingQuoteService.selectAirbrushingQuote(quoteId, data);
export const reopenAirbrushingQuotation = (airbrushingId: string) => airbrushingQuoteService.reopenAirbrushingQuotation(airbrushingId);
