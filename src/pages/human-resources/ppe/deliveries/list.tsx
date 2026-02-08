import { PpeDeliveryList } from "@/components/inventory/epi/delivery/ppe-delivery-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { IconPlus } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../../hooks";
import { hasPrivilege } from "../../../../utils";

export const PpeDeliveryListPage = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();

  // Check if user is admin (only admins can create PPE deliveries)
  const isAdmin = currentUser && hasPrivilege(currentUser, SECTOR_PRIVILEGES.ADMIN);

  // Track page access
  usePageTracker({
    title: "Lista de Entregas de EPI",
    icon: "truck",
  });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4 pb-4">
        <PageHeader
          className="flex-shrink-0"
          variant="default"
          title="Entregas de EPI"
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
        <PpeDeliveryList className="flex-1 min-h-0" />
      </div>
    </PrivilegeRoute>
  );
};
