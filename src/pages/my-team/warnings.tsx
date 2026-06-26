import { routes, TEAM_LEADER } from "../../constants";

import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/page-header";
import { WarningList } from "@/components/personnel-department/warning/list";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export default function MyTeamWarningsPage() {
  usePageTracker({ title: "Advertências da Equipe", icon: "alert-triangle" });

  return (
    <PrivilegeRoute requiredPrivilege={[TEAM_LEADER]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Advertências da Equipe"
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Minha Equipe", href: routes.myTeam.root },
            { label: "Advertências" },
          ]}
          className="flex-shrink-0"
        />
        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <WarningList teamScope className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
}
