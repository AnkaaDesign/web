import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useNavigate } from "react-router-dom";
import {
  IconChartBar,
  IconBrush,
  IconArrowRight,
} from "@tabler/icons-react";

const pages = [
  {
    title: "Produção de Tintas",
    description: "Acompanhamento da produção de tintas, consumo de pigmentos e eficiência do setor de pintura",
    route: routes.statistics.painting.production,
    icon: IconBrush,
  },
];

export const PaintStatisticsHubPage = () => {
  const navigate = useNavigate();

  usePageTracker({
    title: "Hub de Estatísticas de Pintura",
    icon: "chart-bar",
  });

  return (
    <div className="h-full flex flex-col px-4 pt-4">
      <div className="flex-shrink-0">
        <PageHeader
          title="Estatísticas de Pintura"
          icon={IconChartBar}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Estatísticas", href: routes.statistics.root },
            { label: "Pintura" },
          ]}
        />
      </div>
      <div className="flex-1 overflow-y-auto pb-6">
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
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

export default PaintStatisticsHubPage;
