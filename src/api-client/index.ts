// packages/api/src/index.ts

export * from "./activity";
export * from "./airbrushing";
export * from "./auth";
export {
  apiClient,
  axios,
  setAuthToken,
  setTokenProvider,
  setAuthErrorHandler,
  removeAuthErrorHandler,
  getTokenProvider,
  getAuthErrorHandler,
  updateApiUrl,
  setJustLoggedIn,
  forceTokenRefresh,
  createCustomApiClient,
  cancelAllRequests,
  clearApiCache,
  httpGet,
  httpPost,
  httpPut,
  httpPatch,
  httpDelete,
} from "./axiosClient";
export * from "./backup";
export * from "./borrow";
export * from "./changelog";
export * from "./customer";
export * from "./cut";
export * from "./ppe";
export * from "./externalWithdrawal";
export * from "./file";
export * from "./garage";
export * from "./holiday";
export * from "./item";
export * from "./item-category";
export * from "./item-price";
export * from "./maintenance";
export * from "./notification";
export * from "./notify";
export * from "./observation";
export * from "./order";
export * from "./paint";
export * from "./position";
export * from "./preferences";
export * from "./warning";
export * from "./sector";
export * from "./service";
export * from "./serviceOrder";
export * from "./supplier";
export * from "./task";
export * from "./truck";
export * from "./layout";
export * from "./services/layoutSection";
export * from "./user";
export * from "./vacation";
export * from "./dashboard";
export * from "./server";
export * from "./services/bonus";
export { payrollService } from "./services/payroll";
export { discountService } from "./services/discount";
export type {
  DiscountGetManyResponse,
  DiscountQueryFormData,
  BatchDiscountCreateFormData,
  BatchDiscountResult,
} from "./services/discount";
export * from "./services/secullum";
export * from "./services/timeClockEntry";
export {
  ssdHealthService,
  raidStatusService,
  backupService,
  webDavService,
  serverMonitoringService,
  systemHealthService,
  // Export specific functions that don't conflict with server.ts
  getSsdHealthData,
  getSsdHealthDataById,
  refreshSsdHealthData,
  getBackupMetadata,
  getBackupMetadataById,
  refreshBackupMetadata,
  startBackupJob,
  stopBackupJob,
  pauseBackupJob,
  resumeBackupJob,
  getWebDavInfo,
  getWebDavInfoById,
  refreshWebDavInfo,
  syncWebDavFolder,
  getServices,
  restartService,
  startService,
  stopService,
  getServiceLogs,
  getMetrics,
  getSystemHealth,
  refreshSystemHealth,
  getHealthHistory,
  getServerRaidStatus,
  getServerRaidStatusById,
  refreshServerRaidStatus,
  refreshSsdHealth,
} from "./services/monitoring";
export * from "./services/statistics";
export * from "./services/deployment";
export * from "./platform-utils";
