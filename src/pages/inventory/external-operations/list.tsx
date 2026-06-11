import { ExternalOperationList } from "@/components/inventory/external-operation/list/external-operation-list";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { IconPlus } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

export const ExternalOperationListPage = () => {
  const navigate = useNavigate();

  // Track page access
  usePageTracker({
    title: "Lista de Operações Externas",
    icon: "package-export",
  });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.ADMIN}>
      <div className="h-full flex flex-col px-4 pt-4">
        <PageHeader
          variant="list"
          title="Operações Externas"
          favoritePage={FAVORITE_PAGES.ESTOQUE_RETIRADAS_EXTERNAS_LISTAR}
          breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Estoque", href: routes.inventory.root }, { label: "Operações Externas" }]}
          actions={[
            {
              key: "create",
              label: "Nova Operação",
              icon: IconPlus,
              onClick: () => navigate(routes.inventory.externalOperations?.create || "/inventory/external-operations/create"),
              variant: "default",
            },
          ]}
        />

        <ExternalOperationList className="flex-1 mt-4" />
      </div>
    </PrivilegeRoute>
  );
};

export default ExternalOperationListPage;
