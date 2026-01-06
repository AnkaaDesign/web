import { CutList } from "@/components/production/cut/list/cut-list";
import { PageHeader } from "@/components/ui/page-header";
import { routes, FAVORITE_PAGES } from "../../../constants";

export default function CutListPage() {
  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <PageHeader
        variant="list"
        title="Cortes"
        favoritePage={FAVORITE_PAGES.PRODUCAO_RECORTE_LISTAR}
        breadcrumbs={[{ label: "Início", href: routes.home }, { label: "Produção", href: routes.production.root }, { label: "Cortes" }]}
        className="flex-shrink-0"
      />

      <div className="flex-1 min-h-0 pb-6 flex flex-col">
        <CutList className="h-full" />
      </div>
    </div>
  );
}
