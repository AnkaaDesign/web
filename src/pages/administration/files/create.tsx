import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { IconFileText } from "@tabler/icons-react";
import { UnderConstruction } from "@/components/navigation/under-construction";
import { FAVORITE_PAGES } from "../../../constants";

export const CreateFilePage = () => {
  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <div className="max-w-3xl mx-auto">
          <PageHeaderWithFavorite
            title="Novo Arquivo"
            icon={IconFileText}
            favoritePage={FAVORITE_PAGES.ADMINISTRACAO_ARQUIVOS_CADASTRAR}
            breadcrumbs={[
              { label: "Início", href: "/" },
              { label: "Administração", href: "/administracao" },
              { label: "Arquivos", href: "/administracao/arquivos" },
              { label: "Novo Arquivo" },
            ]}
          />
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto mt-6">
        <div className="max-w-3xl mx-auto h-full">
          <UnderConstruction title="Create File" />
        </div>
      </div>
    </div>
  );
};
