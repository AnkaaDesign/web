import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { ObservationList } from "@/components/production/observation/list";
import { IconEye, IconPlus } from "@tabler/icons-react";
import { routes, SECTOR_PRIVILEGES, FAVORITE_PAGES } from "../../../constants";
import { useNavigate } from "react-router-dom";
import { usePageTracker } from "@/hooks/use-page-tracker";

export const ObservationsList = () => {
  const navigate = useNavigate();

  // Track page for analytics
  usePageTracker({ title: "Observações - Lista", icon: "observations_list" });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.PRODUCTION}>
      <div className="flex flex-col h-full space-y-4">
        <div className="flex-shrink-0">
          <PageHeaderWithFavorite
            title="Observações"
            icon={IconEye}
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
          />
        </div>
        <div className="flex-1 min-h-0">
          <ObservationList />
        </div>
      </div>
    </PrivilegeRoute>
  );
};
