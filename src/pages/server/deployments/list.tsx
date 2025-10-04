import { IconRocket } from "@tabler/icons-react";

import { routes, SECTOR_PRIVILEGES } from "../../../constants";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { DeploymentList } from "@/components/server/deployment/list";
import { usePageTracker } from "@/hooks/use-page-tracker";

export const DeploymentListPage = () => {
  usePageTracker({
    title: "Implantações",
    icon: "rocket",
  });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
      <div className="flex flex-col h-full space-y-4">
        <PageHeaderWithFavorite
          title="Implantações"
          icon={IconRocket}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Servidor", href: routes.server.root },
            { label: "Implantações" },
          ]}
        />

        <DeploymentList className="flex-1 min-h-0" />
      </div>
    </PrivilegeRoute>
  );
};
