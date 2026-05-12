import { PageHeader } from "@/components/ui/page-header";
import { AssinaturaList } from "@/components/human-resources/time-clock/assinatura-digital/assinatura-list";
import { routes, FAVORITE_PAGES, SECTOR_PRIVILEGES } from "../../../../constants";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export default function AssinaturaDigitalListPage() {
  usePageTracker({ title: "Assinatura Digital de Cartão Ponto", icon: "signature" });

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="list"
          title="Assinatura Digital de Cartão Ponto"
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Recursos Humanos", href: routes.humanResources.root },
            { label: "Controle de Ponto", href: routes.humanResources.timeClock.list },
            { label: "Assinatura Digital" },
          ]}
          favoritePage={FAVORITE_PAGES.RECURSOS_HUMANOS_CONTROLE_PONTO_ASSINATURA_DIGITAL_LISTAR}
          className="flex-shrink-0"
        />
        <div className="flex-1 min-h-0 pb-6 flex flex-col">
          <AssinaturaList className="h-full" />
        </div>
      </div>
    </PrivilegeRoute>
  );
}
