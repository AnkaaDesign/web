import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

interface FilterUpdate {
  showInactive?: boolean;
  categoryIds?: string[];
  brandIds?: string[];
  supplierIds?: string[];
  searchTerm?: string;
  page?: number;
}

/**
 * Direct URL filter update hook for borrow form
 * This provides immediate, atomic updates like the order form uses
 */
export function useDirectFilterUpdate() {
  const [_searchParams, setSearchParams] = useSearchParams();

  const updateFilters = useCallback(
    (updates: FilterUpdate) => {
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);

          // Update showInactive
          if (updates.showInactive !== undefined) {
            if (updates.showInactive) {
              params.set("showInactive", "true");
            } else {
              params.delete("showInactive");
            }
          }

          // Update categoryIds
          if (updates.categoryIds !== undefined) {
            if (updates.categoryIds.length > 0) {
              params.set("categoryIds", JSON.stringify(updates.categoryIds));
            } else {
              params.delete("categoryIds");
            }
          }

          // Update brandIds
          if (updates.brandIds !== undefined) {
            if (updates.brandIds.length > 0) {
              params.set("brandIds", JSON.stringify(updates.brandIds));
            } else {
              params.delete("brandIds");
            }
          }

          // Update supplierIds
          if (updates.supplierIds !== undefined) {
            if (updates.supplierIds.length > 0) {
              params.set("supplierIds", JSON.stringify(updates.supplierIds));
            } else {
              params.delete("supplierIds");
            }
          }

          // Update searchTerm
          if (updates.searchTerm !== undefined) {
            if (updates.searchTerm) {
              params.set("searchTerm", updates.searchTerm);
            } else {
              params.delete("searchTerm");
            }
          }

          // Update page
          if (updates.page !== undefined) {
            if (updates.page > 1) {
              params.set("page", updates.page.toString());
            } else {
              params.delete("page");
            }
          }

          return params;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const clearAllFilters = useCallback(() => {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);

        // Clear all filter params but preserve others like selected items
        params.delete("showInactive");
        params.delete("categoryIds");
        params.delete("brandIds");
        params.delete("supplierIds");
        params.delete("searchTerm");
        params.delete("page");

        return params;
      },
      { replace: true },
    );
  }, [setSearchParams]);

  return {
    updateFilters,
    clearAllFilters,
  };
}
