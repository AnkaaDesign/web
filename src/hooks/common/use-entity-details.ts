import { useQuery } from "@tanstack/react-query";
import {
  getItemCategories,
  getItemBrands,
  getSuppliers,
  getUsers,
  getCustomers,
  getSectors,
  getPaints,
  getPaintFormulas,
  getItems,
  getFiles,
  getObservations,
  getServiceOrders,
} from "../../api-client";

interface EntityDetails {
  categories: Map<string, string>;
  brands: Map<string, string>;
  suppliers: Map<string, string>;
  users: Map<string, { name: string; email?: string }>;
  customers: Map<string, string>;
  sectors: Map<string, string>;
  paints: Map<string, any>; // Changed to any to store full paint objects with hex, finish, brand, etc.
  formulas: Map<string, string>;
  items: Map<string, string>;
  files: Map<string, string>;
  observations: Map<string, string>;
  serviceOrders: Map<string, any>; // Store full service order objects with description, type, status, etc.
}

// The list endpoints cap `limit` (100 for most entities); chunk id batches to stay within bounds.
const ID_BATCH_SIZE = 100;

// Resolve records by id through the list endpoint (`where: { id: { in } }`) in batches, instead of
// one getById call per id. Two wins: a single request per ~100 ids (no N+1 storm), and deleted ids
// simply don't come back — no per-id 404 logged on the API for stale references in old changelogs.
async function fetchByIds(listFn: (params: any) => Promise<{ data?: any[] }>, ids: string[], include?: Record<string, unknown>): Promise<any[]> {
  if (ids.length === 0) return [];
  const out: any[] = [];
  for (let i = 0; i < ids.length; i += ID_BATCH_SIZE) {
    const chunk = ids.slice(i, i + ID_BATCH_SIZE);
    try {
      const res = await listFn({ where: { id: { in: chunk } }, limit: chunk.length, ...(include ? { include } : {}) });
      if (res?.data?.length) out.push(...res.data);
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Failed to batch-fetch entity details:", error);
      }
    }
  }
  return out;
}

export function useEntityDetails(entityIds: {
  categoryIds?: string[];
  brandIds?: string[];
  supplierIds?: string[];
  userIds?: string[];
  customerIds?: string[];
  sectorIds?: string[];
  paintIds?: string[];
  formulaIds?: string[];
  itemIds?: string[];
  fileIds?: string[];
  observationIds?: string[];
  serviceOrderIds?: string[];
}) {
  const uniqueCategoryIds = [...new Set(entityIds.categoryIds || [])].filter(Boolean);
  const uniqueBrandIds = [...new Set(entityIds.brandIds || [])].filter(Boolean);
  const uniqueSupplierIds = [...new Set(entityIds.supplierIds || [])].filter(Boolean);
  const uniqueUserIds = [...new Set(entityIds.userIds || [])].filter(Boolean);
  const uniqueCustomerIds = [...new Set(entityIds.customerIds || [])].filter(Boolean);
  const uniqueSectorIds = [...new Set(entityIds.sectorIds || [])].filter(Boolean);
  const uniquePaintIds = [...new Set(entityIds.paintIds || [])].filter(Boolean);
  const uniqueFormulaIds = [...new Set(entityIds.formulaIds || [])].filter(Boolean);
  const uniqueItemIds = [...new Set(entityIds.itemIds || [])].filter(Boolean);
  const uniqueFileIds = [...new Set(entityIds.fileIds || [])].filter(Boolean);
  const uniqueObservationIds = [...new Set(entityIds.observationIds || [])].filter(Boolean);
  const uniqueServiceOrderIds = [...new Set(entityIds.serviceOrderIds || [])].filter(Boolean);

  return useQuery({
    queryKey: [
      "entity-details",
      uniqueCategoryIds,
      uniqueBrandIds,
      uniqueSupplierIds,
      uniqueUserIds,
      uniqueCustomerIds,
      uniqueSectorIds,
      uniquePaintIds,
      uniqueFormulaIds,
      uniqueItemIds,
      uniqueFileIds,
      uniqueObservationIds,
      uniqueServiceOrderIds,
    ],
    queryFn: async () => {
      const details: EntityDetails = {
        categories: new Map(),
        brands: new Map(),
        suppliers: new Map(),
        users: new Map(),
        customers: new Map(),
        sectors: new Map(),
        paints: new Map(),
        formulas: new Map(),
        items: new Map(),
        files: new Map(),
        observations: new Map(),
        serviceOrders: new Map(),
      };

      const [categories, brands, suppliers, users, customers, sectors, paints, formulas, items, files, observations, serviceOrders] = await Promise.all([
        fetchByIds(getItemCategories, uniqueCategoryIds),
        fetchByIds(getItemBrands, uniqueBrandIds),
        fetchByIds(getSuppliers, uniqueSupplierIds),
        fetchByIds(getUsers, uniqueUserIds),
        fetchByIds(getCustomers, uniqueCustomerIds),
        fetchByIds(getSectors, uniqueSectorIds),
        fetchByIds(getPaints, uniquePaintIds, { paintBrand: true, paintType: true }),
        fetchByIds(getPaintFormulas, uniqueFormulaIds),
        fetchByIds(getItems, uniqueItemIds),
        fetchByIds(getFiles, uniqueFileIds),
        fetchByIds(getObservations, uniqueObservationIds),
        fetchByIds(getServiceOrders, uniqueServiceOrderIds, { assignedTo: true }),
      ]);

      for (const c of categories) details.categories.set(c.id, c.name || "");
      for (const b of brands) details.brands.set(b.id, b.name || "");
      for (const s of suppliers) details.suppliers.set(s.id, s.fantasyName || "");
      for (const u of users) details.users.set(u.id, { name: u.name || `Usuário ${String(u.id).slice(0, 8)}`, email: u.email });
      for (const c of customers) details.customers.set(c.id, c.fantasyName || c.name || `Cliente ${String(c.id).slice(0, 8)}`);
      for (const s of sectors) details.sectors.set(s.id, s.name || "");
      for (const p of paints) details.paints.set(p.id, p);
      for (const f of formulas) details.formulas.set(f.id, f.description || f.code || `Fórmula ${String(f.id).slice(0, 8)}`);
      for (const it of items) details.items.set(it.id, it.name || "");
      for (const f of files) details.files.set(f.id, f.filename || "");
      for (const o of observations) details.observations.set(o.id, o.content || o.description || `Observação ${String(o.id).slice(0, 8)}`);
      for (const so of serviceOrders) details.serviceOrders.set(so.id, so);

      return details;
    },
    enabled:
      uniqueCategoryIds.length > 0 ||
      uniqueBrandIds.length > 0 ||
      uniqueSupplierIds.length > 0 ||
      uniqueUserIds.length > 0 ||
      uniqueCustomerIds.length > 0 ||
      uniqueSectorIds.length > 0 ||
      uniquePaintIds.length > 0 ||
      uniqueFormulaIds.length > 0 ||
      uniqueItemIds.length > 0 ||
      uniqueFileIds.length > 0 ||
      uniqueObservationIds.length > 0 ||
      uniqueServiceOrderIds.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
