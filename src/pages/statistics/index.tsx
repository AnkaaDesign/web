import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { routes, FAVORITE_PAGES } from "@/constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import {
  IconChartBar,
  IconBuildingFactory2,
  IconCash,
  IconUsers,
  IconPackage,
  IconArrowRight,
  IconTrendingUp,
  IconAlertTriangle,
  IconReportMoney,
  IconFlame,
  IconShoppingCart,
  IconActivity,
  IconCoins,
  IconCash as IconCashFlow,
  IconReceipt2,
  IconCalendarOff,
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

interface StatLink {
  label: string;
  description: string;
  route: string;
  icon: React.ElementType;
  tone: ToneKey;
}

interface StatModule {
  title: string;
  description: string;
  icon: React.ElementType;
  hubRoute: string;
  tone: ToneKey;
  links: StatLink[];
}

const modules: StatModule[] = [
  {
    title: "Produção",
    description: "Produtividade, desempenho, gargalos e bônus",
    icon: IconBuildingFactory2,
    hubRoute: routes.statistics.production.root,
    tone: "blue",
    links: [
      {
        label: "Produtividade",
        description: "Tarefas por colaborador efetivo",
        route: routes.statistics.production.productivity,
        icon: IconTrendingUp,
        tone: "blue",
      },
      {
        label: "Desempenho",
        description: "Ponderado por cargo × dias úteis",
        route: routes.statistics.production.performance,
        icon: IconActivity,
        tone: "violet",
      },
      {
        label: "Gargalos",
        description: "Etapas que atrasam o fluxo",
        route: routes.statistics.production.bottlenecks,
        icon: IconAlertTriangle,
        tone: "rose",
      },
      {
        label: "Relação Bônus / Produção",
        description: "Acúmulo diário e previsão",
        route: routes.statistics.production.bonusValue,
        icon: IconCoins,
        tone: "amber",
      },
    ],
  },
  {
    title: "Financeiro",
    description: "Receita, cobranças, fluxo de caixa e NFS-e",
    icon: IconCash,
    hubRoute: routes.statistics.financial.root,
    tone: "emerald",
    links: [
      {
        label: "Receita & Orçamentos",
        description: "Funil, ticket médio e backlog",
        route: routes.statistics.financial.revenueQuotes,
        icon: IconReportMoney,
        tone: "emerald",
      },
      {
        label: "Cobranças & Fluxo de Caixa",
        description: "Faturado vs recebido e DSO",
        route: routes.statistics.financial.collection,
        icon: IconCashFlow,
        tone: "blue",
      },
      {
        label: "NFS-e",
        description: "Emissão, status e impostos",
        route: routes.statistics.financial.nfse,
        icon: IconReceipt2,
        tone: "violet",
      },
    ],
  },
  {
    title: "Departamento Pessoal",
    description: "Folha, equipe e faltas",
    icon: IconUsers,
    hubRoute: routes.statistics.personnelDepartment.root,
    tone: "violet",
    links: [
      {
        label: "Folha de Pagamento",
        description: "Bruto, líquido e custos por setor",
        route: routes.statistics.personnelDepartment.payroll,
        icon: IconReportMoney,
        tone: "emerald",
      },
      {
        label: "Equipe",
        description: "Efetivo, admissões, desligamentos e rotatividade",
        route: routes.statistics.personnelDepartment.teamPerformance,
        icon: IconUsers,
        tone: "blue",
      },
      {
        label: "Faltas",
        description: "Faltas, atestados e atrasos",
        route: routes.statistics.personnelDepartment.absenteeism,
        icon: IconCalendarOff,
        tone: "rose",
      },
    ],
  },
  {
    title: "Estoque",
    description: "Consumo, pedidos e movimentação de inventário",
    icon: IconPackage,
    hubRoute: routes.statistics.inventory.root,
    tone: "amber",
    links: [
      {
        label: "Consumo",
        description: "Materiais e insumos por período",
        route: routes.statistics.inventory.consumption,
        icon: IconFlame,
        tone: "cyan",
      },
      {
        label: "Pedidos",
        description: "Compras, fornecedores e prazos",
        route: routes.statistics.inventory.orders,
        icon: IconShoppingCart,
        tone: "amber",
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
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {modules.map((module) => {
            const ModuleIcon = module.icon;
            const tone = TONES[module.tone];
            return (
              <Card
                key={module.title}
                className={cn(
                  "group relative flex flex-col overflow-hidden border-border/60 transition-all",
                  "min-h-[280px]",
                  tone.border,
                )}
              >
                <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r", tone.barFrom, tone.barTo)} />
                <CardHeader className="pb-3">
                  <div className="flex items-start gap-3">
                    <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl ring-1 flex-shrink-0", tone.iconBg, tone.iconRing)}>
                      <ModuleIcon className={cn("h-6 w-6", tone.iconText)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-lg leading-tight">{module.title}</CardTitle>
                      <CardDescription className="mt-1 text-sm">{module.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col pt-0">
                  <div className="space-y-1">
                    {module.links.map((link) => {
                      const LinkIcon = link.icon;
                      const linkTone = TONES[link.tone];
                      return (
                        <button
                          key={link.route}
                          onClick={() => navigate(link.route)}
                          className="w-full flex items-center gap-3 rounded-md px-3 py-2.5 text-left hover:bg-muted/70 transition-colors group/link"
                        >
                          <div className={cn("flex h-8 w-8 items-center justify-center rounded-md ring-1 flex-shrink-0", linkTone.iconBg, linkTone.iconRing)}>
                            <LinkIcon className={cn("h-4 w-4", linkTone.iconText)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium leading-tight">{link.label}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {link.description}
                            </p>
                          </div>
                          <IconArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover/link:opacity-100 transition-opacity flex-shrink-0" />
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-auto pt-3 border-t border-border/40">
                    <button
                      onClick={() => navigate(module.hubRoute)}
                      className={cn(
                        "w-full flex items-center justify-between text-sm font-medium transition-all px-3",
                        tone.iconText,
                      )}
                    >
                      <span>Ver módulo completo</span>
                      <IconArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </button>
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
