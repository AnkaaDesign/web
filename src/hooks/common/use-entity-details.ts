import { useQuery } from "@tanstack/react-query";
import {
  getItemCategoryById,
  getItemBrandById,
  getSupplierById,
  getUserById,
  getCustomerById,
  getSectorById,
  getPaintById,
  getPaintFormulaById,
  getItemById,
  getFileById,
  getObservationById,
  getServiceOrderById,
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

      // Fetch all categories
      const categoryPromises = uniqueCategoryIds.map(async (id) => {
        try {
          const response = await getItemCategoryById(id, {});
          if (response?.success && response.data) {
            details.categories.set(id, response.data.name || "");
          }
        } catch (error) {
          if (process.env.NODE_ENV !== 'production') {
            console.error(`Failed to fetch category ${id}:`, error);
          }
        }
      });

      // Fetch all brands
      const brandPromises = uniqueBrandIds.map(async (id) => {
        try {
          const response = await getItemBrandById(id, {});
          if (response?.success && response.data) {
            details.brands.set(id, response.data.name || "");
          }
        } catch (error) {
          if (process.env.NODE_ENV !== 'production') {
            console.error(`Failed to fetch brand ${id}:`, error);
          }
        }
      });

      // Fetch all suppliers
      const supplierPromises = uniqueSupplierIds.map(async (id) => {
        try {
          const response = await getSupplierById(id, {});
          if (response?.success && response.data) {
            details.suppliers.set(id, response.data.fantasyName || "");
          }
        } catch (error) {
          if (process.env.NODE_ENV !== 'production') {
            console.error(`Failed to fetch supplier ${id}:`, error);
          }
        }
      });

      // Fetch all users
      const userPromises = uniqueUserIds.map(async (id) => {
        try {
          const response = await getUserById(id, {});
          if (response?.success && response.data) {
            const userData = response.data as any;
            details.users.set(id, {
              name: userData.name || `Usuário ${id.slice(0, 8)}`,
              email: userData.email,
            });
          }
        } catch (error) {
          if (process.env.NODE_ENV !== 'production') {
            console.error(`Failed to fetch user ${id}:`, error);
          }
        }
      });

      // Fetch all customers
      const customerPromises = uniqueCustomerIds.map(async (id) => {
        try {
          const response = await getCustomerById(id, {});
          if (response?.success && response.data) {
            details.customers.set(id, (response.data as any).fantasyName || (response.data as any).name || `Cliente ${id.slice(0, 8)}`);
          }
        } catch (error) {
          if (process.env.NODE_ENV !== 'production') {
            console.error(`Failed to fetch customer ${id}:`, error);
          }
        }
      });

      // Fetch all sectors
      const sectorPromises = uniqueSectorIds.map(async (id) => {
        try {
          const response = await getSectorById(id, {});
          if (response?.success && response.data) {
            details.sectors.set(id, response.data.name || "");
          }
        } catch (error) {
          if (process.env.NODE_ENV !== 'production') {
            console.error(`Failed to fetch sector ${id}:`, error);
          }
        }
      });

      // Fetch all paints with full details (hex, finish, brand, manufacturer, etc.)
      const paintPromises = uniquePaintIds.map(async (id) => {
        try {
          const response = await getPaintById(id, {
            include: {
              paintBrand: true,
              paintType: true,
            },
          });
          if (response?.success && response.data) {
            // Store the full paint object with all properties needed for display
            details.paints.set(id, response.data);
          }
        } catch (error) {
          if (process.env.NODE_ENV !== 'production') {
            console.error(`Failed to fetch paint ${id}:`, error);
          }
        }
      });

      // Fetch all formulas
      const formulaPromises = uniqueFormulaIds.map(async (id) => {
        try {
          const response = await getPaintFormulaById(id, {});
          if (response?.success && response.data) {
            details.formulas.set(id, (response.data as any).description || (response.data as any).code || `Fórmula ${id.slice(0, 8)}`);
          }
        } catch (error) {
          if (process.env.NODE_ENV !== 'production') {
            console.error(`Failed to fetch formula ${id}:`, error);
          }
        }
      });

      // Fetch all items
      const itemPromises = uniqueItemIds.map(async (id) => {
        try {
          const response = await getItemById(id, {});
          if (response?.success && response.data) {
            details.items.set(id, response.data.name || "");
          }
        } catch (error) {
          if (process.env.NODE_ENV !== 'production') {
            console.error(`Failed to fetch item ${id}:`, error);
          }
        }
      });

      // Fetch all files
      const filePromises = uniqueFileIds.map(async (id) => {
        try {
          const response = await getFileById(id, {});
          if (response?.success && response.data) {
            details.files.set(id, response.data.filename || "");
          }
        } catch (error) {
          if (process.env.NODE_ENV !== 'production') {
            console.error(`Failed to fetch file ${id}:`, error);
          }
        }
      });

      // Fetch all observations
      const observationPromises = uniqueObservationIds.map(async (id) => {
        try {
          const response = await getObservationById(id, {});
          if (response?.success && response.data) {
            details.observations.set(id, (response.data as any).content || (response.data as any).description || `Observação ${id.slice(0, 8)}`);
          }
        } catch (error) {
          if (process.env.NODE_ENV !== 'production') {
            console.error(`Failed to fetch observation ${id}:`, error);
          }
        }
      });

      // Fetch all service orders with full details
      const serviceOrderPromises = uniqueServiceOrderIds.map(async (id) => {
        try {
          const response = await getServiceOrderById({
            id,
            include: {
              assignedTo: true,
            },
          });
          if (response?.success && response.data) {
            // Store the full service order object
            details.serviceOrders.set(id, response.data);
          }
        } catch (error) {
          if (process.env.NODE_ENV !== 'production') {
            console.error(`Failed to fetch service order ${id}:`, error);
          }
        }
      });

      await Promise.all([
        ...categoryPromises,
        ...brandPromises,
        ...supplierPromises,
        ...userPromises,
        ...customerPromises,
        ...sectorPromises,
        ...paintPromises,
        ...formulaPromises,
        ...itemPromises,
        ...filePromises,
        ...observationPromises,
        ...serviceOrderPromises,
      ]);

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
