// packages/api-client/src/paintingAnalysis.ts

import { apiClient } from "./axiosClient";
import type {
  PaintingAlertResolveResponse,
  PaintingAnalysisComputeFormData,
  PaintingAnalysisCreateFormData,
  PaintingAnalysisCreateResponse,
  PaintingAnalysisDeleteResponse,
  PaintingAnalysisFaceCreateFormData,
  PaintingAnalysisFaceCreateResponse,
  PaintingAnalysisFaceDeleteResponse,
  PaintingAnalysisFaceUpdateFormData,
  PaintingAnalysisFaceUpdateResponse,
  PaintingAnalysisGetManyFormData,
  PaintingAnalysisGetManyResponse,
  PaintingAnalysisGetUniqueResponse,
  PaintingAnalysisProcessFormData,
  PaintingAnalysisUpdateFormData,
  PaintingAnalysisUpdateResponse,
  PaintingBoundaryUpdateFormData,
  PaintingBoundaryUpdateResponse,
  PaintingConfigGetResponse,
  PaintingIndirectUpdateFormData,
  PaintingIndirectUpdateResponse,
  PaintingProcessParamsUpdateFormData,
  PaintingProcessParamsUpdateResponse,
  PaintingRateUpdateFormData,
  PaintingRateUpdateResponse,
  PaintingRegionUpdateFormData,
  PaintingRegionUpdateResponse,
  PaintingRuleUpdateFormData,
  PaintingRuleUpdateResponse,
  PaintingStepUpdateFormData,
  PaintingStepUpdateResponse,
  PaintingStepTaskUpdateFormData,
  PaintingStepTaskUpdateResponse,
  PaintingStepMaterialUpdateFormData,
  PaintingStepMaterialUpdateResponse,
  PaintingPaintSystemUpdateFormData,
  PaintingPaintSystemUpdateResponse,
} from "../types";

const basePath = "/painting-analyses";

// Painting Analysis Service
export const paintingAnalysisService = {
  // =====================
  // Analysis CRUD
  // =====================

  async getPaintingAnalyses(params: PaintingAnalysisGetManyFormData = {}): Promise<PaintingAnalysisGetManyResponse> {
    const response = await apiClient.get<PaintingAnalysisGetManyResponse>(basePath, { params });
    return response.data;
  },

  async getPaintingAnalysisById(id: string): Promise<PaintingAnalysisGetUniqueResponse> {
    const response = await apiClient.get<PaintingAnalysisGetUniqueResponse>(`${basePath}/${id}`);
    return response.data;
  },

  async createPaintingAnalysis(data: PaintingAnalysisCreateFormData): Promise<PaintingAnalysisCreateResponse> {
    const response = await apiClient.post<PaintingAnalysisCreateResponse>(basePath, data);
    return response.data;
  },

  async updatePaintingAnalysis(id: string, data: PaintingAnalysisUpdateFormData): Promise<PaintingAnalysisUpdateResponse> {
    const response = await apiClient.patch<PaintingAnalysisUpdateResponse>(`${basePath}/${id}`, data);
    return response.data;
  },

  async deletePaintingAnalysis(id: string): Promise<PaintingAnalysisDeleteResponse> {
    const response = await apiClient.delete<PaintingAnalysisDeleteResponse>(`${basePath}/${id}`);
    return response.data;
  },

  // =====================
  // Faces
  // =====================

  async addPaintingAnalysisFace(analysisId: string, data: PaintingAnalysisFaceCreateFormData): Promise<PaintingAnalysisFaceCreateResponse> {
    const formData = new FormData();
    formData.append("file", data.file);
    formData.append("view", data.view);
    formData.append("referenceKind", data.referenceKind);
    formData.append("referenceValueCm", String(data.referenceValueCm));

    const response = await apiClient.post<PaintingAnalysisFaceCreateResponse>(`${basePath}/${analysisId}/faces`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  async updatePaintingAnalysisFace(faceId: string, data: PaintingAnalysisFaceUpdateFormData): Promise<PaintingAnalysisFaceUpdateResponse> {
    const response = await apiClient.patch<PaintingAnalysisFaceUpdateResponse>(`${basePath}/faces/${faceId}`, data);
    return response.data;
  },

  async deletePaintingAnalysisFace(faceId: string): Promise<PaintingAnalysisFaceDeleteResponse> {
    const response = await apiClient.delete<PaintingAnalysisFaceDeleteResponse>(`${basePath}/faces/${faceId}`);
    return response.data;
  },

  // =====================
  // Processing (async image pipeline) & business recompute
  // =====================

  // Returns 202 — processing is asynchronous; poll GET /:id while status === PROCESSING.
  async processPaintingAnalysis(id: string, data: PaintingAnalysisProcessFormData = {}): Promise<PaintingAnalysisGetUniqueResponse> {
    const response = await apiClient.post<PaintingAnalysisGetUniqueResponse>(`${basePath}/${id}/process`, data);
    return response.data;
  },

  // Recomputes independent business stages (MATCH / STRATEGY / PLAN). Default: all.
  async computePaintingAnalysis(id: string, data: PaintingAnalysisComputeFormData = {}): Promise<PaintingAnalysisGetUniqueResponse> {
    const response = await apiClient.post<PaintingAnalysisGetUniqueResponse>(`${basePath}/${id}/compute`, data);
    return response.data;
  },

  // =====================
  // Regions / Boundaries / Steps / Alerts
  // =====================

  async updatePaintingRegion(regionId: string, data: PaintingRegionUpdateFormData): Promise<PaintingRegionUpdateResponse> {
    const response = await apiClient.patch<PaintingRegionUpdateResponse>(`${basePath}/regions/${regionId}`, data);
    return response.data;
  },

  async updatePaintingBoundary(boundaryId: string, data: PaintingBoundaryUpdateFormData): Promise<PaintingBoundaryUpdateResponse> {
    const response = await apiClient.patch<PaintingBoundaryUpdateResponse>(`${basePath}/boundaries/${boundaryId}`, data);
    return response.data;
  },

  async updatePaintingStep(stepId: string, data: PaintingStepUpdateFormData): Promise<PaintingStepUpdateResponse> {
    const response = await apiClient.patch<PaintingStepUpdateResponse>(`${basePath}/steps/${stepId}`, data);
    return response.data;
  },

  async updatePaintingStepTask(taskId: string, data: PaintingStepTaskUpdateFormData): Promise<PaintingStepTaskUpdateResponse> {
    const response = await apiClient.patch<PaintingStepTaskUpdateResponse>(`${basePath}/step-tasks/${taskId}`, data);
    return response.data;
  },

  async updatePaintingStepMaterial(materialId: string, data: PaintingStepMaterialUpdateFormData): Promise<PaintingStepMaterialUpdateResponse> {
    const response = await apiClient.patch<PaintingStepMaterialUpdateResponse>(`${basePath}/step-materials/${materialId}`, data);
    return response.data;
  },

  async resolvePaintingAlert(alertId: string): Promise<PaintingAlertResolveResponse> {
    const response = await apiClient.patch<PaintingAlertResolveResponse>(`${basePath}/alerts/${alertId}/resolve`);
    return response.data;
  },

  // =====================
  // Config
  // =====================

  async getPaintingConfig(): Promise<PaintingConfigGetResponse> {
    const response = await apiClient.get<PaintingConfigGetResponse>(`${basePath}/config`);
    return response.data;
  },

  async updatePaintingConfigRate(id: string, data: PaintingRateUpdateFormData): Promise<PaintingRateUpdateResponse> {
    const response = await apiClient.patch<PaintingRateUpdateResponse>(`${basePath}/config/rates/${id}`, data);
    return response.data;
  },

  async updatePaintingConfigIndirect(id: string, data: PaintingIndirectUpdateFormData): Promise<PaintingIndirectUpdateResponse> {
    const response = await apiClient.patch<PaintingIndirectUpdateResponse>(`${basePath}/config/indirects/${id}`, data);
    return response.data;
  },

  async updatePaintingConfigRule(id: string, data: PaintingRuleUpdateFormData): Promise<PaintingRuleUpdateResponse> {
    const response = await apiClient.patch<PaintingRuleUpdateResponse>(`${basePath}/config/rules/${id}`, data);
    return response.data;
  },

  async updatePaintingConfigProcessParams(id: string, data: PaintingProcessParamsUpdateFormData): Promise<PaintingProcessParamsUpdateResponse> {
    const response = await apiClient.patch<PaintingProcessParamsUpdateResponse>(`${basePath}/config/process-params/${id}`, data);
    return response.data;
  },

  async updatePaintingConfigPaintSystem(id: string, data: PaintingPaintSystemUpdateFormData): Promise<PaintingPaintSystemUpdateResponse> {
    const response = await apiClient.patch<PaintingPaintSystemUpdateResponse>(`${basePath}/config/paint-systems/${id}`, data);
    return response.data;
  },
};

// Convenience exports (mirrors paint.ts style)
export const getPaintingAnalyses = (params: PaintingAnalysisGetManyFormData = {}) => paintingAnalysisService.getPaintingAnalyses(params);
export const getPaintingAnalysisById = (id: string) => paintingAnalysisService.getPaintingAnalysisById(id);
export const createPaintingAnalysis = (data: PaintingAnalysisCreateFormData) => paintingAnalysisService.createPaintingAnalysis(data);
export const updatePaintingAnalysis = (id: string, data: PaintingAnalysisUpdateFormData) => paintingAnalysisService.updatePaintingAnalysis(id, data);
export const deletePaintingAnalysis = (id: string) => paintingAnalysisService.deletePaintingAnalysis(id);
export const addPaintingAnalysisFace = (analysisId: string, data: PaintingAnalysisFaceCreateFormData) => paintingAnalysisService.addPaintingAnalysisFace(analysisId, data);
export const updatePaintingAnalysisFace = (faceId: string, data: PaintingAnalysisFaceUpdateFormData) => paintingAnalysisService.updatePaintingAnalysisFace(faceId, data);
export const deletePaintingAnalysisFace = (faceId: string) => paintingAnalysisService.deletePaintingAnalysisFace(faceId);
export const processPaintingAnalysis = (id: string, data?: PaintingAnalysisProcessFormData) => paintingAnalysisService.processPaintingAnalysis(id, data);
export const computePaintingAnalysis = (id: string, data?: PaintingAnalysisComputeFormData) => paintingAnalysisService.computePaintingAnalysis(id, data);
export const updatePaintingRegion = (regionId: string, data: PaintingRegionUpdateFormData) => paintingAnalysisService.updatePaintingRegion(regionId, data);
export const updatePaintingBoundary = (boundaryId: string, data: PaintingBoundaryUpdateFormData) => paintingAnalysisService.updatePaintingBoundary(boundaryId, data);
export const updatePaintingStep = (stepId: string, data: PaintingStepUpdateFormData) => paintingAnalysisService.updatePaintingStep(stepId, data);
export const updatePaintingStepTask = (taskId: string, data: PaintingStepTaskUpdateFormData) => paintingAnalysisService.updatePaintingStepTask(taskId, data);
export const updatePaintingStepMaterial = (materialId: string, data: PaintingStepMaterialUpdateFormData) =>
  paintingAnalysisService.updatePaintingStepMaterial(materialId, data);
export const resolvePaintingAlert = (alertId: string) => paintingAnalysisService.resolvePaintingAlert(alertId);
export const getPaintingConfig = () => paintingAnalysisService.getPaintingConfig();
export const updatePaintingConfigRate = (id: string, data: PaintingRateUpdateFormData) => paintingAnalysisService.updatePaintingConfigRate(id, data);
export const updatePaintingConfigIndirect = (id: string, data: PaintingIndirectUpdateFormData) => paintingAnalysisService.updatePaintingConfigIndirect(id, data);
export const updatePaintingConfigRule = (id: string, data: PaintingRuleUpdateFormData) => paintingAnalysisService.updatePaintingConfigRule(id, data);
export const updatePaintingConfigProcessParams = (id: string, data: PaintingProcessParamsUpdateFormData) => paintingAnalysisService.updatePaintingConfigProcessParams(id, data);
export const updatePaintingConfigPaintSystem = (id: string, data: PaintingPaintSystemUpdateFormData) => paintingAnalysisService.updatePaintingConfigPaintSystem(id, data);
