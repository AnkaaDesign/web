// Notas widget — the unified dashboard surface for the Note feature (the merge
// of the old "Post-its" mural and the local "Anotações" scratchpad into ONE
// server-backed Note entity).
//
// It embeds the shared <NoteBoard>, the same component rendered by the
// Ferramentas › Notas page, so data is shared automatically: both the widget and
// the page call `useNotes` / `useNoteMutations`, which key into the same
// react-query cache. Creating, editing, coloring, moving or archiving a note in
// one place is reflected in the other instantly — they are literally the same
// notes.
//
// The widget can render in either view mode:
//   - "postit" → the free-canvas sticky board (drag / resize / zoom / pan). The
//     canvas viewport is persisted under a per-instance localStorage key so each
//     widget keeps its own framing, independent of the page. Wheel-zoom is on
//     (same as the page) — the canvas captures the wheel while hovered, so
//     scrolling over the widget zooms rather than scrolling the dashboard.
//   - "board"  → the organized card board (Google-Keep style responsive grid).
//
// Back-compat: this file registers TWO widget definitions that share the same
// Render/Config components — the canonical `tools.postits` (default view
// "postit") and a hidden legacy alias `quick-action.note` (default view "board")
// so existing saved layouts referencing EITHER old widget keep rendering the
// unified widget. Only the canonical one appears in the add-widget gallery.

import { useMemo } from "react";
import { z } from "zod";
import { IconNote, IconAdjustments } from "@tabler/icons-react";

import { WidgetCard } from "../components/widget-card";
import { WidgetTabsBar } from "../components/config-kit";
import { Section, SectionGroup, ToggleRow, SegmentedControl } from "./_shared";
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
import { NoteBoard } from "../../components/notes/note-board";
import type {
  WidgetConfigProps,
  WidgetDefinition,
  WidgetRenderProps,
} from "../types";

type ViewMode = "postit" | "board";

// The two registrations differ only by the `viewMode` default, so the schema is
// built by a small factory. Both produce the identical inferred `Config` type,
// which lets the canonical widget and the legacy alias share one RenderComponent
// and one ConfigComponent.
function makeConfigSchema(defaultViewMode: ViewMode) {
  return z.object({
    title: z.string().min(1).max(80).default("Notas").describe("Título"),
    accent: makeAccentSchema({ color: "yellow", icon: "FileText" }),
    display: z
      .object({
        showHeader: z.boolean().default(true),
        showViewAllLink: z.boolean().default(true),
      })
      .default({ showHeader: true, showViewAllLink: true }),
    viewMode: z.enum(["postit", "board"]).default(defaultViewMode),
  });
}

const configSchema = makeConfigSchema("postit");
// Legacy `quick-action.note` (the old free-text scratchpad) instances have no
// `viewMode` in their saved config; defaulting the alias schema to "board"
// upgrades them to the organized card board, the closest analog to a notepad.
const legacyConfigSchema = makeConfigSchema("board");
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
        <span className={accent.classes.text}>{config.title || "Notas"}</span>
      }
      icon={<AccentIcon className={`h-4 w-4 ${accent.classes.icon}`} />}
      viewAllHref={
        (config.display?.showViewAllLink ?? true)
          ? routes.tools.notes.root
          : undefined
      }
      showHeader={config.display?.showHeader ?? true}
      accentColor={config.accent?.color as WidgetAccentColor}
      accentShade={config.accent?.shade as WidgetAccentShade | undefined}
    >
      <div className="h-full p-2">
        <NoteBoard
          className="h-full"
          compact
          viewMode={config.viewMode ?? "postit"}
          viewStorageKey={`ankaa.notes.canvasView.widget:${instanceId}`}
          enableWheelZoom
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
            <Section title="Modo de exibição" defaultOpen>
              <SegmentedControl
                label="Modo de exibição"
                options={[
                  { value: "postit", label: "Post-it" },
                  { value: "board", label: "Quadro" },
                ]}
                value={c.viewMode ?? "postit"}
                onChange={(v) => set("viewMode", v as Config["viewMode"])}
              />
            </Section>
            <Section title="Destaque (cor e ícone)">
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

const DESCRIPTION =
  "Suas notas — mural de post-its ou quadro organizado. As mesmas da página Ferramentas › Notas.";

// Canonical unified widget. Keeps the historical id `tools.postits` so every
// existing saved dashboard with a post-it widget keeps rendering this widget.
export const notesBoardWidget: WidgetDefinition<Config> = {
  id: "tools.postits",
  name: "Notas",
  description: DESCRIPTION,
  icon: IconNote,
  category: "other",
  allowedSectors: "*",
  defaultSize: { cols: 2, rows: 2 },
  minSize: { cols: 1, rows: 1 },
  maxSize: { cols: 4, rows: 4 },
  configSchema,
  defaultConfig: {
    title: "Notas",
    accent: { color: "yellow", icon: "FileText", shade: "500" },
    display: { showHeader: true, showViewAllLink: true },
    viewMode: "postit",
  },
  RenderComponent: Render,
  ConfigComponent: ConfigComp,
};

// Hidden legacy alias for the removed "Anotações" scratchpad widget. Registered
// (via `registerHidden`) so existing saved instances of `quick-action.note`
// still resolve to the unified widget instead of being stripped from the layout,
// but excluded from the add-widget gallery so only ONE "Notas" is offered.
// Defaults to the "board" view (the notepad's closest analog).
export const notesBoardLegacyWidget: WidgetDefinition<Config> = {
  ...notesBoardWidget,
  id: "quick-action.note",
  configSchema: legacyConfigSchema,
  defaultConfig: {
    title: "Notas",
    accent: { color: "yellow", icon: "FileText", shade: "500" },
    display: { showHeader: true, showViewAllLink: true },
    viewMode: "board",
  },
};
