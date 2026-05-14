import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { routes, FAVORITE_PAGES } from "@/constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useNavigate } from "react-router-dom";
import {
  IconChartBar,
  IconReportMoney,
  IconArrowRight,
  IconBuildingBank,
  IconReceipt2,
  IconCash,
} from "@tabler/icons-react";

const pages = [
  {
    title: "Receita & Orçamentos",
    description: "Funil de vendas, ticket médio, ciclo de fechamento e backlog ativo",
    route: routes.statistics.financial.revenueQuotes,
    icon: IconReportMoney,
  },
  {
    title: "Cobranças & Fluxo de Caixa",
    description: "Faturado vs recebido por período, taxa de recebimento e envelhecimento",
    route: routes.statistics.financial.collection,
    icon: IconCash,
  },
  {
    title: "Recebíveis & Clientes",
    description: "Maiores devedores, DSO por cliente, previsão de caixa e curva de recuperação",
    route: routes.statistics.financial.receivables,
    icon: IconBuildingBank,
  },
  {
    title: "NFS-e",
    description: "Emissão, status de autorização e impostos estimados sobre o serviço",
    route: routes.statistics.financial.nfse,
    icon: IconReceipt2,
  },
];

export const FinancialStatisticsHubPage = () => {
  const navigate = useNavigate();

  usePageTracker({
    title: "Hub de Estatísticas Financeiras",
    icon: "chart-bar",
  });

  return (
    <div className="h-full flex flex-col px-4 pt-4">
      <div className="flex-shrink-0">
        <PageHeader
          title="Estatísticas Financeiras"
          icon={IconChartBar}
          favoritePage={FAVORITE_PAGES.ESTATISTICAS_FINANCEIRO}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Estatísticas", href: routes.statistics.root },
            { label: "Financeiro" },
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
                  <CardDescription className="text-sm text-foreground/75">
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

export default FinancialStatisticsHubPage;
