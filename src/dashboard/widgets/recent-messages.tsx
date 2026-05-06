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
import { z } from "zod";
import { IconMessage, IconMessageOff } from "@tabler/icons-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { HomeDashboardWidgetBody } from "./_shared";
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
    borderColor: "none",
  }),
  itemsPerRow: z.number().int().min(1).max(8).default(4),
  itemsPerColumn: z.number().int().min(1).max(6).default(2),
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
function generateBlocks(seed: string): PreviewBlock[] {
  const rng = seededRng(seed);
  const blocks: PreviewBlock[] = [];
  const totalBlocks = 8 + Math.floor(rng() * 7); // 8–14

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
function PreviewBlockNode({
  block,
  isUnread,
}: {
  block: PreviewBlock;
  isUnread: boolean;
}) {
  const baseBar = isUnread ? "bg-primary/30" : "bg-muted-foreground/25";
  const baseBarHover = isUnread
    ? "group-hover:bg-primary/40"
    : "group-hover:bg-muted-foreground/40";

  let barClass = "";
  let isList = false;
  let isDivider = false;
  let isImage = false;

  if (block.kind === "heading") {
    barClass = `h-2.5 rounded-md ${baseBar} ${baseBarHover}`;
  } else if (block.kind === "paragraph") {
    barClass = `h-1.5 rounded-full ${baseBar} ${baseBarHover}`;
  } else if (block.kind === "list") {
    isList = true;
  } else if (block.kind === "divider") {
    isDivider = true;
  } else if (block.kind === "button") {
    barClass = `h-3.5 rounded-md ${
      isUnread ? "bg-primary/45" : "bg-muted-foreground/35"
    } ${
      isUnread ? "group-hover:bg-primary/55" : "group-hover:bg-muted-foreground/50"
    }`;
  } else {
    isImage = true;
  }

  // Slot wrapper — flex column centering the bar vertically. `min-h-0`
  // allows the slot to shrink below its content size so all blocks fit
  // even in compact cards.
  return (
    <div className="min-h-0 flex flex-col justify-center transition-colors">
      {isDivider ? (
        <div className="h-px w-full bg-border" />
      ) : isList ? (
        <div className="flex items-center gap-1.5">
          <span
            className={`h-1.5 w-1.5 rounded-full shrink-0 ${baseBar} ${baseBarHover} transition-colors`}
          />
          <div
            className={`h-1.5 rounded-full ${baseBar} ${baseBarHover} transition-colors`}
            style={{ width: `${block.width}%` }}
          />
        </div>
      ) : isImage ? (
        <div
          className={`rounded-md ${
            isUnread
              ? "bg-primary/15 border border-primary/30"
              : "bg-muted/60 border border-border"
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
}

function MessageStubCard({ message, onClick }: MessageStubCardProps) {
  const isUnread = !message.viewedAt;
  const blocks = useMemo(() => generateBlocks(message.id), [message.id]);
  const timeAgo = message.publishedAt
    ? formatDistanceToNow(new Date(message.publishedAt), {
        addSuffix: true,
        locale: ptBR,
      })
    : null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative h-full w-full text-left rounded-lg border bg-card hover:shadow-md hover:border-primary/40 hover:scale-[1.01] transition-all overflow-hidden flex flex-col ${
        isUnread ? "border-primary/40 ring-1 ring-primary/20" : "border-border"
      }`}
    >
      {/* Top accent bar — solid primary for unread, muted otherwise */}
      <div
        className={`h-1 shrink-0 ${isUnread ? "bg-primary" : "bg-muted-foreground/20"}`}
      />

      <div className="p-3 flex flex-col flex-1 min-h-0 gap-2">
        {/* Title + small tag */}
        <div className="flex items-start gap-2 min-w-0">
          <h4
            className={`text-sm font-semibold leading-tight line-clamp-2 flex-1 min-w-0 ${
              isUnread ? "text-primary" : "text-secondary-foreground"
            }`}
          >
            {message.title || "Sem título"}
          </h4>
          {isUnread && (
            <span className="shrink-0 rounded-md bg-primary/15 text-primary text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5">
              Novo
            </span>
          )}
        </div>

        {/* Block preview — CSS grid with equal rows so all blocks render
            and distribute through the card height regardless of card size.
            (overflow-hidden was clipping blocks at small sizes.) */}
        <div
          className="flex-1 min-h-0 grid gap-1 py-1"
          style={{
            gridTemplateRows: `repeat(${blocks.length}, minmax(0, 1fr))`,
          }}
        >
          {blocks.map((b, i) => (
            <PreviewBlockNode key={i} block={b} isUnread={isUnread} />
          ))}
        </div>

        {/* Footer — relative time */}
        {timeAgo && (
          <div className="shrink-0 text-[10px] text-muted-foreground tabular-nums truncate pt-1 border-t border-border/50">
            {timeAgo}
          </div>
        )}
      </div>

      {/* Bottom accent bar */}
      <div
        className={`h-0.5 shrink-0 ${
          isUnread ? "bg-primary" : "bg-muted-foreground/15"
        }`}
      />
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

  const accent = resolveAccent({
    color: config.accent?.color as WidgetAccentColor,
    icon: config.accent?.icon as WidgetAccentIcon,
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
      borderColor={config.accent?.borderColor as WidgetBorderColor | undefined}
    >
      <HomeDashboardWidgetBody
        selector={(d) => d.recentMessages ?? []}
      >
        {(messages) =>
          messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-sm text-muted-foreground">
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
  const borderColor = (config.accent?.borderColor ?? "none") as WidgetBorderColor;
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-sm">Título</Label>
        <Input
          value={config.title}
          onChange={(v) => set("title", typeof v === "string" ? v : "")}
          placeholder="Mensagens Recentes"
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
          <Label className="text-xs">Mensagens por linha (1–8)</Label>
          <Input
            type="number"
            value={config.itemsPerRow}
            onChange={(v) => {
              const n = typeof v === "number" ? v : Number(v);
              if (Number.isFinite(n)) set("itemsPerRow", Math.max(1, Math.min(8, n)));
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

export const recentMessagesWidget: WidgetDefinition<Config> = {
  id: "home.recent-messages",
  name: "Mensagens Recentes",
  description:
    "Últimas mensagens recebidas. Configurável: título, aparência, mensagens por linha, linhas visíveis.",
  icon: IconMessage,
  category: "communication",
  allowedSectors: "*",
  defaultSize: { cols: 4, rows: 2 },
  minSize: { cols: 1, rows: 1 },
  maxSize: { cols: 4, rows: 4 },
  configSchema,
  defaultConfig: {
    title: "Mensagens Recentes",
    accent: { color: "indigo", icon: "Message", borderColor: "none" },
    itemsPerRow: 4,
    itemsPerColumn: 2,
  },
  RenderComponent: Render,
  ConfigComponent: ConfigComp,
};
