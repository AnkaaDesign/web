import { PageHeader } from "@/components/ui/page-header";
import { ChangelogList } from "@/components/administration/changelog/list";
import { FAVORITE_PAGES } from "../../../constants";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";

function ChangeLogsList() {
  return (
    <PrivilegeRoute>
      <div className="h-full flex flex-col px-4 pt-4">
        <PageHeader
          variant="list"
          title="Histórico de Alterações"
          favoritePage={FAVORITE_PAGES.ADMINISTRACAO_REGISTROS_ALTERACOES_LISTAR}
          breadcrumbs={[{ label: "Início", href: "/" }, { label: "Servidor", href: "/servidor" }, { label: "Registros de Alterações" }]}
        />
        <ChangelogList className="flex-1 min-h-0 mt-4" />
      </div>
    </PrivilegeRoute>
  );
}

export default ChangeLogsList;
