import { PageHeader } from "@/components/ui/page-header";
import { IconHistory } from "@tabler/icons-react";
import { ChangelogList } from "@/components/administration/changelog/list";
import { FAVORITE_PAGES } from "../../../constants";

function ChangeLogsList() {
  return (
    <div className="flex flex-col h-full space-y-4">
      <PageHeader
        variant="list"
        title="Histórico de Alterações"
        icon={IconHistory}
        favoritePage={FAVORITE_PAGES.ADMINISTRACAO_REGISTROS_ALTERACOES_LISTAR}
        breadcrumbs={[{ label: "Início", href: "/" }, { label: "Servidor", href: "/servidor" }, { label: "Registros de Alterações" }]}
      />
      <div className="flex-1 overflow-hidden">
        <ChangelogList />
      </div>
    </div>
  );
}

export default ChangeLogsList;
