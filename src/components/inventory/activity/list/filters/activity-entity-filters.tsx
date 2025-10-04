import type { ActivityGetManyFormData } from "../../../../../schemas";
import { useUsers, useItems } from "../../../../../hooks";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";

interface ActivityEntityFiltersProps {
  filters: Partial<ActivityGetManyFormData>;
  updateFilter: <K extends keyof ActivityGetManyFormData>(key: K, value: ActivityGetManyFormData[K] | undefined) => void;
}

export const ActivityEntityFilters = ({ filters, updateFilter }: ActivityEntityFiltersProps) => {
  // Load entity data
  const { data: usersResponse, isLoading: loadingUsers } = useUsers({
    orderBy: { name: "asc" },
  });

  const { data: itemsResponse, isLoading: loadingItems } = useItems({
    orderBy: { name: "asc" },
  });

  const users = usersResponse?.data || [];
  const items = itemsResponse?.data || [];

  // Transform data for combobox
  const userOptions = users.map((user) => ({
    value: user.id,
    label: user.name,
  }));

  const itemOptions = items.map((item) => ({
    value: item.id,
    label: item.uniCode ? `${item.uniCode} - ${item.name}` : item.name,
  }));

  const selectedUserIds = filters.userIds || [];
  const selectedItemIds = filters.itemIds || [];

  const handleUserIdsChange = (userIds: string[]) => {
    updateFilter("userIds", userIds.length > 0 ? userIds : undefined);
  };

  const handleItemIdsChange = (itemIds: string[]) => {
    updateFilter("itemIds", itemIds.length > 0 ? itemIds : undefined);
  };

  return (
    <>
      <div>
        <Label className="text-base font-medium mb-3 block">Usuários</Label>
        <Combobox
          mode="multiple"
          options={userOptions}
          value={selectedUserIds}
          onValueChange={handleUserIdsChange}
          placeholder="Selecione usuários..."
          emptyText="Nenhum usuário encontrado"
          searchPlaceholder="Buscar usuários..."
          disabled={loadingUsers}
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
          mode="multiple"
          options={itemOptions}
          value={selectedItemIds}
          onValueChange={handleItemIdsChange}
          placeholder="Selecione itens..."
          emptyText="Nenhum item encontrado"
          searchPlaceholder="Buscar itens..."
          disabled={loadingItems}
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
