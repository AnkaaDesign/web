import { UnderConstruction } from "@/components/navigation/under-construction";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { IconBell } from "@tabler/icons-react";
import { FAVORITE_PAGES } from "../../../../constants";
import { useParams } from "react-router-dom";

export const EditNotificationPage = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <div className="px-4 pt-4">
          <div className="max-w-3xl mx-auto">
            <PageHeaderWithFavorite
              title="Editar Notificação"
              icon={IconBell}
              favoritePage={FAVORITE_PAGES.ADMINISTRACAO_NOTIFICACOES_LISTAR}
              breadcrumbs={[
                { label: "Início", href: "/" },
                { label: "Administração", href: "/administracao" },
                { label: "Notificações", href: "/administracao/notificacoes" },
                { label: "Editar" },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4">
          <UnderConstruction title={`Edit Notification ${id || ""}`} />
        </div>
      </div>
    </div>
  );
};
