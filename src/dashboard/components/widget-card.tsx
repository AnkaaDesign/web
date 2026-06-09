// Shared chrome for dashboard widgets — gives every tile the same visual
// language: rounded card + border + a fixed-height header strip and a
// matching footer strip. The fixed header height (h-9) is what keeps every
// widget's header visually aligned regardless of whether the widget shows a
// search input, day navigator, or other taller controls inside `headerExtra`.
//
// When the caller passes `accentColor` + `accentShade`, a thin colored
// stripe is rendered flush at the very top of the card (clipped to the
// card's rounded corners by the wrapper's `overflow-hidden`). This mirrors
// the gallery card design from `add-widget-modal.tsx` so the user can
// recognize each widget at a glance by its picked accent.

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { IconChevronRight } from "@tabler/icons-react";
import { borderClassFor, resolveAccentClasses } from "./widget-accent";
import { useWidgetChrome } from "./widget-chrome-context";
import { WIDGET_TITLE_MAX } from "./config-kit";
import type {
  WidgetAccentColor,
  WidgetAccentShade,
  WidgetBorderColor,
} from "./widget-accent";

interface WidgetCardProps {
  title?: ReactNode;
  icon?: ReactNode;
  /** "See all" link rendered centered in the bottom footer strip. */
  viewAllHref?: string;
  /** Optional right-side header content (e.g., search, day navigator). */
  headerExtra?: ReactNode;
  /** Optional extra content rendered to the right of the centered "Ver todos" link. */
  footerExtra?: ReactNode;
  /** Optional integer shown as a muted pill in the header. */
  count?: number | null;
  /** Hide the header entirely (e.g. when the user disabled `showHeader`). */
  showHeader?: boolean;
  /** Hide the footer entirely. Defaults to true. */
  showFooter?: boolean;
  /** Optional border accent color — overrides the default `border-border`. */
  borderColor?: WidgetBorderColor;
  /**
   * Top accent stripe color. When BOTH `accentColor` and `accentShade` are
   * provided, a thin colored bar is rendered flush at the top of the card
   * (mirrors the gallery card design). When either is missing, no stripe
   * renders — backward compatible with existing callers.
   */
  accentColor?: WidgetAccentColor;
  accentShade?: WidgetAccentShade;
  className?: string;
  children: ReactNode;
}

export function WidgetCard({
  title,
  icon,
  viewAllHref,
  headerExtra,
  footerExtra,
  count,
  showHeader = true,
  showFooter = true,
  borderColor,
  accentColor,
  accentShade,
  className,
  children,
}: WidgetCardProps) {
  const chrome = useWidgetChrome();
  const canRename = chrome.isEditing && !!chrome.onRenameCommit;
  const renderFooter = showFooter && (viewAllHref || footerExtra);

  // Inline rename state — the title swaps to an <input> in place (no modal).
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);
  // config.title is the source of truth; fall back to a plain-string title.
  const seedTitle =
    chrome.currentTitle ?? (typeof title === "string" ? title : "");

  const beginRename = useCallback(() => {
    if (!canRename) return;
    setDraftTitle(seedTitle);
    setEditingTitle(true);
  }, [canRename, seedTitle]);

  const commitRename = useCallback(() => {
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== seedTitle) chrome.onRenameCommit?.(trimmed);
    setEditingTitle(false);
  }, [draftTitle, seedTitle, chrome]);

  const cancelRename = useCallback(() => setEditingTitle(false), []);

  // The tile's pencil button bumps renameSignal to start inline editing.
  const lastSignal = useRef(chrome.renameSignal ?? 0);
  useEffect(() => {
    const sig = chrome.renameSignal ?? 0;
    if (sig !== lastSignal.current) {
      lastSignal.current = sig;
      beginRename();
    }
  }, [chrome.renameSignal, beginRename]);

  useEffect(() => {
    if (editingTitle) titleInputRef.current?.select();
  }, [editingTitle]);
  // When the caller provides an `accentColor`, the card border itself adopts
  // that color/shade (auto-derived — there's no longer a separate borderColor
  // config field). Falls back to the legacy `borderColor` prop for any caller
  // that hasn't migrated yet, then to the neutral `border-border` token.
  const accentClasses = accentColor
    ? resolveAccentClasses(accentColor, accentShade ?? "500")
    : null;
  const borderClass = accentClasses?.cardBorder ?? borderClassFor(borderColor);
  const stripeClass = accentClasses?.dot ?? null;
  return (
    <div
      className={`h-full w-full flex flex-col min-h-0 rounded-lg bg-card border ${borderClass} shadow-sm overflow-hidden ${
        className ?? ""
      }`}
    >
      {stripeClass && (
        <div className={`h-1.5 w-full shrink-0 ${stripeClass}`} />
      )}
      {showHeader && (title || icon || headerExtra || count != null) && (
        <div className="relative z-30 flex items-center justify-between gap-3 px-3 h-9 border-b border-border shrink-0 bg-muted/30">
          <div className="flex items-center gap-2 min-w-0">
            {icon}
            {title &&
              (editingTitle ? (
                <input
                  ref={titleInputRef}
                  type="text"
                  value={draftTitle}
                  maxLength={WIDGET_TITLE_MAX}
                  autoFocus
                  onChange={(e) => setDraftTitle(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitRename();
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      cancelRename();
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="min-w-0 flex-1 h-6 -my-0.5 px-1 text-sm font-semibold rounded bg-background border border-primary/60 outline-none focus:ring-1 focus:ring-ring text-secondary-foreground"
                />
              ) : canRename ? (
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    beginRename();
                  }}
                  title="Clique duas vezes para renomear"
                  className="flex min-w-0 items-center -mx-1 rounded px-1 cursor-text transition-colors hover:bg-accent/60"
                >
                  <h3 className="text-sm font-semibold text-secondary-foreground truncate">
                    {title}
                  </h3>
                </button>
              ) : (
                <h3 className="text-sm font-semibold text-secondary-foreground truncate">
                  {title}
                </h3>
              ))}
            {count != null && (
              <span className="shrink-0 rounded-md bg-muted/70 text-muted-foreground text-[10px] font-medium tabular-nums px-1.5 py-0.5">
                {count}
              </span>
            )}
          </div>
          {headerExtra && (
            <div className="flex items-center gap-2 shrink-0">{headerExtra}</div>
          )}
        </div>
      )}
      <div className="relative flex-1 min-h-0 overflow-hidden">{children}</div>
      {renderFooter && (
        <div className="relative flex items-center justify-center px-3 h-7 border-t border-border shrink-0 bg-muted/30">
          {viewAllHref && (
            <Link
              to={viewAllHref}
              className="group flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-primary transition-colors"
            >
              Ver todos
              <IconChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
          {footerExtra && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
              {footerExtra}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
