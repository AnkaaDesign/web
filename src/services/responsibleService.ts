import { apiClient } from '@/api-client/axiosClient';
import type {
  Responsible,
  ResponsibleCreateFormData,
  ResponsibleUpdateFormData,
  ResponsibleGetManyFormData,
  ResponsibleGetManyResponse,
  ResponsibleLoginFormData,
  AuthResponse,
} from '@/types/responsible';

class ResponsibleService {
  /**
   * Get all responsibles
   */
  async getAll(params?: ResponsibleGetManyFormData): Promise<ResponsibleGetManyResponse> {
    const response = await apiClient.get('/responsibles', { params });
    return response.data;
  }

  /**
   * Get a single responsible by ID
   */
  async getById(id: string): Promise<Responsible> {
    const response = await apiClient.get(`/responsibles/${id}`);
    return response.data;
  }

  /**
   * Get responsibles by company ID
   */
  async getByCompany(companyId: string): Promise<Responsible[]> {
    const response = await apiClient.get('/responsibles', {
      params: { companyId }
    });
    return response.data.data;
  }

  /**
   * Get responsible by company and role
   */
  async getByCompanyAndRole(companyId: string, role: string): Promise<Responsible | null> {
    const response = await apiClient.get('/responsibles', {
      params: { companyId, role }
    });
    return response.data.data[0] || null;
  }

  /**
   * Create a new responsible
   */
  async create(data: ResponsibleCreateFormData): Promise<Responsible> {
    const response = await apiClient.post('/responsibles', data);
    return response.data;
  }

  /**
   * Update a responsible
   */
  async update(id: string, data: ResponsibleUpdateFormData): Promise<Responsible> {
    const response = await apiClient.put(`/responsibles/${id}`, data);
    return response.data;
  }

  /**
   * Delete a responsible
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/responsibles/${id}`);
  }

  /**
   * Batch create responsibles
   */
  async batchCreate(data: ResponsibleCreateFormData[]): Promise<Responsible[]> {
    const response = await apiClient.post('/responsibles/batch', { responsibles: data });
    return response.data;
  }

  /**
   * Batch update responsibles
   */
  async batchUpdate(updates: Array<{ id: string; data: ResponsibleUpdateFormData }>): Promise<Responsible[]> {
    const response = await apiClient.put('/responsibles/batch', { updates });
    return response.data;
  }

  /**
   * Batch delete responsibles
   */
  async batchDelete(ids: string[]): Promise<void> {
    await apiClient.delete('/responsibles/batch', { data: { ids } });
  }

  /**
   * Responsible login
   */
  async login(data: ResponsibleLoginFormData): Promise<AuthResponse> {
    const response = await apiClient.post('/responsibles/login', data);
    return response.data;
  }

  /**
   * Search responsibles by name or phone
   */
  async search(query: string, companyId?: string): Promise<Responsible[]> {
    const response = await apiClient.get('/responsibles', {
      params: {
        search: query,
        companyId
      }
    });
    return response.data.data;
  }

  /**
   * Check if a phone number is already in use
   */
  async checkPhoneAvailability(phone: string, excludeId?: string): Promise<boolean> {
    try {
      const response = await apiClient.get('/responsibles/check-phone', {
        params: { phone, excludeId }
      });
      return response.data.available;
    } catch {
      return false;
    }
  }

  /**
   * Check if an email is already in use
   */
  async checkEmailAvailability(email: string, excludeId?: string): Promise<boolean> {
    try {
      const response = await apiClient.get('/responsibles/check-email', {
        params: { email, excludeId }
      });
      return response.data.available;
    } catch {
      return false;
    }
  }

  /**
   * Toggle responsible active status
   */
  async toggleActive(id: string): Promise<Responsible> {
    const response = await apiClient.patch(`/responsibles/${id}/toggle-active`);
    return response.data;
  }

  /**
   * Update responsible password
   */
  async updatePassword(id: string, password: string): Promise<void> {
    await apiClient.patch(`/responsibles/${id}/password`, { password });
  }
}

export const responsibleService = new ResponsibleService();
