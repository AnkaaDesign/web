// Re-export axios client utilities for easier imports
export {
  apiClient,
  setAuthToken,
  setTokenProvider,
  setAuthErrorHandler,
  removeAuthErrorHandler,
  getTokenProvider,
  getAuthErrorHandler,
  updateApiUrl,
  createCustomApiClient,
  cancelAllRequests,
  clearApiCache,
  httpGet,
  httpPost,
  httpPut,
  httpPatch,
  httpDelete,
} from "./axiosClient";
