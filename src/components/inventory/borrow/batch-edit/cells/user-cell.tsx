import { useState, useEffect } from "react";
import { FormControl, FormField, FormItem, FormMessage } from "@/components/ui/form";
import { Combobox } from "@/components/ui/combobox";
import { useUsers } from "../../../../../hooks";
import debounce from "lodash/debounce";
import { USER_STATUS } from "../../../../../constants";

interface UserCellProps {
  control: any;
  index: number;
}

export function UserCell({ control, index }: UserCellProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

  const debouncedSearch = debounce((value: string) => {
    setDebouncedSearchTerm(value);
  }, 300);

  useEffect(() => {
    debouncedSearch(searchTerm);
  }, [searchTerm]);

  const { data: usersResponse, isLoading } = useUsers({
    statuses: [
      USER_STATUS.EXPERIENCE_PERIOD_1,
      USER_STATUS.EXPERIENCE_PERIOD_2,
      USER_STATUS.CONTRACTED
    ],
    ...(debouncedSearchTerm && {
      searchingFor: debouncedSearchTerm,
    }),
    orderBy: { name: "asc" },
    take: 50,
  });

  const users = usersResponse?.data || [];

  const options = users.map((user) => ({
    label: user.name,
    value: user.id,
  }));

  return (
    <FormField
      control={control}
      name={`borrows.${index}.data.userId`}
      render={({ field }) => (
        <FormItem>
          <FormControl>
            <Combobox
              value={field.value || ""}
              onValueChange={(value) => field.onChange(value || null)}
              options={options}
              placeholder="Selecione um usuário"
              searchPlaceholder="Buscar usuário..."
              onSearchChange={setSearchTerm}
              isLoading={isLoading}
              emptyMessage="Nenhum usuário encontrado"
              className="h-8 text-sm"
            />
          </FormControl>
          <FormMessage className="text-xs" />
        </FormItem>
      )}
    />
  );
}
