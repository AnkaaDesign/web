import { useState } from "react";
import { IconAdjustments, IconBell, IconEye, IconEyeOff } from "@tabler/icons-react";

import { toast } from "@/components/ui/sonner";
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
// Exibição — "Mostrar valores por padrão"
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
    title: "Ocultos por padrão",
    description:
      "Todo valor em dinheiro aparece embaçado (R$ ••••••) ao abrir ou trocar de página. Clique no olho da barra lateral para revelar — e ao navegar eles voltam a ficar ocultos.",
  },
  {
    mode: "visible",
    icon: IconEye,
    title: "Visíveis por padrão",
    description:
      "Os valores aparecem normalmente ao abrir qualquer página. O olho da barra lateral passa a OCULTAR — útil para mostrar a tela a outra pessoa — e a próxima navegação volta a exibi-los.",
  },
];

function DisplayPreferencesTab() {
  const { preferences, isLoading, updateMine } = useMyPreferences();
  // The live default comes from the pricing store (already fed by this same preference), so the
  // selection reflects what the app is actually doing — including a change made in another tab.
  const { pricingVisibleByDefault } = usePricing();
  const [saving, setSaving] = useState(false);

  const current: PricingDefaultMode = pricingVisibleByDefault ? "visible" : "hidden";

  const select = async (mode: PricingDefaultMode) => {
    if (saving || mode === current) return;
    // updateMine rejects until the Preferences row exists (it self-creates on first load).
    if (!preferences) {
      toast.error("Suas preferências ainda estão carregando. Tente novamente em instantes.");
      return;
    }
    setSaving(true);
    try {
      // updateMine writes the row AND updates the query cache optimistically, which flows back
      // through PricingProvider → setPricingDefault, so the change applies to this page instantly.
      await updateMine({ pricesVisibleByDefault: mode === "visible" } as never);
      toast.success(mode === "visible" ? "Valores passam a aparecer por padrão." : "Valores passam a ficar ocultos por padrão.");
    } catch {
      toast.error("Não foi possível salvar a preferência.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconEye className="h-4 w-4 text-muted-foreground" />
          Valores em dinheiro
        </CardTitle>
        <CardDescription>
          Define como cada página começa. O botão do olho continua valendo para a tela atual — esta escolha é só o ponto
          de partida, ao qual o app volta a cada recarga ou troca de página.
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
                  disabled={saving}
                  aria-pressed={active}
                  className={cn(
                    "flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
                    saving && "cursor-not-allowed opacity-70",
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
