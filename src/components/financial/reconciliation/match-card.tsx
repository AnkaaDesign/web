import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { IconArrowUpRight } from "@tabler/icons-react";

interface Props {
  /** Destination URL — typically opens the matched entity's detail dialog. */
  to: string;
  /** Used in the cue label as "Abrir <linkLabel> ↗". Lowercase, no article. */
  linkLabel: string;
  /** Optional side effect on click (e.g. close the current modal). */
  onNavigate?: () => void;
  /**
   * Optional destructive action rendered in the footer-right (e.g. Desvincular).
   * The element MUST call preventDefault + stopPropagation in its onClick to
   * avoid the parent Link consuming the click.
   */
  action?: ReactNode;
  children: ReactNode;
}

/**
 * Shared card design for a confirmed-match row. Used on BOTH sides of the
 * transaction↔NF link so the cross-link affordance feels symmetric:
 * - same emerald border + hover state
 * - same focus ring
 * - same "Abrir … ↗" cue in the footer-left
 * - same slot for an optional action button on the footer-right
 *
 * Both ManualMatchDialog (TX → NF) and FiscalDocumentDetailSheet (NF → TX)
 * render this. If you tweak the visual treatment, both sides update together.
 */
export function MatchCard({
  to,
  linkLabel,
  onNavigate,
  action,
  children,
}: Props) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className="block rounded-md bg-background/70 dark:bg-background/40 border border-emerald-500/30 p-3 text-sm hover:border-emerald-500/60 hover:bg-emerald-50/30 dark:hover:bg-emerald-500/15 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
    >
      {children}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1 font-medium">
          Abrir {linkLabel}
          <IconArrowUpRight className="h-3 w-3" />
        </span>
        {action}
      </div>
    </Link>
  );
}
