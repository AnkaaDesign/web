import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { AirbrushingList } from "@/components/production/airbrushing/list";
import { IconBrush, IconPlus } from "@tabler/icons-react";
import { routes, SECTOR_PRIVILEGES, FAVORITE_PAGES } from "../../../constants";
import { useNavigate } from "react-router-dom";
import { usePageTracker } from "@/hooks/use-page-tracker";

export const AirbrushingListPage = () => {
  const navigate = useNavigate();

  // Track page for analytics
  usePageTracker({ title: "Aerografia - Lista" });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.PRODUCTION}>
      <div className="flex flex-col h-full space-y-4">
        <div className="flex-shrink-0">
          <PageHeaderWithFavorite
            title="Aerografia"
            icon={IconBrush}
            favoritePage={FAVORITE_PAGES.PRODUCAO_AEROGRAFIA_LISTAR}
            breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Produção", href: routes.production.root }, { label: "Aerografia" }]}
            actions={[
              {
                key: "create",
                label: "Nova Aerografia",
                icon: IconPlus,
                onClick: () => navigate(routes.production.airbrushings.create),
                variant: "default",
              },
            ]}
          />
        </div>
        <div className="flex-1 min-h-0">
          <AirbrushingList />
        </div>
      </div>
    </PrivilegeRoute>
  );
};
