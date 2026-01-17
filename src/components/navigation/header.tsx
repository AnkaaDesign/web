import React from "react";
import { useSidebar } from "@/contexts/sidebar-context";
import { useTheme } from "@/contexts/theme-context";
import { cn } from "@/lib/utils";
import { IconMenu2 } from "@tabler/icons-react";

export const Header: React.FC = () => {
  const { toggle } = useSidebar();
  const { theme } = useTheme();

  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <header
      className={cn(
        "border-b border-border px-4 py-3 w-full h-16 flex items-center justify-between transition-colors bg-card",
      )}
    >
      {/* Left side - App title */}
      <div className="flex items-center gap-4">
        <img src="/logo.png" alt="Ankaa Logo" className="h-12" />
      </div>

      {/* Right side - Hamburger menu */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          className={cn(
            "w-12 h-12 rounded-lg flex items-center justify-center transition-colors",
            isDark ? "hover:bg-neutral-800 text-neutral-100" : "hover:bg-neutral-100 text-neutral-700",
          )}
        >
          <IconMenu2 width={20} height={20} />
        </button>
      </div>
    </header>
  );
};
