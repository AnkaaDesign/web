import { useMemo } from "react";
import { useParams } from "react-router-dom";

import { PageHeader } from "@/components/ui/page-header";
import { AssinaturaDetail } from "@/components/human-resources/time-clock/assinatura-digital/assinatura-detail";
import { AssinaturaDownloadButton } from "@/components/human-resources/time-clock/assinatura-digital/assinatura-download-button";
import { routes, SECTOR_PRIVILEGES } from "../../../../constants";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export default function AssinaturaDigitalDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const apuracaoId = useMemo(() => {
    const n = Number(id);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [id]);

  usePageTracker({ title: "Detalhes da Apuração", icon: "signature" });

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.ACCOUNTING, SECTOR_PRIVILEGES.HUMAN_RESOURCES, SECTOR_PRIVILEGES.ADMIN]}>
      <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
        <PageHeader
          variant="detail"
          title={apuracaoId ? `Apuração #${apuracaoId}` : "Apuração inválida"}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Recursos Humanos", href: routes.humanResources.root },
            { label: "Controle de Ponto", href: routes.humanResources.timeClock.list },
            {
              label: "Fechamento",
              href: routes.humanResources.timeClock.fechamento.list,
            },
            { label: apuracaoId ? `#${apuracaoId}` : "—" },
          ]}
          headerExtra={
            apuracaoId ? <AssinaturaDownloadButton apuracaoIds={[apuracaoId]} /> : undefined
          }
          className="flex-shrink-0"
        />
        <div className="flex-1 min-h-0 pb-6 overflow-auto">
          {apuracaoId ? (
            <AssinaturaDetail apuracaoId={apuracaoId} className="h-full" />
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              ID de apuração inválido.
            </div>
          )}
        </div>
      </div>
    </PrivilegeRoute>
  );
}
