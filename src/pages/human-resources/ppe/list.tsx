import { PpeList } from "@/components/inventory/epi/list/ppe-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { IconShield, IconPlus } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

export const PpeListPage = () => {
  const navigate = useNavigate();

  // Track page access
  usePageTracker({
    title: "Lista de EPIs",
    icon: "shield",
  });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
      <div className="flex flex-col h-full space-y-4">
        <div className="flex-shrink-0">
          <PageHeader
            variant="default"
            title="EPIs"
            icon={IconShield}
            favoritePage={FAVORITE_PAGES.RECURSOS_HUMANOS_EPI_LISTAR}
            breadcrumbs={[{ label: "Início", href: routes.home }, { label: "RH", href: routes.humanResources.root }, { label: "EPIs" }]}
            actions={[
              {
                key: "create",
                label: "Novo EPI",
                icon: IconPlus,
                onClick: () => navigate(routes.humanResources.ppe.create),
                variant: "default",
              },
            ]}
          />
        </div>
        <PpeList className="flex-1 min-h-0" />
      </div>
    </PrivilegeRoute>
  );
};
