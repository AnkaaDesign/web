import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { Card, CardContent } from "@/components/ui/card";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../../constants";
import { usePageTracker } from "@/hooks/use-page-tracker";
import {
  IconTrendingUp,
  IconTool,
} from "@tabler/icons-react";

export const StockMovementStatisticsPage = () => {
  // Page tracking
  usePageTracker({
    title: "Movimentação de Estoque",
    icon: "trending-up",
  });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
      <div className="flex flex-col h-full">
        <PageHeaderWithFavorite
          title="Movimentação de Estoque"
          icon={IconTrendingUp}
          favoritePage={FAVORITE_PAGES.ESTOQUE_ESTATISTICAS_MOVIMENTACAO}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Estoque", href: routes.inventory.root },
            { label: "Estatísticas", href: routes.inventory.statistics.root },
            { label: "Movimentação" }
          ]}
        />
        <div className="flex-1 flex items-center justify-center">
          <Card className="max-w-md">
            <CardContent className="p-8 text-center">
              <IconTool className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-2xl font-semibold mb-2">Em Construção</h3>
              <p className="text-muted-foreground">
                Esta página está sendo desenvolvida e estará disponível em breve.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default StockMovementStatisticsPage;
