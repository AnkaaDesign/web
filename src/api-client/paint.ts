// packages/api/src/paint.ts

import { apiClient } from "./axiosClient";
import type {
  // Schema types (for parameters)
  PaintGetManyFormData,
  PaintGetByIdFormData,
  PaintCreateFormData,
  PaintUpdateFormData,
  PaintBatchCreateFormData,
  PaintBatchUpdateFormData,
  PaintBatchUpdateColorOrderFormData,
  PaintBatchDeleteFormData,
  PaintFormulaGetManyFormData,
  PaintFormulaGetByIdFormData,
  PaintFormulaCreateFormData,
  PaintFormulaUpdateFormData,
  PaintFormulaBatchCreateFormData,
  PaintFormulaBatchUpdateFormData,
  PaintFormulaBatchDeleteFormData,
  PaintFormulaComponentGetManyFormData,
  PaintFormulaComponentGetByIdFormData,
  PaintFormulaComponentCreateFormData,
  PaintFormulaComponentUpdateFormData,
  PaintFormulaComponentBatchCreateFormData,
  PaintFormulaComponentBatchUpdateFormData,
  PaintFormulaComponentBatchDeleteFormData,
  PaintProductionGetManyFormData,
  PaintProductionGetByIdFormData,
  PaintProductionCreateFormData,
  PaintProductionUpdateFormData,
  PaintProductionBatchCreateFormData,
  PaintProductionBatchUpdateFormData,
  PaintProductionBatchDeleteFormData,
  // Paint Type types
  PaintTypeGetManyFormData,
  PaintTypeGetByIdFormData,
  PaintTypeCreateFormData,
  PaintTypeUpdateFormData,
  PaintTypeBatchCreateFormData,
  PaintTypeBatchUpdateFormData,
  PaintTypeBatchDeleteFormData,
  // Paint Ground types
  PaintGroundGetManyFormData,
  PaintGroundGetByIdFormData,
  PaintGroundCreateFormData,
  PaintGroundUpdateFormData,
  PaintGroundBatchCreateFormData,
  PaintGroundBatchUpdateFormData,
  PaintGroundBatchDeleteFormData,
  // Paint Brand types
  PaintBrandGetManyFormData,
  PaintBrandGetByIdFormData,
  PaintBrandCreateFormData,
  PaintBrandUpdateFormData,
  PaintBrandBatchCreateFormData,
  PaintBrandBatchUpdateFormData,
  PaintBrandBatchDeleteFormData,
  // Merge types
  PaintMergeFormData,
  // Query types
  PaintQueryFormData,
  PaintFormulaQueryFormData,
  PaintFormulaComponentQueryFormData,
  PaintProductionQueryFormData,
  PaintTypeQueryFormData,
  PaintGroundQueryFormData,
  PaintBrandQueryFormData,
  // Item types for component filtering
  ItemGetManyFormData,
} from "../schemas";
import type {
  // Interface types (for responses)
  Paint,
  PaintFormula,
  PaintFormulaComponent,
  PaintProduction,
  PaintGetUniqueResponse,
  PaintGetManyResponse,
  PaintCreateResponse,
  PaintUpdateResponse,
  PaintDeleteResponse,
  PaintBatchCreateResponse,
  PaintBatchUpdateResponse,
  PaintBatchDeleteResponse,
  PaintFormulaGetUniqueResponse,
  PaintFormulaGetManyResponse,
  PaintFormulaCreateResponse,
  PaintFormulaUpdateResponse,
  PaintFormulaDeleteResponse,
  PaintFormulaBatchCreateResponse,
  PaintFormulaBatchUpdateResponse,
  PaintFormulaBatchDeleteResponse,
  PaintFormulaComponentGetUniqueResponse,
  PaintFormulaComponentGetManyResponse,
  PaintFormulaComponentCreateResponse,
  PaintFormulaComponentUpdateResponse,
  PaintFormulaComponentDeleteResponse,
  PaintFormulaComponentBatchCreateResponse,
  PaintFormulaComponentBatchUpdateResponse,
  PaintFormulaComponentBatchDeleteResponse,
  PaintProductionGetUniqueResponse,
  PaintProductionGetManyResponse,
  PaintProductionCreateResponse,
  PaintProductionUpdateResponse,
  PaintProductionDeleteResponse,
  PaintProductionBatchCreateResponse,
  PaintProductionBatchUpdateResponse,
  PaintProductionBatchDeleteResponse,
  // Paint Type types
  PaintType,
  PaintTypeGetManyResponse,
  PaintTypeGetUniqueResponse,
  PaintTypeCreateResponse,
  PaintTypeUpdateResponse,
  PaintTypeDeleteResponse,
  PaintTypeBatchCreateResponse,
  PaintTypeBatchUpdateResponse,
  PaintTypeBatchDeleteResponse,
  // Paint Ground types
  PaintGround,
  PaintGroundGetManyResponse,
  PaintGroundGetUniqueResponse,
  PaintGroundCreateResponse,
  PaintGroundUpdateResponse,
  PaintGroundDeleteResponse,
  PaintGroundBatchCreateResponse,
  PaintGroundBatchUpdateResponse,
  PaintGroundBatchDeleteResponse,
  // Paint Brand types
  PaintBrand,
  PaintBrandGetManyResponse,
  PaintBrandGetUniqueResponse,
  PaintBrandCreateResponse,
  PaintBrandUpdateResponse,
  PaintBrandDeleteResponse,
  PaintBrandBatchCreateResponse,
  PaintBrandBatchUpdateResponse,
  PaintBrandBatchDeleteResponse,
  // Merge response types
  PaintMergeResponse,
  // Item types for component filtering
  ItemGetManyResponse,
} from "../types";

// =====================
// Paint Service Class
// =====================

export class PaintService {
  private readonly basePath = "/paints";

  // =====================
  // Paint Query Operations
  // =====================

  async getPaints(params: PaintGetManyFormData = {}): Promise<PaintGetManyResponse> {
    // Clean up params to remove empty strings, undefined, and null values
    const cleanedParams = Object.entries(params).reduce((acc, [key, value]: [string, any]) => {
      // Skip empty strings, null, undefined
      if (value === "" || value === null || value === undefined) {
        return acc;
      }

      // CRITICAL: Skip color similarity if it's the default black color or invalid
      if (key === "similarColor" && (value === "#000000" || value === "")) {
        return acc;
      }

      // CRITICAL: Skip threshold if there's no color
      if (key === "similarColorThreshold" && (!params.similarColor || params.similarColor === "#000000" || params.similarColor === "")) {
        return acc;
      }

      // Only include valid values
      acc[key as keyof PaintGetManyFormData] = value;
      return acc;
    }, {} as Partial<PaintGetManyFormData>);


    const response = await apiClient.get<PaintGetManyResponse>(this.basePath, { params: cleanedParams });
    return response.data;
  }

  async getPaintById(id: string, params?: Omit<PaintGetByIdFormData, "id">): Promise<PaintGetUniqueResponse> {
    const response = await apiClient.get<PaintGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // Paint CRUD Operations
  // =====================

  async createPaint(
    data: PaintCreateFormData,
    query?: PaintQueryFormData,
    skipNotification = false,
    colorPreviewFile?: File
  ): Promise<PaintCreateResponse> {
    const headers: Record<string, string> = skipNotification ? { "X-Skip-Success-Notification": "true" } : {};

    // If there's a file, use FormData
    if (colorPreviewFile) {
      const formData = this.createFormDataWithFile(data, colorPreviewFile);
      const response = await apiClient.post<PaintCreateResponse>(this.basePath, formData, {
        params: query,
        headers,
      });
      return response.data;
    }

    // Otherwise, use JSON
    const response = await apiClient.post<PaintCreateResponse>(this.basePath, data, {
      params: query,
      headers,
    });
    return response.data;
  }

  async updatePaint(
    id: string,
    data: PaintUpdateFormData,
    query?: PaintQueryFormData,
    colorPreviewFile?: File
  ): Promise<PaintUpdateResponse> {
    // If there's a file, use FormData
    if (colorPreviewFile) {
      const formData = this.createFormDataWithFile(data, colorPreviewFile);
      const response = await apiClient.put<PaintUpdateResponse>(`${this.basePath}/${id}`, formData, { params: query });
      return response.data;
    }

    // Otherwise, use JSON
    const response = await apiClient.put<PaintUpdateResponse>(`${this.basePath}/${id}`, data, { params: query });
    return response.data;
  }

  /**
   * Helper to create FormData with paint data and colorPreview file
   */
  private createFormDataWithFile(data: PaintCreateFormData | PaintUpdateFormData, file: File): FormData {
    const formData = new FormData();

    // Add the file
    formData.append("colorPreview", file);

    // Add other form data fields
    Object.entries(data).forEach(([key, value]) => {
      if (value === null || value === undefined || key === "colorPreview") {
        return;
      }

      if (Array.isArray(value)) {
        // For arrays like tags and groundIds, use JSON string
        formData.append(key, JSON.stringify(value));
      } else if (typeof value === "object") {
        formData.append(key, JSON.stringify(value));
      } else {
        formData.append(key, String(value));
      }
    });

    return formData;
  }

  async deletePaint(id: string): Promise<PaintDeleteResponse> {
    const response = await apiClient.delete<PaintDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Paint Brand Integration Methods
  // =====================

  /**
   * Get all paints associated with a specific paint brand
   */
  async getPaintsByBrandId(brandId: string, params?: Omit<PaintGetManyFormData, "paintBrandIds">): Promise<PaintGetManyResponse> {
    const requestParams: PaintGetManyFormData = {
      ...params,
      paintBrandIds: [brandId],
    };
    const response = await apiClient.get<PaintGetManyResponse>(this.basePath, { params: requestParams });
    return response.data;
  }

  /**
   * Get paints filtered by multiple paint brands
   */
  async getPaintsByBrandIds(brandIds: string[], params?: Omit<PaintGetManyFormData, "paintBrandIds">): Promise<PaintGetManyResponse> {
    const requestParams: PaintGetManyFormData = {
      ...params,
      paintBrandIds: brandIds,
    };
    const response = await apiClient.get<PaintGetManyResponse>(this.basePath, { params: requestParams });
    return response.data;
  }

  // =====================
  // Paint Batch Operations
  // =====================

  async batchCreatePaints(data: PaintBatchCreateFormData, query?: PaintQueryFormData): Promise<PaintBatchCreateResponse<Paint>> {
    const response = await apiClient.post<PaintBatchCreateResponse<Paint>>(`${this.basePath}/batch`, data, { params: query });
    return response.data;
  }

  async batchUpdatePaints(data: PaintBatchUpdateFormData, query?: PaintQueryFormData): Promise<PaintBatchUpdateResponse<Paint>> {
    const response = await apiClient.put<PaintBatchUpdateResponse<Paint>>(`${this.basePath}/batch`, data, { params: query });
    return response.data;
  }

  async batchDeletePaints(data: PaintBatchDeleteFormData): Promise<PaintBatchDeleteResponse> {
    const response = await apiClient.delete<PaintBatchDeleteResponse>(`${this.basePath}/batch`, { data });
    return response.data;
  }

  // =====================
  // Paint Merge Operations
  // =====================

  async mergePaints(data: PaintMergeFormData, query?: PaintQueryFormData): Promise<PaintMergeResponse> {
    const response = await apiClient.post<PaintMergeResponse>(`${this.basePath}/merge`, data, { params: query });
    return response.data;
  }

  // Paint Batch Update Color Order
  async batchUpdateColorOrder(data: PaintBatchUpdateColorOrderFormData) {
    const response = await apiClient.put(`${this.basePath}/batch/color-order`, data);
    return response.data;
  }

  // =====================
  // Component Intersection Operations
  // =====================

  /**
   * Get available components based on intersection of paint brand and paint type
   * Returns only components that exist in BOTH paint brand AND paint type
   */
  async getAvailableComponents(paintBrandId: string, paintTypeId: string): Promise<ItemGetManyResponse> {
    const response = await apiClient.get<ItemGetManyResponse>(`${this.basePath}/components/available/${paintBrandId}/${paintTypeId}`);
    return response.data;
  }
}

// =====================
// Paint Formula Service Class
// =====================

export class PaintFormulaService {
  private readonly basePath = "/paints/formulas";

  // =====================
  // Query Operations
  // =====================

  async getPaintFormulas(params: PaintFormulaGetManyFormData = {}): Promise<PaintFormulaGetManyResponse> {
    const response = await apiClient.get<PaintFormulaGetManyResponse>(this.basePath, { params });
    return response.data;
  }

  async getPaintFormulasByPaintId(paintId: string, params: Omit<PaintFormulaGetManyFormData, "paintIds"> = {}): Promise<PaintFormulaGetManyResponse> {
    const requestParams: PaintFormulaGetManyFormData = {
      ...params,
      paintIds: [paintId],
    };
    const response = await apiClient.get<PaintFormulaGetManyResponse>(this.basePath, { params: requestParams });
    return response.data;
  }

  async getPaintFormulaById(id: string, params?: PaintFormulaGetByIdFormData): Promise<PaintFormulaGetUniqueResponse> {
    const response = await apiClient.get<PaintFormulaGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  /**
   * Get paint formulas filtered by paint brand compatibility
   */
  async getPaintFormulasByBrandId(brandId: string, params?: Omit<PaintFormulaGetManyFormData, "paintIds">): Promise<PaintFormulaGetManyResponse> {
    // First get paints by brand
    const paintsResponse = await apiClient.get<PaintGetManyResponse>("/paints", {
      params: { paintBrandIds: [brandId] },
    });

    if (!paintsResponse.data?.data?.length) {
      return { success: true, data: [], message: "No formulas found for this brand" };
    }

    const paintIds = paintsResponse.data.data.map((paint) => paint.id);
    const requestParams: PaintFormulaGetManyFormData = {
      ...params,
      paintIds,
    };

    const response = await apiClient.get<PaintFormulaGetManyResponse>(this.basePath, { params: requestParams });
    return response.data;
  }

  // =====================
  // CRUD Operations
  // =====================

  async createPaintFormula(data: PaintFormulaCreateFormData, query?: PaintFormulaQueryFormData): Promise<PaintFormulaCreateResponse> {
    const response = await apiClient.post<PaintFormulaCreateResponse>(this.basePath, data, { params: query });
    return response.data;
  }

  async updatePaintFormula(id: string, data: PaintFormulaUpdateFormData, query?: PaintFormulaQueryFormData): Promise<PaintFormulaUpdateResponse> {
    const response = await apiClient.put<PaintFormulaUpdateResponse>(`${this.basePath}/${id}`, data, { params: query });
    return response.data;
  }

  async deletePaintFormula(id: string): Promise<PaintFormulaDeleteResponse> {
    const response = await apiClient.delete<PaintFormulaDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreatePaintFormulas(data: PaintFormulaBatchCreateFormData, query?: PaintFormulaQueryFormData): Promise<PaintFormulaBatchCreateResponse<PaintFormula>> {
    const response = await apiClient.post<PaintFormulaBatchCreateResponse<PaintFormula>>(`${this.basePath}/batch`, data, { params: query });
    return response.data;
  }

  async batchUpdatePaintFormulas(data: PaintFormulaBatchUpdateFormData, query?: PaintFormulaQueryFormData): Promise<PaintFormulaBatchUpdateResponse<PaintFormula>> {
    const response = await apiClient.put<PaintFormulaBatchUpdateResponse<PaintFormula>>(`${this.basePath}/batch`, data, { params: query });
    return response.data;
  }

  async batchDeletePaintFormulas(data: PaintFormulaBatchDeleteFormData): Promise<PaintFormulaBatchDeleteResponse> {
    const response = await apiClient.delete<PaintFormulaBatchDeleteResponse>(`${this.basePath}/batch`, { data });
    return response.data;
  }
}

// =====================
// Paint Formula Component Service Class
// =====================

export class PaintFormulaComponentService {
  private readonly basePath = "/paints/formula-components";

  // =====================
  // Query Operations
  // =====================

  async getPaintFormulaComponents(params: PaintFormulaComponentGetManyFormData = {}): Promise<PaintFormulaComponentGetManyResponse> {
    const response = await apiClient.get<PaintFormulaComponentGetManyResponse>(this.basePath, { params });
    return response.data;
  }

  async getPaintFormulaComponentById(id: string, params?: PaintFormulaComponentGetByIdFormData): Promise<PaintFormulaComponentGetUniqueResponse> {
    const response = await apiClient.get<PaintFormulaComponentGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // CRUD Operations
  // =====================

  async createPaintFormulaComponent(data: PaintFormulaComponentCreateFormData, query?: PaintFormulaComponentQueryFormData): Promise<PaintFormulaComponentCreateResponse> {
    const response = await apiClient.post<PaintFormulaComponentCreateResponse>(this.basePath, data, { params: query });
    return response.data;
  }

  async updatePaintFormulaComponent(
    id: string,
    data: PaintFormulaComponentUpdateFormData,
    query?: PaintFormulaComponentQueryFormData,
  ): Promise<PaintFormulaComponentUpdateResponse> {
    const response = await apiClient.put<PaintFormulaComponentUpdateResponse>(`${this.basePath}/${id}`, data, { params: query });
    return response.data;
  }

  async deletePaintFormulaComponent(id: string): Promise<PaintFormulaComponentDeleteResponse> {
    const response = await apiClient.delete<PaintFormulaComponentDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreatePaintFormulaComponents(
    data: PaintFormulaComponentBatchCreateFormData,
    query?: PaintFormulaComponentQueryFormData,
  ): Promise<PaintFormulaComponentBatchCreateResponse<PaintFormulaComponent>> {
    const response = await apiClient.post<PaintFormulaComponentBatchCreateResponse<PaintFormulaComponent>>(`${this.basePath}/batch`, data, { params: query });
    return response.data;
  }

  async batchUpdatePaintFormulaComponents(
    data: PaintFormulaComponentBatchUpdateFormData,
    query?: PaintFormulaComponentQueryFormData,
  ): Promise<PaintFormulaComponentBatchUpdateResponse<PaintFormulaComponent>> {
    const response = await apiClient.put<PaintFormulaComponentBatchUpdateResponse<PaintFormulaComponent>>(`${this.basePath}/batch`, data, { params: query });
    return response.data;
  }

  async batchDeletePaintFormulaComponents(data: PaintFormulaComponentBatchDeleteFormData): Promise<PaintFormulaComponentBatchDeleteResponse> {
    const response = await apiClient.delete<PaintFormulaComponentBatchDeleteResponse>(`${this.basePath}/batch`, { data });
    return response.data;
  }

  // =====================
  // Formulation Test Operations
  // =====================

  async deductForFormulationTest(data: {
    itemId: string;
    weight: number;
    formulaPaintId?: string;
  }): Promise<{
    success: boolean;
    message: string;
    data: {
      unitsDeducted: number;
      remainingQuantity: number;
    };
  }> {
    const response = await apiClient.post(`${this.basePath}/deduct-for-test`, data);
    return response.data;
  }
}

// =====================
// Paint Production Service Class
// =====================

export class PaintProductionService {
  private readonly basePath = "/paints/productions";

  // =====================
  // Query Operations
  // =====================

  async getPaintProductions(params: PaintProductionGetManyFormData = {}): Promise<PaintProductionGetManyResponse> {
    const response = await apiClient.get<PaintProductionGetManyResponse>(this.basePath, { params });
    return response.data;
  }

  async getPaintProductionById(id: string, params?: PaintProductionGetByIdFormData): Promise<PaintProductionGetUniqueResponse> {
    const response = await apiClient.get<PaintProductionGetUniqueResponse>(`${this.basePath}/${id}`, {
      params,
    });
    return response.data;
  }

  // =====================
  // CRUD Operations
  // =====================

  async createPaintProduction(data: PaintProductionCreateFormData, query?: PaintProductionQueryFormData): Promise<PaintProductionCreateResponse> {
    const response = await apiClient.post<PaintProductionCreateResponse>(this.basePath, data, { params: query });
    return response.data;
  }

  async updatePaintProduction(id: string, data: PaintProductionUpdateFormData, query?: PaintProductionQueryFormData): Promise<PaintProductionUpdateResponse> {
    const response = await apiClient.put<PaintProductionUpdateResponse>(`${this.basePath}/${id}`, data, { params: query });
    return response.data;
  }

  async deletePaintProduction(id: string): Promise<PaintProductionDeleteResponse> {
    const response = await apiClient.delete<PaintProductionDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreatePaintProductions(data: PaintProductionBatchCreateFormData, query?: PaintProductionQueryFormData): Promise<PaintProductionBatchCreateResponse<PaintProduction>> {
    const response = await apiClient.post<PaintProductionBatchCreateResponse<PaintProduction>>(`${this.basePath}/batch`, data, { params: query });
    return response.data;
  }

  async batchUpdatePaintProductions(data: PaintProductionBatchUpdateFormData, query?: PaintProductionQueryFormData): Promise<PaintProductionBatchUpdateResponse<PaintProduction>> {
    const response = await apiClient.put<PaintProductionBatchUpdateResponse<PaintProduction>>(`${this.basePath}/batch`, data, { params: query });
    return response.data;
  }

  async batchDeletePaintProductions(data: PaintProductionBatchDeleteFormData): Promise<PaintProductionBatchDeleteResponse> {
    const response = await apiClient.delete<PaintProductionBatchDeleteResponse>(`${this.basePath}/batch`, { data });
    return response.data;
  }
}

// =====================
// Paint Type Service Class
// =====================

export class PaintTypeService {
  private readonly basePath = "/paints/types";

  // =====================
  // Query Operations
  // =====================

  async getPaintTypes(params: PaintTypeGetManyFormData = {}): Promise<PaintTypeGetManyResponse> {
    const response = await apiClient.get<PaintTypeGetManyResponse>(this.basePath, { params });
    return response.data;
  }

  async getPaintTypeById(id: string, params?: Omit<PaintTypeGetByIdFormData, "id">): Promise<PaintTypeGetUniqueResponse> {
    const response = await apiClient.get<PaintTypeGetUniqueResponse>(`${this.basePath}/${id}`, { params });
    return response.data;
  }

  // =====================
  // CRUD Operations
  // =====================

  async createPaintType(data: PaintTypeCreateFormData, query?: PaintTypeQueryFormData): Promise<PaintTypeCreateResponse> {
    const response = await apiClient.post<PaintTypeCreateResponse>(this.basePath, data, { params: query });
    return response.data;
  }

  async updatePaintType(id: string, data: PaintTypeUpdateFormData, query?: PaintTypeQueryFormData): Promise<PaintTypeUpdateResponse> {
    const response = await apiClient.put<PaintTypeUpdateResponse>(`${this.basePath}/${id}`, data, { params: query });
    return response.data;
  }

  async deletePaintType(id: string): Promise<PaintTypeDeleteResponse> {
    const response = await apiClient.delete<PaintTypeDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreatePaintTypes(data: PaintTypeBatchCreateFormData, query?: PaintTypeQueryFormData): Promise<PaintTypeBatchCreateResponse<PaintType>> {
    const response = await apiClient.post<PaintTypeBatchCreateResponse<PaintType>>(`${this.basePath}/batch`, data, { params: query });
    return response.data;
  }

  async batchUpdatePaintTypes(data: PaintTypeBatchUpdateFormData, query?: PaintTypeQueryFormData): Promise<PaintTypeBatchUpdateResponse<PaintType>> {
    const response = await apiClient.put<PaintTypeBatchUpdateResponse<PaintType>>(`${this.basePath}/batch`, data, { params: query });
    return response.data;
  }

  async batchDeletePaintTypes(data: PaintTypeBatchDeleteFormData): Promise<PaintTypeBatchDeleteResponse> {
    const response = await apiClient.delete<PaintTypeBatchDeleteResponse>(`${this.basePath}/batch`, { data });
    return response.data;
  }
}

// =====================
// Paint Ground Service Class
// =====================

export class PaintGroundService {
  private readonly basePath = "/paints/grounds";

  // =====================
  // Query Operations
  // =====================

  async getPaintGrounds(params: PaintGroundGetManyFormData = {}): Promise<PaintGroundGetManyResponse> {
    const response = await apiClient.get<PaintGroundGetManyResponse>(this.basePath, { params });
    return response.data;
  }

  async getPaintGroundById(id: string, params?: Omit<PaintGroundGetByIdFormData, "id">): Promise<PaintGroundGetUniqueResponse> {
    const response = await apiClient.get<PaintGroundGetUniqueResponse>(`${this.basePath}/${id}`, { params });
    return response.data;
  }

  // =====================
  // CRUD Operations
  // =====================

  async createPaintGround(data: PaintGroundCreateFormData, query?: PaintGroundQueryFormData): Promise<PaintGroundCreateResponse> {
    const response = await apiClient.post<PaintGroundCreateResponse>(this.basePath, data, { params: query });
    return response.data;
  }

  async updatePaintGround(id: string, data: PaintGroundUpdateFormData, query?: PaintGroundQueryFormData): Promise<PaintGroundUpdateResponse> {
    const response = await apiClient.put<PaintGroundUpdateResponse>(`${this.basePath}/${id}`, data, { params: query });
    return response.data;
  }

  async deletePaintGround(id: string): Promise<PaintGroundDeleteResponse> {
    const response = await apiClient.delete<PaintGroundDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreatePaintGrounds(data: PaintGroundBatchCreateFormData, query?: PaintGroundQueryFormData): Promise<PaintGroundBatchCreateResponse<PaintGround>> {
    const response = await apiClient.post<PaintGroundBatchCreateResponse<PaintGround>>(`${this.basePath}/batch`, data, { params: query });
    return response.data;
  }

  async batchUpdatePaintGrounds(data: PaintGroundBatchUpdateFormData, query?: PaintGroundQueryFormData): Promise<PaintGroundBatchUpdateResponse<PaintGround>> {
    const response = await apiClient.put<PaintGroundBatchUpdateResponse<PaintGround>>(`${this.basePath}/batch`, data, { params: query });
    return response.data;
  }

  async batchDeletePaintGrounds(data: PaintGroundBatchDeleteFormData): Promise<PaintGroundBatchDeleteResponse> {
    const response = await apiClient.delete<PaintGroundBatchDeleteResponse>(`${this.basePath}/batch`, { data });
    return response.data;
  }
}

// =====================
// Paint Brand Service Class
// =====================

export class PaintBrandService {
  private readonly basePath = "/paint-brands";

  // =====================
  // Query Operations
  // =====================

  async getPaintBrands(params: PaintBrandGetManyFormData = {}): Promise<PaintBrandGetManyResponse> {
    const response = await apiClient.get<PaintBrandGetManyResponse>(this.basePath, { params });
    return response.data;
  }

  async getPaintBrandById(id: string, params?: Omit<PaintBrandGetByIdFormData, "id">): Promise<PaintBrandGetUniqueResponse> {
    const response = await apiClient.get<PaintBrandGetUniqueResponse>(`${this.basePath}/${id}`, { params });
    return response.data;
  }

  // =====================
  // CRUD Operations
  // =====================

  async createPaintBrand(data: PaintBrandCreateFormData, query?: PaintBrandQueryFormData): Promise<PaintBrandCreateResponse> {
    const response = await apiClient.post<PaintBrandCreateResponse>(this.basePath, data, { params: query });
    return response.data;
  }

  async updatePaintBrand(id: string, data: PaintBrandUpdateFormData, query?: PaintBrandQueryFormData): Promise<PaintBrandUpdateResponse> {
    const response = await apiClient.put<PaintBrandUpdateResponse>(`${this.basePath}/${id}`, data, { params: query });
    return response.data;
  }

  async deletePaintBrand(id: string): Promise<PaintBrandDeleteResponse> {
    const response = await apiClient.delete<PaintBrandDeleteResponse>(`${this.basePath}/${id}`);
    return response.data;
  }

  // =====================
  // Component Filtering Operations
  // =====================

  /**
   * Get all component items associated with a specific paint brand
   */
  async getComponentItemsByBrandId(brandId: string, params?: Omit<ItemGetManyFormData, "where">): Promise<ItemGetManyResponse> {
    const response = await apiClient.get<ItemGetManyResponse>(`${this.basePath}/${brandId}/components`, {
      params,
    });
    return response.data;
  }

  /**
   * Get all component items that can be used with the specified paint brands
   */
  async getComponentItemsByBrandIds(brandIds: string[], params?: Omit<ItemGetManyFormData, "where">): Promise<ItemGetManyResponse> {
    const requestParams: ItemGetManyFormData = {
      ...params,
      where: {
        ...params?.where,
        paintBrands: {
          some: {
            id: {
              in: brandIds,
            },
          },
        },
      },
    };
    const response = await apiClient.get<ItemGetManyResponse>("/items", { params: requestParams });
    return response.data;
  }

  /**
   * Get items filtered by paint brand compatibility
   */
  async getItemsCompatibleWithBrands(brandIds: string[], params?: Omit<ItemGetManyFormData, "paintBrandIds">): Promise<ItemGetManyResponse> {
    const requestParams: ItemGetManyFormData = {
      ...params,
      paintBrandIds: brandIds,
    };
    const response = await apiClient.get<ItemGetManyResponse>("/items", { params: requestParams });
    return response.data;
  }

  // =====================
  // Batch Operations
  // =====================

  async batchCreatePaintBrands(data: PaintBrandBatchCreateFormData, query?: PaintBrandQueryFormData): Promise<PaintBrandBatchCreateResponse<PaintBrand>> {
    const response = await apiClient.post<PaintBrandBatchCreateResponse<PaintBrand>>(`${this.basePath}/batch`, data, { params: query });
    return response.data;
  }

  async batchUpdatePaintBrands(data: PaintBrandBatchUpdateFormData, query?: PaintBrandQueryFormData): Promise<PaintBrandBatchUpdateResponse<PaintBrand>> {
    const response = await apiClient.put<PaintBrandBatchUpdateResponse<PaintBrand>>(`${this.basePath}/batch`, data, { params: query });
    return response.data;
  }

  async batchDeletePaintBrands(data: PaintBrandBatchDeleteFormData): Promise<PaintBrandBatchDeleteResponse> {
    const response = await apiClient.delete<PaintBrandBatchDeleteResponse>(`${this.basePath}/batch`, { data });
    return response.data;
  }
}

// =====================
// Service Instances & Exports
// =====================

export const paintService = new PaintService();
export const paintFormulaService = new PaintFormulaService();
export const paintFormulaComponentService = new PaintFormulaComponentService();
export const paintProductionService = new PaintProductionService();
export const paintTypeService = new PaintTypeService();
export const paintGroundService = new PaintGroundService();
export const paintBrandService = new PaintBrandService();

// Paint exports
export const getPaints = (params: PaintGetManyFormData = {}) => paintService.getPaints(params);
export const getPaintById = (id: string, params?: Omit<PaintGetByIdFormData, "id">) => paintService.getPaintById(id, params);
export const createPaint = (data: PaintCreateFormData, query?: PaintQueryFormData, skipNotification = false, colorPreviewFile?: File) => paintService.createPaint(data, query, skipNotification, colorPreviewFile);
export const updatePaint = (id: string, data: PaintUpdateFormData, query?: PaintQueryFormData, colorPreviewFile?: File) => paintService.updatePaint(id, data, query, colorPreviewFile);
export const deletePaint = (id: string) => paintService.deletePaint(id);
export const batchCreatePaints = (data: PaintBatchCreateFormData, query?: PaintQueryFormData) => paintService.batchCreatePaints(data, query);
export const batchUpdatePaints = (data: PaintBatchUpdateFormData, query?: PaintQueryFormData) => paintService.batchUpdatePaints(data, query);
export const batchDeletePaints = (data: PaintBatchDeleteFormData) => paintService.batchDeletePaints(data);
export const mergePaints = (data: PaintMergeFormData, query?: PaintQueryFormData) => paintService.mergePaints(data, query);
export const batchUpdatePaintColorOrder = (data: PaintBatchUpdateColorOrderFormData) => paintService.batchUpdateColorOrder(data);

// Component Intersection exports
export const getAvailableComponents = (paintBrandId: string, paintTypeId: string) => paintService.getAvailableComponents(paintBrandId, paintTypeId);

// Paint Brand Integration exports
export const getPaintsByBrandId = (brandId: string, params?: Omit<PaintGetManyFormData, "paintBrandIds">) => paintService.getPaintsByBrandId(brandId, params);
export const getPaintsByBrandIds = (brandIds: string[], params?: Omit<PaintGetManyFormData, "paintBrandIds">) => paintService.getPaintsByBrandIds(brandIds, params);

// Paint Formula exports
export const getPaintFormulas = (params: PaintFormulaGetManyFormData = {}) => paintFormulaService.getPaintFormulas(params);
export const getPaintFormulasByPaintId = (paintId: string, params?: Omit<PaintFormulaGetManyFormData, "paintIds">) =>
  paintFormulaService.getPaintFormulasByPaintId(paintId, params);
export const getPaintFormulaById = (id: string, params?: PaintFormulaGetByIdFormData) => paintFormulaService.getPaintFormulaById(id, params);
export const createPaintFormula = (data: PaintFormulaCreateFormData, query?: PaintFormulaQueryFormData) => paintFormulaService.createPaintFormula(data, query);
export const updatePaintFormula = (id: string, data: PaintFormulaUpdateFormData, query?: PaintFormulaQueryFormData) => paintFormulaService.updatePaintFormula(id, data, query);
export const deletePaintFormula = (id: string) => paintFormulaService.deletePaintFormula(id);
export const batchCreatePaintFormulas = (data: PaintFormulaBatchCreateFormData, query?: PaintFormulaQueryFormData) => paintFormulaService.batchCreatePaintFormulas(data, query);
export const batchUpdatePaintFormulas = (data: PaintFormulaBatchUpdateFormData, query?: PaintFormulaQueryFormData) => paintFormulaService.batchUpdatePaintFormulas(data, query);
export const batchDeletePaintFormulas = (data: PaintFormulaBatchDeleteFormData) => paintFormulaService.batchDeletePaintFormulas(data);

// Paint Formula Brand Integration exports
export const getPaintFormulasByBrandId = (brandId: string, params?: Omit<PaintFormulaGetManyFormData, "paintIds">) =>
  paintFormulaService.getPaintFormulasByBrandId(brandId, params);

// Paint Formula Component exports
export const getPaintFormulaComponents = (params: PaintFormulaComponentGetManyFormData = {}) => paintFormulaComponentService.getPaintFormulaComponents(params);
export const getPaintFormulaComponentById = (id: string, params?: PaintFormulaComponentGetByIdFormData) => paintFormulaComponentService.getPaintFormulaComponentById(id, params);
export const createPaintFormulaComponent = (data: PaintFormulaComponentCreateFormData, query?: PaintFormulaComponentQueryFormData) =>
  paintFormulaComponentService.createPaintFormulaComponent(data, query);
export const updatePaintFormulaComponent = (id: string, data: PaintFormulaComponentUpdateFormData, query?: PaintFormulaComponentQueryFormData) =>
  paintFormulaComponentService.updatePaintFormulaComponent(id, data, query);
export const deletePaintFormulaComponent = (id: string) => paintFormulaComponentService.deletePaintFormulaComponent(id);
export const batchCreatePaintFormulaComponents = (data: PaintFormulaComponentBatchCreateFormData, query?: PaintFormulaComponentQueryFormData) =>
  paintFormulaComponentService.batchCreatePaintFormulaComponents(data, query);
export const batchUpdatePaintFormulaComponents = (data: PaintFormulaComponentBatchUpdateFormData, query?: PaintFormulaComponentQueryFormData) =>
  paintFormulaComponentService.batchUpdatePaintFormulaComponents(data, query);
export const batchDeletePaintFormulaComponents = (data: PaintFormulaComponentBatchDeleteFormData) => paintFormulaComponentService.batchDeletePaintFormulaComponents(data);

// Paint Production exports
export const getPaintProductions = (params: PaintProductionGetManyFormData = {}) => paintProductionService.getPaintProductions(params);
export const getPaintProductionById = (id: string, params?: PaintProductionGetByIdFormData) => paintProductionService.getPaintProductionById(id, params);
export const createPaintProduction = (data: PaintProductionCreateFormData, query?: PaintProductionQueryFormData) => paintProductionService.createPaintProduction(data, query);
export const updatePaintProduction = (id: string, data: PaintProductionUpdateFormData, query?: PaintProductionQueryFormData) =>
  paintProductionService.updatePaintProduction(id, data, query);
export const deletePaintProduction = (id: string) => paintProductionService.deletePaintProduction(id);
export const batchCreatePaintProductions = (data: PaintProductionBatchCreateFormData, query?: PaintProductionQueryFormData) =>
  paintProductionService.batchCreatePaintProductions(data, query);
export const batchUpdatePaintProductions = (data: PaintProductionBatchUpdateFormData, query?: PaintProductionQueryFormData) =>
  paintProductionService.batchUpdatePaintProductions(data, query);
export const batchDeletePaintProductions = (data: PaintProductionBatchDeleteFormData) => paintProductionService.batchDeletePaintProductions(data);

// Paint Type exports
export const getPaintTypes = (params: PaintTypeGetManyFormData = {}) => paintTypeService.getPaintTypes(params);
export const getPaintTypeById = (id: string, params?: Omit<PaintTypeGetByIdFormData, "id">) => paintTypeService.getPaintTypeById(id, params);
export const createPaintType = (data: PaintTypeCreateFormData, query?: PaintTypeQueryFormData) => paintTypeService.createPaintType(data, query);
export const updatePaintType = (id: string, data: PaintTypeUpdateFormData, query?: PaintTypeQueryFormData) => paintTypeService.updatePaintType(id, data, query);
export const deletePaintType = (id: string) => paintTypeService.deletePaintType(id);
export const batchCreatePaintTypes = (data: PaintTypeBatchCreateFormData, query?: PaintTypeQueryFormData) => paintTypeService.batchCreatePaintTypes(data, query);
export const batchUpdatePaintTypes = (data: PaintTypeBatchUpdateFormData, query?: PaintTypeQueryFormData) => paintTypeService.batchUpdatePaintTypes(data, query);
export const batchDeletePaintTypes = (data: PaintTypeBatchDeleteFormData) => paintTypeService.batchDeletePaintTypes(data);

// Paint Ground exports
export const getPaintGrounds = (params: PaintGroundGetManyFormData = {}) => paintGroundService.getPaintGrounds(params);
export const getPaintGroundById = (id: string, params?: Omit<PaintGroundGetByIdFormData, "id">) => paintGroundService.getPaintGroundById(id, params);
export const createPaintGround = (data: PaintGroundCreateFormData, query?: PaintGroundQueryFormData) => paintGroundService.createPaintGround(data, query);
export const updatePaintGround = (id: string, data: PaintGroundUpdateFormData, query?: PaintGroundQueryFormData) => paintGroundService.updatePaintGround(id, data, query);
export const deletePaintGround = (id: string) => paintGroundService.deletePaintGround(id);
export const batchCreatePaintGrounds = (data: PaintGroundBatchCreateFormData, query?: PaintGroundQueryFormData) => paintGroundService.batchCreatePaintGrounds(data, query);
export const batchUpdatePaintGrounds = (data: PaintGroundBatchUpdateFormData, query?: PaintGroundQueryFormData) => paintGroundService.batchUpdatePaintGrounds(data, query);
export const batchDeletePaintGrounds = (data: PaintGroundBatchDeleteFormData) => paintGroundService.batchDeletePaintGrounds(data);

// Paint Brand exports
export const getPaintBrands = (params: PaintBrandGetManyFormData = {}) => paintBrandService.getPaintBrands(params);
export const getPaintBrandById = (id: string, params?: Omit<PaintBrandGetByIdFormData, "id">) => paintBrandService.getPaintBrandById(id, params);
export const createPaintBrand = (data: PaintBrandCreateFormData, query?: PaintBrandQueryFormData) => paintBrandService.createPaintBrand(data, query);
export const updatePaintBrand = (id: string, data: PaintBrandUpdateFormData, query?: PaintBrandQueryFormData) => paintBrandService.updatePaintBrand(id, data, query);
export const deletePaintBrand = (id: string) => paintBrandService.deletePaintBrand(id);
export const batchCreatePaintBrands = (data: PaintBrandBatchCreateFormData, query?: PaintBrandQueryFormData) => paintBrandService.batchCreatePaintBrands(data, query);
export const batchUpdatePaintBrands = (data: PaintBrandBatchUpdateFormData, query?: PaintBrandQueryFormData) => paintBrandService.batchUpdatePaintBrands(data, query);
export const batchDeletePaintBrands = (data: PaintBrandBatchDeleteFormData) => paintBrandService.batchDeletePaintBrands(data);

// Paint Brand Component Filtering exports
export const getComponentItemsByBrandId = (brandId: string, params?: Omit<ItemGetManyFormData, "where">) => paintBrandService.getComponentItemsByBrandId(brandId, params);
export const getComponentItemsByBrandIds = (brandIds: string[], params?: Omit<ItemGetManyFormData, "where">) => paintBrandService.getComponentItemsByBrandIds(brandIds, params);
export const getItemsCompatibleWithBrands = (brandIds: string[], params?: Omit<ItemGetManyFormData, "paintBrandIds">) =>
  paintBrandService.getItemsCompatibleWithBrands(brandIds, params);
