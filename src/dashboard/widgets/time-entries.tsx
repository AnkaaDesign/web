import { useMemo } from "react";
import { z } from "zod";
import { IconClock } from "@tabler/icons-react";
import { SECTOR_PRIVILEGES } from "../../constants";
import { TimeEntriesCard } from "../../components/home-dashboard";
import { WidgetCard } from "../components/widget-card";
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
      <div className="space-y-2">
        <Label className="text-xs">Aparência</Label>
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
      </div>
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
  allowedSectors: [
    SECTOR_PRIVILEGES.LOGISTIC,
    SECTOR_PRIVILEGES.DESIGNER,
    SECTOR_PRIVILEGES.PRODUCTION,
    SECTOR_PRIVILEGES.PRODUCTION_MANAGER,
    SECTOR_PRIVILEGES.WAREHOUSE,
    SECTOR_PRIVILEGES.HUMAN_RESOURCES,
    SECTOR_PRIVILEGES.MAINTENANCE,
    SECTOR_PRIVILEGES.PLOTTING,
  ],
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
