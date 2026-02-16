import { useCallback, useMemo, useRef } from "react";
import { ITEM_CATEGORY_TYPE } from "../../../../../constants";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { IconCategory, IconBrandAsana, IconTruck } from "@tabler/icons-react";
import { getItemCategories, getItemBrands, getSuppliers } from "../../../../../api-client";
import type { ItemCategory, ItemBrand, Supplier } from "../../../../../types";

interface EntitySelectorsProps {
  categoryIds?: string[];
  onCategoryIdsChange: (ids: string[]) => void;
  brandIds?: string[];
  onBrandIdsChange: (ids: string[]) => void;
  supplierIds?: string[];
  onSupplierIdsChange: (ids: string[]) => void;
  initialCategories?: ItemCategory[];
  initialBrands?: ItemBrand[];
  initialSuppliers?: Supplier[];
}

export function EntitySelectors({
  categoryIds = [],
  onCategoryIdsChange,
  brandIds = [],
  onBrandIdsChange,
  supplierIds = [],
  onSupplierIdsChange,
  initialCategories = [],
  initialBrands = [],
  initialSuppliers = []
}: EntitySelectorsProps) {
  // Create caches for fetched items
  const categoryCacheRef = useRef<Map<string, { label: string; value: string }>>(new Map());
  const brandCacheRef = useRef<Map<string, { label: string; value: string }>>(new Map());
  const supplierCacheRef = useRef<Map<string, { label: string; value: string }>>(new Map());

  // Memoize initial options for categories
  const initialCategoryOptions = useMemo(() => {
    const options = initialCategories.map((category) => {
      const label = `${category.name}${category.type === ITEM_CATEGORY_TYPE.PPE ? " (EPI)" : ""}`;
      const option = { label, value: category.id };
      categoryCacheRef.current.set(category.id, option);
      return option;
    });
    // Add "Sem categoria" option
    return [{ value: "null", label: "Sem categoria" }, ...options];
  }, [initialCategories]);

  // Memoize initial options for brands
  const initialBrandOptions = useMemo(() => {
    const options = initialBrands.map((brand) => {
      const option = { label: brand.name, value: brand.id };
      brandCacheRef.current.set(brand.id, option);
      return option;
    });
    // Add "Sem marca" option
    return [{ value: "null", label: "Sem marca" }, ...options];
  }, [initialBrands]);

  // Memoize initial options for suppliers
  const initialSupplierOptions = useMemo(() => {
    const options = initialSuppliers.map((supplier) => {
      const option = { label: supplier.fantasyName, value: supplier.id };
      supplierCacheRef.current.set(supplier.id, option);
      return option;
    });
    // Add "Sem fornecedor" option
    return [{ value: "null", label: "Sem fornecedor" }, ...options];
  }, [initialSuppliers]);

  // Query function for categories
  const queryCategoriesFn = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const queryParams: any = {
        orderBy: { name: "asc" },
        page: page,
        take: 50,
      };

      if (searchTerm && searchTerm.trim()) {
        queryParams.where = {
          name: { contains: searchTerm.trim(), mode: "insensitive" },
        };
      }

      const response = await getItemCategories(queryParams);
      const categories = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      const options = categories.map((category) => {
        const label = `${category.name}${category.type === ITEM_CATEGORY_TYPE.PPE ? " (EPI)" : ""}`;
        const option = { label, value: category.id };
        categoryCacheRef.current.set(category.id, option);
        return option;
      });

      // Add "Sem categoria" option to first page
      if (page === 1) {
        options.unshift({ value: "null", label: "Sem categoria" });
      }

      return { data: options, hasMore };
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error fetching categories:", error);
      }
      return { data: [], hasMore: false };
    }
  }, []);

  // Query function for brands
  const queryBrandsFn = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const queryParams: any = {
        orderBy: { name: "asc" },
        page: page,
        take: 50,
      };

      if (searchTerm && searchTerm.trim()) {
        queryParams.where = {
          name: { contains: searchTerm.trim(), mode: "insensitive" },
        };
      }

      const response = await getItemBrands(queryParams);
      const brands = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      const options = brands.map((brand) => {
        const option = { label: brand.name, value: brand.id };
        brandCacheRef.current.set(brand.id, option);
        return option;
      });

      // Add "Sem marca" option to first page
      if (page === 1) {
        options.unshift({ value: "null", label: "Sem marca" });
      }

      return { data: options, hasMore };
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error fetching brands:", error);
      }
      return { data: [], hasMore: false };
    }
  }, []);

  // Query function for suppliers
  const querySuppliersFn = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const queryParams: any = {
        orderBy: { fantasyName: "asc" },
        page: page,
        take: 50,
      };

      if (searchTerm && searchTerm.trim()) {
        queryParams.where = {
          OR: [
            { fantasyName: { contains: searchTerm.trim(), mode: "insensitive" } },
            { corporateName: { contains: searchTerm.trim(), mode: "insensitive" } },
          ],
        };
      }

      const response = await getSuppliers(queryParams);
      const suppliers = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      const options = suppliers.map((supplier) => {
        const option = { label: supplier.fantasyName, value: supplier.id };
        supplierCacheRef.current.set(supplier.id, option);
        return option;
      });

      // Add "Sem fornecedor" option to first page
      if (page === 1) {
        options.unshift({ value: "null", label: "Sem fornecedor" });
      }

      return { data: options, hasMore };
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error fetching suppliers:", error);
      }
      return { data: [], hasMore: false };
    }
  }, []);

  return (
    <div className="space-y-4">
      {/* Categories */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <IconCategory className="h-4 w-4" />
          Categorias
        </Label>
        <Combobox
          async={true}
          queryKey={["item-categories", "filter"]}
          queryFn={queryCategoriesFn}
          initialOptions={initialCategoryOptions}
          value={categoryIds}
          onValueChange={(value) => {
            if (Array.isArray(value)) onCategoryIdsChange(value);
          }}
          placeholder="Selecione categorias..."
          emptyText="Nenhuma categoria encontrada"
          searchPlaceholder="Buscar categorias..."
          mode="multiple"
          minSearchLength={0}
          pageSize={50}
          debounceMs={300}
        />
        {categoryIds.length > 0 && (
          <div className="text-xs text-muted-foreground">
            {categoryIds.length} categoria{categoryIds.length !== 1 ? "s" : ""} selecionada{categoryIds.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Brands */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <IconBrandAsana className="h-4 w-4" />
          Marcas
        </Label>
        <Combobox
          async={true}
          queryKey={["item-brands", "filter"]}
          queryFn={queryBrandsFn}
          initialOptions={initialBrandOptions}
          value={brandIds}
          onValueChange={(value) => {
            if (Array.isArray(value)) onBrandIdsChange(value);
          }}
          placeholder="Selecione marcas..."
          emptyText="Nenhuma marca encontrada"
          searchPlaceholder="Buscar marcas..."
          mode="multiple"
          minSearchLength={0}
          pageSize={50}
          debounceMs={300}
        />
        {brandIds.length > 0 && (
          <div className="text-xs text-muted-foreground">
            {brandIds.length} marca{brandIds.length !== 1 ? "s" : ""} selecionada{brandIds.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Suppliers */}
      <div className="space-y-2">
        <Label className="flex items-center gap-2">
          <IconTruck className="h-4 w-4" />
          Fornecedores
        </Label>
        <Combobox
          async={true}
          queryKey={["suppliers", "filter"]}
          queryFn={querySuppliersFn}
          initialOptions={initialSupplierOptions}
          value={supplierIds}
          onValueChange={(value) => {
            if (Array.isArray(value)) onSupplierIdsChange(value);
          }}
          placeholder="Selecione fornecedores..."
          emptyText="Nenhum fornecedor encontrado"
          searchPlaceholder="Buscar fornecedores..."
          mode="multiple"
          minSearchLength={0}
          pageSize={50}
          debounceMs={300}
        />
        {supplierIds.length > 0 && (
          <div className="text-xs text-muted-foreground">
            {supplierIds.length} fornecedor{supplierIds.length !== 1 ? "es" : ""} selecionado{supplierIds.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </div>
  );
}
