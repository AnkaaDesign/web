import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { PpeSizesList } from "@/components/inventory/epi/sizes/ppe-sizes-list";
import { FAVORITE_PAGES, SECTOR_PRIVILEGES, routes } from "../../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const PpeSizeListPage = () => {
  usePageTracker({
    title: "Tamanhos de EPI",
    icon: "sizes",
  });

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4 pb-4">
        <PageHeader
          className="flex-shrink-0"
          variant="list"
          title="Tamanhos de EPI"
          favoritePage={FAVORITE_PAGES.RECURSOS_HUMANOS_EPI_TAMANHOS_LISTAR}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "RH", href: routes.humanResources.root },
            { label: "EPIs", href: routes.humanResources.ppe.root },
            { label: "Tamanhos" },
          ]}
        />
        <PpeSizesList className="flex-1 min-h-0" />
      </div>
    </PrivilegeRoute>
  );
};

export default PpeSizeListPage;
