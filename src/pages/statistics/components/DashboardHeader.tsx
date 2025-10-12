/**
 * Dashboard Header Component
 *
 * Displays:
 * - Title and breadcrumbs
 * - Global date range selector
 * - Quick action buttons
 * - Export/share buttons
 */

import { useState } from "react";
import { PageHeaderWithFavorite } from "@/components/ui/page-header-with-favorite";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  IconChartBar,
  IconRefresh,
  IconDownload,
  IconShare,
  IconCalendar,
  IconFilter,
  IconSettings,
} from "@tabler/icons-react";
import { routes, FAVORITE_PAGES } from "@/constants";
import { getDateRangePresets } from "../utils/dashboard-helpers";

export interface DashboardHeaderProps {
  title?: string;
  onRefresh?: () => void;
  onExport?: () => void;
  onShare?: () => void;
  onDateRangeChange?: (start: Date, end: Date) => void;
  onFilterClick?: () => void;
  onSettingsClick?: () => void;
  isRefreshing?: boolean;
  lastUpdated?: Date;
}

/**
 * Dashboard Header Component
 */
export function DashboardHeader({
  title = "Dashboard de Estatísticas",
  onRefresh,
  onExport,
  onShare,
  onDateRangeChange,
  onFilterClick,
  onSettingsClick,
  isRefreshing = false,
  lastUpdated,
}: DashboardHeaderProps) {
  const [selectedPreset, setSelectedPreset] = useState("last30days");
  const dateRangePresets = getDateRangePresets();

  const handlePresetSelect = (presetValue: string) => {
    setSelectedPreset(presetValue);
    const preset = dateRangePresets.find((p) => p.value === presetValue);
    if (preset && onDateRangeChange) {
      onDateRangeChange(preset.start, preset.end);
    }
  };

  const currentPreset = dateRangePresets.find((p) => p.value === selectedPreset);

  return (
    <div className="space-y-4">
      <PageHeaderWithFavorite
        title={title}
        icon={IconChartBar}
        favoritePage={FAVORITE_PAGES.ESTATISTICAS}
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Estatísticas" },
        ]}
      />

      <div className="flex items-center justify-between gap-4 flex-wrap">
        {/* Date Range Selector */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <IconCalendar className="h-4 w-4" />
                {currentPreset?.label || "Selecionar período"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {dateRangePresets.map((preset) => (
                <DropdownMenuItem
                  key={preset.value}
                  onClick={() => handlePresetSelect(preset.value)}
                  className={selectedPreset === preset.value ? "bg-accent" : ""}
                >
                  {preset.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {lastUpdated && (
            <span className="text-sm text-muted-foreground">
              Atualizado: {lastUpdated.toLocaleTimeString("pt-BR")}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {onFilterClick && (
            <Button variant="outline" size="sm" onClick={onFilterClick}>
              <IconFilter className="h-4 w-4" />
            </Button>
          )}

          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
            >
              <IconRefresh
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <IconDownload className="h-4 w-4 mr-2" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onExport}>
                Exportar como PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onExport}>
                Exportar como Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onExport}>
                Exportar como CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {onShare && (
            <Button variant="outline" size="sm" onClick={onShare}>
              <IconShare className="h-4 w-4 mr-2" />
              Compartilhar
            </Button>
          )}

          {onSettingsClick && (
            <Button variant="outline" size="sm" onClick={onSettingsClick}>
              <IconSettings className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
