/**
 * DashboardCard Component
 * Consistent card container for dashboard charts
 */

import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MoreVertical, Maximize2, RefreshCw, Download, Settings } from 'lucide-react';

export interface DashboardCardProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  className?: string;
  contentClassName?: string;

  // Actions
  onExpand?: () => void;
  onRefresh?: () => void;
  onExport?: () => void;
  onSettings?: () => void;
  onRemove?: () => void;

  // Drag handle (for rearrangeable dashboards)
  draggable?: boolean;
  dragHandleProps?: any;

  // Loading state
  isLoading?: boolean;
  isRefreshing?: boolean;
}

export const DashboardCard = React.memo<DashboardCardProps>(({
  children,
  title,
  subtitle,
  icon,
  className,
  contentClassName,
  onExpand,
  onRefresh,
  onExport,
  onSettings,
  onRemove,
  draggable = false,
  dragHandleProps,
  isLoading = false,
  isRefreshing = false,
}) => {
  const hasActions = onExpand || onRefresh || onExport || onSettings || onRemove;

  return (
    <Card className={cn('w-full h-full flex flex-col', className)}>
      <CardHeader className="flex-shrink-0 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            {draggable && (
              <div
                {...dragHandleProps}
                className="flex-shrink-0 mt-1 cursor-move text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="9" cy="5" r="1" />
                  <circle cx="9" cy="12" r="1" />
                  <circle cx="9" cy="19" r="1" />
                  <circle cx="15" cy="5" r="1" />
                  <circle cx="15" cy="12" r="1" />
                  <circle cx="15" cy="19" r="1" />
                </svg>
              </div>
            )}

            {icon && (
              <div className="flex-shrink-0 mt-0.5 text-primary">
                {icon}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold leading-tight text-foreground truncate">
                {title}
              </h3>
              {subtitle && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {hasActions && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 flex-shrink-0"
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onExpand && (
                  <DropdownMenuItem onClick={onExpand}>
                    <Maximize2 className="h-4 w-4 mr-2" />
                    Expandir
                  </DropdownMenuItem>
                )}
                {onRefresh && (
                  <DropdownMenuItem onClick={onRefresh} disabled={isRefreshing}>
                    <RefreshCw className={cn('h-4 w-4 mr-2', isRefreshing && 'animate-spin')} />
                    Atualizar
                  </DropdownMenuItem>
                )}
                {onExport && (
                  <DropdownMenuItem onClick={onExport}>
                    <Download className="h-4 w-4 mr-2" />
                    Exportar
                  </DropdownMenuItem>
                )}
                {onSettings && (
                  <DropdownMenuItem onClick={onSettings}>
                    <Settings className="h-4 w-4 mr-2" />
                    Configurações
                  </DropdownMenuItem>
                )}
                {onRemove && (
                  <>
                    <DropdownMenuItem
                      onClick={onRemove}
                      className="text-destructive focus:text-destructive"
                    >
                      Remover
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </CardHeader>

      <CardContent className={cn('flex-1 pt-0 min-h-0', contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
});

DashboardCard.displayName = 'DashboardCard';
