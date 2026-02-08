import { z } from "zod";
import { useUrlFilters } from "../common/use-url-filters";
import type { SupplierGetManyFormData } from "../../schemas";
import { BRAZILIAN_STATES } from "../../constants";

// Define filter schemas specific to suppliers - matching the API schema
const supplierFilterSchemas = {
  // Text search
  searchingFor: {
    schema: z.string().min(1),
    debounceMs: 500, // Debounce text input
  },

  // Boolean filters
  hasLogo: {
    schema: z.coerce.boolean(),
  },
  hasItems: {
    schema: z.coerce.boolean(),
  },
  hasOrders: {
    schema: z.coerce.boolean(),
  },
  hasActiveOrders: {
    schema: z.coerce.boolean(),
  },
  hasCnpj: {
    schema: z.coerce.boolean(),
  },
  hasEmail: {
    schema: z.coerce.boolean(),
  },
  hasSite: {
    schema: z.coerce.boolean(),
  },

  // Location filters
  cities: {
    schema: z.array(z.string()),
    defaultValue: [] as string[],
  },
  states: {
    schema: z.array(z.enum(BRAZILIAN_STATES as readonly [string, ...string[]])),
    defaultValue: [] as string[],
  },

  // Text filters
  phoneContains: {
    schema: z.string().optional(),
  },

  // Range filters
  itemCount: {
    schema: z.object({
      min: z.number().int().min(0).optional(),
      max: z.number().int().min(0).optional(),
    }),
  },
  orderCount: {
    schema: z.object({
      min: z.number().int().min(0).optional(),
      max: z.number().int().min(0).optional(),
    }),
  },

  // Date range filters
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

  // Pagination and sorting
  page: {
    schema: z.coerce.number().int().positive().default(1),
    defaultValue: 1,
  },
  limit: {
    schema: z.coerce.number().int().positive().max(100).default(20),
    defaultValue: 20,
  },
  itemsPerPage: {
    schema: z.coerce.number().int().positive().max(100).default(20),
    defaultValue: 20,
  },
  orderBy: {
    schema: z.object({
      id: z.enum(["asc", "desc"]).optional(),
      fantasyName: z.enum(["asc", "desc"]).optional(),
      cnpj: z.enum(["asc", "desc"]).optional(),
      corporateName: z.enum(["asc", "desc"]).optional(),
      email: z.enum(["asc", "desc"]).optional(),
      address: z.enum(["asc", "desc"]).optional(),
      addressNumber: z.enum(["asc", "desc"]).optional(),
      addressComplement: z.enum(["asc", "desc"]).optional(),
      neighborhood: z.enum(["asc", "desc"]).optional(),
      city: z.enum(["asc", "desc"]).optional(),
      state: z.enum(["asc", "desc"]).optional(),
      zipCode: z.enum(["asc", "desc"]).optional(),
      site: z.enum(["asc", "desc"]).optional(),
      logoId: z.enum(["asc", "desc"]).optional(),
      createdAt: z.enum(["asc", "desc"]).optional(),
      updatedAt: z.enum(["asc", "desc"]).optional(),
      count: z
        .object({
          items: z.enum(["asc", "desc"]).optional(),
          orders: z.enum(["asc", "desc"]).optional(),
          orderRules: z.enum(["asc", "desc"]).optional(),
        })
        .optional(),
    }),
    defaultValue: { fantasyName: "asc" as const },
  },
  sortOrder: {
    schema: z.enum(["asc", "desc"]).default("asc"),
    defaultValue: "asc" as const,
  },

  // Business-specific filters
  cnpj: {
    schema: z.string().optional(),
  },
  status: {
    schema: z.string().optional(), // Could be enum-based if supplier has status field
  },
  paymentTerms: {
    schema: z.string().optional(),
  },
  deliveryTime: {
    schema: z.number().int().min(0).optional(),
  },
  rating: {
    schema: z.number().min(0).max(5).optional(),
  },
  priority: {
    schema: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  },
};

type SupplierFilters = {
  [K in keyof typeof supplierFilterSchemas]: K extends keyof SupplierGetManyFormData ? SupplierGetManyFormData[K] : any;
};

export function useSupplierFilters() {
  return useUrlFilters<SupplierFilters>(supplierFilterSchemas);
}

// Helper function to convert URL filters to API format
export function convertToApiFilters(urlFilters: SupplierFilters): Partial<SupplierGetManyFormData> {
  const apiFilters: Partial<SupplierGetManyFormData> = {};

  // Text search
  if (urlFilters.searchingFor) apiFilters.searchingFor = urlFilters.searchingFor;

  // Boolean filters
  if (typeof urlFilters.hasLogo === "boolean") apiFilters.hasLogo = urlFilters.hasLogo;
  if (typeof urlFilters.hasItems === "boolean") apiFilters.hasItems = urlFilters.hasItems;
  if (typeof urlFilters.hasOrders === "boolean") apiFilters.hasOrders = urlFilters.hasOrders;
  if (typeof urlFilters.hasActiveOrders === "boolean") apiFilters.hasActiveOrders = urlFilters.hasActiveOrders;
  if (typeof urlFilters.hasCnpj === "boolean") apiFilters.hasCnpj = urlFilters.hasCnpj;
  if (typeof urlFilters.hasEmail === "boolean") apiFilters.hasEmail = urlFilters.hasEmail;
  if (typeof urlFilters.hasSite === "boolean") apiFilters.hasSite = urlFilters.hasSite;

  // Location filters
  if (urlFilters.cities && urlFilters.cities.length > 0) apiFilters.cities = urlFilters.cities;
  if (urlFilters.states && urlFilters.states.length > 0) apiFilters.states = urlFilters.states;

  // Text filters
  if (urlFilters.phoneContains) apiFilters.phoneContains = urlFilters.phoneContains;
  if (urlFilters.cnpj) apiFilters.cnpj = urlFilters.cnpj;

  // Range filters
  if (urlFilters.itemCount) apiFilters.itemCount = urlFilters.itemCount;
  if (urlFilters.orderCount) apiFilters.orderCount = urlFilters.orderCount;

  // Date range filters
  if (urlFilters.createdAt) apiFilters.createdAt = urlFilters.createdAt;
  if (urlFilters.updatedAt) apiFilters.updatedAt = urlFilters.updatedAt;

  // Business-specific filters
  if (urlFilters.status) apiFilters.status = urlFilters.status;
  if (urlFilters.paymentTerms) apiFilters.paymentTerms = urlFilters.paymentTerms;
  if (urlFilters.deliveryTime) apiFilters.deliveryTime = urlFilters.deliveryTime;
  if (urlFilters.rating) apiFilters.rating = urlFilters.rating;
  if (urlFilters.priority) apiFilters.priority = urlFilters.priority;

  // Pagination and sorting - handle both limit and itemsPerPage
  if (urlFilters.page) apiFilters.page = urlFilters.page;
  if (urlFilters.limit) apiFilters.limit = urlFilters.limit;
  if (urlFilters.itemsPerPage) apiFilters.limit = urlFilters.itemsPerPage; // Map itemsPerPage to limit for API
  if (urlFilters.orderBy) apiFilters.orderBy = urlFilters.orderBy;

  return apiFilters;
}

// Helper function to convert API filters back to URL format
export function convertFromApiFilters(apiFilters: Partial<SupplierGetManyFormData>): Partial<SupplierFilters> {
  const urlFilters: Partial<SupplierFilters> = {};

  // Text search
  if (apiFilters.searchingFor) urlFilters.searchingFor = apiFilters.searchingFor;

  // Boolean filters
  if (typeof apiFilters.hasLogo === "boolean") urlFilters.hasLogo = apiFilters.hasLogo;
  if (typeof apiFilters.hasItems === "boolean") urlFilters.hasItems = apiFilters.hasItems;
  if (typeof apiFilters.hasOrders === "boolean") urlFilters.hasOrders = apiFilters.hasOrders;
  if (typeof apiFilters.hasActiveOrders === "boolean") urlFilters.hasActiveOrders = apiFilters.hasActiveOrders;
  if (typeof apiFilters.hasCnpj === "boolean") urlFilters.hasCnpj = apiFilters.hasCnpj;
  if (typeof apiFilters.hasEmail === "boolean") urlFilters.hasEmail = apiFilters.hasEmail;
  if (typeof apiFilters.hasSite === "boolean") urlFilters.hasSite = apiFilters.hasSite;

  // Location filters
  if (apiFilters.cities) urlFilters.cities = apiFilters.cities;
  if (apiFilters.states) urlFilters.states = apiFilters.states;

  // Text filters
  if (apiFilters.phoneContains) urlFilters.phoneContains = apiFilters.phoneContains;
  if (apiFilters.cnpj) urlFilters.cnpj = apiFilters.cnpj;

  // Range filters
  if (apiFilters.itemCount) urlFilters.itemCount = apiFilters.itemCount;
  if (apiFilters.orderCount) urlFilters.orderCount = apiFilters.orderCount;

  // Date range filters
  if (apiFilters.createdAt) urlFilters.createdAt = apiFilters.createdAt;
  if (apiFilters.updatedAt) urlFilters.updatedAt = apiFilters.updatedAt;

  // Business-specific filters
  if (apiFilters.status) urlFilters.status = apiFilters.status;
  if (apiFilters.paymentTerms) urlFilters.paymentTerms = apiFilters.paymentTerms;
  if (apiFilters.deliveryTime) urlFilters.deliveryTime = apiFilters.deliveryTime;
  if (apiFilters.rating) urlFilters.rating = apiFilters.rating;
  if (apiFilters.priority) urlFilters.priority = apiFilters.priority;

  // Pagination and sorting
  if (apiFilters.page) urlFilters.page = apiFilters.page;
  if (apiFilters.limit) {
    urlFilters.limit = apiFilters.limit;
    urlFilters.itemsPerPage = apiFilters.limit; // Also set itemsPerPage for consistency
  }
  if (apiFilters.orderBy) urlFilters.orderBy = apiFilters.orderBy;

  return urlFilters;
}
