import { PpeDeliveryList } from "@/components/inventory/epi/delivery/ppe-delivery-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import { IconTruck, IconPlus } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../../hooks";
import { hasPrivilege } from "../../../../utils";

export const PpeDeliveryListPage = () => {
  const navigate = useNavigate();
  const { data: currentUser } = useAuth();

  // Check if user is admin (only admins can create PPE deliveries)
  const isAdmin = currentUser && hasPrivilege(currentUser, SECTOR_PRIVILEGES.ADMIN);

  // Track page access
  usePageTracker({
    title: "Lista de Entregas de EPI",
    icon: "truck",
  });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
      <div className="flex flex-col h-full space-y-4">
        <div className="flex-shrink-0">
          <PageHeader
            variant="default"
            title="Entregas de EPI"
            icon={IconTruck}
            favoritePage={FAVORITE_PAGES.RECURSOS_HUMANOS_EPI_ENTREGAS_LISTAR}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "RH", href: routes.humanResources.root },
              { label: "EPIs", href: routes.humanResources.ppe.root },
              { label: "Entregas" },
            ]}
            actions={[
              // Only show create button for admins
              ...(isAdmin
                ? [
                    {
                      key: "create",
                      label: "Nova Entrega",
                      icon: IconPlus,
                      onClick: () => navigate(routes.humanResources.ppe.deliveries.create),
                      variant: "default" as const,
                    },
                  ]
                : []),
            ]}
          />
        </div>
        <PpeDeliveryList className="flex-1 min-h-0" />
      </div>
    </PrivilegeRoute>
  );
};
