import type { BaseResponse } from './common';

// Collection Analytics
export interface CollectionItem {
  period: string;
  periodLabel: string;
  invoicedAmount: number;
  paidAmount: number;
  collectionRate: number;
  overdueAmount: number;
}

export interface AgingBand {
  band: string;
  bandLabel: string;
  count: number;
  amount: number;
}

export interface RevenueFunnel {
  invoiced: number;
  billed: number;
  collected: number;
  outstanding: number;
}

export interface CollectionSummary {
  collectionRate: number;
  avgDaysToPayment: number;
  totalOverdue: number;
  overdueRate: number;
}

export interface CollectionAnalyticsData {
  summary: CollectionSummary;
  items: CollectionItem[];
  agingAnalysis: AgingBand[];
  revenueFunnel: RevenueFunnel;
}

export interface CollectionAnalyticsResponse extends BaseResponse {
  data: CollectionAnalyticsData;
}

// Bank Slip Performance
export interface BankSlipPerformanceItem {
  period: string;
  periodLabel: string;
  totalSlips: number;
  paidSlips: number;
  conversionRate: number;
  avgDelay: number;
}

export interface StatusDistributionItem {
  status: string;
  statusLabel: string;
  count: number;
  amount: number;
}

export interface TypeDistributionItem {
  type: string;
  typeLabel: string;
  count: number;
  amount: number;
  paidCount: number;
  conversionRate: number;
}

export interface BankSlipPerformanceSummary {
  conversionRate: number;
  avgDelayDays: number;
  errorRate: number;
  activeSlips: number;
}

export interface BankSlipPerformanceData {
  summary: BankSlipPerformanceSummary;
  items: BankSlipPerformanceItem[];
  statusDistribution: StatusDistributionItem[];
  typeDistribution: TypeDistributionItem[];
}

export interface BankSlipPerformanceResponse extends BaseResponse {
  data: BankSlipPerformanceData;
}

// Shared filter types
export interface FinancialAnalyticsFilters {
  startDate: Date;
  endDate: Date;
  customerIds?: string[];
  status?: string[];
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  groupBy?: string;
}

export type FinancialChartType = 'bar' | 'pie' | 'area' | 'line' | 'bar-stacked';

// =====================================================================
// Quote Funnel Analytics
// =====================================================================

export interface QuoteFunnelStage {
  stage: string;
  stageLabel: string;
  count: number;
  totalValue: number;
  conversionFromPrevious: number;
  conversionFromTop: number;
  avgDaysFromCreation: number;
}

export interface QuoteFunnelItem {
  period: string;
  periodLabel: string;
  newQuotes: number;
  approvedQuotes: number;
  billedQuotes: number;
  settledQuotes: number;
  totalValue: number;
  settledValue: number;
}

export interface QuoteTopCustomer {
  customerId: string;
  customerName: string;
  quoteCount: number;
  totalValue: number;
  settledValue: number;
  conversionRate: number;
}

export interface QuoteTopSector {
  sectorId: string;
  sectorName: string;
  quoteCount: number;
  totalValue: number;
  settledValue: number;
}

export interface QuoteFunnelSummary {
  totalQuotes: number;
  totalQuotedValue: number;
  totalSettledValue: number;
  conversionRate: number;
  avgTicket: number;
  avgSalesCycleDays: number;
  activeBacklogValue: number;
}

export interface QuoteFunnelAnalyticsData {
  summary: QuoteFunnelSummary;
  funnel: QuoteFunnelStage[];
  items: QuoteFunnelItem[];
  topCustomers: QuoteTopCustomer[];
  topSectors: QuoteTopSector[];
}

export interface QuoteFunnelAnalyticsResponse extends BaseResponse {
  data: QuoteFunnelAnalyticsData;
}

export interface QuoteFunnelAnalyticsFilters {
  startDate: Date;
  endDate: Date;
  customerIds?: string[];
  sectorIds?: string[];
  status?: string[];
  groupBy?: string;
}

// =====================================================================
// Receivables Analytics
// =====================================================================

export interface DelinquentCustomer {
  customerId: string;
  customerName: string;
  overdueAmount: number;
  overdueCount: number;
  oldestDueDate: string | null;
  daysOverdueMax: number;
  totalReceivable: number;
}

export interface CustomerAgingRow {
  customerId: string;
  customerName: string;
  current: number;
  band30: number;
  band60: number;
  band90: number;
  band90Plus: number;
  total: number;
  dso: number;
}

export interface ForecastInstallment {
  installmentId: string;
  invoiceId: string | null;
  customerId: string;
  customerName: string;
  taskId: string | null;
  taskName: string | null;
  taskSerialNumber: string | null;
  invoiceTotalAmount: number;
  installmentNumber: number;
  totalInstallments: number;
  dueDate: string;
  amount: number;
  paidAmount: number;
  remaining: number;
  status: string;
  daysFromNow: number;
}

export interface ForecastDayBucket {
  bucket: string;
  bucketLabel: string;
  dueAmount: number;
  installmentCount: number;
  truncated?: boolean;
  installments?: ForecastInstallment[];
}

export interface RecoveryCohort {
  cohortMonth: string;
  cohortLabel: string;
  invoicedAmount: number;
  recoveredAt30Days: number;
  recoveredAt60Days: number;
  recoveredAt90Days: number;
  recoveredFinal: number;
}

export interface ReceivablesSummary {
  totalReceivable: number;
  totalOverdue: number;
  totalCurrent: number;
  avgDso: number;
  activeCustomers: number;
  forecastNext7: number;
  forecastNext30: number;
  forecastNext60: number;
  forecastNext90: number;
}

export interface ReceivablesAnalyticsData {
  summary: ReceivablesSummary;
  topDelinquents: DelinquentCustomer[];
  customerAging: CustomerAgingRow[];
  forecastBuckets: ForecastDayBucket[];
  recoveryCohorts: RecoveryCohort[];
}

export interface ReceivablesAnalyticsResponse extends BaseResponse {
  data: ReceivablesAnalyticsData;
}

export interface ReceivablesAnalyticsFilters {
  startDate: Date;
  endDate: Date;
  customerIds?: string[];
  limit?: number;
  forecastDays?: number;
}

// =====================================================================
// Sicredi Webhook Analytics
// =====================================================================

export interface SicrediMonthlyItem {
  period: string;
  periodLabel: string;
  eventCount: number;
  liquidation: number;
  discount: number;
  interest: number;
  penalty: number;
  abatement: number;
  failedCount: number;
}

export interface SicrediMovementRow {
  movimento: string;
  count: number;
  totalLiquidation: number;
}

export interface SicrediErrorRow {
  errorMessage: string;
  count: number;
  lastOccurred: string | null;
}

export interface SicrediWebhookSummary {
  totalEvents: number;
  totalProcessed: number;
  totalFailed: number;
  processingSuccessRate: number;
  totalLiquidation: number;
  totalDiscountGiven: number;
  totalInterestEarned: number;
  totalPenaltyEarned: number;
  totalAbatement: number;
  netSettlementImpact: number;
}

export interface SicrediWebhookAnalyticsData {
  summary: SicrediWebhookSummary;
  items: SicrediMonthlyItem[];
  movementBreakdown: SicrediMovementRow[];
  errorBreakdown: SicrediErrorRow[];
}

export interface SicrediWebhookAnalyticsResponse extends BaseResponse {
  data: SicrediWebhookAnalyticsData;
}

export interface SicrediWebhookAnalyticsFilters {
  startDate: Date;
  endDate: Date;
  groupBy?: string;
}

// =====================================================================
// NFSe Analytics
// =====================================================================

export interface NfseStatusDistribution {
  status: string;
  statusLabel: string;
  count: number;
}

export interface NfseMonthlyItem {
  period: string;
  periodLabel: string;
  authorized: number;
  pending: number;
  processing: number;
  error: number;
  cancelled: number;
  total: number;
}

export interface NfseErrorRow {
  errorMessage: string;
  count: number;
  lastOccurred: string | null;
}

export interface NfseSummary {
  totalDocuments: number;
  totalAuthorized: number;
  totalPending: number;
  totalProcessing: number;
  totalError: number;
  totalCancelled: number;
  authorizationRate: number;
  errorRate: number;
  avgRetryCount: number;
  documentsAtRetryLimit: number;
  issRatePercent: number;
  grossServiceRevenue: number;
  estimatedIssAmount: number;
  netServiceRevenue: number;
  pendingGrossRevenue: number;
}

export interface NfseAnalyticsData {
  summary: NfseSummary;
  statusDistribution: NfseStatusDistribution[];
  items: NfseMonthlyItem[];
  errorBreakdown: NfseErrorRow[];
}

export interface NfseAnalyticsResponse extends BaseResponse {
  data: NfseAnalyticsData;
}

export interface NfseAnalyticsFilters {
  startDate: Date;
  endDate: Date;
  status?: string[];
  groupBy?: string;
}
