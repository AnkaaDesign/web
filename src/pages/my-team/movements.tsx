import { ActivityList } from "@/components/inventory/activity/list/activity-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { TEAM_LEADER, routes } from "../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const TeamMovementsPage = () => {
  usePageTracker({
    title: "Movimentações da Equipe",
    icon: "search",
  });

  return (
    <PrivilegeRoute requiredPrivilege={TEAM_LEADER}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4 pb-4">
        <PageHeader
          className="flex-shrink-0"
          variant="list"
          title="Movimentações da Equipe"
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Minha Equipe", href: routes.myTeam.root },
            { label: "Movimentações" },
          ]}
        />

        <ActivityList teamScope className="flex-1 min-h-0" />
      </div>
    </PrivilegeRoute>
  );
};

export default TeamMovementsPage;
