/**
 * Statistics Pages Index
 *
 * Exports all entity-specific statistics pages and advanced analytics
 */

// Entity-specific statistics pages
export { InventoryStatisticsPage } from "./inventory";
export { ProductionStatisticsPage } from "./production";
export { OrdersStatisticsPage } from "./orders";
export { HRStatisticsPage } from "./hr";
export { FinancialStatisticsPage } from "./financial";

// Advanced Analytics Pages
export { default as PredictiveAnalytics } from './analytics/predictive';
export { default as ComparativeAnalysis } from './analytics/comparative';
export { default as CorrelationAnalysis } from './analytics/correlation';
export { default as CohortAnalysis } from './analytics/cohort';

// Dashboard and Monitoring Pages
export { default as ExecutiveDashboard } from './executive';
export { default as GoalTracking } from './goals';
export { default as RealTimeMonitoring } from './realtime';
export { default as DataExplorer } from './explorer';

// Report Pages
export { default as CustomReportsBuilder } from './reports/builder';

// Re-export components for convenience
export * from "./components";
export * from "./utils/dashboard-helpers";
export * from "./utils/dashboard-config";

// Re-export analytics components and utilities
export * from './analytics/components';
export * from './analytics/utils';
