import { PageHeader } from "@/components/ui/page-header";
import { routes, FAVORITE_PAGES } from "../../../constants";
import { IconTool } from "@tabler/icons-react";

export default function GaragesPage() {
  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex-shrink-0">
        <PageHeader
          title="Garagens"
          description="Gestão de garagens e vagas"
          favoritePageKey={FAVORITE_PAGES.PRODUCTION_GARAGES}
          breadcrumbs={[
            { label: "Produção", path: routes.production.root },
            { label: "Garagens", path: routes.production.garages.root },
          ]}
        />
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4 p-8 max-w-md">
          <IconTool className="mx-auto h-20 w-20 text-yellow-500" />
          <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Em Construção
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Esta funcionalidade está sendo desenvolvida e estará disponível em breve.
          </p>
        </div>
      </div>
    </div>
  );
}
