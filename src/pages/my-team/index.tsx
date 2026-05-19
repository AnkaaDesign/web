import { PageHeader } from "@/components/ui/page-header";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { Card, CardContent } from "@/components/ui/card";
import { QuickAccessCard } from "@/components/dashboard";
import { useNavigate } from "react-router-dom";
import { useTeamStaffUsers, useTeamStaffBorrows, useTeamStaffWarnings } from "../../hooks";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { routes, TEAM_LEADER, BORROW_STATUS } from "../../constants";
import { IconUsersGroup } from "@tabler/icons-react";
import { Users, Wrench, AlertTriangle, ShieldCheck, Activity, Fingerprint } from "lucide-react";

export default function MyTeamPage() {
  const navigate = useNavigate();

  usePageTracker({ title: "Minha Equipe", icon: "users-group" });

  // Lightweight counts — request a single record just to read meta.totalRecords
  const { data: membersData } = useTeamStaffUsers({ limit: 1 });
  const { data: activeBorrowsData } = useTeamStaffBorrows({
    limit: 1,
    where: { status: BORROW_STATUS.ACTIVE },
  });
  const { data: warningsData } = useTeamStaffWarnings({ limit: 1 });

  const memberCount = membersData?.meta?.totalRecords;
  const activeBorrowCount = activeBorrowsData?.meta?.totalRecords;
  const warningCount = warningsData?.meta?.totalRecords;

  return (
    <PrivilegeRoute requiredPrivilege={TEAM_LEADER}>
      <div className="h-full flex flex-col bg-background px-4 pt-4 pb-4">
        <PageHeader
          title="Minha Equipe"
          icon={IconUsersGroup}
          breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Minha Equipe" }]}
          className="flex-shrink-0"
        />

        <div className="flex-1 overflow-y-auto pt-4">
          <Card>
            <CardContent className="p-6 space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4">Acesso Rápido</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <QuickAccessCard
                    title="Membros"
                    icon={Users}
                    onClick={() => navigate(routes.myTeam.members)}
                    count={memberCount}
                    color="blue"
                  />
                  <QuickAccessCard
                    title="Empréstimos"
                    icon={Wrench}
                    onClick={() => navigate(routes.myTeam.loans)}
                    count={activeBorrowCount}
                    color="orange"
                  />
                  <QuickAccessCard
                    title="Advertências"
                    icon={AlertTriangle}
                    onClick={() => navigate(routes.myTeam.warnings)}
                    count={warningCount}
                    color="red"
                  />
                  <QuickAccessCard
                    title="EPIs"
                    icon={ShieldCheck}
                    onClick={() => navigate(routes.myTeam.ppes)}
                    color="teal"
                  />
                  <QuickAccessCard
                    title="Movimentações"
                    icon={Activity}
                    onClick={() => navigate(routes.myTeam.movements)}
                    color="purple"
                  />
                  <QuickAccessCard
                    title="Controle de Ponto"
                    icon={Fingerprint}
                    onClick={() => navigate(routes.myTeam.calculations)}
                    color="green"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PrivilegeRoute>
  );
}
