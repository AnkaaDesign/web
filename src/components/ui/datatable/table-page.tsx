import { useRef, type ReactNode } from "react";
import type { Icon as TablerIcon } from "@tabler/icons-react";
import { PageHeader, type PageAction } from "@/components/ui/page-header";
import { cn } from "@/lib/utils";
import { DataTable, type DataTableProps } from "./data-table";
import { useScrollHideHeader } from "./use-scroll-hide-header";
import type { FAVORITE_PAGES } from "@/constants";

export interface DataTablePageProps<TData> {
  // --- page header ---
  title: string | ReactNode;
  subtitle?: string | ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  actions?: PageAction[];
  icon?: TablerIcon;
  favoritePage?: FAVORITE_PAGES;
  headerExtra?: ReactNode;
  /** Hide the header on scroll-down / reveal on scroll-up (performant). Default: true. */
  scrollHideHeader?: boolean;
  pageClassName?: string;
  // --- table ---
  table: DataTableProps<TData>;
}

/**
 * The canonical "table page" layout: a page header on top (which performantly
 * collapses on scroll-down and reveals on scroll-up) and a card that fills the
 * remaining height, inside which ONLY the table body scrolls.
 *
 * The header collapse is driven by the table's own scroll container via
 * `useScrollHideHeader` (rAF + ref/DOM mutation) — the table never re-renders
 * while scrolling.
 */
export function DataTablePage<TData>({
  title,
  subtitle,
  breadcrumbs,
  actions,
  icon,
  favoritePage,
  headerExtra,
  scrollHideHeader = true,
  pageClassName,
  table,
}: DataTablePageProps<TData>) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLDivElement | null>(null);

  useScrollHideHeader({ scrollRef, headerRef, enabled: scrollHideHeader });

  return (
    <div className={cn("flex h-full flex-col bg-background p-4", pageClassName)}>
      {/* Collapsible header: grid-rows 1fr→0fr is a smooth, measure-free collapse.
          The top padding + the gap below the header live INSIDE the collapsing area,
          so when it hides on scroll there is no empty space left at the top. */}
      <div
        ref={headerRef}
        data-hidden="false"
        className="grid shrink-0 grid-rows-[1fr] transition-[grid-template-rows] duration-200 ease-out will-change-[grid-template-rows] data-[hidden=true]:grid-rows-[0fr]"
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pb-3">
            <PageHeader
              variant="list"
              title={title}
              subtitle={subtitle}
              breadcrumbs={breadcrumbs}
              actions={actions}
              icon={icon}
              favoritePage={favoritePage}
              headerExtra={headerExtra}
            />
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <DataTable<TData> {...table} scrollContainerRef={scrollRef} />
      </div>
    </div>
  );
}
