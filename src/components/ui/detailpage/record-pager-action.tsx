import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import type { PageAction } from "@/components/ui/page-header";
import type { RecordNavigation } from "./use-record-navigation";

/**
 * The prev/next record widget: `‹  N / total  ›`.
 *
 * Extracted from `DetailPage` because the Orçamento and Faturamento detail pages are multi-step
 * WIZARDS, not `DetailPage`s — they render their own `PageHeader` and so have to push this control
 * themselves. A second copy of the JSX would be a third place for the control to drift.
 *
 * Renders `null` when there is no list context (`total === 0`, which `useRecordNavigation` also
 * reports for a stale deep link whose id is not in the list).
 */
export function RecordPager({ nav, keyboard }: { nav: RecordNavigation; keyboard?: boolean }) {
  if (nav.total <= 0) return null;
  // ←/→ is only advertised where the hook actually binds it. On a form page the shortcut is off
  // (the guard only skips FOCUSED inputs, so a stray ← would page away mid-edit), and promising it
  // in a tooltip that does nothing is worse than not mentioning it.
  const hint = keyboard === false ? "" : " (←)";
  const hintNext = keyboard === false ? "" : " (→)";
  return (
    <div className="flex items-center gap-1">
      {/* h-9 w-9 to match the size="sm" triggers ("Seções", "Exportar") sitting beside it. */}
      <Button variant="outline" size="icon" className="h-9 w-9" disabled={!nav.hasPrev} onClick={nav.goPrev} title={`Registro anterior${hint}`}>
        <IconChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-[3.5rem] px-1 text-center text-sm tabular-nums text-muted-foreground">
        {nav.position} / {nav.total}
      </span>
      <Button variant="outline" size="icon" className="h-9 w-9" disabled={!nav.hasNext} onClick={nav.goNext} title={`Próximo registro${hintNext}`}>
        <IconChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

/**
 * The same widget as a `PageAction`, for `DetailPage`, which has no `headerExtra` slot of its own.
 *
 * The two wizard pages deliberately do NOT use this: an action lands to the RIGHT of `headerExtra`
 * and therefore directly beside the wizard's own "Anterior / Próximo", where two adjacent pairs of
 * arrows read as one control. They render `<RecordPager>` inside `headerExtra` instead, which puts
 * it left of "Ver Dossiê" / "Ver Orçamento" and clear of the step buttons.
 *
 * Returns `null` when there is no list context, so the caller can just spread it.
 */
export function recordPagerAction(nav: RecordNavigation, opts?: { keyboard?: boolean }): PageAction | null {
  if (nav.total <= 0) return null;
  return {
    key: "record-nav",
    // `ActionsDropdown` stringifies labels, so a ReactNode label MUST stay off the mobile menu.
    hideOnMobile: true,
    label: <RecordPager nav={nav} keyboard={opts?.keyboard} />,
  };
}
