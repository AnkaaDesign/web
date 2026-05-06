// Quick-note widget — a per-instance scratchpad. Persisted in localStorage so
// it works across refreshes without bloating Preferences with arbitrary text.
// (The widget's `config` only stores display options, not the note content.)
//
// Configurable: title, accent color + icon (consistent with task/item tables).

import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import { IconNotebook } from "@tabler/icons-react";
import { WidgetCard } from "../components/widget-card";
import { AccentPicker, resolveAccent } from "../components/widget-accent";
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
  title: z.string().min(1).max(80).default("Anotações").describe("Título"),
  accent: z
    .object({
      color: z
        .enum([
          "gray",
          "slate",
          "red",
          "orange",
          "amber",
          "yellow",
          "lime",
          "green",
          "emerald",
          "teal",
          "cyan",
          "sky",
          "blue",
          "indigo",
          "violet",
          "purple",
          "fuchsia",
          "pink",
          "rose",
        ])
        .default("amber"),
      icon: z
        .enum([
          "ClipboardText",
          "ClipboardList",
          "ClipboardCheck",
          "Calendar",
          "CalendarDue",
          "Clock",
          "Hourglass",
          "Check",
          "CircleCheck",
          "AlertTriangle",
          "Flag",
          "Star",
          "Bolt",
          "Truck",
          "Package",
          "Brush",
          "Palette",
          "Receipt",
          "FileText",
          "Tools",
          "Users",
          "Factory",
        ])
        .default("FileText"),
      borderColor: z
        .enum([
          "none",
          "gray",
          "slate",
          "red",
          "orange",
          "amber",
          "yellow",
          "lime",
          "green",
          "emerald",
          "teal",
          "cyan",
          "sky",
          "blue",
          "indigo",
          "violet",
          "purple",
          "fuchsia",
          "pink",
          "rose",
        ])
        .default("none"),
    })
    .default({ color: "amber", icon: "FileText", borderColor: "none" }),
});
type Config = z.infer<typeof configSchema>;

const STORAGE_KEY_PREFIX = "ankaa.dashboard.quick-note:";

function Render({ instanceId, config }: WidgetRenderProps<Config>) {
  const storageKey = `${STORAGE_KEY_PREFIX}${instanceId}`;
  const [text, setText] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      return window.localStorage.getItem(storageKey) ?? "";
    } catch {
      return "";
    }
  });
  const debounceRef = useRef<number | null>(null);

  // Debounce writes — typing on every keystroke would hammer localStorage.
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      try {
        window.localStorage.setItem(storageKey, text);
      } catch {
        // Quota / private mode — best effort
      }
    }, 350);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [text, storageKey]);

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
          {config.title || "Anotações"}
        </span>
      }
      icon={<AccentIcon className={`h-4 w-4 ${accent.classes.icon}`} />}
      borderColor={config.accent?.borderColor as WidgetBorderColor | undefined}
    >
      <textarea
        className="h-full w-full resize-none p-3 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
        placeholder="Escreva aqui..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
    </WidgetCard>
  );
}

function ConfigComp({ config, onChange }: WidgetConfigProps<Config>) {
  const c = config;
  const set = <K extends keyof Config>(key: K, value: Config[K]) =>
    onChange({ ...c, [key]: value });
  const accentColor = (c.accent?.color ?? "amber") as WidgetAccentColor;
  const accentIcon = (c.accent?.icon ?? "FileText") as WidgetAccentIcon;
  const borderColor = (c.accent?.borderColor ?? "none") as WidgetBorderColor;
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-sm">Título</Label>
        <Input
          value={c.title}
          onChange={(v) => set("title", typeof v === "string" ? v : "")}
          placeholder="Anotações"
        />
        <p className="text-[10px] text-muted-foreground">
          A cor escolhida abaixo será aplicada ao título.
        </p>
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

export const quickNoteWidget: WidgetDefinition<Config> = {
  id: "quick-action.note",
  name: "Anotações",
  description: "Bloco de notas pessoal, salvo automaticamente neste navegador.",
  icon: IconNotebook,
  category: "quick-actions",
  allowedSectors: "*",
  defaultSize: { cols: 1, rows: 2 },
  minSize: { cols: 1, rows: 1 },
  maxSize: { cols: 4, rows: 4 },
  configSchema,
  defaultConfig: {
    title: "Anotações",
    accent: { color: "amber", icon: "FileText", borderColor: "none" },
  },
  RenderComponent: Render,
  ConfigComponent: ConfigComp,
};
