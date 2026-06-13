import { z } from "zod";
import { useUrlFilters } from "../common/use-url-filters";
import type { UserGetManyFormData } from "../../schemas";
import { CONTRACT_TYPE } from "../../constants";

// Define filter schemas specific to users - matching the API schema
const userFilterSchemas = {
  // Text search
  searchingFor: {
    schema: z.string().min(1),
    debounceMs: 500, // Debounce text input
  },

  // Contract type filter
  contractTypes: {
    schema: z.array(z.enum(Object.values(CONTRACT_TYPE) as [CONTRACT_TYPE, ...CONTRACT_TYPE[]])),
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
  ledSectorId: {
    schema: z.array(z.string()),
    defaultValue: [] as string[],
  },

  // Boolean filters
  hasBonifications: {
    schema: z.coerce.boolean(),
  },
  hasLedSector: {
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

  // Bonification range filters
  bonificationEarnings: {
    schema: z.object({
      min: z.number().min(0).optional(),
      max: z.number().min(0).optional(),
    }),
  },
  bonificationsCount: {
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
      currentContractType: z.enum(["asc", "desc"]).optional(),
      currentContractStatus: z.enum(["asc", "desc"]).optional(),
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
      ledSector: z
        .object({
          name: z.enum(["asc", "desc"]).optional(),
        })
        .optional(),
      count: z
        .object({
          tasks: z.enum(["asc", "desc"]).optional(),
          bonifications: z.enum(["asc", "desc"]).optional(),
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

  // Contract type filter
  if (urlFilters.contractTypes && urlFilters.contractTypes.length > 0) apiFilters.contractTypes = urlFilters.contractTypes;

  // Entity filters
  if (urlFilters.positionId && urlFilters.positionId.length > 0) apiFilters.positionId = urlFilters.positionId;
  if (urlFilters.sectorId && urlFilters.sectorId.length > 0) apiFilters.sectorId = urlFilters.sectorId;
  if (urlFilters.ledSectorId && urlFilters.ledSectorId.length > 0) apiFilters.ledSectorId = urlFilters.ledSectorId;

  // Boolean filters
  if (typeof urlFilters.hasBonifications === "boolean") apiFilters.hasBonifications = urlFilters.hasBonifications;
  if (typeof urlFilters.hasLedSector === "boolean") apiFilters.hasLedSector = urlFilters.hasLedSector;
  if (typeof urlFilters.hasEmail === "boolean") apiFilters.hasEmail = urlFilters.hasEmail;
  if (typeof urlFilters.hasPhone === "boolean") apiFilters.hasPhone = urlFilters.hasPhone;
  if (typeof urlFilters.verified === "boolean") apiFilters.verified = urlFilters.verified;
  if (typeof urlFilters.requirePasswordChange === "boolean") apiFilters.requirePasswordChange = urlFilters.requirePasswordChange;

  // Date range filters
  if (urlFilters.birth) apiFilters.birth = urlFilters.birth;
  if (urlFilters.createdAt) apiFilters.createdAt = urlFilters.createdAt;
  if (urlFilters.updatedAt) apiFilters.updatedAt = urlFilters.updatedAt;
  if (urlFilters.lastLoginAt) apiFilters.lastLoginAt = urlFilters.lastLoginAt;

  // Bonification range filters
  if (urlFilters.bonificationEarnings) apiFilters.bonificationEarnings = urlFilters.bonificationEarnings;
  if (urlFilters.bonificationsCount) apiFilters.bonificationsCount = urlFilters.bonificationsCount;

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

  // Contract type filter
  if (apiFilters.contractTypes) urlFilters.contractTypes = apiFilters.contractTypes;

  // Entity filters
  if (apiFilters.positionId) urlFilters.positionId = apiFilters.positionId;
  if (apiFilters.sectorId) urlFilters.sectorId = apiFilters.sectorId;
  if (apiFilters.ledSectorId) urlFilters.ledSectorId = apiFilters.ledSectorId;

  // Boolean filters
  if (typeof apiFilters.hasBonifications === "boolean") urlFilters.hasBonifications = apiFilters.hasBonifications;
  if (typeof apiFilters.hasLedSector === "boolean") urlFilters.hasLedSector = apiFilters.hasLedSector;
  if (typeof apiFilters.hasEmail === "boolean") urlFilters.hasEmail = apiFilters.hasEmail;
  if (typeof apiFilters.hasPhone === "boolean") urlFilters.hasPhone = apiFilters.hasPhone;
  if (typeof apiFilters.verified === "boolean") urlFilters.verified = apiFilters.verified;
  if (typeof apiFilters.requirePasswordChange === "boolean") urlFilters.requirePasswordChange = apiFilters.requirePasswordChange;

  // Date range filters
  if (apiFilters.birth) urlFilters.birth = apiFilters.birth;
  if (apiFilters.createdAt) urlFilters.createdAt = apiFilters.createdAt;
  if (apiFilters.updatedAt) urlFilters.updatedAt = apiFilters.updatedAt;
  if (apiFilters.lastLoginAt) urlFilters.lastLoginAt = apiFilters.lastLoginAt;

  // Bonification range filters
  if (apiFilters.bonificationEarnings) urlFilters.bonificationEarnings = apiFilters.bonificationEarnings;
  if (apiFilters.bonificationsCount) urlFilters.bonificationsCount = apiFilters.bonificationsCount;

  // Pagination and sorting
  if (apiFilters.page) urlFilters.page = apiFilters.page;
  if (apiFilters.limit) {
    urlFilters.limit = apiFilters.limit;
    urlFilters.itemsPerPage = apiFilters.limit; // Also set itemsPerPage for consistency
  }
  if (apiFilters.orderBy) urlFilters.orderBy = apiFilters.orderBy;

  return urlFilters;
}
