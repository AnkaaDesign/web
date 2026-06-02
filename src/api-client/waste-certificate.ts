import { apiClient } from "./axiosClient";

export interface WasteCertificateCreatePayload {
  pdf: Blob;
  filename: string;
  date: Date;
  periodStart: Date;
  periodEnd: Date;
  description: string;
  volume: string;
}

const buildCreateFormData = (payload: WasteCertificateCreatePayload): FormData => {
  const fd = new FormData();
  fd.append("file", payload.pdf, payload.filename);
  fd.append("date", payload.date.toISOString());
  fd.append("periodStart", payload.periodStart.toISOString());
  fd.append("periodEnd", payload.periodEnd.toISOString());
  fd.append("description", payload.description);
  fd.append("volume", payload.volume);
  return fd;
};

export const wasteCertificateService = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    searchingFor?: string;
    status?: string;
    orderBy?: Record<string, "asc" | "desc">;
  }) => apiClient.get("/waste-certificates", { params }),

  getById: (id: string) => apiClient.get(`/waste-certificates/${id}`),

  create: (payload: WasteCertificateCreatePayload) =>
    apiClient.post("/waste-certificates", buildCreateFormData(payload), {
      headers: { "Content-Type": "multipart/form-data" },
    }),

  delete: (id: string) => apiClient.delete(`/waste-certificates/${id}`),

  // ---- Public (shareable link) ----
  getPublic: (id: string) =>
    apiClient.get(`/waste-certificates/public/${id}`, { params: { _t: Date.now() } }),

  uploadSignedPublic: (id: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return apiClient.post(`/waste-certificates/public/${id}/signed`, fd, {
      headers: { "Content-Type": "multipart/form-data" },
    });
  },
};
