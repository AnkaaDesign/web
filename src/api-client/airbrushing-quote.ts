// packages/api-client/src/airbrushing-quote.ts
//
// Cotação da aerografia — lado do comercial. A aerografia criada sem aerografista
// nasce "Em Cotação"; cada aerografista abre uma negociação (AirbrushingQuote) e o
// comercial contrapropõe ou seleciona. As rotas do aerografista (`requests/*`) são
// do app e não têm cliente aqui.

import { apiClient } from "./axiosClient";
import type { AirbrushingQuoteOverviewResponse, AirbrushingQuoteActionResponse } from "../types";

// =====================
// Form Data Types
// =====================

/** Corpo do POST /airbrushing-quotes/:quoteId/counter. */
export interface AirbrushingQuoteCounterData {
  amount: number;
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
export const selectAirbrushingQuote = (quoteId: string, data?: AirbrushingQuoteSelectData) => airbrushingQuoteService.selectAirbrushingQuote(quoteId, data);
export const reopenAirbrushingQuotation = (airbrushingId: string) => airbrushingQuoteService.reopenAirbrushingQuotation(airbrushingId);
