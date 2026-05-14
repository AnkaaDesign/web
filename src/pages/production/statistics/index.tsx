import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { routes, FAVORITE_PAGES } from "@/constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useNavigate } from "react-router-dom";
import {
  IconChartBar,
  IconTrendingUp,
  IconAlertTriangle,
  IconArrowRight,
  IconCoins,
} from "@tabler/icons-react";

const pages = [
  {
    title: "Produtividade",
    description: "Tarefas concluídas e média por colaborador efetivo, por mês ou ano",
    route: routes.statistics.production.productivity,
    icon: IconTrendingUp,
  },
  {
    title: "Gargalos",
    description: "Identifique etapas que estão atrasando o fluxo produtivo e seus impactos",
    route: routes.statistics.production.bottlenecks,
    icon: IconAlertTriangle,
  },
  {
    title: "Relação Bônus / Produção",
    description: "Acúmulo diário do bônus em relação às tarefas concluídas no período (26–25), com previsão até o fechamento",
    route: routes.statistics.production.bonusValue,
    icon: IconCoins,
  },
];

export const ProductionStatisticsHubPage = () => {
  const navigate = useNavigate();

  usePageTracker({
    title: "Hub de Estatísticas de Produção",
    icon: "chart-bar",
  });

  return (
    <div className="h-full flex flex-col px-4 pt-4">
      <div className="flex-shrink-0">
        <PageHeader
          title="Estatísticas de Produção"
          icon={IconChartBar}
          favoritePage={FAVORITE_PAGES.ESTATISTICAS_PRODUCAO}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Estatísticas", href: routes.statistics.root },
            { label: "Produção" },
          ]}
        />
      </div>
      <div className="flex-1 overflow-y-auto pb-6">
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {pages.map((page) => {
            const PageIcon = page.icon;
            return (
              <Card
                key={page.route}
                className="cursor-pointer hover:shadow-sm transition-shadow"
                onClick={() => navigate(page.route)}
              >
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <PageIcon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{page.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">
                    {page.description}
                  </CardDescription>
                  <div className="mt-4 flex items-center text-sm text-primary font-medium group">
                    Ver detalhes
                    <IconArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
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

export default ProductionStatisticsHubPage;
