import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { IconBell } from "@tabler/icons-react";
import { UnderConstruction } from "@/components/navigation/under-construction";
import { FAVORITE_PAGES } from "../../../constants";

export const CreateNotificationPage = () => {
  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <div className="px-4 pt-4">
          <div className="max-w-3xl mx-auto">
            <PageHeaderWithFavorite
              title="Nova Notificação"
              icon={IconBell}
              favoritePage={FAVORITE_PAGES.ADMINISTRACAO_NOTIFICACOES_CADASTRAR}
              breadcrumbs={[
                { label: "Início", href: "/" },
                { label: "Administração", href: "/administracao" },
                { label: "Notificações", href: "/administracao/notificacoes" },
                { label: "Nova Notificação" },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-4">
          <UnderConstruction title="Create Notification" />
        </div>
      </div>
    </div>
  );
};
