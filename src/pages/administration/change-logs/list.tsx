import { PageHeader } from "@/components/ui/page-header";
import { IconHistory, IconSearch } from "@tabler/icons-react";
import { ChangelogList } from "@/components/administration/changelog/list";
import { FAVORITE_PAGES, routes } from "../../../constants";
import { useNavigate } from "react-router-dom";

function ChangeLogsList() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-full space-y-4">
      <PageHeader
        variant="list"
        title="Histórico de Alterações"
        icon={IconHistory}
        favoritePage={FAVORITE_PAGES.ADMINISTRACAO_REGISTROS_ALTERACOES_LISTAR}
        breadcrumbs={[{ label: "Início", href: "/" }, { label: "Administração", href: "/administracao" }, { label: "Histórico de Alterações" }]}
        actions={[
          {
            key: "by-entity",
            label: "Por Entidade",
            icon: IconSearch,
            onClick: () => navigate(routes.administration.changeLogs.root + "/entidade"),
            variant: "default" as const,
          },
        ]}
      />
      <div className="flex-1 overflow-hidden">
        <ChangelogList />
      </div>
    </div>
  );
}

export default ChangeLogsList;
