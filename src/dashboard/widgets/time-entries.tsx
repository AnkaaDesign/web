import { useMemo } from "react";
import { z } from "zod";
import { IconClock, IconAdjustments } from "@tabler/icons-react";
import { TimeEntriesCard } from "../../components/home-dashboard";
import { WidgetCard } from "../components/widget-card";
import { Section } from "./_shared";
import {
  AccentPicker,
  makeAccentSchema,
  resolveAccent,
} from "../components/widget-accent";
import type {
  WidgetAccentColor,
  WidgetAccentIcon,
  WidgetBorderColor,
} from "../components/widget-accent";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
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
    borderColor: "none",
  }),
});
type Config = z.infer<typeof configSchema>;

function Render({ config }: WidgetRenderProps<Config>) {
  const accent = useMemo(
    () =>
      resolveAccent({
        color: config.accent?.color as WidgetAccentColor,
        icon: config.accent?.icon as WidgetAccentIcon,
      }),
    [config.accent?.color, config.accent?.icon],
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
      viewAllHref="/pessoal/meus-pontos"
      borderColor={config.accent?.borderColor as WidgetBorderColor | undefined}
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
  const borderColor = (config.accent?.borderColor ?? "none") as WidgetBorderColor;
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-sm">Título</Label>
        <Input
          value={config.title}
          onChange={(v) => set("title", typeof v === "string" ? v : "")}
          placeholder="Ponto da Semana"
        />
      </div>
      <Tabs defaultValue="appearance" className="flex flex-col gap-2">
        <TabsList className="self-start">
          <TabsTrigger value="appearance" className="gap-1">
            <IconAdjustments className="h-3.5 w-3.5" /> Aparência
          </TabsTrigger>
        </TabsList>

        <TabsContent value="appearance" className="space-y-3 mt-0">
          <Section title="Acento (cor, ícone, borda)" defaultOpen>
            <AccentPicker
              value={{ color: accentColor, icon: accentIcon, borderColor }}
              onChange={(next) =>
                set("accent", {
                  color: next.color,
                  icon: next.icon,
                  borderColor: next.borderColor,
                } as Config["accent"])
              }
            />
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export const timeEntriesWidget: WidgetDefinition<Config> = {
  id: "home.time-entries",
  name: "Ponto da Semana",
  description:
    "Registros de ponto da semana atual. Configurável: título e aparência (cor / ícone / borda).",
  icon: IconClock,
  category: "hr",
  // Personal data (your own punch-clock entries). The widget body itself shows
  // "Sem cadastro no sistema de ponto" when the API reports the user lacks a
  // Secullum link, so granting "*" is safe — users without Secullum just see
  // a graceful empty state instead of the widget being hidden from the picker.
  allowedSectors: "*",
  defaultSize: { cols: 2, rows: 2 },
  minSize: { cols: 1, rows: 1 },
  maxSize: { cols: 4, rows: 4 },
  configSchema,
  defaultConfig: {
    title: "Ponto da Semana",
    accent: { color: "teal", icon: "Clock", borderColor: "none" },
  },
  RenderComponent: Render,
  ConfigComponent: ConfigComp,
};
