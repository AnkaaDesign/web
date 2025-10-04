import { PageHeader } from "@/components/ui/page-header";
import { IconBell } from "@tabler/icons-react";
import { UnderConstruction } from "@/components/navigation/under-construction";
import { FAVORITE_PAGES } from "../../../constants";

export const NotificationListPage = () => {
  return (
    <div className="space-y-6">
      <PageHeader
        variant="list"
        title="Notificações"
        icon={IconBell}
        favoritePage={FAVORITE_PAGES.ADMINISTRACAO_NOTIFICACOES_LISTAR}
        breadcrumbs={[{ label: "Início", href: "/" }, { label: "Administração", href: "/administracao" }, { label: "Notificações" }]}
      />
      <UnderConstruction title="Notification List" />
    </div>
  );
};
