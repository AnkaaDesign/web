import { CutList } from "@/components/production/cut/list/cut-list";
import { PageHeader } from "@/components/ui/page-header";
import { routes, FAVORITE_PAGES } from "../../../constants";
import { IconScissors } from "@tabler/icons-react";

export default function CutListPage() {
  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex-shrink-0">
        <PageHeader
          variant="default"
          title="Cortes"
          icon={IconScissors}
          favoritePage={FAVORITE_PAGES.PRODUCAO_RECORTE_LISTAR}
          breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Produção", href: routes.production.root }, { label: "Cortes" }]}
        />
      </div>
      <CutList className="flex-1 min-h-0" />
    </div>
  );
}
