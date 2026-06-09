// Shared building blocks for the widget configuration UI.
//
// Centralises the pieces that used to be copy-pasted (and to drift) across the
// add/configure modals and every widget's ConfigComponent:
//   - CONFIG_DIALOG_CONTENT_CLASS — the single source of truth for the fixed
//     1080×800 dialog footprint (with viewport caps).
//   - WidgetConfigDialog          — the shell: fixed header / scrolling body /
//     optional sticky footer. The shell owns scrolling, so ConfigComponents must
//     NOT add their own `max-h-[Nvh] overflow-y-auto` wrapper.
//   - TitleField                  — the canonical "Título" input every widget
//     reuses (single validation rule, single layout).
//   - SELECT_TILE_*               — one selection-state vocabulary for the
//     size / color / icon pickers so "selected" looks identical everywhere.

import { type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { cn } from "../../lib/utils";

// Max title length — mirrors the `z.string().min(1).max(80)` every widget uses
// for `config.title`. Kept here so the inline rename input (WidgetCard) and
// TitleField enforce the exact same rule the schema validates on save.
export const WIDGET_TITLE_MAX = 80;

/**
 * Single source of truth for the big config-dialog footprint. A fixed
 * 1080×800 with viewport caps so it never jumps when inner sections expand,
 * and still fits small screens. `gap-0 p-0` because the shell manages its own
 * header/body/footer padding.
 */
export const CONFIG_DIALOG_CONTENT_CLASS =
  "w-[min(1080px,calc(100vw-2rem))] max-w-[min(1080px,calc(100vw-2rem))] " +
  "h-[min(800px,calc(100vh-2rem))] max-h-[calc(100vh-2rem)] " +
  "flex flex-col gap-0 p-0 overflow-hidden";

interface WidgetConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  /** Fixed (non-scrolling) content directly under the header — search, tabs. */
  headerExtra?: ReactNode;
  /** Sticky footer (e.g. Cancelar / Aplicar). When omitted, no footer renders. */
  footer?: ReactNode;
  /** Extra classes for the scrolling body wrapper. */
  bodyClassName?: string;
  /** Draw a divider under the headerExtra zone. Default true. */
  headerExtraBordered?: boolean;
  /** When true the body is NOT padded/scrolled by the shell (caller owns it). */
  rawBody?: boolean;
  children: ReactNode;
}

/**
 * The shell shared by every large config dialog. Header and footer stay fixed;
 * only the middle scrolls. One ScrollArea, one padding system, one size.
 */
export function WidgetConfigDialog({
  open,
  onOpenChange,
  title,
  description,
  headerExtra,
  footer,
  bodyClassName,
  headerExtraBordered = true,
  rawBody = false,
  children,
}: WidgetConfigDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={CONFIG_DIALOG_CONTENT_CLASS}>
        <DialogHeader className="shrink-0 space-y-1 border-b border-border px-6 pb-4 pt-6 text-left">
          <DialogTitle className="pr-8">{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        {headerExtra ? (
          <div
            className={cn(
              "shrink-0 px-6 py-3",
              headerExtraBordered && "border-b border-border",
            )}
          >
            {headerExtra}
          </div>
        ) : null}
        {rawBody ? (
          <div className={cn("flex-1 min-h-0", bodyClassName)}>{children}</div>
        ) : (
          // Plain overflow container (not Radix ScrollArea) so `position: sticky`
          // works for the per-widget config tab bar. `-mx-6` on WidgetTabsBar
          // counteracts this `px-6` to span full width.
          <div className={cn("flex-1 min-h-0 overflow-y-auto px-6 pt-5 pb-6", bodyClassName)}>
            {children}
          </div>
        )}
        {footer ? (
          <DialogFooter className="shrink-0 gap-2 border-t border-border bg-muted/20 px-6 py-4">
            {footer}
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Sticky bar that pins the tab strip (TabsList) to the top of the scrolling
 * config body while the tab content scrolls underneath. Lives as the first
 * child inside a widget's `<Tabs>`. `-mx-6` spans the dialog body's `px-6`
 * padding so the bar's background fully covers content scrolling beneath it.
 */
export function WidgetTabsBar({ children }: { children: ReactNode }) {
  return (
    <div className="sticky top-0 z-10 -mx-6 mb-3 border-b border-border bg-card px-6 pb-2.5 pt-1">
      {children}
    </div>
  );
}

/**
 * Canonical "Título" field. Every widget's ConfigComponent renders this instead
 * of hand-rolling a Label + Input + helper block, so the title editor is
 * pixel-identical everywhere and validates like the schema (1–80 chars).
 */
export function TitleField({
  value,
  onChange,
  hint = "Texto exibido no cabeçalho do widget. Recebe a cor de destaque.",
}: {
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="widget-title" className="text-xs font-medium">
        Título
      </Label>
      <Input
        id="widget-title"
        value={value}
        maxLength={WIDGET_TITLE_MAX}
        onChange={(v) => onChange(typeof v === "string" ? v : String(v ?? ""))}
        placeholder="Título do widget"
      />
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Selection-tile token vocabulary — shared by the size / icon pickers so a
// "selected" tile reads the same across the whole config UI. (Color swatches
// keep their own ring+check treatment because the swatch IS the color.)
// ---------------------------------------------------------------------------

export const SELECT_TILE_BASE =
  "relative rounded-md border-[1.5px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";
export const SELECT_TILE_ACTIVE =
  "border-primary bg-primary text-primary-foreground shadow-sm";
export const SELECT_TILE_INACTIVE =
  "border-border bg-muted/30 text-foreground hover:bg-accent hover:border-primary/40";
export const SELECT_TILE_DISABLED =
  "border-border/40 opacity-30 cursor-not-allowed";
