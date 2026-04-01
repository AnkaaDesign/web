import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { routes, FAVORITE_PAGES } from "@/constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useNavigate } from "react-router-dom";
import {
  IconChartBar,
  IconBuildingFactory2,
  IconCash,
  IconUsers,
  IconPackage,
  IconPaint,
  IconSettings,
  IconArrowRight,
  IconTrendingUp,
  IconAlertTriangle,
  IconReceipt,
  IconFileInvoice,
  IconReportMoney,
  IconUserStar,
  IconFlame,
  IconShoppingCart,
  IconStar,
  IconChartLine,
  IconBrush,
  IconEye,
} from "@tabler/icons-react";

interface StatLink {
  label: string;
  description: string;
  route: string;
  icon: React.ElementType;
}

interface StatModule {
  title: string;
  description: string;
  icon: React.ElementType;
  links: StatLink[];
}

const modules: StatModule[] = [
  {
    title: "Produção",
    description: "Acompanhe o desempenho e eficiência da produção",
    icon: IconBuildingFactory2,
    links: [
      {
        label: "Rendimento",
        description: "Métricas de produtividade e rendimento da produção",
        route: routes.statistics.production.throughput,
        icon: IconTrendingUp,
      },
      {
        label: "Gargalos",
        description: "Identifique pontos de lentidão no processo produtivo",
        route: routes.statistics.production.bottlenecks,
        icon: IconAlertTriangle,
      },
      {
        label: "Receita",
        description: "Análise de receita gerada pela produção",
        route: routes.statistics.production.revenue,
        icon: IconReceipt,
      },
    ],
  },
  {
    title: "Financeiro",
    description: "Indicadores financeiros e controle de cobranças",
    icon: IconCash,
    links: [
      {
        label: "Cobranças",
        description: "Acompanhamento de cobranças e inadimplência",
        route: routes.statistics.financial.collection,
        icon: IconReportMoney,
      },
      {
        label: "Boletos",
        description: "Controle e análise de boletos emitidos",
        route: routes.statistics.financial.bankSlips,
        icon: IconFileInvoice,
      },
    ],
  },
  {
    title: "Recursos Humanos",
    description: "Gestão de pessoas e folha de pagamento",
    icon: IconUsers,
    links: [
      {
        label: "Folha de Pagamento",
        description: "Análise detalhada da folha de pagamento",
        route: routes.statistics.humanResources.payroll,
        icon: IconReportMoney,
      },
      {
        label: "Equipe e Performance",
        description: "Desempenho e métricas da equipe",
        route: routes.statistics.humanResources.teamPerformance,
        icon: IconUserStar,
      },
    ],
  },
  {
    title: "Estoque",
    description: "Controle de inventário, consumo e tendências",
    icon: IconPackage,
    links: [
      {
        label: "Consumo",
        description: "Análise de consumo de materiais e insumos",
        route: routes.statistics.inventory.consumption,
        icon: IconFlame,
      },
      {
        label: "Pedidos",
        description: "Estatísticas de pedidos de compra",
        route: routes.statistics.inventory.orders,
        icon: IconShoppingCart,
      },
      {
        label: "Top Itens",
        description: "Itens mais utilizados e movimentados",
        route: routes.statistics.inventory.topItems,
        icon: IconStar,
      },
      {
        label: "Tendências",
        description: "Tendências de estoque e previsões",
        route: routes.statistics.inventory.trends,
        icon: IconChartLine,
      },
    ],
  },
  {
    title: "Pintura",
    description: "Estatísticas do setor de pintura",
    icon: IconPaint,
    links: [
      {
        label: "Produção de Tintas",
        description: "Acompanhamento da produção e uso de tintas",
        route: routes.statistics.painting.production,
        icon: IconBrush,
      },
    ],
  },
  {
    title: "Administração",
    description: "Visão geral e indicadores administrativos",
    icon: IconSettings,
    links: [
      {
        label: "Visão Geral",
        description: "Painel consolidado com indicadores gerais",
        route: routes.statistics.administration.overview,
        icon: IconEye,
      },
    ],
  },
];

export const StatisticsHubPage = () => {
  const navigate = useNavigate();

  usePageTracker({
    title: "Hub de Estatísticas",
    icon: "chart-bar",
  });

  return (
    <div className="h-full flex flex-col px-4 pt-4">
      <div className="flex-shrink-0">
        <PageHeader
          title="Estatísticas"
          icon={IconChartBar}
          favoritePage={FAVORITE_PAGES.ESTATISTICAS}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Estatísticas" },
          ]}
        />
      </div>
      <div className="flex-1 overflow-y-auto pb-6">
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {modules.map((module) => {
            const ModuleIcon = module.icon;
            return (
              <Card key={module.title} className="flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <ModuleIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{module.title}</CardTitle>
                      <CardDescription>{module.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 pt-0">
                  <div className="space-y-1">
                    {module.links.map((link) => {
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
};

export default StatisticsHubPage;
