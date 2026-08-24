import { IconAdjustments, IconBell, IconEye, IconEyeOff } from "@tabler/icons-react";

import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { FAVORITE_PAGES, routes } from "@/constants";
import { DETAIL_PAGE_SPACING } from "@/lib/layout-constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useMyPreferences } from "@/dashboard/hooks/use-my-preferences";
import { usePricing } from "@/contexts/pricing-context";
import { NotificationPreferencesPage } from "./notification-preferences";

// =====================
// Exibição — "Valores em dinheiro" (Preferences.pricesVisibleByDefault)
// =====================

type PricingDefaultMode = "hidden" | "visible";

const PRICING_MODES: Array<{
  mode: PricingDefaultMode;
  icon: typeof IconEye;
  title: string;
  description: string;
}> = [
  {
    mode: "hidden",
    icon: IconEyeOff,
    title: "Sempre ocultos",
    description:
      "Todo valor em dinheiro aparece embaçado (R$ ••••••), em qualquer página. Continua assim ao navegar, ao recarregar e no aplicativo do celular, até você escolher o contrário.",
  },
  {
    mode: "visible",
    icon: IconEye,
    title: "Sempre visíveis",
    description:
      "Os valores aparecem normalmente em qualquer página, aqui e no aplicativo do celular. Use o olho da barra lateral para ocultá-los rapidamente — por exemplo, ao mostrar a tela a outra pessoa.",
  },
];

function DisplayPreferencesTab() {
  const { isLoading } = useMyPreferences();
  // Same setting the sidebar eye writes, read straight from the pricing store — so this
  // card also reflects a change made with the eye, in another tab or on the phone.
  const { pricingVisible, setPricingPreference, isSavingPricing } = usePricing();

  const current: PricingDefaultMode = pricingVisible ? "visible" : "hidden";

  const select = (mode: PricingDefaultMode) => {
    if (isSavingPricing || mode === current) return;
    // PricingProvider applies it immediately and persists it to
    // Preferences.pricesVisibleByDefault, rolling back with a toast if the write fails.
    setPricingPreference(mode === "visible");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconEye className="h-4 w-4 text-muted-foreground" />
          Valores em dinheiro
        </CardTitle>
        <CardDescription>
          Escolha salva na sua conta: vale para todas as páginas, sobrevive a recarregar o navegador e acompanha você no
          aplicativo do celular. O olho da barra lateral é um atalho para esta mesma escolha.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {PRICING_MODES.map(({ mode, icon: Icon, title, description }) => {
              const active = current === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => select(mode)}
                  disabled={isSavingPricing}
                  aria-pressed={active}
                  className={cn(
                    "flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
                    isSavingPricing && "cursor-not-allowed opacity-70",
                  )}
                >
                  <span className="flex items-center gap-2 font-medium">
                    <Icon className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
                    {title}
                  </span>
                  <span className="text-sm text-muted-foreground">{description}</span>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =====================
// Page
// =====================

export function PreferencesPage() {
  usePageTracker({ title: "Preferências", icon: "settings" });

  return (
    <div className={cn("flex flex-col h-full", DETAIL_PAGE_SPACING.CONTAINER)}>
      <div className="flex-shrink-0">
        <PageHeader
          title="Preferências"
          icon={IconAdjustments}
          favoritePage={FAVORITE_PAGES.PERFIL_PREFERENCIAS}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Meu Perfil", href: routes.profile },
            { label: "Preferências" },
          ]}
        />
      </div>

      <Tabs defaultValue="exibicao" className="mt-4 flex min-h-0 flex-1 flex-col gap-3">
        <TabsList className="flex-shrink-0 self-start">
          <TabsTrigger value="exibicao" className="gap-2">
            <IconEye className="h-4 w-4" /> Exibição
          </TabsTrigger>
          <TabsTrigger value="notificacoes" className="gap-2">
            <IconBell className="h-4 w-4" /> Notificações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="exibicao" className="mt-0 flex-1 min-h-0 overflow-y-auto pb-6">
          <DisplayPreferencesTab />
        </TabsContent>

        <TabsContent value="notificacoes" className="mt-0 flex-1 min-h-0 pb-6">
          <NotificationPreferencesPage embedded />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default PreferencesPage;
