// packages/hooks/src/useAuth.ts
// Simplified auth hook with unified 6-digit verification

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authService } from "../api-client";
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
import type { User, AuthTokenResponse, AuthMessageResponse } from "../types";
import type { UseMutationResult } from "@tanstack/react-query";

// =====================
// Type Definitions
// =====================

interface AuthHookReturn {
  // Query data
  user: User | undefined;
  isLoading: boolean;
  error: Error | null;

  // Core auth mutations
  login: UseMutationResult<AuthTokenResponse, Error, SignInFormData>;
  register: UseMutationResult<AuthTokenResponse, Error, SignUpFormData>;
  logout: UseMutationResult<AuthMessageResponse, Error, void>;
  changePassword: UseMutationResult<AuthMessageResponse, Error, ChangePasswordFormData>;

  // Unified verification mutations
  sendVerification: UseMutationResult<AuthMessageResponse, Error, SendVerificationFormData>;
  verifyCode: UseMutationResult<AuthMessageResponse, Error, VerifyCodeFormData>;
  resendVerification: UseMutationResult<AuthMessageResponse, Error, SendVerificationFormData>;

  // Password reset mutations
  requestPasswordReset: UseMutationResult<AuthMessageResponse, Error, PasswordResetRequestFormData>;
  resetPasswordWithCode: UseMutationResult<AuthMessageResponse, Error, PasswordResetFormData>;

  // Admin mutations
  adminToggleUserStatus: UseMutationResult<AuthMessageResponse, Error, AdminToggleUserStatusFormData>;
  adminResetUserPassword: UseMutationResult<AuthMessageResponse, Error, AdminResetUserPasswordFormData>;
  adminLogoutUser: UseMutationResult<AuthMessageResponse, Error, AdminLogoutUserFormData>;
}

// =====================
// Query Keys
// =====================

export const authKeys = {
  all: ["auth"],
  currentUser: () => ["auth", "currentUser"],
};

// =====================
// Current User Hook
// =====================

export function useCurrentUser() {
  return useQuery({
    queryKey: authKeys.currentUser(),
    queryFn: () => authService.me(),
    select: (response) => response.data,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

// =====================
// Main Auth Hook
// =====================

export function useAuth(): AuthHookReturn {
  const queryClient = useQueryClient();

  // Get current user data
  const { data, isLoading, error } = useCurrentUser();

  // Core authentication mutations
  const login = useMutation({
    mutationFn: authService.login,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.all });
    },
  });

  const register = useMutation({
    mutationFn: authService.register,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.all });
    },
  });

  const logout = useMutation({
    mutationFn: authService.logout,
    onSuccess: () => {
      queryClient.clear(); // Clear all cached data on logout
    },
  });

  const changePassword = useMutation({
    mutationFn: authService.changePassword,
  });

  // Unified verification mutations
  const sendVerification = useMutation({
    mutationFn: authService.sendVerification,
  });

  const verifyCode = useMutation({
    mutationFn: authService.verifyCode,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.all });
    },
  });

  const resendVerification = useMutation({
    mutationFn: authService.resendVerification,
  });

  // Password reset mutations
  const requestPasswordReset = useMutation({
    mutationFn: authService.requestPasswordReset,
  });

  const resetPasswordWithCode = useMutation({
    mutationFn: authService.resetPasswordWithCode,
  });

  // Admin mutations
  const adminToggleUserStatus = useMutation({
    mutationFn: authService.adminToggleUserStatus,
  });

  const adminResetUserPassword = useMutation({
    mutationFn: authService.adminResetUserPassword,
  });

  const adminLogoutUser = useMutation({
    mutationFn: authService.adminLogoutUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.all });
    },
  });

  return {
    // Query data
    user: data,
    isLoading,
    error,

    // Core auth mutations
    login,
    register,
    logout,
    changePassword,

    // Unified verification mutations
    sendVerification,
    verifyCode,
    resendVerification,

    // Password reset mutations
    requestPasswordReset,
    resetPasswordWithCode,

    // Admin mutations
    adminToggleUserStatus,
    adminResetUserPassword,
    adminLogoutUser,
  };
}

// =====================
// Helper Hooks
// =====================

// Hook for checking if user is authenticated
export function useIsAuthenticated(): boolean {
  const { data } = useCurrentUser();
  return !!data;
}

// Hook for getting user privileges
export function useUserPrivileges() {
  const { data: user } = useCurrentUser();
  return user?.sector?.privileges || null;
}

// =====================
// End of Auth Hook
// =====================
