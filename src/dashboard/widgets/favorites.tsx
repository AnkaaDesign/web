// Favorites widget — quick-access cards for the user's bookmarked pages.
//
// Configurable: title, accent (color/icon/border), itemsPerRow, itemsPerColumn.
// Card layout (horizontal vs vertical) and density adapt automatically to the
// resulting card height.

import { useMemo } from "react";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { IconStar, IconPlus } from "@tabler/icons-react";
import { useFavorites } from "../../contexts/favorites-context";
import { getIconInfoByPath, isPageCadastrar } from "../../utils";
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
  title: z.string().min(1).max(80).default("Favoritos"),
  accent: makeAccentSchema({ color: "yellow", icon: "Star", borderColor: "none" }),
  itemsPerRow: z.number().int().min(1).max(10).default(4),
  itemsPerColumn: z.number().int().min(1).max(6).default(1),
});
type Config = z.infer<typeof configSchema>;

const GRID_GAP_PX = 12;
const WIDGET_ROW_PX = 180;
const WIDGET_HEADER_PX = 40;
const WIDGET_PADDING_PX = 24;
const VERTICAL_LAYOUT_THRESHOLD_PX = 110;

function FavoritesRender({ config, size: tileSize }: WidgetRenderProps<Config>) {
  const { favorites } = useFavorites();
  const navigate = useNavigate();
  const perRow = Math.max(1, Math.min(10, config.itemsPerRow ?? 4));
  const perCol = Math.max(1, Math.min(6, config.itemsPerColumn ?? 1));

  const widgetBodyHeight =
    tileSize.rows * WIDGET_ROW_PX - WIDGET_HEADER_PX - WIDGET_PADDING_PX;
  const cardHeightPx =
    (widgetBodyHeight - (perCol - 1) * GRID_GAP_PX) / perCol;
  const layout: "vertical" | "horizontal" =
    cardHeightPx >= VERTICAL_LAYOUT_THRESHOLD_PX ? "vertical" : "horizontal";

  const iconStyle =
    layout === "vertical"
      ? { box: "p-2.5 rounded-lg", icon: "h-5 w-5" }
      : cardHeightPx >= 70
      ? { box: "p-1.5 rounded-md", icon: "h-4 w-4" }
      : { box: "p-1 rounded-md", icon: "h-3.5 w-3.5" };
  const titleClass =
    layout === "vertical"
      ? "text-sm font-semibold line-clamp-2 leading-tight"
      : cardHeightPx >= 70
      ? "text-xs font-semibold flex-1 min-w-0 truncate"
      : "text-[11px] font-medium flex-1 min-w-0 truncate";
  const cardPad =
    layout === "vertical" ? "p-3" : cardHeightPx >= 70 ? "p-2.5" : "p-1.5";
  const flexDir =
    layout === "horizontal" ? "flex-row items-center gap-2" : "flex-col items-start gap-2";

  const rowHeight = `calc((100% - ${(perCol - 1) * GRID_GAP_PX}px) / ${perCol})`;

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
        <span className={accent.classes.text}>{config.title || "Favoritos"}</span>
      }
      icon={<AccentIcon className={`h-4 w-4 ${accent.classes.icon}`} />}
      count={favorites.length || null}
      borderColor={config.accent?.borderColor as WidgetBorderColor | undefined}
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
                className={`text-left cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/40 hover:scale-[1.02] rounded-lg bg-secondary border border-border ${cardPad} flex ${flexDir} min-w-0 overflow-hidden`}
                title={fav.title}
              >
                <div className="relative inline-block shrink-0">
                  <div
                    className={`${iconInfo.color} text-white ${iconStyle.box} flex items-center justify-center`}
                  >
                    <IconComponent className={iconStyle.icon} />
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
                <h3
                  className={`text-secondary-foreground leading-tight ${titleClass}`}
                >
                  {fav.title}
                </h3>
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
  const borderColor = (config.accent?.borderColor ?? "none") as WidgetBorderColor;
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
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Cartões por linha (1–10)</Label>
          <Input
            type="number"
            value={config.itemsPerRow}
            onChange={(v) => {
              const n = typeof v === "number" ? v : Number(v);
              if (Number.isFinite(n)) set("itemsPerRow", Math.max(1, Math.min(10, n)));
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Linhas visíveis (1–6)</Label>
          <Input
            type="number"
            value={config.itemsPerColumn}
            onChange={(v) => {
              const n = typeof v === "number" ? v : Number(v);
              if (Number.isFinite(n)) set("itemsPerColumn", Math.max(1, Math.min(6, n)));
            }}
          />
        </div>
      </div>
    </div>
  );
}

export const favoritesWidget: WidgetDefinition<Config> = {
  id: "home.favorites",
  name: "Favoritos",
  description:
    "Acesso rápido às páginas favoritas. Configurável: título, aparência (cor / ícone / borda), cartões por linha e linhas visíveis.",
  icon: IconStar,
  category: "favorites",
  allowedSectors: "*",
  defaultSize: { cols: 4, rows: 1 },
  minSize: { cols: 1, rows: 1 },
  maxSize: { cols: 4, rows: 4 },
  configSchema,
  defaultConfig: {
    title: "Favoritos",
    accent: { color: "yellow", icon: "Star", borderColor: "none" },
    itemsPerRow: 4,
    itemsPerColumn: 1,
  },
  RenderComponent: FavoritesRender,
  ConfigComponent: ConfigComp,
};
