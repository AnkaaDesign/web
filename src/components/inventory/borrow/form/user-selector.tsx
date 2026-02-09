import { useMemo, useCallback } from "react";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import type { User } from "../../../../types";
import { getUsers } from "../../../../api-client";

interface UserSelectorProps {
  control: any;
  disabled?: boolean;
  selectedUserId?: string;
  initialUser?: User;
}

export function BorrowUserSelector({ control, disabled, selectedUserId: _selectedUserId, initialUser }: UserSelectorProps) {
  // Memoize initialOptions with stable dependency
  const initialOptions = useMemo(() => {
    if (!initialUser) return [];

    return [{
      value: initialUser.id,
      label: initialUser.name,
      description: initialUser.position?.name,
    }];
  }, [initialUser?.id]);

  // Async query function for Combobox with pagination
  // Filter: isActive: true includes all active users regardless of status
  // (includes dismissed third-party workers who still have isActive: true)
  const queryFn = useCallback(async (searchTerm: string, page: number = 1) => {
    const pageSize = 50;
    const response = await getUsers({
      take: pageSize,
      skip: (page - 1) * pageSize,
      where: {
        isActive: true,
        ...(searchTerm ? {
          OR: [
            { name: { contains: searchTerm, mode: "insensitive" } },
            { email: { contains: searchTerm, mode: "insensitive" } },
            { cpf: { contains: searchTerm } },
          ],
        } : {}),
      },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        cpf: true,
        status: true,
        isActive: true,
        position: {
          select: {
            id: true,
            name: true,
            sector: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    const users = response.data || [];
    const total = response.meta?.totalRecords || 0;
    const hasMore = (page * pageSize) < total;

    return {
      data: users.map((user) => ({
        value: user.id,
        label: user.name,
        description: user.position?.name,
        metadata: {
          email: user.email,
          position: user.position,
          status: user.status,
        },
      })),
      hasMore,
      total,
    };
  }, []);

  // Custom render function for user options
  const renderUserOption = (option: any) => {
    const metadata = option.metadata;
    if (!metadata) return option.label;

    return (
      <div className="flex items-center justify-between w-full">
        <div className="flex flex-col">
          <span className="truncate">{option.label}</span>
          {metadata.position && (
            <span className="text-xs text-muted-foreground">{metadata.position.name}</span>
          )}
        </div>
        {metadata.position?.sector && (
          <Badge variant="outline" className="text-xs flex-shrink-0">
            {metadata.position.sector.name}
          </Badge>
        )}
      </div>
    );
  };

  return (
    <FormField
      control={control}
      name="userId"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Usuário *</FormLabel>
          <FormControl>
            <Combobox
              async
              queryKey={["users", "borrow-selector"]}
              queryFn={queryFn}
              initialOptions={initialOptions}
              minSearchLength={0}
              pageSize={50}
              debounceMs={300}
              value={field.value || ""}
              onValueChange={field.onChange}
              placeholder="Selecione um usuário"
              emptyText="Nenhum usuário encontrado"
              disabled={disabled}
              renderOption={renderUserOption}
              searchable
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
