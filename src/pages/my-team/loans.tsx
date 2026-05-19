import { BorrowList } from "@/components/inventory/borrow/list/borrow-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { TEAM_LEADER, routes } from "../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export default function TeamLoansPage() {
  usePageTracker({
    title: "Empréstimos da Equipe",
    icon: "packages",
  });

  return (
    <PrivilegeRoute requiredPrivilege={TEAM_LEADER}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Empréstimos da Equipe"
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Minha Equipe", href: routes.myTeam.root },
            { label: "Empréstimos" },
          ]}
          className="flex-shrink-0"
        />

        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <BorrowList teamScope className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
}
