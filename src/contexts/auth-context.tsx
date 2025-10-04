import React, { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";

// Utility to clean up any invalid stored routes
const clearInvalidStoredRoutes = () => {
  try {
    // Clear any localStorage items that might contain invalid routes
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      const value = localStorage.getItem(key);
      if (value && typeof value === "string" && value.includes("dashboard/unified")) {
        console.warn(`Removing invalid stored route from ${key}:`, value);
        localStorage.removeItem(key);
      }
    });

    // Clear any sessionStorage items that might contain invalid routes
    const sessionKeys = Object.keys(sessionStorage);
    sessionKeys.forEach((key) => {
      const value = sessionStorage.getItem(key);
      if (value && typeof value === "string" && value.includes("dashboard/unified")) {
        console.warn(`Removing invalid stored route from session ${key}:`, value);
        sessionStorage.removeItem(key);
      }
    });
  } catch (error) {
    console.warn("Error clearing invalid stored routes:", error);
  }
};
import * as apiClientModule from "../api-client";
const { authService, setAuthToken, setTokenProvider, setAuthErrorHandler, removeAuthErrorHandler, setJustLoggedIn, apiClient, forceTokenRefresh } = apiClientModule;
import type { AuthUser } from "../types";
import type { SignUpFormData } from "../schemas";
import { detectContactMethod } from "../utils";
import { routes } from "../constants";
import { getLocalStorage, setLocalStorage, removeLocalStorage, getUserData, setUserData, removeUserData } from "@/lib/storage";

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (contact: string, password: string) => Promise<{ success: boolean }>;
  logout: () => void;
  updateUser: (user: AuthUser) => void;
  register: (data: { name: string; contact: string; password: string }) => Promise<{ requiresVerification: boolean; phone?: string; userId?: string }>;
  recoverPassword: (contact: string) => Promise<void>;
  verifyCode: (contact: string, code: string) => Promise<void>;
  resendCode: (contact: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoadingUser, setIsLoadingUser] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Set up the token provider for dynamic token retrieval
    // CRITICAL: Always read fresh from localStorage, don't rely on closure
    const tokenProvider = () => {
      const token = getLocalStorage("token");
      return token;
    };

    setTokenProvider(tokenProvider);

    const initializeAuth = async () => {
      // Prevent duplicate concurrent requests
      if (isLoadingUser) {
        return;
      }

      setIsLoadingUser(true);

      try {
        const token = getLocalStorage("token");

        if (token) {
          setAuthToken(token);

          // Load cached user data first for immediate display
          const cachedUser = getUserData();
          if (cachedUser) {
            setUser(cachedUser as AuthUser);
            // Don't set isLoading to false yet if we're going to fetch fresh data
          }

          // Then fetch fresh data from API
          try {
            const response = await authService.me();
            // Handle response structure from API - { success, message, data: userObject }
            const userData = response?.data || response;
            if (userData) {
              setUser(userData as AuthUser);
              setUserData(userData); // Cache the fresh data
            }
          } catch (apiError: unknown) {
            const error = apiError as { statusCode?: number; message?: string; _statusCode?: number };

            // Handle rate limiting specifically
            if (error?.statusCode === 429 || error?._statusCode === 429) {
              // Don't clear token on rate limiting, just wait
              setTimeout(() => {
                const currentToken = getLocalStorage("token");
                if (currentToken) {
                  initializeAuth();
                }
              }, 30000);

              // If we have cached user data, we can proceed
              if (cachedUser) {
                setIsLoading(false);
                setIsInitialized(true);
              }
              return;
            }

            // If API fails but we have cached user, that's ok
            if (!cachedUser) {
              // Only clear if we don't have cached data
              removeLocalStorage("token");
              removeUserData();
              setAuthToken(null);
              setUser(null);
            } else {
            }
          }
        } else {
        }
      } catch (error) {
        // Clear everything on initialization failure
        removeLocalStorage("token");
        removeUserData();
        setAuthToken(null);
        setUser(null);
      } finally {
        // Only set loading to false when we're truly done
        setIsLoading(false);
        setIsInitialized(true);
        setIsLoadingUser(false);
      }
    };

    // Only run once when component mounts
    if (!isInitialized) {
      // Clean up any invalid stored routes first
      clearInvalidStoredRoutes();
      initializeAuth();
    }
  }, [isInitialized]);

  // Set up global authentication error handler
  useEffect(() => {
    const handleAuthError = (error: { statusCode: number; message: string; category?: string }) => {
      // Check if it's a deleted user or token-related error
      if (error.statusCode === 401 || error.statusCode === 403) {
        // Clear auth state immediately
        removeLocalStorage("token");
        removeUserData();
        setAuthToken(null);
        setUser(null);

        // Navigate to login page
        setTimeout(() => {
          try {
            navigate(routes.authentication.login);
          } catch (navError) {
            console.error("Navigation error during auth error logout:", navError);
          }
        }, 100);
      }
    };

    // Register the auth error handler
    setAuthErrorHandler(handleAuthError);

    // Cleanup function to remove the handler when component unmounts
    return () => {
      removeAuthErrorHandler();
    };
  }, [navigate]);

  const login = async (contact: string, password: string) => {
    try {
      const response = await authService.login({ contact, password });

      // The response structure is { success: true, message: "...", data: { token, user: {...} } }
      if (response?.success && response?.data?.token && response?.data?.user) {
        const { token, user } = response.data;

        // Check if user is verified
        if (user.verified === false) {
          // Redirect to verification page
          navigate(`${routes.authentication.verifyCode}?contact=${encodeURIComponent(contact)}&returnTo=${encodeURIComponent(routes.authentication.login)}`);
          throw new Error("Conta não verificada. Por favor, verifique seu email ou telefone.");
        }

        setLocalStorage("token", token);

        setUserData(user); // Cache user data

        // CRITICAL: Set token on axios IMMEDIATELY using ALL methods
        setAuthToken(token);

        // Force token refresh to ensure it's on all instances
        forceTokenRefresh(token);

        // Also update the default headers to ensure it's always included
        if (apiClient && apiClient.defaults) {
          apiClient.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        }

        setUser(user);

        // Mark that we just logged in to handle race conditions
        setJustLoggedIn();

        // Force update the token provider to ensure it picks up the new token
        // CRITICAL: Create a new function to ensure fresh reads from localStorage
        const updatedTokenProvider = () => {
          const currentToken = getLocalStorage("token");
          return currentToken;
        };
        setTokenProvider(updatedTokenProvider);

        // Verify token was stored
        const verifyToken = getLocalStorage("token");

        // Return success to let the Login component know login succeeded
        return { success: true } as const;
      } else {
        console.error("Invalid response structure:", response);
        throw new Error("Invalid response from server");
      }
    } catch (error) {
      console.error("Login error:", error);
      // Handle specific unverified account error from server
      if (error instanceof Error && (error.message.includes("Conta ainda não verificada") || error.message.includes("ainda não verificada"))) {
        // Redirect to verification page
        const redirectUrl = `${routes.authentication.verifyCode}?contact=${encodeURIComponent(contact)}&returnTo=${encodeURIComponent(routes.authentication.login)}`;
        navigate(redirectUrl);
        // Throw a specific error so Login component knows we handled it
        throw new Error("VERIFICATION_REDIRECT");
      }
      throw error;
    }
  };

  const register = async (data: { name: string; contact: string; password: string }) => {
    try {
      // Detect contact method type
      const contactType = detectContactMethod(data.contact);

      // Transform contact to separate email and phone fields
      const isEmail = contactType === "email";
      const transformedData: SignUpFormData = {
        name: data.name,
        password: data.password,
        ...(isEmail ? { email: data.contact } : { phone: data.contact }),
      };

      const response = await authService.register(transformedData);

      if (response?.success && response?.data?.token && response?.data?.user) {
        const { token, user } = response.data;

        // Check if user needs verification
        if (user.verified === false) {
          // For phone numbers, redirect to phone verification
          if (contactType === "phone") {
            return {
              requiresVerification: true,
              phone: data.contact,
              userId: user.id,
            };
          }

          // For emails, redirect to general verification (if needed)
          return {
            requiresVerification: true,
            userId: user.id,
          };
        }

        // Auto-login after registration if already verified
        setLocalStorage("token", token);
        setUserData(user); // Cache user data
        setAuthToken(token);
        setUser(user);

        // Navigate based on user's privilege level
        // Don't navigate here - let the Register component handle navigation
        // This prevents race conditions between auth-context and Register component navigation

        return {
          requiresVerification: false,
        };
      }

      // If no token/user in response, assume verification is required
      return {
        requiresVerification: true,
        phone: contactType === "phone" ? data.contact : undefined,
      };
    } catch (error) {
      throw error;
    }
  };

  const recoverPassword = async (contact: string) => {
    try {
      await authService.requestPasswordReset({ contact });
    } catch (error) {
      throw error;
    }
  };

  const verifyCode = async (contact: string, code: string) => {
    try {
      await authService.verifyCode({ contact, code });
    } catch (error) {
      throw error;
    }
  };

  const resendCode = async (contact: string) => {
    try {
      await authService.resendVerification({ contact });
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    removeLocalStorage("token");
    removeUserData(); // Clear cached user data
    setAuthToken(null);
    setUser(null);

    // Use setTimeout to ensure state updates are complete before navigation
    setTimeout(() => {
      try {
        navigate(routes.authentication.login);
      } catch (navError) {
        console.error("Navigation error during logout:", navError);
      }
    }, 100);
  };

  const updateUser = (updatedUser: AuthUser) => {
    setUser(updatedUser);
  };

  const value = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
    updateUser,
    register,
    recoverPassword,
    verifyCode,
    resendCode,
  };

  // Don't render children until auth is initialized to prevent hook call errors
  // Also wait if we're loading and haven't determined auth state yet
  if (!isInitialized || (isLoading && user === null)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
