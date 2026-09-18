import { apiClient } from '@/api-client/axiosClient';
import type {
  Responsible,
  ResponsibleCreateFormData,
  ResponsibleUpdateFormData,
  ResponsibleGetManyFormData,
  ResponsibleGetManyResponse,
  ResponsibleRole,
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
   * Every contact of a company that holds the given role.
   *
   * Returns a list: a contact can hold several roles, so "the COMMERCIAL
   * responsible" is no longer unique.
   */
  async getByCompanyAndRole(companyId: string, role: ResponsibleRole): Promise<Responsible[]> {
    const response = await apiClient.get('/responsibles', {
      params: { companyId, roles: [role] }
    });
    return response.data.data;
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

  // `login` e `updatePassword` foram REMOVIDOS.
  //
  // `login` chamava `POST /responsibles/login`, que nunca autenticou nada (o
  // JWT saía sem `sub`) e nenhum componente deste app jamais o chamou.
  // `updatePassword` chamava `PATCH /responsibles/:id/password` — uma rota que
  // NUNCA EXISTIU na API: a tela de senha dava 404 no submit, e era o único
  // caminho de interface para dar senha a um responsável.
  //
  // O acesso do responsável agora é por OTP, em `api-client/responsible-auth.ts`.
}

export const responsibleService = new ResponsibleService();
