import { useNavigate } from "react-router-dom";
import {
  IconTools,
  IconQrcode,
  IconArrowRight,
  IconPalette,
  IconCalculator,
  IconClock,
  IconCalendarDollar,
  IconFlask,
  IconRecycle,
} from "@tabler/icons-react";
import type { Icon as TablerIcon } from "@tabler/icons-react";

import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/constants";
import { useAuth } from "@/contexts/auth-context";
import { hasAnyPrivilege } from "@/utils";
import { getRequiredPrivilegeForRoute } from "@/utils/route-privileges";

interface ToolGroup {
  title: string;
  description: string;
  icon: TablerIcon;
  links: {
    label: string;
    description: string;
    route: string;
    icon: TablerIcon;
  }[];
}

const toolGroups: ToolGroup[] = [
  {
    title: "Geração e Compartilhamento",
    description: "Ferramentas para gerar e compartilhar conteúdo",
    icon: IconQrcode,
    links: [
      {
        label: "Gerador de QR Code",
        description: "QR codes vetoriais para sites, telefones, Wi-Fi e contatos",
        route: routes.tools.qrCode.root,
        icon: IconQrcode,
      },
      {
        label: "Certificado de Resíduos",
        description: "Gere, compartilhe e arquive certificados de destinação de resíduos",
        route: routes.tools.wasteCertificate.root,
        icon: IconRecycle,
      },
    ],
  },
  {
    title: "Cores",
    description: "Ferramentas para visualização e estudo de cores",
    icon: IconPalette,
    links: [
      {
        label: "Paleta de Cores",
        description: "Sistema true-color para explorar paletas e combinações",
        route: routes.tools.colorPalette.root,
        icon: IconPalette,
      },
    ],
  },
  {
    title: "Calculadoras",
    description: "Ferramentas de cálculo para uso operacional",
    icon: IconCalculator,
    links: [
      {
        label: "Calculadora de Horas",
        description: "Some, subtraia e converta horas trabalhadas",
        route: routes.tools.timeCalculator.root,
        icon: IconClock,
      },
      {
        label: "Custo de Horas Extras",
        description: "Cálculo de horas extras por colaborador para metalúrgica",
        route: routes.tools.overtimeCost.root,
        icon: IconCalendarDollar,
      },
      {
        label: "Calculadora de Mistura",
        description: "Calcule proporções para misturas de tinta",
        route: routes.tools.paintMix.root,
        icon: IconFlask,
      },
    ],
  },
];

export function ToolsHubPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Hide tool cards the current sector cannot open (mirrors ROUTE_PRIVILEGES, incl.
  // the ADMIN superuser bypass). Groups left with no accessible link are dropped.
  const canAccess = (route: string): boolean => {
    const required = getRequiredPrivilegeForRoute(route);
    if (!required) return true;
    const list = (Array.isArray(required) ? required : [required]) as Parameters<typeof hasAnyPrivilege>[1];
    return hasAnyPrivilege(user as any, list);
  };
  const visibleGroups = toolGroups
    .map((group) => ({ ...group, links: group.links.filter((link) => canAccess(link.route)) }))
    .filter((group) => group.links.length > 0);

  return (
    <div className="h-full flex flex-col px-4 pt-4">
      <div className="flex-shrink-0">
        <PageHeader
          title="Ferramentas"
          icon={IconTools}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Ferramentas" },
          ]}
        />
      </div>

      <div className="flex-1 overflow-y-auto pb-6">
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visibleGroups.map((group) => {
            const GroupIcon = group.icon;
            return (
              <Card key={group.title} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <GroupIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{group.title}</CardTitle>
                      <CardDescription>{group.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 pt-0">
                  <div className="space-y-1">
                    {group.links.map((link) => {
                      const LinkIcon = link.icon;
                      return (
                        <button
                          key={link.route}
                          onClick={() => navigate(link.route)}
                          className="w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-left hover:bg-muted transition-colors group"
                        >
                          <LinkIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{link.label}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {link.description}
                            </p>
                          </div>
                          <IconArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default ToolsHubPage;
