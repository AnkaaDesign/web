import { UnderConstruction } from "@/components/navigation/under-construction";
import { PageHeader } from "@/components/ui/page-header";
import { IconBell } from "@tabler/icons-react";
import { FAVORITE_PAGES } from "../../../../constants";
import { useParams } from "react-router-dom";

export const EditNotificationPage = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <PageHeader
        title="Editar Notificação"
        icon={IconBell}
        favoritePage={FAVORITE_PAGES.ADMINISTRACAO_NOTIFICACOES_LISTAR}
        breadcrumbs={[
          { label: "Início", href: "/" },
          { label: "Administração", href: "/administracao" },
          { label: "Notificações", href: "/administracao/notificacoes" },
          { label: "Editar" },
        ]}
        className="flex-shrink-0"
      />
      <div className="flex-1 overflow-y-auto pb-6">
        <UnderConstruction title={`Edit Notification ${id || ""}`} />
      </div>
    </div>
  );
};
