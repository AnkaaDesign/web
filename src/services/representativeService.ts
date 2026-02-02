import { apiClient } from '@/api-client/axiosClient';
import type {
  Representative,
  RepresentativeCreateFormData,
  RepresentativeUpdateFormData,
  RepresentativeGetManyFormData,
  RepresentativeGetManyResponse,
  RepresentativeLoginFormData,
  AuthResponse,
} from '@/types/representative';

class RepresentativeService {
  /**
   * Get all representatives
   */
  async getAll(params?: RepresentativeGetManyFormData): Promise<RepresentativeGetManyResponse> {
    const response = await apiClient.get('/representatives', { params });
    return response.data;
  }

  /**
   * Get a single representative by ID
   */
  async getById(id: string): Promise<Representative> {
    const response = await apiClient.get(`/representatives/${id}`);
    return response.data;
  }

  /**
   * Get representatives by customer ID
   */
  async getByCustomer(customerId: string): Promise<Representative[]> {
    const response = await apiClient.get('/representatives', {
      params: { customerId }
    });
    return response.data.data;
  }

  /**
   * Get representative by customer and role
   */
  async getByCustomerAndRole(customerId: string, role: string): Promise<Representative | null> {
    const response = await apiClient.get('/representatives', {
      params: { customerId, role }
    });
    return response.data.data[0] || null;
  }

  /**
   * Create a new representative
   */
  async create(data: RepresentativeCreateFormData): Promise<Representative> {
    const response = await apiClient.post('/representatives', data);
    return response.data;
  }

  /**
   * Update a representative
   */
  async update(id: string, data: RepresentativeUpdateFormData): Promise<Representative> {
    const response = await apiClient.put(`/representatives/${id}`, data);
    return response.data;
  }

  /**
   * Delete a representative
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/representatives/${id}`);
  }

  /**
   * Batch create representatives
   */
  async batchCreate(data: RepresentativeCreateFormData[]): Promise<Representative[]> {
    const response = await apiClient.post('/representatives/batch', { representatives: data });
    return response.data;
  }

  /**
   * Batch update representatives
   */
  async batchUpdate(updates: Array<{ id: string; data: RepresentativeUpdateFormData }>): Promise<Representative[]> {
    const response = await apiClient.put('/representatives/batch', { updates });
    return response.data;
  }

  /**
   * Batch delete representatives
   */
  async batchDelete(ids: string[]): Promise<void> {
    await apiClient.delete('/representatives/batch', { data: { ids } });
  }

  /**
   * Representative login
   */
  async login(data: RepresentativeLoginFormData): Promise<AuthResponse> {
    const response = await apiClient.post('/representatives/login', data);
    return response.data;
  }

  /**
   * Search representatives by name or phone
   */
  async search(query: string, customerId?: string): Promise<Representative[]> {
    const response = await apiClient.get('/representatives', {
      params: {
        search: query,
        customerId
      }
    });
    return response.data.data;
  }

  /**
   * Check if a phone number is already in use
   */
  async checkPhoneAvailability(phone: string, excludeId?: string): Promise<boolean> {
    try {
      const response = await apiClient.get('/representatives/check-phone', {
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
      const response = await apiClient.get('/representatives/check-email', {
        params: { email, excludeId }
      });
      return response.data.available;
    } catch {
      return false;
    }
  }

  /**
   * Toggle representative active status
   */
  async toggleActive(id: string): Promise<Representative> {
    const response = await apiClient.patch(`/representatives/${id}/toggle-active`);
    return response.data;
  }

  /**
   * Update representative password
   */
  async updatePassword(id: string, password: string): Promise<void> {
    await apiClient.patch(`/representatives/${id}/password`, { password });
  }
}

export const representativeService = new RepresentativeService();