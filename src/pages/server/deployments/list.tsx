import { IconRocket } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES } from "../../../constants";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { DeploymentManager } from "@/components/server/deployment/deployment-manager";
import { usePageTracker } from "@/hooks/use-page-tracker";

export const DeploymentListPage = () => {
  usePageTracker({
    title: "Implantações",
    icon: "rocket",
  });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
      <div className="h-full flex flex-col px-4 pt-4">
        <div className="flex-shrink-0">
          <PageHeader
            title="Implantações"
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Servidor", href: routes.server.root },
              { label: "Implantações" },
            ]}
          />
        </div>

        <div className="flex-1 overflow-y-auto pb-6">
          <DeploymentManager className="flex-1 min-h-0 mt-4" />
        </div>
      </div>
    </PrivilegeRoute>
  );
};
