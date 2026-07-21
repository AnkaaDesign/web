// Authentication response types

import type { User } from "./user";
import type { File as AnkaaFile } from "./file";

export interface AuthTokenResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    // Long-lived (60d) opaque refresh token. Present on /auth/login (and
    // /auth/register auto-login); absent on /auth/refresh, which is non-rotating
    // and returns only a new access token + user.
    refreshToken?: string;
    user: AuthUser;
  };
}

export interface AuthUser {
  id: string;
  email: string | null;
  phone: string | null;
  name: string;
  currentContractType?: string | null;
  currentContractStatus?: string | null;
  currentEmployeeType?: string | null;
  requirePasswordChange?: boolean;
  verified?: boolean;
  avatarId?: string | null;
  avatar?: AnkaaFile | null;
  sectorId?: string | null;
  sector?: {
    id: string;
    name: string;
    privileges: string;
  } | null;
  ledSector?: {
    id: string;
    name: string;
    privileges: string;
  } | null;
}

export interface AuthMessageResponse {
  success: boolean;
  message: string;
}

export interface AuthUserResponse {
  success: boolean;
  message: string;
  data: User;
}

export interface TokenPayload {
  sub: string; // user ID
  email: string | null;
  phone: string | null;
  name: string;
  iat: number;
  exp: number;
}
