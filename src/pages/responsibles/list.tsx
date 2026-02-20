import { ResponsibleList } from "@/components/administration/customer/responsible";
import { PageHeader } from "@/components/ui/page-header";
import { routes, FAVORITE_PAGES } from "@/constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { IconPlus } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";

export const ResponsibleListPage = () => {
  const navigate = useNavigate();

  // Track page access
  usePageTracker({
    title: "Lista de Responsáveis",
    icon: "users",
  });

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <PageHeader
        variant="list"
        title="Responsáveis"
        favoritePage={FAVORITE_PAGES.ADMINISTRACAO_RESPONSAVEIS_LISTAR}
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Administração", href: routes.administration.root },
          { label: "Clientes", href: routes.administration.customers.root },
          { label: "Responsáveis" }
        ]}
        actions={[
          {
            key: "create",
            label: "Cadastrar",
            icon: IconPlus,
            onClick: () => navigate(routes.responsibles.create),
            variant: "default" as const,
          },
        ]}
        className="flex-shrink-0"
      />
      <div className="flex-1 min-h-0 pb-6 flex flex-col">
        <ResponsibleList className="h-full" />
      </div>
    </div>
  );
};
