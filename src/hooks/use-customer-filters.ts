import { z } from "zod";
import { useUrlFilters } from "./use-url-filters";
import type { CustomerGetManyFormData } from "../schemas";
import { BRAZILIAN_STATES } from "../constants";

// Define filter schemas specific to customers - matching the API schema
const customerFilterSchemas = {
  // Text search
  searchingFor: {
    schema: z.string().min(1),
    debounceMs: 500, // Debounce text input
  },

  // Boolean filters
  hasLogo: {
    schema: z.coerce.boolean(),
  },
  hasTasks: {
    schema: z.coerce.boolean(),
  },
  hasServiceOrders: {
    schema: z.coerce.boolean(),
  },
  hasActiveTasks: {
    schema: z.coerce.boolean(),
  },
  hasCpf: {
    schema: z.coerce.boolean(),
  },
  hasCnpj: {
    schema: z.coerce.boolean(),
  },
  hasEmail: {
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
  tags: {
    schema: z.array(z.string()),
    defaultValue: [] as string[],
  },

  // Range filters
  taskCount: {
    schema: z.object({
      min: z.number().int().min(0).optional(),
      max: z.number().int().min(0).optional(),
    }),
  },
  serviceOrderCount: {
    schema: z.object({
      min: z.number().int().min(0).optional(),
      max: z.number().int().min(0).optional(),
    }),
  },

  // Date range filters
  birthDate: {
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
      name: z.enum(["asc", "desc"]).optional(),
      fantasyName: z.enum(["asc", "desc"]).optional(),
      cpf: z.enum(["asc", "desc"]).optional(),
      cnpj: z.enum(["asc", "desc"]).optional(),
      email: z.enum(["asc", "desc"]).optional(),
      address: z.enum(["asc", "desc"]).optional(),
      addressNumber: z.enum(["asc", "desc"]).optional(),
      addressComplement: z.enum(["asc", "desc"]).optional(),
      neighborhood: z.enum(["asc", "desc"]).optional(),
      city: z.enum(["asc", "desc"]).optional(),
      state: z.enum(["asc", "desc"]).optional(),
      zipCode: z.enum(["asc", "desc"]).optional(),
      birthDate: z.enum(["asc", "desc"]).optional(),
      observations: z.enum(["asc", "desc"]).optional(),
      logoId: z.enum(["asc", "desc"]).optional(),
      createdAt: z.enum(["asc", "desc"]).optional(),
      updatedAt: z.enum(["asc", "desc"]).optional(),
      count: z
        .object({
          tasks: z.enum(["asc", "desc"]).optional(),
          serviceOrders: z.enum(["asc", "desc"]).optional(),
          services: z.enum(["asc", "desc"]).optional(),
        })
        .optional(),
    }),
    defaultValue: { name: "asc" as const },
  },
  sortOrder: {
    schema: z.enum(["asc", "desc"]).default("asc"),
    defaultValue: "asc" as const,
  },

  // Business-specific filters
  cpf: {
    schema: z.string().optional(),
  },
  cnpj: {
    schema: z.string().optional(),
  },
  status: {
    schema: z.string().optional(), // Could be enum-based if customer has status field
  },
};

type CustomerFilters = {
  [K in keyof typeof customerFilterSchemas]: K extends keyof CustomerGetManyFormData ? CustomerGetManyFormData[K] : any;
};

export function useCustomerFilters() {
  return useUrlFilters<CustomerFilters>(customerFilterSchemas);
}

// Helper function to convert URL filters to API format
export function convertToApiFilters(urlFilters: CustomerFilters): Partial<CustomerGetManyFormData> {
  const apiFilters: Partial<CustomerGetManyFormData> = {};

  // Text search
  if (urlFilters.searchingFor) apiFilters.searchingFor = urlFilters.searchingFor;

  // Boolean filters
  if (typeof urlFilters.hasLogo === "boolean") apiFilters.hasLogo = urlFilters.hasLogo;
  if (typeof urlFilters.hasTasks === "boolean") apiFilters.hasTasks = urlFilters.hasTasks;
  if (typeof urlFilters.hasServiceOrders === "boolean") apiFilters.hasServiceOrders = urlFilters.hasServiceOrders;
  if (typeof urlFilters.hasActiveTasks === "boolean") apiFilters.hasActiveTasks = urlFilters.hasActiveTasks;
  if (typeof urlFilters.hasCpf === "boolean") apiFilters.hasCpf = urlFilters.hasCpf;
  if (typeof urlFilters.hasCnpj === "boolean") apiFilters.hasCnpj = urlFilters.hasCnpj;
  if (typeof urlFilters.hasEmail === "boolean") apiFilters.hasEmail = urlFilters.hasEmail;

  // Location filters
  if (urlFilters.cities && urlFilters.cities.length > 0) apiFilters.cities = urlFilters.cities;
  if (urlFilters.states && urlFilters.states.length > 0) apiFilters.states = urlFilters.states;

  // Text filters
  if (urlFilters.phoneContains) apiFilters.phoneContains = urlFilters.phoneContains;
  if (urlFilters.cpf) apiFilters.cpf = urlFilters.cpf;
  if (urlFilters.cnpj) apiFilters.cnpj = urlFilters.cnpj;
  if (urlFilters.tags && urlFilters.tags.length > 0) apiFilters.tags = urlFilters.tags;

  // Range filters
  if (urlFilters.taskCount) apiFilters.taskCount = urlFilters.taskCount;
  if (urlFilters.serviceOrderCount) apiFilters.serviceOrderCount = urlFilters.serviceOrderCount;

  // Date range filters
  if (urlFilters.birthDate) apiFilters.birthDate = urlFilters.birthDate;
  if (urlFilters.createdAt) apiFilters.createdAt = urlFilters.createdAt;
  if (urlFilters.updatedAt) apiFilters.updatedAt = urlFilters.updatedAt;

  // Business-specific filters
  if (urlFilters.status) apiFilters.status = urlFilters.status;

  // Pagination and sorting - handle both limit and itemsPerPage
  if (urlFilters.page) apiFilters.page = urlFilters.page;
  if (urlFilters.limit) apiFilters.limit = urlFilters.limit;
  if (urlFilters.itemsPerPage) apiFilters.limit = urlFilters.itemsPerPage; // Map itemsPerPage to limit for API
  if (urlFilters.orderBy) apiFilters.orderBy = urlFilters.orderBy;

  return apiFilters;
}

// Helper function to convert API filters back to URL format
export function convertFromApiFilters(apiFilters: Partial<CustomerGetManyFormData>): Partial<CustomerFilters> {
  const urlFilters: Partial<CustomerFilters> = {};

  // Text search
  if (apiFilters.searchingFor) urlFilters.searchingFor = apiFilters.searchingFor;

  // Boolean filters
  if (typeof apiFilters.hasLogo === "boolean") urlFilters.hasLogo = apiFilters.hasLogo;
  if (typeof apiFilters.hasTasks === "boolean") urlFilters.hasTasks = apiFilters.hasTasks;
  if (typeof apiFilters.hasServiceOrders === "boolean") urlFilters.hasServiceOrders = apiFilters.hasServiceOrders;
  if (typeof apiFilters.hasActiveTasks === "boolean") urlFilters.hasActiveTasks = apiFilters.hasActiveTasks;
  if (typeof apiFilters.hasCpf === "boolean") urlFilters.hasCpf = apiFilters.hasCpf;
  if (typeof apiFilters.hasCnpj === "boolean") urlFilters.hasCnpj = apiFilters.hasCnpj;
  if (typeof apiFilters.hasEmail === "boolean") urlFilters.hasEmail = apiFilters.hasEmail;

  // Location filters
  if (apiFilters.cities) urlFilters.cities = apiFilters.cities;
  if (apiFilters.states) urlFilters.states = apiFilters.states;

  // Text filters
  if (apiFilters.phoneContains) urlFilters.phoneContains = apiFilters.phoneContains;
  if (apiFilters.cpf) urlFilters.cpf = apiFilters.cpf;
  if (apiFilters.cnpj) urlFilters.cnpj = apiFilters.cnpj;
  if (apiFilters.tags) urlFilters.tags = apiFilters.tags;

  // Range filters
  if (apiFilters.taskCount) urlFilters.taskCount = apiFilters.taskCount;
  if (apiFilters.serviceOrderCount) urlFilters.serviceOrderCount = apiFilters.serviceOrderCount;

  // Date range filters
  if (apiFilters.birthDate) urlFilters.birthDate = apiFilters.birthDate;
  if (apiFilters.createdAt) urlFilters.createdAt = apiFilters.createdAt;
  if (apiFilters.updatedAt) urlFilters.updatedAt = apiFilters.updatedAt;

  // Business-specific filters
  if (apiFilters.status) urlFilters.status = apiFilters.status;

  // Pagination and sorting
  if (apiFilters.page) urlFilters.page = apiFilters.page;
  if (apiFilters.limit) {
    urlFilters.limit = apiFilters.limit;
    urlFilters.itemsPerPage = apiFilters.limit; // Also set itemsPerPage for consistency
  }
  if (apiFilters.orderBy) urlFilters.orderBy = apiFilters.orderBy;

  return urlFilters;
}
