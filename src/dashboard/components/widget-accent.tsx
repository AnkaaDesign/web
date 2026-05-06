// Shared accent system for dashboard widgets — a curated palette of named
// colors and a curated set of icons that widgets can use to give each
// instance a distinct visual identity (e.g. "Em Produção" violet with a
// brush icon, "Concluídas" green with a check, etc.).
//
// Color classes are listed as LITERAL strings here so Tailwind's JIT picks
// them up at build time. Don't construct class names like `text-${color}-500`
// at runtime — they would be tree-shaken away.

import { useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { z } from "zod";
import {
  IconClipboardText,
  IconClipboardList,
  IconClipboardCheck,
  IconCalendar,
  IconCalendarDue,
  IconClock,
  IconClock24,
  IconHourglass,
  IconCheck,
  IconCircleCheck,
  IconAlertTriangle,
  IconFlag,
  IconStar,
  IconBolt,
  IconTruck,
  IconPackage,
  IconBrush,
  IconPalette,
  IconReceipt,
  IconFileText,
  IconTools,
  IconUsers,
  IconBuildingFactory2,
  IconMessage,
  IconBell,
  IconHome,
  IconHeart,
  IconBookmark,
  IconChartBar,
  IconSearch,
  IconPalette as IconPaletteHeader,
} from "@tabler/icons-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { ScrollArea } from "../../components/ui/scroll-area";

// ============================================================
// Color palette
// ============================================================

export type WidgetAccentColor =
  | "gray"
  | "slate"
  | "red"
  | "orange"
  | "amber"
  | "yellow"
  | "lime"
  | "green"
  | "emerald"
  | "teal"
  | "cyan"
  | "sky"
  | "blue"
  | "indigo"
  | "violet"
  | "purple"
  | "fuchsia"
  | "pink"
  | "rose";

interface AccentColorClasses {
  /** Title text color (header). */
  text: string;
  /** Icon foreground (header icon). */
  icon: string;
  /** Small dot / badge before each row's primary cell. */
  dot: string;
  /** Optional left-border accent. */
  border: string;
  /** Card outer border (used when this color is picked as the widget border). */
  cardBorder: string;
}

export const ACCENT_COLOR_CLASSES: Record<WidgetAccentColor, AccentColorClasses> = {
  gray: {
    text: "text-secondary-foreground",
    icon: "text-muted-foreground",
    dot: "bg-muted-foreground",
    border: "border-l-muted-foreground/40",
    cardBorder: "border-muted-foreground/50",
  },
  slate: {
    text: "text-slate-500",
    icon: "text-slate-500",
    dot: "bg-slate-500",
    border: "border-l-slate-500/40",
    cardBorder: "border-slate-500/50",
  },
  red: {
    text: "text-red-500",
    icon: "text-red-500",
    dot: "bg-red-500",
    border: "border-l-red-500/40",
    cardBorder: "border-red-500/50",
  },
  orange: {
    text: "text-orange-500",
    icon: "text-orange-500",
    dot: "bg-orange-500",
    border: "border-l-orange-500/40",
    cardBorder: "border-orange-500/50",
  },
  amber: {
    text: "text-amber-500",
    icon: "text-amber-500",
    dot: "bg-amber-500",
    border: "border-l-amber-500/40",
    cardBorder: "border-amber-500/50",
  },
  yellow: {
    text: "text-yellow-500",
    icon: "text-yellow-500",
    dot: "bg-yellow-500",
    border: "border-l-yellow-500/40",
    cardBorder: "border-yellow-500/50",
  },
  lime: {
    text: "text-lime-500",
    icon: "text-lime-500",
    dot: "bg-lime-500",
    border: "border-l-lime-500/40",
    cardBorder: "border-lime-500/50",
  },
  green: {
    text: "text-green-500",
    icon: "text-green-500",
    dot: "bg-green-500",
    border: "border-l-green-500/40",
    cardBorder: "border-green-500/50",
  },
  emerald: {
    text: "text-emerald-500",
    icon: "text-emerald-500",
    dot: "bg-emerald-500",
    border: "border-l-emerald-500/40",
    cardBorder: "border-emerald-500/50",
  },
  teal: {
    text: "text-teal-500",
    icon: "text-teal-500",
    dot: "bg-teal-500",
    border: "border-l-teal-500/40",
    cardBorder: "border-teal-500/50",
  },
  cyan: {
    text: "text-cyan-500",
    icon: "text-cyan-500",
    dot: "bg-cyan-500",
    border: "border-l-cyan-500/40",
    cardBorder: "border-cyan-500/50",
  },
  sky: {
    text: "text-sky-500",
    icon: "text-sky-500",
    dot: "bg-sky-500",
    border: "border-l-sky-500/40",
    cardBorder: "border-sky-500/50",
  },
  blue: {
    text: "text-blue-500",
    icon: "text-blue-500",
    dot: "bg-blue-500",
    border: "border-l-blue-500/40",
    cardBorder: "border-blue-500/50",
  },
  indigo: {
    text: "text-indigo-500",
    icon: "text-indigo-500",
    dot: "bg-indigo-500",
    border: "border-l-indigo-500/40",
    cardBorder: "border-indigo-500/50",
  },
  violet: {
    text: "text-violet-500",
    icon: "text-violet-500",
    dot: "bg-violet-500",
    border: "border-l-violet-500/40",
    cardBorder: "border-violet-500/50",
  },
  purple: {
    text: "text-purple-500",
    icon: "text-purple-500",
    dot: "bg-purple-500",
    border: "border-l-purple-500/40",
    cardBorder: "border-purple-500/50",
  },
  fuchsia: {
    text: "text-fuchsia-500",
    icon: "text-fuchsia-500",
    dot: "bg-fuchsia-500",
    border: "border-l-fuchsia-500/40",
    cardBorder: "border-fuchsia-500/50",
  },
  pink: {
    text: "text-pink-500",
    icon: "text-pink-500",
    dot: "bg-pink-500",
    border: "border-l-pink-500/40",
    cardBorder: "border-pink-500/50",
  },
  rose: {
    text: "text-rose-500",
    icon: "text-rose-500",
    dot: "bg-rose-500",
    border: "border-l-rose-500/40",
    cardBorder: "border-rose-500/50",
  },
};

/** Border-only options — same colors plus an explicit "none" that defers to the
 * widget's default `border-border`. */
export type WidgetBorderColor = WidgetAccentColor | "none";

export function borderClassFor(value: WidgetBorderColor | null | undefined): string {
  if (!value || value === "none") return "border-border";
  return ACCENT_COLOR_CLASSES[value]?.cardBorder ?? "border-border";
}

export const ACCENT_COLOR_LABELS: Record<WidgetAccentColor, string> = {
  gray: "Cinza (padrão)",
  slate: "Ardósia",
  red: "Vermelho",
  orange: "Laranja",
  amber: "Âmbar",
  yellow: "Amarelo",
  lime: "Lima",
  green: "Verde",
  emerald: "Esmeralda",
  teal: "Petróleo",
  cyan: "Ciano",
  sky: "Céu",
  blue: "Azul",
  indigo: "Índigo",
  violet: "Violeta",
  purple: "Roxo",
  fuchsia: "Fúcsia",
  pink: "Rosa",
  rose: "Rosa-vermelho",
};

export const ACCENT_COLOR_VALUES: WidgetAccentColor[] = Object.keys(
  ACCENT_COLOR_LABELS,
) as WidgetAccentColor[];

export const BORDER_COLOR_VALUES: WidgetBorderColor[] = [
  "none",
  ...ACCENT_COLOR_VALUES,
];

export const BORDER_COLOR_LABELS: Record<WidgetBorderColor, string> = {
  none: "Sem cor (padrão)",
  ...ACCENT_COLOR_LABELS,
};

// ============================================================
// Icon set
// ============================================================

export type WidgetAccentIcon =
  | "ClipboardText"
  | "ClipboardList"
  | "ClipboardCheck"
  | "Calendar"
  | "CalendarDue"
  | "Clock"
  | "Clock24"
  | "Hourglass"
  | "Check"
  | "CircleCheck"
  | "AlertTriangle"
  | "Flag"
  | "Star"
  | "Bolt"
  | "Truck"
  | "Package"
  | "Brush"
  | "Palette"
  | "Receipt"
  | "FileText"
  | "Tools"
  | "Users"
  | "Factory"
  | "Message"
  | "Bell"
  | "Home"
  | "Heart"
  | "Bookmark"
  | "ChartBar";

export const ACCENT_ICON_COMPONENTS: Record<
  WidgetAccentIcon,
  ComponentType<{ className?: string; size?: number }>
> = {
  ClipboardText: IconClipboardText,
  ClipboardList: IconClipboardList,
  ClipboardCheck: IconClipboardCheck,
  Calendar: IconCalendar,
  CalendarDue: IconCalendarDue,
  Clock: IconClock,
  Clock24: IconClock24,
  Hourglass: IconHourglass,
  Check: IconCheck,
  CircleCheck: IconCircleCheck,
  AlertTriangle: IconAlertTriangle,
  Flag: IconFlag,
  Star: IconStar,
  Bolt: IconBolt,
  Truck: IconTruck,
  Package: IconPackage,
  Brush: IconBrush,
  Palette: IconPalette,
  Receipt: IconReceipt,
  FileText: IconFileText,
  Tools: IconTools,
  Users: IconUsers,
  Factory: IconBuildingFactory2,
  Message: IconMessage,
  Bell: IconBell,
  Home: IconHome,
  Heart: IconHeart,
  Bookmark: IconBookmark,
  ChartBar: IconChartBar,
};

export const ACCENT_ICON_LABELS: Record<WidgetAccentIcon, string> = {
  ClipboardText: "Prancheta com texto",
  ClipboardList: "Prancheta de lista",
  ClipboardCheck: "Prancheta concluída",
  Calendar: "Calendário",
  CalendarDue: "Calendário (prazo)",
  Clock: "Relógio",
  Clock24: "Relógio 24h",
  Hourglass: "Ampulheta",
  Check: "Visto",
  CircleCheck: "Visto em círculo",
  AlertTriangle: "Alerta",
  Flag: "Bandeira",
  Star: "Estrela",
  Bolt: "Raio",
  Truck: "Caminhão",
  Package: "Pacote",
  Brush: "Pincel",
  Palette: "Paleta",
  Receipt: "Recibo",
  FileText: "Documento",
  Tools: "Ferramentas",
  Users: "Pessoas",
  Factory: "Fábrica",
  Message: "Mensagem",
  Bell: "Sino",
  Home: "Casa",
  Heart: "Coração",
  Bookmark: "Marcador",
  ChartBar: "Gráfico",
};

export const ACCENT_ICON_VALUES: WidgetAccentIcon[] = Object.keys(
  ACCENT_ICON_LABELS,
) as WidgetAccentIcon[];

// ============================================================
// Helpers
// ============================================================

// ============================================================
// Shared Zod schema factory — every widget that wants the accent system
// builds its config off this so we don't duplicate the enum lists.
// ============================================================

const ACCENT_COLOR_TUPLE = [
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
] as const;

const ACCENT_ICON_TUPLE = [
  "ClipboardText",
  "ClipboardList",
  "ClipboardCheck",
  "Calendar",
  "CalendarDue",
  "Clock",
  "Clock24",
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
  "Message",
  "Bell",
  "Home",
  "Heart",
  "Bookmark",
  "ChartBar",
] as const;

const BORDER_COLOR_TUPLE = ["none", ...ACCENT_COLOR_TUPLE] as const;

/**
 * Build the accent sub-schema for a widget config. Each widget can pass its
 * own semantic defaults (e.g., favorites = yellow + Star, time-entries =
 * teal + Clock).
 */
export function makeAccentSchema(defaults: {
  color: WidgetAccentColor;
  icon: WidgetAccentIcon;
  borderColor?: WidgetBorderColor;
}) {
  const fallback = {
    color: defaults.color,
    icon: defaults.icon,
    borderColor: defaults.borderColor ?? "none",
  };
  return z
    .object({
      color: z.enum(ACCENT_COLOR_TUPLE).default(defaults.color),
      icon: z.enum(ACCENT_ICON_TUPLE).default(defaults.icon),
      borderColor: z
        .enum(BORDER_COLOR_TUPLE)
        .default(defaults.borderColor ?? "none"),
    })
    .default(fallback);
}

export interface ResolvedAccent {
  color: WidgetAccentColor;
  icon: WidgetAccentIcon;
  classes: AccentColorClasses;
  Icon: ComponentType<{ className?: string; size?: number }>;
}

export function resolveAccent(input?: {
  color?: WidgetAccentColor | null;
  icon?: WidgetAccentIcon | null;
}): ResolvedAccent {
  const color = (input?.color ?? "gray") as WidgetAccentColor;
  const icon = (input?.icon ?? "ClipboardText") as WidgetAccentIcon;
  return {
    color,
    icon,
    classes: ACCENT_COLOR_CLASSES[color] ?? ACCENT_COLOR_CLASSES.gray,
    Icon: ACCENT_ICON_COMPONENTS[icon] ?? ACCENT_ICON_COMPONENTS.ClipboardText,
  };
}

/** Render the accent icon with the matching color class applied. */
export function AccentIconNode({
  accent,
  className,
}: {
  accent: ResolvedAccent;
  className?: string;
}): ReactNode {
  const Cmp = accent.Icon;
  return <Cmp className={`${className ?? "h-4 w-4"} ${accent.classes.icon}`} />;
}

// ============================================================
// AccentPicker — two summary cards + modal dialogs (mirrors the
// message IconPicker pattern)
// ============================================================

interface AccentPickerProps {
  value: {
    color: WidgetAccentColor;
    icon: WidgetAccentIcon;
    borderColor?: WidgetBorderColor;
  };
  onChange: (next: {
    color: WidgetAccentColor;
    icon: WidgetAccentIcon;
    borderColor: WidgetBorderColor;
  }) => void;
}

export function AccentPicker({ value, onChange }: AccentPickerProps) {
  const [colorOpen, setColorOpen] = useState(false);
  const [iconOpen, setIconOpen] = useState(false);
  const [borderOpen, setBorderOpen] = useState(false);

  const borderColor: WidgetBorderColor = value.borderColor ?? "none";
  const accent = resolveAccent(value);
  const Icon = accent.Icon;

  const change = (
    patch: Partial<{
      color: WidgetAccentColor;
      icon: WidgetAccentIcon;
      borderColor: WidgetBorderColor;
    }>,
  ) =>
    onChange({
      color: value.color,
      icon: value.icon,
      borderColor,
      ...patch,
    });

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {/* Color card */}
        <button
          type="button"
          onClick={() => setColorOpen(true)}
          className="flex items-center gap-3 rounded-md border border-border bg-card hover:bg-accent/30 hover:border-primary/40 transition-colors px-3 py-2.5 text-left min-w-0"
        >
          <span
            className={`h-6 w-6 rounded-md shrink-0 ${accent.classes.dot} ring-2 ring-border`}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Cor
            </div>
            <div className="text-sm font-medium truncate">
              {ACCENT_COLOR_LABELS[value.color]}
            </div>
          </div>
        </button>

        {/* Icon card */}
        <button
          type="button"
          onClick={() => setIconOpen(true)}
          className="flex items-center gap-3 rounded-md border border-border bg-card hover:bg-accent/30 hover:border-primary/40 transition-colors px-3 py-2.5 text-left min-w-0"
        >
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${accent.classes.icon}`}
          >
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Ícone
            </div>
            <div className="text-sm font-medium truncate">
              {ACCENT_ICON_LABELS[value.icon]}
            </div>
          </div>
        </button>

        {/* Border card */}
        <button
          type="button"
          onClick={() => setBorderOpen(true)}
          className="flex items-center gap-3 rounded-md border border-border bg-card hover:bg-accent/30 hover:border-primary/40 transition-colors px-3 py-2.5 text-left min-w-0"
        >
          <span
            className={`h-6 w-6 rounded-md shrink-0 border-2 bg-card ${borderClassFor(borderColor)}`}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Borda
            </div>
            <div className="text-sm font-medium truncate">
              {BORDER_COLOR_LABELS[borderColor]}
            </div>
          </div>
        </button>
      </div>

      <AccentColorDialog
        open={colorOpen}
        onClose={() => setColorOpen(false)}
        value={value.color}
        onSelect={(color) => change({ color })}
      />
      <AccentIconDialog
        open={iconOpen}
        onClose={() => setIconOpen(false)}
        value={value.icon}
        accentColor={value.color}
        onSelect={(icon) => change({ icon })}
      />
      <AccentBorderDialog
        open={borderOpen}
        onClose={() => setBorderOpen(false)}
        value={borderColor}
        onSelect={(bc) => change({ borderColor: bc })}
      />
    </>
  );
}

// ----- Border dialog -----

function AccentBorderDialog({
  open,
  onClose,
  value,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  value: WidgetBorderColor;
  onSelect: (color: WidgetBorderColor) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Selecione a cor da borda</DialogTitle>
          <DialogDescription>
            A cor da borda destaca o widget no painel. Escolha "Sem cor" para
            usar a borda padrão.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {BORDER_COLOR_VALUES.map((color) => {
            const active = color === value;
            const previewClass = borderClassFor(color);
            return (
              <button
                key={color}
                type="button"
                onClick={() => {
                  onSelect(color);
                  onClose();
                }}
                className={`relative flex items-center gap-2.5 rounded-md border px-3 py-2 text-left transition-all ${
                  active
                    ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                    : "border-border hover:border-primary/40 hover:bg-accent/30"
                }`}
              >
                <span
                  className={`h-5 w-5 rounded-md shrink-0 border-2 bg-card ${previewClass}`}
                  aria-hidden="true"
                />
                <span className="text-sm font-medium truncate">
                  {BORDER_COLOR_LABELS[color]}
                </span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ----- Color dialog -----

function AccentColorDialog({
  open,
  onClose,
  value,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  value: WidgetAccentColor;
  onSelect: (color: WidgetAccentColor) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <IconPaletteHeader className="h-4 w-4" />
            Selecione uma cor
          </DialogTitle>
          <DialogDescription>
            A cor é aplicada ao título do widget e ao indicador colorido em cada
            linha.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {ACCENT_COLOR_VALUES.map((color) => {
            const classes = ACCENT_COLOR_CLASSES[color];
            const active = color === value;
            return (
              <button
                key={color}
                type="button"
                onClick={() => {
                  onSelect(color);
                  onClose();
                }}
                className={`relative flex items-center gap-2.5 rounded-md border px-3 py-2 text-left transition-all ${
                  active
                    ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                    : "border-border hover:border-primary/40 hover:bg-accent/30"
                }`}
              >
                <span
                  className={`h-5 w-5 rounded-md shrink-0 ${classes.dot}`}
                  aria-hidden="true"
                />
                <span className={`text-sm font-medium ${classes.text} truncate`}>
                  {ACCENT_COLOR_LABELS[color]}
                </span>
                {active && (
                  <IconCheck className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary" />
                )}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ----- Icon dialog -----

function AccentIconDialog({
  open,
  onClose,
  value,
  accentColor,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  value: WidgetAccentIcon;
  accentColor: WidgetAccentColor;
  onSelect: (icon: WidgetAccentIcon) => void;
}) {
  const [search, setSearch] = useState("");
  const accentClasses = ACCENT_COLOR_CLASSES[accentColor];

  const filtered = ACCENT_ICON_VALUES.filter((iconKey) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      iconKey.toLowerCase().includes(q) ||
      ACCENT_ICON_LABELS[iconKey].toLowerCase().includes(q)
    );
  });

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Selecione um ícone</DialogTitle>
          <DialogDescription>
            O ícone aparece no cabeçalho do widget, com a cor de destaque escolhida.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(v) => setSearch(typeof v === "string" ? v : "")}
              placeholder="Buscar ícone..."
              className="pl-9"
              autoFocus
            />
          </div>
          <ScrollArea className="h-[360px] rounded-md border border-border p-3">
            {filtered.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-12">
                Nenhum ícone encontrado.
              </div>
            ) : (
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {filtered.map((iconKey) => {
                  const Cmp = ACCENT_ICON_COMPONENTS[iconKey];
                  const active = iconKey === value;
                  return (
                    <button
                      key={iconKey}
                      type="button"
                      onClick={() => {
                        onSelect(iconKey);
                        onClose();
                      }}
                      className={`flex flex-col items-center gap-1 rounded-md border px-2 py-2 transition-all ${
                        active
                          ? `border-primary ring-2 ring-primary/30 ${accentClasses.icon}`
                          : "border-border text-muted-foreground hover:text-foreground hover:border-primary/40"
                      }`}
                      title={ACCENT_ICON_LABELS[iconKey]}
                    >
                      <Cmp className="h-5 w-5" />
                      <span className="text-[10px] truncate w-full text-center">
                        {ACCENT_ICON_LABELS[iconKey]}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
