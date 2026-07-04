// Post-its widget — embeds the full personal post-it mural (the same component
// rendered by the Ferramentas › Post-its page) directly on the Home dashboard.
//
// Data is shared automatically: both this widget and the page call `usePostits`
// /`usePostitMutations`, which key into the same react-query cache, so creating,
// editing, coloring, moving or archiving a note in one place is reflected in the
// other instantly — they are literally the same post-its.
//
// One board behavior differs in the widget context: the canvas zoom/pan view is
// persisted under a per-instance localStorage key so each widget keeps its own
// framing, independent of the page. Wheel-zoom is enabled (same as the page) —
// note that, like on the page, the canvas captures the wheel while hovered, so
// scrolling over the widget zooms rather than scrolling the dashboard.

import { useMemo } from "react";
import { z } from "zod";
import { IconNote, IconAdjustments } from "@tabler/icons-react";

import { WidgetCard } from "../components/widget-card";
import { WidgetTabsBar } from "../components/config-kit";
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../components/ui/tabs";
import { routes } from "../../constants/routes";
import { PostitBoard } from "../../components/postits/postit-board";
import type {
  WidgetConfigProps,
  WidgetDefinition,
  WidgetRenderProps,
} from "../types";

const configSchema = z.object({
  title: z.string().min(1).max(80).default("Post-its").describe("Título"),
  accent: makeAccentSchema({ color: "yellow", icon: "FileText" }),
  display: z
    .object({
      showHeader: z.boolean().default(true),
      showViewAllLink: z.boolean().default(true),
    })
    .default({ showHeader: true, showViewAllLink: true }),
});
type Config = z.infer<typeof configSchema>;

function Render({ instanceId, config }: WidgetRenderProps<Config>) {
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
        <span className={accent.classes.text}>{config.title || "Post-its"}</span>
      }
      icon={<AccentIcon className={`h-4 w-4 ${accent.classes.icon}`} />}
      viewAllHref={
        (config.display?.showViewAllLink ?? true)
          ? routes.tools.postIts.root
          : undefined
      }
      showHeader={config.display?.showHeader ?? true}
      accentColor={config.accent?.color as WidgetAccentColor}
      accentShade={config.accent?.shade as WidgetAccentShade | undefined}
    >
      <div className="h-full p-2">
        <PostitBoard
          className="h-full"
          viewStorageKey={`ankaa.postits.canvasView.widget:${instanceId}`}
          enableWheelZoom
          compact
        />
      </div>
    </WidgetCard>
  );
}

function ConfigComp({ config, onChange }: WidgetConfigProps<Config>) {
  const c = config;
  const set = <K extends keyof Config>(key: K, value: Config[K]) =>
    onChange({ ...c, [key]: value });
  const accentColor = (c.accent?.color ?? "yellow") as WidgetAccentColor;
  const accentIcon = (c.accent?.icon ?? "FileText") as WidgetAccentIcon;
  const accentShade = (c.accent?.shade ?? "500") as WidgetAccentShade;
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
                  checked={c.display?.showHeader ?? true}
                  onCheckedChange={(v) =>
                    set("display", {
                      ...(c.display ?? { showViewAllLink: true }),
                      showHeader: v,
                    } as Config["display"])
                  }
                />
                <ToggleRow
                  label='Link "Ver todos"'
                  checked={c.display?.showViewAllLink ?? true}
                  onCheckedChange={(v) =>
                    set("display", {
                      ...(c.display ?? { showHeader: true }),
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

export const postitBoardWidget: WidgetDefinition<Config> = {
  id: "tools.postits",
  name: "Post-its",
  description:
    "Mural de post-its pessoais — os mesmos da página Ferramentas › Post-its. Arraste, redimensione, mude a cor e arquive direto da Home.",
  icon: IconNote,
  category: "other",
  allowedSectors: "*",
  defaultSize: { cols: 2, rows: 2 },
  minSize: { cols: 1, rows: 1 },
  maxSize: { cols: 4, rows: 4 },
  configSchema,
  defaultConfig: {
    title: "Post-its",
    accent: { color: "yellow", icon: "FileText", shade: "500" },
    display: { showHeader: true, showViewAllLink: true },
  },
  RenderComponent: Render,
  ConfigComponent: ConfigComp,
};
