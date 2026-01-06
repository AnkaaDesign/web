import { BorrowList } from "@/components/inventory/borrow/list/borrow-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { FAVORITE_PAGES, SECTOR_PRIVILEGES, routes } from "../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { IconPlus } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

export default function LoanListPage() {
  const navigate = useNavigate();

  // Track page access
  usePageTracker({
    title: "Lista de Empréstimos",
    icon: "package-export",
  });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Empréstimos"
          favoritePage={FAVORITE_PAGES.ESTOQUE_EMPRESTIMOS_LISTAR}
          breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Estoque", href: routes.inventory.root }, { label: "Empréstimos" }]}
          actions={[
            {
              key: "create",
              label: "Novo Empréstimo",
              icon: IconPlus,
              onClick: () => navigate(routes.inventory.loans.create),
              variant: "default",
            },
          ]}
          className="flex-shrink-0"
        />

        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <BorrowList className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
}
