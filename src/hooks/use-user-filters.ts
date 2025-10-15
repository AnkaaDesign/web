import { z } from "zod";
import { useUrlFilters } from "./use-url-filters";
import type { UserGetManyFormData } from "../schemas";
import { USER_STATUS } from "../constants";

// Define filter schemas specific to users - matching the API schema
const userFilterSchemas = {
  // Text search
  searchingFor: {
    schema: z.string().min(1),
    debounceMs: 500, // Debounce text input
  },

  // Status filter
  status: {
    schema: z.array(z.enum(Object.values(USER_STATUS) as [USER_STATUS, ...USER_STATUS[]])),
    defaultValue: [] as string[],
  },

  // Entity filters
  positionId: {
    schema: z.array(z.string()),
    defaultValue: [] as string[],
  },
  sectorId: {
    schema: z.array(z.string()),
    defaultValue: [] as string[],
  },
  managedSectorId: {
    schema: z.array(z.string()),
    defaultValue: [] as string[],
  },

  // Boolean filters
  hasCommissions: {
    schema: z.coerce.boolean(),
  },
  hasManagedSector: {
    schema: z.coerce.boolean(),
  },
  hasEmail: {
    schema: z.coerce.boolean(),
  },
  hasPhone: {
    schema: z.coerce.boolean(),
  },
  verified: {
    schema: z.coerce.boolean(),
  },
  requirePasswordChange: {
    schema: z.coerce.boolean(),
  },

  // Date range filters
  birth: {
    schema: z.object({
      gte: z.coerce.date().optional(),
      lte: z.coerce.date().optional(),
    }),
  },
  createdAt: {
    schema: z.object({
      gte: z.coerce.date().optional(),
      lte: z.coerce.date().optional(),
    }),
  },
  updatedAt: {
    schema: z.object({
      gte: z.coerce.date().optional(),
      lte: z.coerce.date().optional(),
    }),
  },
  lastLoginAt: {
    schema: z.object({
      gte: z.coerce.date().optional(),
      lte: z.coerce.date().optional(),
    }),
  },

  // Commission range filters
  commissionEarnings: {
    schema: z.object({
      min: z.number().min(0).optional(),
      max: z.number().min(0).optional(),
    }),
  },
  commissionsCount: {
    schema: z.object({
      min: z.number().int().min(0).optional(),
      max: z.number().int().min(0).optional(),
    }),
  },

  // Pagination and sorting
  page: {
    schema: z.coerce.number().int().positive().default(1),
    defaultValue: 1,
  },
  limit: {
    schema: z.coerce.number().int().positive().max(100).default(40),
    defaultValue: 40,
  },
  itemsPerPage: {
    schema: z.coerce.number().int().positive().max(100).default(40),
    defaultValue: 40,
  },
  orderBy: {
    schema: z.object({
      id: z.enum(["asc", "desc"]).optional(),
      name: z.enum(["asc", "desc"]).optional(),
      email: z.enum(["asc", "desc"]).optional(),
      cpf: z.enum(["asc", "desc"]).optional(),
      pis: z.enum(["asc", "desc"]).optional(),
      phone: z.enum(["asc", "desc"]).optional(),
      status: z.enum(["asc", "desc"]).optional(),
      statusOrder: z.enum(["asc", "desc"]).optional(),
      verified: z.enum(["asc", "desc"]).optional(),
      birth: z.enum(["asc", "desc"]).optional(),
      performanceLevel: z.enum(["asc", "desc"]).optional(),
      lastLoginAt: z.enum(["asc", "desc"]).optional(),
      createdAt: z.enum(["asc", "desc"]).optional(),
      updatedAt: z.enum(["asc", "desc"]).optional(),
      position: z
        .object({
          name: z.enum(["asc", "desc"]).optional(),
          level: z.enum(["asc", "desc"]).optional(),
        })
        .optional(),
      sector: z
        .object({
          name: z.enum(["asc", "desc"]).optional(),
        })
        .optional(),
      managedSector: z
        .object({
          name: z.enum(["asc", "desc"]).optional(),
        })
        .optional(),
      count: z
        .object({
          tasks: z.enum(["asc", "desc"]).optional(),
          commissions: z.enum(["asc", "desc"]).optional(),
          activities: z.enum(["asc", "desc"]).optional(),
        })
        .optional(),
    }),
    defaultValue: { name: "asc" as const },
  },
  sortOrder: {
    schema: z.enum(["asc", "desc"]).default("asc"),
    defaultValue: "asc" as const,
  },
};

type UserFilters = {
  [K in keyof typeof userFilterSchemas]: K extends keyof UserGetManyFormData ? UserGetManyFormData[K] : any;
};

export function useUserFilters() {
  return useUrlFilters<UserFilters>(userFilterSchemas);
}

// Helper function to convert URL filters to API format
export function convertToApiFilters(urlFilters: UserFilters): Partial<UserGetManyFormData> {
  const apiFilters: Partial<UserGetManyFormData> = {};

  // Text search
  if (urlFilters.searchingFor) apiFilters.searchingFor = urlFilters.searchingFor;

  // Status filter
  if (urlFilters.status && urlFilters.status.length > 0) apiFilters.status = urlFilters.status;

  // Entity filters
  if (urlFilters.positionId && urlFilters.positionId.length > 0) apiFilters.positionId = urlFilters.positionId;
  if (urlFilters.sectorId && urlFilters.sectorId.length > 0) apiFilters.sectorId = urlFilters.sectorId;
  if (urlFilters.managedSectorId && urlFilters.managedSectorId.length > 0) apiFilters.managedSectorId = urlFilters.managedSectorId;

  // Boolean filters
  if (typeof urlFilters.hasCommissions === "boolean") apiFilters.hasCommissions = urlFilters.hasCommissions;
  if (typeof urlFilters.hasManagedSector === "boolean") apiFilters.hasManagedSector = urlFilters.hasManagedSector;
  if (typeof urlFilters.hasEmail === "boolean") apiFilters.hasEmail = urlFilters.hasEmail;
  if (typeof urlFilters.hasPhone === "boolean") apiFilters.hasPhone = urlFilters.hasPhone;
  if (typeof urlFilters.verified === "boolean") apiFilters.verified = urlFilters.verified;
  if (typeof urlFilters.requirePasswordChange === "boolean") apiFilters.requirePasswordChange = urlFilters.requirePasswordChange;

  // Date range filters
  if (urlFilters.birth) apiFilters.birth = urlFilters.birth;
  if (urlFilters.createdAt) apiFilters.createdAt = urlFilters.createdAt;
  if (urlFilters.updatedAt) apiFilters.updatedAt = urlFilters.updatedAt;
  if (urlFilters.lastLoginAt) apiFilters.lastLoginAt = urlFilters.lastLoginAt;

  // Commission range filters
  if (urlFilters.commissionEarnings) apiFilters.commissionEarnings = urlFilters.commissionEarnings;
  if (urlFilters.commissionsCount) apiFilters.commissionsCount = urlFilters.commissionsCount;

  // Pagination and sorting - handle both limit and itemsPerPage
  if (urlFilters.page) apiFilters.page = urlFilters.page;
  if (urlFilters.limit) apiFilters.limit = urlFilters.limit;
  if (urlFilters.itemsPerPage) apiFilters.limit = urlFilters.itemsPerPage; // Map itemsPerPage to limit for API
  if (urlFilters.orderBy) apiFilters.orderBy = urlFilters.orderBy;

  return apiFilters;
}

// Helper function to convert API filters back to URL format
export function convertFromApiFilters(apiFilters: Partial<UserGetManyFormData>): Partial<UserFilters> {
  const urlFilters: Partial<UserFilters> = {};

  // Text search
  if (apiFilters.searchingFor) urlFilters.searchingFor = apiFilters.searchingFor;

  // Status filter
  if (apiFilters.status) urlFilters.status = apiFilters.status;

  // Entity filters
  if (apiFilters.positionId) urlFilters.positionId = apiFilters.positionId;
  if (apiFilters.sectorId) urlFilters.sectorId = apiFilters.sectorId;
  if (apiFilters.managedSectorId) urlFilters.managedSectorId = apiFilters.managedSectorId;

  // Boolean filters
  if (typeof apiFilters.hasCommissions === "boolean") urlFilters.hasCommissions = apiFilters.hasCommissions;
  if (typeof apiFilters.hasManagedSector === "boolean") urlFilters.hasManagedSector = apiFilters.hasManagedSector;
  if (typeof apiFilters.hasEmail === "boolean") urlFilters.hasEmail = apiFilters.hasEmail;
  if (typeof apiFilters.hasPhone === "boolean") urlFilters.hasPhone = apiFilters.hasPhone;
  if (typeof apiFilters.verified === "boolean") urlFilters.verified = apiFilters.verified;
  if (typeof apiFilters.requirePasswordChange === "boolean") urlFilters.requirePasswordChange = apiFilters.requirePasswordChange;

  // Date range filters
  if (apiFilters.birth) urlFilters.birth = apiFilters.birth;
  if (apiFilters.createdAt) urlFilters.createdAt = apiFilters.createdAt;
  if (apiFilters.updatedAt) urlFilters.updatedAt = apiFilters.updatedAt;
  if (apiFilters.lastLoginAt) urlFilters.lastLoginAt = apiFilters.lastLoginAt;

  // Commission range filters
  if (apiFilters.commissionEarnings) urlFilters.commissionEarnings = apiFilters.commissionEarnings;
  if (apiFilters.commissionsCount) urlFilters.commissionsCount = apiFilters.commissionsCount;

  // Pagination and sorting
  if (apiFilters.page) urlFilters.page = apiFilters.page;
  if (apiFilters.limit) {
    urlFilters.limit = apiFilters.limit;
    urlFilters.itemsPerPage = apiFilters.limit; // Also set itemsPerPage for consistency
  }
  if (apiFilters.orderBy) urlFilters.orderBy = apiFilters.orderBy;

  return urlFilters;
}
