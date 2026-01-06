import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { ObservationList } from "@/components/production/observation/list";
import { IconPlus } from "@tabler/icons-react";
import { routes, SECTOR_PRIVILEGES, FAVORITE_PAGES } from "../../../constants";
import { useNavigate } from "react-router-dom";
import { usePageTracker } from "@/hooks/use-page-tracker";

export const ObservationsList = () => {
  const navigate = useNavigate();

  // Track page for analytics
  usePageTracker({ title: "Observações - Lista", icon: "observations_list" });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.PRODUCTION}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Observações"
          favoritePage={FAVORITE_PAGES.PRODUCAO_OBSERVACOES_LISTAR}
          breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Produção", href: routes.production.root }, { label: "Observações" }]}
          actions={[
            {
              key: "create",
              label: "Nova Observação",
              icon: IconPlus,
              onClick: () => navigate(routes.production.observations.create),
              variant: "default",
            },
          ]}
          className="flex-shrink-0"
        />

        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <ObservationList className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
};
