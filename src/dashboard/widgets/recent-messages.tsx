// Recent Messages widget — stylized stub cards (title + skeleton-bar preview)
// modeled after the "Exemplos de Mensagem" cards in the message creation
// form. The stub doesn't try to render actual message content (which can be
// rich and arbitrarily long); it shows a tasteful abstract preview that
// resizes cleanly at any widget tile size.
//
// Configurable: itemsPerRow (1–8), itemsPerColumn (1–6).
//
// Click → opens the existing MessageModal so users can read full content.

import { useCallback, useMemo, useState } from "react";
import { WidgetTabsBar } from "../components/config-kit";
import { z } from "zod";
import {
  IconAdjustments,
  IconClock,
  IconLayout,
  IconMessage,
  IconMessageOff,
} from "@tabler/icons-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  HomeDashboardWidgetBody,
  Section,
  SectionGroup,
  ToggleRow,
  NumberPills,
  DensitySegmented,
  DENSITY_VALUES,
  type Density,
} from "./_shared";
import { routes } from "../../constants/routes";
import { WidgetCard } from "../components/widget-card";
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
import { MessageModal } from "../../components/common/message-modal/message-modal";
import { useMarkAsViewed } from "../../hooks/administration/use-message";
import type { HomeDashboardMessage } from "../../types";
import type {
  WidgetConfigProps,
  WidgetDefinition,
  WidgetRenderProps,
} from "../types";

const configSchema = z.object({
  title: z.string().min(1).max(80).default("Mensagens Recentes"),
  accent: makeAccentSchema({
    color: "indigo",
    icon: "Message",
  }),
  itemsPerRow: z.number().int().min(1).max(8).default(4),
  itemsPerColumn: z.number().int().min(1).max(6).default(2),
  density: z.enum(DENSITY_VALUES).default("comfortable"),
  display: z
    .object({
      showHeader: z.boolean().default(true),
      showViewAllLink: z.boolean().default(true),
    })
    .default({ showHeader: true, showViewAllLink: true }),
});
type Config = z.infer<typeof configSchema>;

const GRID_GAP_PX = 12;

// ============================================================
// Stub card — title + structural-block preview + small tag
//
// Each card renders a sequence of "blocks" mimicking the actual message
// editor's block types (heading, paragraph, list, divider, image, button).
// The sequence is generated deterministically from the message's id so it
// stays stable per message but varies between messages — multiple cards
// side-by-side look distinct, not cookie-cutter.
// ============================================================

type BlockKind = "heading" | "paragraph" | "list" | "divider" | "button" | "image";

interface PreviewBlock {
  kind: BlockKind;
  /** width % for paragraph / list / heading lines */
  width: number;
}

/** Deterministic PRNG seeded from a string. */
function seededRng(seed: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h ^ seed.charCodeAt(i)) * 16777619) >>> 0;
  }
  return () => {
    h = (h * 1664525 + 1013904223) >>> 0;
    return h / 0x100000000;
  };
}

/**
 * Generates a richer 8–14 block sequence so the preview reads like a real
 * message at typical card sizes. Always starts with a heading. Blocks are
 * later distributed via `justify-evenly` so the column fills the card.
 *
 * Block grouping rules:
 *   - Always lead with a heading
 *   - 30% chance of a "hero" image-style block right after the heading
 *   - Mix paragraph (most common) + list runs of 2–4 items + optional
 *     divider every few paragraphs
 *   - 30% chance of a button block near the end
 */
function generateBlocks(seed: string, density: Density = "comfortable"): PreviewBlock[] {
  const rng = seededRng(seed);
  const blocks: PreviewBlock[] = [];
  const totalBlocks =
    density === "compact"
      ? 5 + Math.floor(rng() * 4) // 5–8
      : density === "spacious"
        ? 11 + Math.floor(rng() * 5) // 11–15
        : 8 + Math.floor(rng() * 5); // 8–12

  // Heading
  blocks.push({ kind: "heading", width: 55 + Math.floor(rng() * 35) });

  // Maybe a hero image right after the heading
  if (rng() < 0.3) {
    blocks.push({ kind: "image", width: 100 });
  }

  let i = blocks.length;
  let consecutiveParagraph = 0;
  let lastListIndex = -3;
  while (i < totalBlocks - 1) {
    const r = rng();
    let kind: BlockKind;

    // List runs of 2–4 items
    if (r < 0.18 && i - lastListIndex > 2) {
      const runLen = 2 + Math.floor(rng() * 3);
      for (let j = 0; j < runLen && i < totalBlocks - 1; j++) {
        blocks.push({ kind: "list", width: 45 + Math.floor(rng() * 45) });
        i++;
      }
      lastListIndex = i;
      consecutiveParagraph = 0;
      continue;
    }

    // Divider every 3+ paragraphs
    if (consecutiveParagraph >= 3 && r < 0.35) {
      blocks.push({ kind: "divider", width: 100 });
      consecutiveParagraph = 0;
      i++;
      continue;
    }

    if (r < 0.78) {
      kind = "paragraph";
      consecutiveParagraph += 1;
    } else if (r < 0.9) {
      kind = "list";
      consecutiveParagraph = 0;
      lastListIndex = i;
    } else if (r < 0.97) {
      kind = "image";
      consecutiveParagraph = 0;
    } else {
      kind = "divider";
      consecutiveParagraph = 0;
    }

    let width = 55 + Math.floor(rng() * 40);
    if (kind === "list") width = 45 + Math.floor(rng() * 45);
    if (kind === "image") width = 70 + Math.floor(rng() * 30);
    if (kind === "divider") width = 100;
    blocks.push({ kind, width });
    i++;
  }

  // Final block: ~30% chance to be a button (CTA)
  if (rng() < 0.3) {
    blocks.push({ kind: "button", width: 30 + Math.floor(rng() * 25) });
  } else {
    blocks.push({ kind: "paragraph", width: 30 + Math.floor(rng() * 35) });
  }

  return blocks;
}

/**
 * Each block renders inside a CSS grid row of equal height (1fr) so the full
 * sequence is always visible regardless of card size — no overflow clipping.
 * The actual bar (h-2 paragraph / h-3 heading / etc.) sits centered in its
 * slot so cards stay legible at any aspect ratio.
 */
const DENSITY_BLOCK = {
  compact: {
    heading: "h-2",
    paragraph: "h-1",
    list: "h-1",
    listDot: "h-1 w-1",
    button: "h-3",
  },
  comfortable: {
    heading: "h-2.5",
    paragraph: "h-1.5",
    list: "h-1.5",
    listDot: "h-1.5 w-1.5",
    button: "h-3.5",
  },
  spacious: {
    heading: "h-3",
    paragraph: "h-2",
    list: "h-2",
    listDot: "h-2 w-2",
    button: "h-4",
  },
} as const;

function PreviewBlockNode({
  block,
  isUnread,
  density,
}: {
  block: PreviewBlock;
  isUnread: boolean;
  density: Density;
}) {
  const baseBar = isUnread ? "bg-primary/45" : "bg-foreground/15";
  const baseBarHover = isUnread
    ? "group-hover:bg-primary/55"
    : "group-hover:bg-foreground/25";
  const sizes = DENSITY_BLOCK[density];

  let barClass = "";
  let isList = false;
  let isDivider = false;
  let isImage = false;

  if (block.kind === "heading") {
    barClass = `${sizes.heading} rounded-md ${baseBar} ${baseBarHover}`;
  } else if (block.kind === "paragraph") {
    barClass = `${sizes.paragraph} rounded-full ${baseBar} ${baseBarHover}`;
  } else if (block.kind === "list") {
    isList = true;
  } else if (block.kind === "divider") {
    isDivider = true;
  } else if (block.kind === "button") {
    barClass = `${sizes.button} rounded-md ${
      isUnread ? "bg-primary/65" : "bg-foreground/25"
    } ${
      isUnread ? "group-hover:bg-primary/80" : "group-hover:bg-foreground/40"
    }`;
  } else {
    isImage = true;
  }

  return (
    <div className="min-h-0 flex flex-col justify-center transition-colors">
      {isDivider ? (
        <div className="h-px w-full bg-border" />
      ) : isList ? (
        <div className="flex items-center gap-1.5">
          <span
            className={`${sizes.listDot} rounded-full shrink-0 ${baseBar} ${baseBarHover} transition-colors`}
          />
          <div
            className={`${sizes.list} rounded-full ${baseBar} ${baseBarHover} transition-colors`}
            style={{ width: `${block.width}%` }}
          />
        </div>
      ) : isImage ? (
        <div
          className={`rounded-md ${
            isUnread
              ? "bg-primary/20 border border-primary/40"
              : "bg-muted/70 border border-border"
          } transition-colors`}
          style={{ width: `${block.width}%`, minHeight: "1.5rem", height: "100%" }}
        />
      ) : (
        <div
          className={`${barClass} transition-colors`}
          style={{ width: `${block.width}%` }}
        />
      )}
    </div>
  );
}

interface MessageStubCardProps {
  message: HomeDashboardMessage;
  onClick: () => void;
  density: Density;
}

const DENSITY_CARD = {
  compact: {
    padding: "p-2",
    gap: "gap-1.5",
    blockGap: "gap-0.5",
    title: "text-xs",
    badge: "text-[8px] px-1 py-0",
    footer: "text-[9px] pt-1 gap-1",
    footerIcon: "h-2.5 w-2.5",
  },
  comfortable: {
    padding: "p-3",
    gap: "gap-2",
    blockGap: "gap-1",
    title: "text-sm",
    badge: "text-[9px] px-1.5 py-0.5",
    footer: "text-[10px] pt-1.5 gap-1.5",
    footerIcon: "h-3 w-3",
  },
  spacious: {
    padding: "p-3.5",
    gap: "gap-2.5",
    blockGap: "gap-1.5",
    title: "text-[15px]",
    badge: "text-[10px] px-2 py-0.5",
    footer: "text-[11px] pt-2 gap-1.5",
    footerIcon: "h-3.5 w-3.5",
  },
} as const;

function MessageStubCard({ message, onClick, density }: MessageStubCardProps) {
  const isUnread = !message.viewedAt;
  const blocks = useMemo(
    () => generateBlocks(message.id, density),
    [message.id, density],
  );
  const timeAgo = message.publishedAt
    ? formatDistanceToNow(new Date(message.publishedAt), {
        addSuffix: true,
        locale: ptBR,
      })
    : null;
  const sizes = DENSITY_CARD[density];

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative h-full w-full text-left rounded-xl border transition-colors duration-150 overflow-hidden flex flex-col hover:border-primary ${
        isUnread
          ? "border-primary/40 bg-gradient-to-br from-primary/[0.07] via-card to-card"
          : "border-border bg-card"
      }`}
    >
      <div
        className={`h-1 shrink-0 ${
          isUnread
            ? "bg-gradient-to-r from-primary via-primary to-primary/50"
            : "bg-gradient-to-r from-muted-foreground/25 via-muted-foreground/15 to-transparent"
        }`}
      />

      <div className={`flex flex-col flex-1 min-h-0 ${sizes.padding} ${sizes.gap}`}>
        {/* Leading unread-dot removed per design feedback — the "Novo" pill
            already signals unread state and the dot added visual noise to a
            narrow card title. */}
        <div className="flex items-start gap-2 min-w-0">
          <h4
            className={`${sizes.title} font-semibold leading-tight line-clamp-2 flex-1 min-w-0 ${
              isUnread ? "text-foreground" : "text-foreground/75"
            }`}
          >
            {message.title || "Sem título"}
          </h4>
          {isUnread && (
            <span
              className={`shrink-0 rounded-full bg-primary text-primary-foreground font-semibold uppercase tracking-wider leading-tight ${sizes.badge}`}
            >
              Novo
            </span>
          )}
        </div>

        <div
          className={`flex-1 min-h-0 grid ${sizes.blockGap}`}
          style={{
            gridTemplateRows: `repeat(${blocks.length}, minmax(0, 1fr))`,
          }}
        >
          {blocks.map((b, i) => (
            <PreviewBlockNode
              key={i}
              block={b}
              isUnread={isUnread}
              density={density}
            />
          ))}
        </div>

        {timeAgo && (
          <div
            className={`shrink-0 flex items-center text-muted-foreground tabular-nums truncate border-t border-border/40 ${sizes.footer}`}
          >
            <IconClock
              className={`${sizes.footerIcon} opacity-60 shrink-0`}
              aria-hidden
            />
            <span className="truncate">{timeAgo}</span>
          </div>
        )}
      </div>
    </button>
  );
}

// ============================================================
// Render
// ============================================================

function Render({ config }: WidgetRenderProps<Config>) {
  const [selected, setSelected] = useState<HomeDashboardMessage | null>(null);
  const { mutate: markAsViewed } = useMarkAsViewed();

  const onMessageClick = useCallback(
    (message: HomeDashboardMessage) => {
      if (!message.viewedAt) markAsViewed(message.id);
      setSelected(message);
    },
    [markAsViewed],
  );

  const perRow = Math.max(1, Math.min(8, config.itemsPerRow ?? 4));
  const perCol = Math.max(1, Math.min(6, config.itemsPerColumn ?? 2));
  const rowHeight = `calc((100% - ${(perCol - 1) * GRID_GAP_PX}px) / ${perCol})`;
  const density: Density = config.density ?? "comfortable";

  const accent = resolveAccent({
    color: config.accent?.color as WidgetAccentColor,
    icon: config.accent?.icon as WidgetAccentIcon,
    shade: config.accent?.shade as WidgetAccentShade | undefined,
  });
  const AccentIcon = accent.Icon;

  return (
    <WidgetCard
      title={
        <span className={accent.classes.text}>
          {config.title || "Mensagens Recentes"}
        </span>
      }
      icon={<AccentIcon className={`h-4 w-4 ${accent.classes.icon}`} />}
      viewAllHref={
        (config.display?.showViewAllLink ?? true)
          ? routes.administration.messages.root
          : undefined
      }
      showHeader={config.display?.showHeader ?? true}
      accentColor={config.accent?.color as WidgetAccentColor}
      accentShade={config.accent?.shade as WidgetAccentShade | undefined}
    >
      <HomeDashboardWidgetBody
        selector={(d) => d.recentMessages ?? []}
      >
        {(messages) =>
          messages.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-sm text-muted-foreground">
              <IconMessageOff className="h-6 w-6 mb-2 opacity-40" />
              Nenhuma mensagem recente.
            </div>
          ) : (
            <>
              <div
                className="grid gap-3 p-3 h-full"
                style={{
                  gridTemplateColumns: `repeat(${perRow}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${perCol}, ${rowHeight})`,
                  gridAutoRows: rowHeight,
                }}
              >
                {messages.map((message) => (
                  <MessageStubCard
                    key={message.id}
                    message={message}
                    onClick={() => onMessageClick(message)}
                    density={density}
                  />
                ))}
              </div>
              {selected && (
                <MessageModal
                  open={!!selected}
                  onOpenChange={(open: boolean) => !open && setSelected(null)}
                  messages={[selected as any]}
                  currentIndex={0}
                  onClose={() => setSelected(null)}
                />
              )}
            </>
          )
        }
      </HomeDashboardWidgetBody>
    </WidgetCard>
  );
}

function ConfigComp({ config, onChange }: WidgetConfigProps<Config>) {
  const set = <K extends keyof Config>(key: K, value: Config[K]) =>
    onChange({ ...config, [key]: value });
  const accentColor = (config.accent?.color ?? "indigo") as WidgetAccentColor;
  const accentIcon = (config.accent?.icon ?? "Message") as WidgetAccentIcon;
  const accentShade = (config.accent?.shade ?? "500") as WidgetAccentShade;
  return (
    <div className="space-y-4">
      <Tabs defaultValue="appearance" className="flex flex-col gap-2">
        <WidgetTabsBar><TabsList className="self-start">
          <TabsTrigger value="appearance" className="gap-1">
            <IconAdjustments className="h-3.5 w-3.5" /> Aparência
          </TabsTrigger>
          <TabsTrigger value="behavior" className="gap-1">
            <IconLayout className="h-3.5 w-3.5" /> Comportamento
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
        <TabsContent value="behavior" className="space-y-3 mt-0">
          <SectionGroup defaultOpenId={null}>
            <Section title="Grade e densidade" defaultOpen>
              <div className="space-y-3">
                <DensitySegmented
                  value={config.density ?? "comfortable"}
                  onChange={(d) => set("density", d)}
                />
                <NumberPills
                  label="Mensagens por linha (1–8)"
                  min={1}
                  max={8}
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

export const recentMessagesWidget: WidgetDefinition<Config> = {
  id: "home.recent-messages",
  name: "Mensagens Recentes",
  description:
    "Últimas mensagens recebidas. Configurável: título, aparência, mensagens por linha, linhas visíveis.",
  icon: IconMessage,
  category: "other",
  allowedSectors: "*",
  defaultSize: { cols: 4, rows: 2 },
  minSize: { cols: 1, rows: 1 },
  maxSize: { cols: 4, rows: 4 },
  configSchema,
  defaultConfig: {
    title: "Mensagens Recentes",
    accent: { color: "indigo", icon: "Message", shade: "500" },
    itemsPerRow: 4,
    itemsPerColumn: 2,
    density: "comfortable",
    display: { showHeader: true, showViewAllLink: true },
  },
  RenderComponent: Render,
  ConfigComponent: ConfigComp,
};
