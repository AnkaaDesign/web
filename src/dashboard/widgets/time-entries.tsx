import { useMemo } from "react";
import { WidgetTabsBar } from "../components/config-kit";
import { z } from "zod";
import { IconClock, IconAdjustments } from "@tabler/icons-react";
import { SECTOR_PRIVILEGES } from "../../constants";
import { TimeEntriesCard } from "../../components/home-dashboard";
import { WidgetCard } from "../components/widget-card";
import { Section, SectionGroup, ToggleRow } from "./_shared";
import {
  AccentPicker,
  makeAccentSchema,
  resolveAccent,
} from "../components/widget-accent";
import type {
  WidgetAccentColor,
  WidgetAccentIcon,
  WidgetAccentShade,
} from "../components/widget-accent";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import type {
  WidgetConfigProps,
  WidgetDefinition,
  WidgetRenderProps,
} from "../types";

const configSchema = z.object({
  title: z.string().min(1).max(80).default("Ponto da Semana"),
  accent: makeAccentSchema({
    color: "teal",
    icon: "Clock",
  }),
  display: z
    .object({
      showHeader: z.boolean().default(true),
      showViewAllLink: z.boolean().default(true),
    })
    .default({ showHeader: true, showViewAllLink: true }),
});
type Config = z.infer<typeof configSchema>;

function Render({ config }: WidgetRenderProps<Config>) {
  const accent = useMemo(
    () =>
      resolveAccent({
        color: config.accent?.color as WidgetAccentColor,
        icon: config.accent?.icon as WidgetAccentIcon,
        shade: config.accent?.shade as WidgetAccentShade | undefined,
      }),
    [config.accent?.color, config.accent?.icon, config.accent?.shade],
  );
  const AccentIcon = accent.Icon;

  return (
    <WidgetCard
      title={
        <span className={accent.classes.text}>
          {config.title || "Ponto da Semana"}
        </span>
      }
      icon={<AccentIcon className={`h-4 w-4 ${accent.classes.icon}`} />}
      viewAllHref={
        (config.display?.showViewAllLink ?? true) ? "/pessoal/meus-pontos" : undefined
      }
      showHeader={config.display?.showHeader ?? true}
      accentColor={config.accent?.color as WidgetAccentColor}
      accentShade={config.accent?.shade as WidgetAccentShade | undefined}
    >
      <TimeEntriesCard embedded />
    </WidgetCard>
  );
}

function ConfigComp({ config, onChange }: WidgetConfigProps<Config>) {
  const set = <K extends keyof Config>(key: K, value: Config[K]) =>
    onChange({ ...config, [key]: value });
  const accentColor = (config.accent?.color ?? "teal") as WidgetAccentColor;
  const accentIcon = (config.accent?.icon ?? "Clock") as WidgetAccentIcon;
  const accentShade = (config.accent?.shade ?? "500") as WidgetAccentShade;
  return (
    <div className="space-y-4">
      <Tabs defaultValue="appearance" className="flex flex-col gap-2">
        <WidgetTabsBar><TabsList className="self-start">
          <TabsTrigger value="appearance" className="gap-1">
            <IconAdjustments className="h-3.5 w-3.5" /> Aparência
          </TabsTrigger>
        </TabsList></WidgetTabsBar>

        <TabsContent value="appearance" className="space-y-3 mt-0">
          <SectionGroup defaultOpenId={null}>
            <Section title="Destaque (cor e ícone)" defaultOpen>
              <AccentPicker
                value={{ color: accentColor, icon: accentIcon, shade: accentShade }}
                onChange={(next) =>
                  set("accent", {
                    color: next.color || accentColor,
                    icon: next.icon || accentIcon,
                    shade: next.shade || accentShade,
                  } as Config["accent"])
                }
              />
            </Section>
            <Section title="Cabeçalho e link">
              <div className="space-y-1">
                <ToggleRow
                  label="Exibir cabeçalho"
                  checked={config.display?.showHeader ?? true}
                  onCheckedChange={(v) =>
                    set("display", { ...(config.display ?? {}), showHeader: v } as Config["display"])
                  }
                />
                <ToggleRow
                  label='Link "Ver todos"'
                  checked={config.display?.showViewAllLink ?? true}
                  onCheckedChange={(v) =>
                    set("display", {
                      ...(config.display ?? {}),
                      showViewAllLink: v,
                    } as Config["display"])
                  }
                />
              </div>
            </Section>
          </SectionGroup>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export const timeEntriesWidget: WidgetDefinition<Config> = {
  id: "home.time-entries",
  name: "Ponto da Semana",
  description:
    "Registros de ponto da semana atual. Configurável: título e aparência.",
  icon: IconClock,
  category: "hr",
  allowedSectors: "*",
  blockedSectors: [SECTOR_PRIVILEGES.FINANCIAL, SECTOR_PRIVILEGES.PRODUCTION_MANAGER, SECTOR_PRIVILEGES.ADMIN],
  defaultSize: { cols: 2, rows: 2 },
  minSize: { cols: 1, rows: 1 },
  maxSize: { cols: 4, rows: 4 },
  configSchema,
  defaultConfig: {
    title: "Ponto da Semana",
    accent: { color: "teal", icon: "Clock", shade: "500" },
    display: { showHeader: true, showViewAllLink: true },
  },
  RenderComponent: Render,
  ConfigComponent: ConfigComp,
};
