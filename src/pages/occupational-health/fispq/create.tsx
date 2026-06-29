import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconFlask, IconCheck } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES, FAVORITE_PAGES } from "../../../constants";
import { getItems } from "../../../api-client";
import type { Item } from "../../../types";
import type { FispqCreateFormData } from "@/schemas/fispq";
import { useFispqMutations } from "@/hooks/occupational-health/use-fispq";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { FispqForm } from "@/components/occupational-health/fispq/form";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const FispqCreatePage = () => {
  const navigate = useNavigate();
  usePageTracker({ title: "Nova FISPQ", icon: "flask" });

  const { createAsync, createMutation } = useFispqMutations();
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [initialOptions, setInitialOptions] = useState<Item[]>([]);

  const queryItems = useCallback(async (search: string, page: number = 1) => {
    const queryParams: any = { page, take: 50, orderBy: { name: "asc" } };
    if (search && search.trim()) queryParams.searchingFor = search.trim();
    const response = await getItems(queryParams);
    const data = response.data || [];
    // Keep a small cache so the selected option label survives after picking.
    setInitialOptions((prev) => {
      const map = new Map(prev.map((i) => [i.id, i]));
      for (const item of data) map.set(item.id, item);
      return Array.from(map.values());
    });
    return { data, hasMore: response.meta?.hasNextPage || false };
  }, []);

  const handleSubmit = async (data: FispqCreateFormData) => {
    try {
      const result = await createAsync(data);
      if (result.data?.id) {
        navigate(routes.occupationalHealth.fispq.details(result.data.id));
      } else {
        navigate(routes.occupationalHealth.fispq.root);
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "production") {
        console.error("Error creating fispq:", error);
      }
    }
  };

  const actions = [
    {
      key: "cancel",
      label: "Cancelar",
      onClick: () => navigate(routes.occupationalHealth.fispq.root),
      variant: "outline" as const,
      disabled: createMutation.isPending,
    },
    {
      key: "submit",
      label: "Criar",
      icon: IconCheck,
      onClick: () => document.getElementById("fispq-form-submit")?.click(),
      variant: "default" as const,
      disabled: createMutation.isPending || !selectedItemId,
      loading: createMutation.isPending,
    },
  ];

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <div className="container mx-auto max-w-4xl flex-shrink-0">
          <PageHeader
            favoritePage={FAVORITE_PAGES.MEDICINA_DO_TRABALHO_FISPQ_CADASTRAR}
            title="Nova FISPQ"
            icon={IconFlask}
            breadcrumbs={[
              { label: "Início", href: "/" },
              { label: "Medicina do Trabalho", href: routes.occupationalHealth.root },
              { label: "FISPQ/FDS", href: routes.occupationalHealth.fispq.root },
              { label: "Nova" },
            ]}
            actions={actions}
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="container mx-auto max-w-4xl space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <IconFlask className="h-5 w-5 text-muted-foreground" />
                  Produto químico
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Combobox<Item>
                  value={selectedItemId ?? undefined}
                  onValueChange={(value) => setSelectedItemId(typeof value === "string" ? value : null)}
                  disabled={createMutation.isPending}
                  placeholder="Selecione o item de estoque"
                  emptyText="Nenhum item encontrado"
                  searchPlaceholder="Buscar item..."
                  async
                  queryKey={["items", "fispq-create"]}
                  queryFn={queryItems}
                  initialOptions={initialOptions}
                  getOptionLabel={(item) => item.name}
                  getOptionValue={(item) => item.id}
                  minSearchLength={0}
                  pageSize={50}
                  debounceMs={300}
                  searchable
                  clearable
                />
              </CardContent>
            </Card>

            <FispqForm mode="create" itemId={selectedItemId ?? ""} onSubmit={handleSubmit} isSubmitting={createMutation.isPending} />
          </div>
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default FispqCreatePage;
