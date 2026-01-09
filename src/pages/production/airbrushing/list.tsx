import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { AirbrushingList } from "@/components/production/airbrushing/list";
import { IconPlus } from "@tabler/icons-react";
import { routes, SECTOR_PRIVILEGES, FAVORITE_PAGES } from "../../../constants";
import { useNavigate } from "react-router-dom";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { useAuth } from "@/contexts/auth-context";
import { hasPrivilege } from "@/utils";

export const AirbrushingListPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Track page for analytics
  usePageTracker({ title: "Aerografia - Lista" });

  // ADMIN and COMMERCIAL can create airbrushing
  const canCreate = user && (hasPrivilege(user, SECTOR_PRIVILEGES.ADMIN) || hasPrivilege(user, SECTOR_PRIVILEGES.COMMERCIAL));

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Aerografia"
          favoritePage={FAVORITE_PAGES.PRODUCAO_AEROGRAFIA_LISTAR}
          breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Produção", href: routes.production.root }, { label: "Aerografia" }]}
          actions={canCreate ? [
            {
              key: "create",
              label: "Nova Aerografia",
              icon: IconPlus,
              onClick: () => navigate(routes.production.airbrushings.create),
              variant: "default",
            },
          ] : []}
          className="flex-shrink-0"
        />
        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <AirbrushingList className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
};
