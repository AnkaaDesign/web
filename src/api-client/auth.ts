// packages/api-client/src/auth.ts
// Simplified auth API client with unified 6-digit verification

import { jwtDecode } from "jwt-decode";
import { apiClient } from "./axiosClient";
import type {
  SignInFormData,
  SignUpFormData,
  PasswordResetRequestFormData,
  PasswordResetFormData,
  ChangePasswordFormData,
  VerifyCodeFormData,
  SendVerificationFormData,
  AdminToggleUserStatusFormData,
  AdminResetUserPasswordFormData,
  AdminLogoutUserFormData,
} from "../schemas";
import type { User, AuthTokenResponse, AuthMessageResponse, AuthUserResponse } from "../types";

// =====================
// Core Authentication
// =====================

export const authService = {
  // Login with email or phone
  login: (data: SignInFormData) => apiClient.post<AuthTokenResponse>("/auth/login", data).then((res) => res.data),

  // Register with email or phone
  register: (data: SignUpFormData) => apiClient.post<AuthTokenResponse>("/auth/register", data).then((res) => res.data),

  // Logout current user
  logout: () => apiClient.post<AuthMessageResponse>("/auth/logout").then((res) => res.data),

  // Get current user
  me: () => apiClient.get<AuthUserResponse>("/auth/me").then((res) => res.data),

  // Refresh token
  refreshToken: () => apiClient.post<AuthTokenResponse>("/auth/refresh").then((res) => res.data),

  // Change password
  changePassword: (data: ChangePasswordFormData) => apiClient.put<AuthMessageResponse>("/auth/change-password", data).then((res) => res.data),

  // =====================
  // Unified 6-Digit Code Verification
  // =====================

  // Send verification code (unified for email/phone)
  sendVerification: (data: SendVerificationFormData) => apiClient.post<AuthMessageResponse>("/auth/send-verification", data).then((res) => res.data),

  // Verify 6-digit code (unified for email/phone)
  verifyCode: (data: VerifyCodeFormData) => apiClient.post<AuthMessageResponse>("/auth/verify", data).then((res) => res.data),

  // Resend verification code (unified for email/phone)
  resendVerification: (data: SendVerificationFormData) => apiClient.post<AuthMessageResponse>("/auth/resend-verification", data).then((res) => res.data),

  // =====================
  // Password Reset (6-digit codes)
  // =====================

  // Request password reset
  requestPasswordReset: (data: PasswordResetRequestFormData) => apiClient.post<AuthMessageResponse>("/auth/password-reset/request", data).then((res) => res.data),

  // Reset password with 6-digit code
  resetPasswordWithCode: (data: PasswordResetFormData) => apiClient.post<AuthMessageResponse>("/auth/password-reset", data).then((res) => res.data),

  // =====================
  // Admin Operations
  // =====================

  // Admin toggle user status
  adminToggleUserStatus: (data: AdminToggleUserStatusFormData) => apiClient.post<AuthMessageResponse>("/auth/admin/toggle-user-status", data).then((res) => res.data),

  // Admin reset user password
  adminResetUserPassword: (data: AdminResetUserPasswordFormData) => apiClient.post<AuthMessageResponse>("/auth/admin/reset-user-password", data).then((res) => res.data),

  // Admin logout user
  adminLogoutUser: (data: AdminLogoutUserFormData) => apiClient.post<AuthMessageResponse>("/auth/admin/logout-user", data).then((res) => res.data),

  // =====================
  // Helper Functions
  // =====================

  // Complete verification for any contact method
  completeVerification: async (contact: string, code: string) => {
    const response = await authService.verifyCode({ contact, code });
    return response;
  },

  // Send verification code to any contact method
  sendVerificationToContact: async (contact: string) => {
    const response = await authService.sendVerification({ contact });
    return response;
  },

  // Get user payload from JWT token
  getUserFromToken: (token: string): User | null => {
    try {
      const decoded = jwtDecode<User>(token);
      return decoded;
    } catch (error) {
      console.error("Falha ao decodificar token:", error);
      return null;
    }
  },

  // Check if token is expired
  isTokenExpired: (token: string): boolean => {
    try {
      const decoded = jwtDecode<{ exp: number }>(token);
      const currentTime = Date.now() / 1000;
      return decoded.exp < currentTime;
    } catch (error) {
      return true; // Consider invalid tokens as expired
    }
  },

  // =====================
  // Legacy Compatibility (deprecated - use unified methods above)
  // =====================

  // @deprecated Use sendVerification instead
  sendVerificationCode: (data: SendVerificationFormData) => authService.sendVerification(data),

  // @deprecated Use login instead
  signin: (data: SignInFormData) => authService.login(data),

  // @deprecated Use register instead
  signup: (data: SignUpFormData) => authService.register(data),

  // @deprecated Use requestPasswordReset instead
  passwordReset: (data: PasswordResetRequestFormData) => authService.requestPasswordReset(data),
};
