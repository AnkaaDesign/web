import { apiClient } from "../axiosClient";

export interface SecullumAuthCredentials {
  email: string;
  password: string;
}

export interface SecullumAuthResponse {
  success: boolean;
  message: string;
  data: {
    email: string;
    userName: string;
    expiresAt: string;
    isAuthenticated: boolean;
  };
}

export interface SecullumEmployee {
  Id: number;
  Nome: string;
  NumeroFolha: string;
  NumeroIdentificador: string;
  NumeroPis: string;
  Cpf: string;
  DepartamentoDescricao: string;
  EmpresaId: number;
  DepartamentoId: number;
  FuncaoId: number;
  HorarioId: number;
}

export interface SecullumDailySummary {
  resumoDiario: {
    Funcionarios: Array<{
      Id: number;
      Nome: string;
      NumeroFolha: string;
      Celular?: string;
    }>;
    Dados: Array<{
      Titulo: string;
      FuncionariosIds: number[];
      Atual: number;
      Total: number;
      ExibirProgressBar: boolean;
      Tipo: number;
    }>;
  };
}

export const secullumService = {
  // Authentication
  authenticate: (credentials: SecullumAuthCredentials) => apiClient.post<SecullumAuthResponse>("/integrations/secullum/auth", credentials),

  getAuthStatus: () => apiClient.get<{ success: boolean; data: { isAuthenticated: boolean } }>("/integrations/secullum/auth/status"),

  logout: (email?: string) => apiClient.post<{ success: boolean; message: string }>("/integrations/secullum/auth/logout", { email }),

  // Employees
  getEmployees: () => apiClient.get<{ success: boolean; data: SecullumEmployee[] }>("/integrations/secullum/employees"),

  syncEmployees: () => apiClient.post<{ success: boolean; message: string; data: any }>("/integrations/secullum/sync/employees"),

  // Attendance
  getDailySummary: () => apiClient.get<{ success: boolean; data: SecullumDailySummary }>("/integrations/secullum/attendance/daily-summary"),

  getMonthlySummary: () => apiClient.get<{ success: boolean; data: any }>("/integrations/secullum/attendance/monthly-summary"),

  getAttendanceRecords: (params?: { cpf?: string; dataInicio?: string; dataFim?: string }) =>
    apiClient.get<{ success: boolean; data: any }>("/integrations/secullum/attendance/records", { params }),

  getAttendanceCalculations: (params?: { cpf?: string; dataInicio?: string; dataFim?: string }) =>
    apiClient.get<{ success: boolean; data: any }>("/integrations/secullum/attendance/calculations", { params }),

  getCalculations: (params?: { userId?: string; cpf?: string; dataInicio?: string; dataFim?: string; startDate?: string; endDate?: string; page?: number; take?: number; status?: string; funcionarioId?: number }) =>
    apiClient.get<{ success: boolean; data: any; meta?: any }>("/integrations/secullum/calculations", {
      params: {
        userId: params?.userId,
        cpf: params?.cpf,
        startDate: params?.startDate || params?.dataInicio,
        endDate: params?.endDate || params?.dataFim,
        page: params?.page,
        take: params?.take,
        status: params?.status,
        funcionarioId: params?.funcionarioId
      }
    }),

  // Departments & Positions
  getDepartments: () => apiClient.get<{ success: boolean; data: any }>("/integrations/secullum/departments"),

  getPositions: () => apiClient.get<{ success: boolean; data: any }>("/integrations/secullum/positions"),

  // Requests
  getPendingRequests: (params?: {
    dataInicio?: Date | null;
    dataFim?: Date | null;
    funcionariosIds?: number[];
    empresaId?: number;
    departamentoId?: number;
    funcaoId?: number;
    estruturaId?: number;
    tipo?: number | null;
    ordem?: number;
    decrescente?: boolean;
    quantidade?: number;
  }) => apiClient.post<{ success: boolean; data: any }>("/integrations/secullum/requests/pending", params || {}),

  // Pendencias (simple requests endpoint)
  getPendencias: (userCpf?: string) =>
    apiClient.get<{ success: boolean; data: any[]; meta: any }>("/integrations/secullum/pendencias", {
      params: userCpf ? { userCpf } : {},
    }),

  // New Requests Management
  getRequests: (pending?: boolean) =>
    apiClient.get<{ success: boolean; data: any[]; message: string }>("/integrations/secullum/requests", {
      params: pending !== undefined ? { pending: pending.toString() } : {},
    }),

  approveRequest: (requestId: string, data: any) => apiClient.post<{ success: boolean; message: string; data: any }>(`/integrations/secullum/requests/${requestId}/approve`, data),

  rejectRequest: (requestId: string, data: any) => apiClient.post<{ success: boolean; message: string; data: any }>(`/integrations/secullum/requests/${requestId}/reject`, data),

  getApprovedRequests: (params?: {
    dataInicio?: Date | null;
    dataFim?: Date | null;
    funcionariosIds?: number[];
    empresaId?: number;
    departamentoId?: number;
    funcaoId?: number;
    estruturaId?: number;
    tipo?: number | null;
    ordem?: number;
    decrescente?: boolean;
    quantidade?: number;
  }) => apiClient.post<{ success: boolean; data: any }>("/integrations/secullum/requests/approved", params || {}),

  // Sync Management
  getSyncStatus: () => apiClient.get<{ success: boolean; data: any }>("/integrations/secullum/sync/status"),

  triggerSync: (params: { type: "full" | "partial" | "pause" | "resume" | "stop"; entityTypes?: string[] }) =>
    apiClient.post<{ success: boolean; message: string; data: any }>("/integrations/secullum/sync/trigger", params),

  getSyncHistory: (params?: { page?: number; limit?: number; status?: string; entityType?: string; dateFrom?: Date; dateTo?: Date }) =>
    apiClient.get<{ success: boolean; data: any; meta?: any }>("/integrations/secullum/sync/history", { params }),

  // Conflict Resolution
  getConflicts: (params?: { status?: "pending" | "resolved" | "all"; entityType?: string; page?: number; limit?: number }) =>
    apiClient.get<{ success: boolean; data: any; meta?: any }>("/integrations/secullum/conflicts", { params }),

  resolveConflict: (params: { conflictId: string; resolution: "use_ankaa" | "use_secullum" | "merge" | "ignore"; notes?: string }) =>
    apiClient.post<{ success: boolean; message: string; data: any }>(`/integrations/secullum/conflicts/${params.conflictId}/resolve`, {
      resolution: params.resolution,
      notes: params.notes,
    }),

  bulkResolveConflicts: (params: { resolution: "use_ankaa" | "use_secullum" | "merge" | "ignore"; conflictIds?: string[]; filters?: any }) =>
    apiClient.post<{ success: boolean; message: string; data: any }>("/integrations/secullum/conflicts/bulk-resolve", params),

  // Entity Mappings
  getEntityMappings: () => apiClient.get<{ success: boolean; data: any }>("/integrations/secullum/mappings"),

  updateEntityMapping: (params: { entityType: string; mappingConfig: any }) =>
    apiClient.put<{ success: boolean; message: string; data: any }>(`/integrations/secullum/mappings/${params.entityType}`, {
      mappingConfig: params.mappingConfig,
    }),

  validateEntityMapping: (entityType: string) => apiClient.post<{ success: boolean; data: any }>(`/integrations/secullum/mappings/${entityType}/validate`),

  // Configuration
  getSyncConfig: () => apiClient.get<{ success: boolean; data: any }>("/integrations/secullum/config"),

  updateSyncConfig: (config: any) => apiClient.put<{ success: boolean; message: string; data: any }>("/integrations/secullum/config", config),

  testConnection: () => apiClient.post<{ success: boolean; message: string; data: any }>("/integrations/secullum/test-connection"),

  // Real-time Monitoring
  getSyncJobs: () => apiClient.get<{ success: boolean; data: any }>("/integrations/secullum/sync/jobs"),

  getSystemMetrics: () => apiClient.get<{ success: boolean; data: any }>("/integrations/secullum/metrics"),

  // Job Control
  pauseJob: (jobId: string) => apiClient.post<{ success: boolean; message: string }>(`/integrations/secullum/sync/jobs/${jobId}/pause`),

  resumeJob: (jobId: string) => apiClient.post<{ success: boolean; message: string }>(`/integrations/secullum/sync/jobs/${jobId}/resume`),

  cancelJob: (jobId: string) => apiClient.post<{ success: boolean; message: string }>(`/integrations/secullum/sync/jobs/${jobId}/cancel`),

  // Data Preview
  previewSync: (params: { entityType: string; limit?: number; filters?: any }) => apiClient.post<{ success: boolean; data: any }>("/integrations/secullum/sync/preview", params),

  // Export/Import
  exportSyncData: (params: { entityType?: string; dateFrom?: Date; dateTo?: Date; format?: "csv" | "excel" | "json" }) =>
    apiClient.post<Blob>("/integrations/secullum/export", params, {
      responseType: "blob",
    }),

  importSyncData: (file: File, entityType: string) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("entityType", entityType);

    return apiClient.post<{ success: boolean; message: string; data: any }>("/integrations/secullum/import", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  },

  // Webhook Management
  getWebhookConfig: () => apiClient.get<{ success: boolean; data: any }>("/integrations/secullum/webhooks"),

  updateWebhookConfig: (config: { url?: string; events?: string[]; secret?: string; enabled?: boolean }) =>
    apiClient.put<{ success: boolean; message: string; data: any }>("/integrations/secullum/webhooks", config),

  testWebhook: () => apiClient.post<{ success: boolean; message: string }>("/integrations/secullum/webhooks/test"),

  // Holidays
  getHolidays: (params?: { year?: number; month?: number }) => apiClient.get<{ success: boolean; data: any }>("/integrations/secullum/holidays", { params }),

  createHoliday: (data: { Data: string; Descricao: string }) => apiClient.post<{ success: boolean; message: string; data?: any }>("/integrations/secullum/holidays", data),

  deleteHoliday: (holidayId: string | number) => apiClient.delete<{ success: boolean; message: string }>(`/integrations/secullum/holidays/${holidayId}`),

  // Configuration
  getConfiguration: () => apiClient.get<{ success: boolean; data: any[] }>("/integrations/secullum/configuration"),

  // Time Clock Entries (Batidas)
  getTimeEntries: (params?: { userId?: string | number; funcionarioId?: number; cpf?: string; startDate?: string; endDate?: string; dataInicio?: string; dataFim?: string }) => {
    // Always use the time-entries endpoint with query parameters
    return apiClient.get<{ success: boolean; data: any; message?: string }>("/integrations/secullum/time-entries", {
      params: {
        userId: params?.userId,
        startDate: params?.startDate || params?.dataInicio,
        endDate: params?.endDate || params?.dataFim,
      },
    });
  },

  // Justifications
  getJustifications: () => apiClient.get<{ success: boolean; data: any[] }>("/integrations/secullum/justifications"),

  // Time Entry Photo
  getTimeEntryPhoto: (userId: number, fonteDadosId: number) =>
    apiClient.get<{ success: boolean; data: { FotoBatida: string } }>(`/integrations/secullum/batidas/foto/${userId}/${fonteDadosId}`),

  // Update Time Entry
  updateTimeEntry: (entryId: number, data: any) => apiClient.put<{ success: boolean; message: string; data: any }>(`/integrations/secullum/time-entries/${entryId}`, data),

  // Batch Update Time Entries
  batchUpdateTimeEntries: (entries: any[]) =>
    apiClient.post<{ success: boolean; message: string; updated: number }>("/integrations/secullum/time-entries/batch-update", { entries }),

  // User mapping sync
  syncUserMapping: (params?: { dryRun?: boolean }) => apiClient.post<{ success: boolean; summary: any; details: any }>("/integrations/secullum/sync-user-mapping", params),
};
