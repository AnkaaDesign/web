import { PageHeader } from "@/components/ui/page-header";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useCanViewPrices } from "../../../hooks";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import {
  IconChartBar,
  IconFlame,
  IconShoppingCart,
  IconArrowRight,
  IconCheck,
} from "@tabler/icons-react";

type ToneKey = "blue" | "emerald" | "violet" | "amber" | "rose" | "cyan" | "fuchsia" | "sky";

const TONES: Record<ToneKey, {
  iconBg: string;
  iconRing: string;
  iconText: string;
  barFrom: string;
  barTo: string;
  border: string;
  bullet: string;
}> = {
  blue:    { iconBg: "bg-blue-500/15",    iconRing: "ring-blue-500/30",    iconText: "text-blue-500",    barFrom: "from-blue-500/15",    barTo: "to-blue-500/0",    border: "hover:border-blue-500/40",    bullet: "text-blue-500/70" },
  emerald: { iconBg: "bg-emerald-500/15", iconRing: "ring-emerald-500/30", iconText: "text-emerald-500", barFrom: "from-emerald-500/15", barTo: "to-emerald-500/0", border: "hover:border-emerald-500/40", bullet: "text-emerald-500/70" },
  violet:  { iconBg: "bg-violet-500/15",  iconRing: "ring-violet-500/30",  iconText: "text-violet-500",  barFrom: "from-violet-500/15",  barTo: "to-violet-500/0",  border: "hover:border-violet-500/40",  bullet: "text-violet-500/70" },
  amber:   { iconBg: "bg-amber-500/15",   iconRing: "ring-amber-500/30",   iconText: "text-amber-500",   barFrom: "from-amber-500/15",   barTo: "to-amber-500/0",   border: "hover:border-amber-500/40",   bullet: "text-amber-500/70" },
  rose:    { iconBg: "bg-rose-500/15",    iconRing: "ring-rose-500/30",    iconText: "text-rose-500",    barFrom: "from-rose-500/15",    barTo: "to-rose-500/0",    border: "hover:border-rose-500/40",    bullet: "text-rose-500/70" },
  cyan:    { iconBg: "bg-cyan-500/15",    iconRing: "ring-cyan-500/30",    iconText: "text-cyan-500",    barFrom: "from-cyan-500/15",    barTo: "to-cyan-500/0",    border: "hover:border-cyan-500/40",    bullet: "text-cyan-500/70" },
  fuchsia: { iconBg: "bg-fuchsia-500/15", iconRing: "ring-fuchsia-500/30", iconText: "text-fuchsia-500", barFrom: "from-fuchsia-500/15", barTo: "to-fuchsia-500/0", border: "hover:border-fuchsia-500/40", bullet: "text-fuchsia-500/70" },
  sky:     { iconBg: "bg-sky-500/15",     iconRing: "ring-sky-500/30",     iconText: "text-sky-500",     barFrom: "from-sky-500/15",     barTo: "to-sky-500/0",     border: "hover:border-sky-500/40",     bullet: "text-sky-500/70" },
};

interface StatPage {
  title: string;
  description: string;
  route: string;
  icon: React.ElementType;
  bullets: string[];
  tone: ToneKey;
}

const pages: StatPage[] = [
  {
    title: "Consumo",
    description: "Análise de consumo de materiais e insumos por período",
    route: routes.statistics.inventory.consumption,
    icon: IconFlame,
    tone: "cyan",
    bullets: [
      "Top itens consumidos por período",
      "Comparativos entre setores/colaboradores",
      "Quantidade × valor monetário",
      "Filtros por categoria, marca e fornecedor",
    ],
  },
  {
    title: "Pedidos",
    description: "Pedidos de compra, fornecedores e tempo de entrega",
    route: routes.statistics.inventory.orders,
    icon: IconShoppingCart,
    tone: "amber",
    bullets: [
      "Pedidos por status e fornecedor",
      "Valor total e ticket médio",
      "Top fornecedores",
      "Tempo médio de entrega",
    ],
  },
];

// Bullets that reference monetary information (hidden from warehouse users)
const MONETARY_BULLETS = new Set(["Quantidade × valor monetário", "Valor total e ticket médio"]);

export const InventoryStatisticsPage = () => {
  const navigate = useNavigate();
  const canViewPrices = useCanViewPrices();

  usePageTracker({
    title: "Hub de Estatísticas do Estoque",
    icon: "chart-bar",
  });

  return (
    <PrivilegeRoute requiredPrivilege={SECTOR_PRIVILEGES.WAREHOUSE}>
      <div className="h-full flex flex-col px-4 pt-4">
        <div className="flex-shrink-0">
          <PageHeader
            title="Estatísticas do Estoque"
            icon={IconChartBar}
            favoritePage={FAVORITE_PAGES.ESTOQUE_ESTATISTICAS}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Estoque", href: routes.inventory.root },
              { label: "Estatísticas" },
            ]}
          />
        </div>
        <div className="flex-1 overflow-y-auto pb-6">
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-5">
            {pages.map((page) => {
              const PageIcon = page.icon;
              const tone = TONES[page.tone];
              return (
                <Card
                  key={page.route}
                  className={cn(
                    "group relative overflow-hidden border-border/60 transition-all",
                    "cursor-pointer",
                    "min-h-[300px] flex flex-col",
                    tone.border,
                  )}
                  onClick={() => navigate(page.route)}
                >
                  <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", tone.barFrom, tone.barTo)} />
                  <CardHeader className="pb-2">
                    <div className="flex items-start gap-3">
                      <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl ring-1 flex-shrink-0", tone.iconBg, tone.iconRing)}>
                        <PageIcon className={cn("h-6 w-6", tone.iconText)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-lg leading-tight">{page.title}</CardTitle>
                        <CardDescription className="mt-1 text-sm">{page.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 pt-2 flex flex-col">
                    <ul className="space-y-1.5 text-sm text-foreground/75 flex-1">
                      {page.bullets.filter((b) => canViewPrices || !MONETARY_BULLETS.has(b)).map((b) => (
                        <li key={b} className="flex items-start gap-2">
                          <IconCheck className={cn("h-3.5 w-3.5 mt-0.5 flex-shrink-0", tone.bullet)} />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4 flex items-center justify-between text-sm pt-3 border-t border-border/40">
                      <span className={cn("font-medium inline-flex items-center gap-1 group-hover:gap-2 transition-all", tone.iconText)}>
                        Ver detalhes
                        <IconArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </PrivilegeRoute>
  );
};

export default InventoryStatisticsPage;
