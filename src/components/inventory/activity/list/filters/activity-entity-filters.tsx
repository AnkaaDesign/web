import { useRef, useCallback } from "react";
import type { ActivityGetManyFormData } from "../../../../../schemas";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { getUsers, getItems } from "../../../../../api-client";

interface ActivityEntityFiltersProps {
  filters: Partial<ActivityGetManyFormData>;
  updateFilter: <K extends keyof ActivityGetManyFormData>(key: K, value: ActivityGetManyFormData[K] | undefined) => void;
}

export const ActivityEntityFilters = ({ filters, updateFilter }: ActivityEntityFiltersProps) => {
  // Create stable caches for fetched data
  const usersCacheRef = useRef<Map<string, { label: string; value: string }>>(new Map());
  const itemsCacheRef = useRef<Map<string, { label: string; value: string }>>(new Map());

  const selectedUserIds = filters.userIds || [];
  const selectedItemIds = filters.itemIds || [];

  const handleUserIdsChange = (userIds: string[]) => {
    updateFilter("userIds", userIds.length > 0 ? userIds : undefined);
  };

  const handleItemIdsChange = (itemIds: string[]) => {
    updateFilter("itemIds", itemIds.length > 0 ? itemIds : undefined);
  };

  // Async query function for users
  const queryUsers = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const pageSize = 50;
      const response = await getUsers({
        orderBy: { name: "asc" },
        page: page,
        take: pageSize,
        where: searchTerm ? {
          OR: [
            { name: { contains: searchTerm, mode: "insensitive" } },
            { email: { contains: searchTerm, mode: "insensitive" } },
          ],
        } : {},
      });

      const users = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      const options = users.map((user) => {
        const option = {
          label: user.name,
          value: user.id,
        };
        usersCacheRef.current.set(user.id, option);
        return option;
      });

      return {
        data: options,
        hasMore: hasMore,
      };
    } catch (error) {
      console.error("Error fetching users:", error);
      return {
        data: [],
        hasMore: false,
      };
    }
  }, []);

  // Async query function for items
  const queryItems = useCallback(async (searchTerm: string, page = 1) => {
    try {
      const pageSize = 50;
      const response = await getItems({
        orderBy: { name: "asc" },
        page: page,
        take: pageSize,
        where: searchTerm ? {
          OR: [
            { name: { contains: searchTerm, mode: "insensitive" } },
            { uniCode: { contains: searchTerm, mode: "insensitive" } },
          ],
        } : {},
      });

      const items = response.data || [];
      const hasMore = response.meta?.hasNextPage || false;

      const options = items.map((item) => {
        const label = item.uniCode ? `${item.uniCode} - ${item.name}` : item.name;
        const option = {
          label,
          value: item.id,
        };
        itemsCacheRef.current.set(item.id, option);
        return option;
      });

      return {
        data: options,
        hasMore: hasMore,
      };
    } catch (error) {
      console.error("Error fetching items:", error);
      return {
        data: [],
        hasMore: false,
      };
    }
  }, []);

  return (
    <>
      <div>
        <Label className="text-base font-medium mb-3 block">Usuários</Label>
        <Combobox
          async
          queryKey={["users", "activity-filters"]}
          queryFn={queryUsers}
          initialOptions={[]}
          minSearchLength={0}
          pageSize={50}
          debounceMs={300}
          mode="multiple"
          value={selectedUserIds}
          onValueChange={handleUserIdsChange}
          placeholder="Selecione usuários..."
          emptyText="Nenhum usuário encontrado"
          searchPlaceholder="Buscar usuários..."
          searchable
        />
        {selectedUserIds.length > 0 && (
          <div className="text-xs text-muted-foreground mt-2">
            {selectedUserIds.length} usuário{selectedUserIds.length !== 1 ? "s" : ""} selecionado{selectedUserIds.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      <div>
        <Label className="text-base font-medium mb-3 block">Itens</Label>
        <Combobox
          async
          queryKey={["items", "activity-filters"]}
          queryFn={queryItems}
          initialOptions={[]}
          minSearchLength={0}
          pageSize={50}
          debounceMs={300}
          mode="multiple"
          value={selectedItemIds}
          onValueChange={handleItemIdsChange}
          placeholder="Selecione itens..."
          emptyText="Nenhum item encontrado"
          searchPlaceholder="Buscar itens..."
          searchable
        />
        {selectedItemIds.length > 0 && (
          <div className="text-xs text-muted-foreground mt-2">
            {selectedItemIds.length} iten{selectedItemIds.length !== 1 ? "s" : ""} selecionado{selectedItemIds.length !== 1 ? "s" : ""}
          </div>
        )}
      </div>
    </>
  );
};
