import { useState, useMemo, useEffect } from "react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { useUsers } from "../../../../hooks";
import type { BorrowCreateFormData, BorrowUpdateFormData } from "../../../../schemas";
import { USER_STATUS } from "../../../../constants";
import type { User } from "../../../../types";
import { toast } from "sonner";

interface UserSelectorProps {
  control: any;
  disabled?: boolean;
  selectedUserId?: string;
}

export function BorrowUserSelector({ control, disabled, selectedUserId }: UserSelectorProps) {
  const [search] = useState("");

  // Fetch active users (experience period and contracted) with their positions and sectors
  const {
    data: usersResponse,
    isLoading,
    error,
  } = useUsers({
    statuses: [
      USER_STATUS.EXPERIENCE_PERIOD_1,
      USER_STATUS.EXPERIENCE_PERIOD_2,
      USER_STATUS.CONTRACTED
    ],
    orderBy: { name: "asc" },
    take: 150,
    include: {
      position: {
        include: {
          sector: true,
        },
      },
    },
  });

  const users = usersResponse?.data || [];

  // Get selected user for displaying details and validation
  const selectedUser = users.find((user: User) => user.id === selectedUserId);

  // Filter users based on search
  const filteredUsers = useMemo(() => {
    if (!search) return users;

    const searchLower = search.toLowerCase();
    return users.filter(
      (user: User) =>
        user.name.toLowerCase().includes(searchLower) ||
        (user.email && user.email.toLowerCase().includes(searchLower)) ||
        (user.cpf && user.cpf.includes(search)) ||
        (user.position?.name && user.position.name.toLowerCase().includes(searchLower)),
    );
  }, [users, search]);

  const userOptions = filteredUsers.map((user: User) => ({
    value: user.id,
    label: user.name,
    searchableText: `${user.name} ${user.email || ""} ${user.cpf || ""} ${user.position?.name || ""}`.toLowerCase(),
    email: user.email,
    position: user.position?.name,
    sector: user.position?.sector?.name,
    status: user.status,
  }));

  // Show warning if no active users are available
  const hasNoActiveUsers = !isLoading && userOptions.length === 0;

  // Validate selected user
  useEffect(() => {
    if (selectedUser) {
      // Check if user is in valid status (not dismissed)
      if (selectedUser.status === USER_STATUS.DISMISSED) {
        toast.error("Usuário selecionado está desligado");
      }
      // Check if user has a position (for better tracking)
      if (!selectedUser.position) {
        toast.warning("Usuário selecionado não possui cargo definido");
      }
    }
  }, [selectedUser]);

  return (
    <FormField
      control={control}
      name="userId"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Usuário *</FormLabel>
          <FormControl>
            <Combobox
              value={field.value || ""}
              onValueChange={field.onChange}
              options={userOptions}
              placeholder="Selecione um usuário"
              emptyText="Nenhum usuário encontrado"
              disabled={disabled || isLoading}
              searchable
            />
          </FormControl>
          {selectedUser && (
            <FormDescription className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span>Usuário: {selectedUser.name}</span>
                {selectedUser.position && (
                  <Badge variant="secondary" className="text-xs">
                    {selectedUser.position.name}
                  </Badge>
                )}
                {selectedUser.position?.sector && (
                  <Badge variant="outline" className="text-xs">
                    {selectedUser.position.sector.name}
                  </Badge>
                )}
                <Badge
                  variant={selectedUser.status === USER_STATUS.DISMISSED ? "destructive" : "default"}
                  className="text-xs"
                >
                  {selectedUser.status === USER_STATUS.EXPERIENCE_PERIOD_1 ? "Experiência 1/2" :
                   selectedUser.status === USER_STATUS.EXPERIENCE_PERIOD_2 ? "Experiência 2/2" :
                   selectedUser.status === USER_STATUS.CONTRACTED ? "Contratado" :
                   "Desligado"}
                </Badge>
              </div>
              {selectedUser.email && <div className="text-sm text-muted-foreground">Email: {selectedUser.email}</div>}
              {!selectedUser.position && <div className="text-amber-600 text-sm">⚠️ Usuário sem cargo definido</div>}
            </FormDescription>
          )}
          {hasNoActiveUsers && <FormDescription className="text-amber-600">⚠️ Nenhum usuário ativo encontrado. Verifique se há usuários ativos no sistema.</FormDescription>}
          {error && <FormDescription className="text-destructive">Erro ao carregar usuários. Tente novamente.</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
