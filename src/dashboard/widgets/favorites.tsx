// Favorites widget — quick-access cards for the user's bookmarked pages.
//
// Configurable: title, accent (color/icon/border), itemsPerRow, itemsPerColumn.
// Card layout (horizontal vs vertical) and density adapt automatically to the
// resulting card height.

import { useMemo } from "react";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import {
  IconStar,
  IconPlus,
  IconChevronRight,
  IconAdjustments,
  IconLayout,
} from "@tabler/icons-react";
import { useFavorites } from "../../contexts/favorites-context";
import { routes } from "../../constants/routes";
import { getIconInfoByPath, isPageCadastrar } from "../../utils";
import { WidgetCard } from "../components/widget-card";
import {
  Section,
  SectionGroup,
  ToggleRow,
  SegmentedControl,
  NumberPills,
  DensitySegmented,
  DENSITY_VALUES,
  type Density,
} from "./_shared";
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
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs";
import type {
  WidgetConfigProps,
  WidgetDefinition,
  WidgetRenderProps,
} from "../types";

const configSchema = z.object({
  title: z.string().min(1).max(80).default("Favoritos"),
  accent: makeAccentSchema({ color: "yellow", icon: "Star" }),
  itemsPerRow: z.number().int().min(1).max(10).default(4),
  itemsPerColumn: z.number().int().min(1).max(6).default(1),
  density: z.enum(DENSITY_VALUES).default("comfortable"),
  layout: z.enum(["row", "stacked"]).default("row"),
  display: z
    .object({
      showHeader: z.boolean().default(true),
      showCount: z.boolean().default(true),
      showViewAllLink: z.boolean().default(true),
    })
    .default({ showHeader: true, showCount: true, showViewAllLink: true }),
});
type Config = z.infer<typeof configSchema>;

const GRID_GAP_PX = 12;
const WIDGET_ROW_PX = 180;
const WIDGET_HEADER_PX = 40;
const WIDGET_FOOTER_PX = 28;
const WIDGET_PADDING_PX = 24;
// Below this card height, spacious gracefully degrades to the comfortable
// horizontal layout so very thin rows still render legibly.
const SPACIOUS_MIN_HEIGHT_PX = 70;

// Density determines the entire visual layout, not just sizing:
//   compact      → horizontal-tight   (icon-left, single-line title, list-like)
//   comfortable  → horizontal-roomy   (icon-left, two-line title, breathing room)
//   spacious     → vertical-centered  (icon top-center, large title centered below)
type LayoutVariant = "h-tight" | "h-roomy" | "h-spacious" | "v-compact" | "v-centered" | "v-spacious";

interface VariantStyles {
  flex: string;
  cardPad: string;
  iconBox: string;
  iconSize: string;
  title: string;
  showChevron: boolean;
}

const VARIANT_STYLES: Record<LayoutVariant, VariantStyles> = {
  "h-tight": {
    flex: "flex-row items-center gap-2",
    cardPad: "px-1.5 py-1",
    iconBox: "p-1 rounded-md",
    iconSize: "h-3.5 w-3.5",
    title: "text-[11px] font-medium flex-1 min-w-0 truncate",
    showChevron: true,
  },
  "h-roomy": {
    flex: "flex-row items-center gap-2.5",
    cardPad: "p-2",
    iconBox: "p-1.5 rounded-lg",
    iconSize: "h-[18px] w-[18px]",
    title: "text-sm font-semibold flex-1 min-w-0 line-clamp-2 leading-tight",
    showChevron: true,
  },
  "h-spacious": {
    flex: "flex-row items-center gap-3",
    cardPad: "p-2.5",
    iconBox: "p-2 rounded-xl",
    iconSize: "h-6 w-6",
    title: "text-[15px] font-semibold flex-1 min-w-0 line-clamp-2 leading-tight",
    showChevron: true,
  },
  "v-compact": {
    flex: "flex-col items-center justify-center text-center gap-1",
    cardPad: "p-1",
    iconBox: "p-1 rounded-md",
    iconSize: "h-3.5 w-3.5",
    title: "text-[10px] font-medium line-clamp-2 leading-tight",
    showChevron: false,
  },
  "v-centered": {
    flex: "flex-col items-center justify-center text-center gap-1.5",
    cardPad: "p-1.5",
    iconBox: "p-1.5 rounded-lg",
    iconSize: "h-5 w-5",
    title: "text-[13px] font-semibold line-clamp-2 leading-tight",
    showChevron: false,
  },
  "v-spacious": {
    flex: "flex-col items-center justify-center text-center gap-2",
    cardPad: "p-2",
    iconBox: "p-2 rounded-xl",
    iconSize: "h-7 w-7",
    title: "text-[15px] font-semibold line-clamp-2 leading-tight",
    showChevron: false,
  },
};

function FavoritesRender({ config, size: tileSize }: WidgetRenderProps<Config>) {
  const { favorites } = useFavorites();
  const navigate = useNavigate();
  const perRow = Math.max(1, Math.min(10, config.itemsPerRow ?? 4));
  const perCol = Math.max(1, Math.min(6, config.itemsPerColumn ?? 1));
  const density: Density = config.density ?? "comfortable";

  const widgetBodyHeight =
    tileSize.rows * WIDGET_ROW_PX -
    WIDGET_HEADER_PX -
    WIDGET_FOOTER_PX -
    WIDGET_PADDING_PX;
  const cardHeightPx =
    (widgetBodyHeight - (perCol - 1) * GRID_GAP_PX) / perCol;

  const layout = config.layout ?? "row";
  const variant: LayoutVariant =
    layout === "stacked"
      ? cardHeightPx >= SPACIOUS_MIN_HEIGHT_PX
        ? density === "compact"
          ? "v-compact"
          : density === "spacious"
            ? "v-spacious"
            : "v-centered"
        : density === "compact"
          ? "h-tight"
          : "h-roomy"
      : density === "compact"
        ? "h-tight"
        : density === "spacious"
          ? "h-spacious"
          : "h-roomy";
  const styles = VARIANT_STYLES[variant];

  const rowHeight = `calc((100% - ${(perCol - 1) * GRID_GAP_PX}px) / ${perCol})`;

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
  const showCount = config.display?.showCount ?? true;

  return (
    <WidgetCard
      title={
        <span className={accent.classes.text}>{config.title || "Favoritos"}</span>
      }
      icon={<AccentIcon className={`h-4 w-4 ${accent.classes.icon}`} />}
      count={showCount ? favorites.length || null : null}
      viewAllHref={
        (config.display?.showViewAllLink ?? true) ? routes.favorites : undefined
      }
      showHeader={config.display?.showHeader ?? true}
      accentColor={config.accent?.color as WidgetAccentColor}
      accentShade={config.accent?.shade as WidgetAccentShade | undefined}
    >
      {favorites.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground p-4">
          <IconStar className="h-6 w-6 mb-2 opacity-50" />
          <p className="text-sm">Nenhum favorito ainda.</p>
        </div>
      ) : (
        <div
          className="grid gap-3 p-3 h-full"
          style={{
            gridTemplateColumns: `repeat(${perRow}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${perCol}, ${rowHeight})`,
            gridAutoRows: rowHeight,
          }}
        >
          {favorites.map((fav) => {
            const iconInfo = getIconInfoByPath(fav.path);
            const IconComponent = iconInfo.icon;
            const isCadastrar = isPageCadastrar(fav.path);
            return (
              <button
                key={fav.id}
                type="button"
                onClick={() => navigate(fav.path)}
                className={`group relative text-left cursor-pointer rounded-xl bg-card border border-border hover:border-primary transition-colors duration-150 ${styles.cardPad} flex ${styles.flex} min-w-0 overflow-hidden`}
                title={fav.title}
              >
                <div className="relative inline-block shrink-0">
                  <div
                    className={`${iconInfo.color} text-white ${styles.iconBox} flex items-center justify-center`}
                  >
                    <IconComponent className={styles.iconSize} />
                  </div>
                  {isCadastrar && (
                    <div className="absolute -top-1 -right-1 bg-white dark:bg-gray-200 rounded-full p-0.5">
                      <IconPlus
                        size={10}
                        className="text-green-600 dark:text-green-700"
                        strokeWidth={3}
                      />
                    </div>
                  )}
                </div>
                <h3 className={`text-secondary-foreground leading-tight ${styles.title}`}>
                  {fav.title}
                </h3>
                {styles.showChevron && (
                  <IconChevronRight
                    className="ml-auto h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0"
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </WidgetCard>
  );
}

function ConfigComp({ config, onChange }: WidgetConfigProps<Config>) {
  const set = <K extends keyof Config>(key: K, value: Config[K]) =>
    onChange({ ...config, [key]: value });
  const accentColor = (config.accent?.color ?? "yellow") as WidgetAccentColor;
  const accentIcon = (config.accent?.icon ?? "Star") as WidgetAccentIcon;
  const accentShade = (config.accent?.shade ?? "500") as WidgetAccentShade;
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-sm">Título</Label>
        <Input
          value={config.title}
          onChange={(v) => set("title", typeof v === "string" ? v : "")}
          placeholder="Favoritos"
        />
      </div>

      <Tabs defaultValue="appearance" className="flex flex-col gap-2">
        <TabsList className="self-start">
          <TabsTrigger value="appearance" className="gap-1">
            <IconAdjustments className="h-3.5 w-3.5" /> Aparência
          </TabsTrigger>
          <TabsTrigger value="behavior" className="gap-1">
            <IconLayout className="h-3.5 w-3.5" /> Comportamento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="appearance" className="space-y-3 mt-0">
          <SectionGroup defaultOpenId={null}>
            <Section title="Acento (cor e ícone)" defaultOpen>
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
            <Section title="Cabeçalho">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <ToggleRow
                  label="Exibir cabeçalho"
                  checked={config.display?.showHeader ?? true}
                  onCheckedChange={(v) =>
                    set("display", {
                      ...(config.display ?? { showCount: true }),
                      showHeader: v,
                    } as Config["display"])
                  }
                />
                <ToggleRow
                  label="Exibir contagem"
                  checked={config.display?.showCount ?? true}
                  onCheckedChange={(v) =>
                    set("display", {
                      ...(config.display ?? { showHeader: true }),
                      showCount: v,
                    } as Config["display"])
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

        <TabsContent value="behavior" className="space-y-3 mt-0">
          <SectionGroup defaultOpenId={null}>
            <Section title="Grade e densidade" defaultOpen>
              <div className="space-y-3">
                <SegmentedControl
                  label="Layout do texto"
                  options={[
                    { value: "row", label: "Em linha" },
                    { value: "stacked", label: "Empilhado" },
                  ]}
                  value={config.layout ?? "row"}
                  onChange={(v) => set("layout", v as Config["layout"])}
                />
                <DensitySegmented
                  value={config.density ?? "comfortable"}
                  onChange={(d) => set("density", d)}
                />
                <NumberPills
                  label="Cartões por linha (1–10)"
                  min={1}
                  max={10}
                  value={config.itemsPerRow}
                  onChange={(n) => set("itemsPerRow", n)}
                />
                <NumberPills
                  label="Linhas visíveis (1–6)"
                  min={1}
                  max={6}
                  value={config.itemsPerColumn}
                  onChange={(n) => set("itemsPerColumn", n)}
                />
              </div>
            </Section>
          </SectionGroup>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export const favoritesWidget: WidgetDefinition<Config> = {
  id: "home.favorites",
  name: "Favoritos",
  description:
    "Acesso rápido às páginas favoritas. Configurável: título, aparência (cor / ícone / borda), cartões por linha e linhas visíveis.",
  icon: IconStar,
  category: "other",
  allowedSectors: "*",
  defaultSize: { cols: 4, rows: 1 },
  minSize: { cols: 1, rows: 1 },
  maxSize: { cols: 4, rows: 4 },
  configSchema,
  defaultConfig: {
    title: "Favoritos",
    accent: { color: "yellow", icon: "Star", shade: "500" },
    itemsPerRow: 4,
    itemsPerColumn: 1,
    density: "comfortable",
    layout: "row",
    display: { showHeader: true, showCount: true, showViewAllLink: true },
  },
  RenderComponent: FavoritesRender,
  ConfigComponent: ConfigComp,
};
