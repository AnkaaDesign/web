import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { IconChevronRight, IconHome2 } from "@tabler/icons-react";
import { MENU_ITEMS, routes } from "../../constants";
import { getBreadcrumbs } from "../../utils";
import { fixNavigationPath } from "@/utils/route-validation";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items?: BreadcrumbItem[];
  onNavigate?: (path: string) => void;
}

export function Breadcrumb({ items, onNavigate }: BreadcrumbProps = {}) {
  const location = useLocation();
  const navigate = useNavigate();

  // Use custom items if provided, otherwise get from menu structure
  const breadcrumbs = items
    ? items.map((item, index) => ({
        id: `custom-${index}`,
        title: item.label,
        path: item.href,
      }))
    : getBreadcrumbs(MENU_ITEMS, location.pathname);

  // Don't show breadcrumbs on the home page itself (unless custom items provided)
  if (!items && (location.pathname === "/" || location.pathname === "")) {
    return null;
  }

  const handleBreadcrumbClick = (path?: string) => {
    if (path) {
      const fixedPath = fixNavigationPath(path);
      if (onNavigate) {
        onNavigate(fixedPath);
      } else {
        navigate(fixedPath);
      }
    }
  };

  // Check if we're using custom items and if the first item is already "Início"
  const showHomeIcon = !items || items[0]?.label !== "Início";

  return (
    <nav className="flex items-center space-x-1 text-sm text-muted-foreground">
      {/* Home link - only show if not already in custom items */}
      {showHomeIcon && (
        <>
          <button onClick={() => onNavigate ? onNavigate(routes.home) : navigate(routes.home)} className="flex items-center gap-1 hover:text-foreground transition-colors">
            <IconHome2 className="w-4 h-4" />
            <span>Início</span>
          </button>
          {breadcrumbs.length > 0 && <IconChevronRight className="w-4 h-4" />}
        </>
      )}

      {breadcrumbs.map((crumb: { id: string; title: string; path?: string }, index: number) => {
        const isLast = index === breadcrumbs.length - 1;
        const canNavigate = crumb.path && !isLast;
        const isHome = crumb.title === "Início" && index === 0;

        return (
          <React.Fragment key={crumb.id}>
            {index > 0 && <IconChevronRight className="w-4 h-4" />}
            {canNavigate ? (
              <button onClick={() => handleBreadcrumbClick(crumb.path)} className="flex items-center gap-1 hover:text-foreground transition-colors max-w-[200px]" title={crumb.title}>
                {isHome && <IconHome2 className="w-4 h-4 shrink-0" />}
                <span className="truncate">{crumb.title}</span>
              </button>
            ) : (
              <span className={cn("flex items-center gap-1 max-w-[200px]", isLast && "text-foreground font-medium")}>
                {isHome && <IconHome2 className="w-4 h-4 shrink-0" />}
                <span className="truncate" title={crumb.title}>{crumb.title}</span>
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
