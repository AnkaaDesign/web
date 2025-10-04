import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IconChartBar, IconPackage, IconActivity, IconMask } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { routes } from "../../../../constants";

export const PpeReportsPage = () => {
  const navigate = useNavigate();

  const reportCards = [
    {
      title: "Relatório de Estoque",
      description: "Visualize os níveis de estoque por tipo e tamanho de EPI",
      icon: IconPackage,
      path: routes.humanResources.ppe.reports.stock,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-100 dark:bg-blue-900/20",
    },
    {
      title: "Estatísticas de Uso",
      description: "Análise de consumo e distribuição de EPIs por período",
      icon: IconActivity,
      path: routes.humanResources.ppe.reports.usage,
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-green-100 dark:bg-green-900/20",
    },
    {
      title: "Inventário de Máscaras",
      description: "Relatório específico para estoque e distribuição de máscaras",
      icon: IconMask,
      path: routes.humanResources.ppe.reports.masks,
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-100 dark:bg-purple-900/20",
    },
  ];

  return (
    <div className="flex-1 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Relatórios de EPI</h1>
          <p className="text-muted-foreground mt-2">Visualize relatórios e análises sobre o estoque e distribuição de Equipamentos de Proteção Individual</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {reportCards.map((report) => {
          const Icon = report.icon;
          return (
            <Card key={report.path} className="hover:shadow-lg transition-shadow cursor-pointer border border-border" onClick={() => navigate(report.path)} level={1}>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${report.bgColor}`}>
                    <Icon className={`h-6 w-6 ${report.color}`} />
                  </div>
                  <CardTitle className="text-lg">{report.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{report.description}</p>
                <Button
                  variant="link"
                  className="mt-4 p-0 h-auto font-medium"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(report.path);
                  }}
                >
                  Visualizar Relatório <span className="font-enhanced-unicode">→</span>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border border-border" level={1}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IconChartBar className="h-5 w-5" />
            Visão Geral
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Os relatórios de EPI fornecem insights valiosos sobre:</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span>Níveis de estoque atuais por tipo e tamanho</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span>Distribuição de tamanhos mais utilizados</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span>Tendências de consumo ao longo do tempo</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-1">•</span>
              <span>Alertas de estoque baixo ou necessidade de reposição</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};
