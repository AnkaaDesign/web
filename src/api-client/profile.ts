// packages/api-client/src/profile.ts

import { apiClient } from "./axiosClient";
import type {
  UserGetUniqueResponse,
  UserUpdateResponse,
} from "../types";
import type { UserUpdateFormData } from "../schemas";

// =====================
// Profile Service Class
// =====================

export class ProfileService {
  private readonly basePath = "/profile";

  // =====================
  // Query Operations
  // =====================

  async getProfile(): Promise<UserGetUniqueResponse> {
    const response = await apiClient.get<UserGetUniqueResponse>(this.basePath);
    return response.data;
  }

  // =====================
  // Mutation Operations
  // =====================

  async updateProfile(data: UserUpdateFormData): Promise<UserUpdateResponse> {
    const response = await apiClient.put<UserUpdateResponse>(this.basePath, data);
    return response.data;
  }

  async uploadPhoto(photo: File, userName?: string): Promise<UserUpdateResponse> {
    const formData = new FormData();
    formData.append('photo', photo);

    // Add context metadata for file organization
    if (userName) {
      formData.append('_context', JSON.stringify({
        entityType: 'user',
        userName: userName,
        fileType: 'photo',
      }));
    }

    const response = await apiClient.put<UserUpdateResponse>(`${this.basePath}/photo`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async deletePhoto(): Promise<UserUpdateResponse> {
    const response = await apiClient.delete<UserUpdateResponse>(`${this.basePath}/photo`);
    return response.data;
  }
}

// =====================
// Export service instance
// =====================

export const profileService = new ProfileService();

// =====================
// Export individual functions
// =====================

export const getProfile = () => profileService.getProfile();
export const updateProfile = (data: UserUpdateFormData) => profileService.updateProfile(data);
export const uploadPhoto = (photo: File, userName?: string) => profileService.uploadPhoto(photo, userName);
export const deletePhoto = () => profileService.deletePhoto();
