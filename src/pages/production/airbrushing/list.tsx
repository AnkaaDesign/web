import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { AirbrushingList } from "@/components/production/airbrushing/list";
import { IconPlus } from "@tabler/icons-react";
import { routes, SECTOR_PRIVILEGES, FAVORITE_PAGES } from "../../../constants";
import { useNavigate } from "react-router-dom";
import { usePageTracker } from "@/hooks/use-page-tracker";

export const AirbrushingListPage = () => {
  const navigate = useNavigate();

  // Track page for analytics
  usePageTracker({ title: "Aerografia - Lista" });

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Aerografia"
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
          className="flex-shrink-0"
        />
        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <AirbrushingList className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
};
