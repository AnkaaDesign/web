import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { AirbrushingList } from "@/components/production/airbrushing/list";
import { IconSpray, IconPlus } from "@tabler/icons-react";
import { routes, SECTOR_PRIVILEGES } from "../../../constants";
import { useNavigate } from "react-router-dom";
import { usePageTracker } from "@/hooks/use-page-tracker";

export const AirbrushingsList = () => {
  const navigate = useNavigate();

  // Track page for analytics
  usePageTracker({ title: "Aerografia - Lista", icon: "airbrushings_list" });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.PRODUCTION}>
      <div className="flex flex-col h-full space-y-4">
        <div className="flex-shrink-0">
          <PageHeader
            variant="list"
            title="Aerografia"
            icon={IconSpray}
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
