import React, { type ReactNode, useMemo } from "react";
import type { Icon as TablerIcon, IconProps as TablerIconsProps } from "@tabler/icons-react";
import { Card, CardContent } from "@/components/ui/card";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { IconRefresh, IconEdit, IconMenu2, IconArrowLeft, IconSearch, IconFilter, IconMaximize, IconMinimize } from "@tabler/icons-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { FavoriteButton } from "./favorite-button";
import { FAVORITE_PAGES } from "../../constants";

// Base entity type requirement
export interface BaseEntity {
  id: string;
  name: string;
}

// Action system for all variants
export interface PageAction {
  key: string;
  label: string | ReactNode;
  icon?: TablerIcon;
  onClick?: () => void;
  href?: string;
  variant?: "default" | "outline" | "secondary" | "destructive" | "ghost" | "link";
  size?: "sm" | "default" | "lg";
  disabled?: boolean;
  loading?: boolean;
  hidden?: boolean;
  hideOnMobile?: boolean;
  mobileOrder?: number;
  group?: "primary" | "secondary" | "danger";
  className?: string;
}

// Base props that all page types share
interface BasePageHeaderProps {
  title: string | ReactNode;
  subtitle?: string | ReactNode;
  breadcrumbs?: Array<{
    label: string;
    href?: string;
  }>;
  backButton?: {
    label?: string;
    onClick?: () => void;
    href?: string;
  };
  icon?: TablerIcon;
  className?: string;
  variant?: "default" | "detail" | "list" | "form" | "batch";
  mobileCollapsed?: boolean;
  actions?: PageAction[];
  favoritePage?: FAVORITE_PAGES;
  onBreadcrumbNavigate?: (path: string) => void;
}

// Entity-specific props for detail pages
interface EntityPageHeaderProps<T extends BaseEntity> extends BasePageHeaderProps {
  variant: "detail";
  entity?: T; // Made optional for backward compatibility

  // Status display
  status?: {
    label: string;
    variant?: "default" | "secondary" | "destructive" | "outline";
    icon?: TablerIcon;
  };

  // Key metrics for detail pages
  metrics?: Array<{
    label: string;
    value: string | number;
    icon?: TablerIcon;
    severity?: "success" | "warning" | "danger";
  }>;
}

// List page specific props
interface ListPageHeaderProps extends BasePageHeaderProps {
  variant: "list";

  // Search functionality
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
  };

  // View controls
  viewControls?: {
    // Show selected toggle
    selectedToggle?: {
      count: number;
      active: boolean;
      onToggle: (active: boolean) => void;
    };

    // View mode toggle (grid/table, minimize/maximize)
    viewMode?: {
      current: "grid" | "table" | "minimized" | "maximized";
      onModeChange: (mode: "grid" | "table" | "minimized" | "maximized") => void;
      options?: Array<{
        value: "grid" | "table" | "minimized" | "maximized";
        icon: React.ComponentType<TablerIconsProps>;
        label: string;
      }>;
    };

    // Column visibility
    columnVisibility?: {
      visible: string[];
      available: Array<{
        key: string;
        label: string;
      }>;
      onChange: (columns: string[]) => void;
    };
  };

  // Filter system
  filters?: {
    active: Array<{
      key: string;
      label: string;
      value: string;
    }>;
    onClearAll: () => void;
    onClearFilter: (key: string) => void;
    onOpenFilters: () => void;
    count?: number;
  };

  // Export functionality
  export?: {
    onExport: () => void;
    loading?: boolean;
    disabled?: boolean;
  };
}

// Form page specific props
interface FormPageHeaderProps extends BasePageHeaderProps {
  variant: "form";

  // Form progress
  progress?: {
    current: number;
    total: number;
    steps?: Array<{
      label: string;
      completed: boolean;
    }>;
  };

  // Form state
  isDirty?: boolean;
  isSubmitting?: boolean;
  hasErrors?: boolean;
}

// Batch operation specific props
interface BatchPageHeaderProps extends BasePageHeaderProps {
  variant: "batch";

  // Selection state
  selection?: {
    count: number;
    total?: number;
    entityName: string; // e.g., "fornecedores", "produtos"
    onClearSelection: () => void;
  };

  // Progress tracking
  progress?: {
    current: number;
    total: number;
    label?: string;
  };

  // Operation state
  isProcessing?: boolean;
}

// Complete PageHeader props union
type PageHeaderProps<T extends BaseEntity = BaseEntity> =
  | (BasePageHeaderProps & { variant?: "default" })
  | EntityPageHeaderProps<T>
  | ListPageHeaderProps
  | FormPageHeaderProps
  | BatchPageHeaderProps;

// Action Button Component
const ActionButton = React.memo(function ActionButton({ action }: { action: PageAction }) {
  const Icon = action.icon;

  // Check if label is a React element
  const isReactElement = React.isValidElement(action.label);

  // Ensure label is a string for string operations
  const labelString = typeof action.label === "string" ? action.label : "";
  const isIconOnly = !isReactElement && (labelString === "" || !labelString.trim());

  // Special handling for different button types (only for string labels)
  const isRefreshButton = action.key === "refresh" || action.key === "atualizar" || (!isReactElement && labelString.toLowerCase() === "atualizar");
  const isDeleteButton = action.key === "delete" || action.key === "excluir" || (!isReactElement && labelString.toLowerCase() === "excluir");
  const isEditButton = action.key === "edit" || action.key === "editar" || (!isReactElement && labelString.toLowerCase() === "editar");

  // Determine variant and styling based on button type
  let buttonVariant = action.variant || "outline";
  let buttonClassName = action.className;

  // Apply standardized pattern
  if (isDeleteButton && !action.variant) {
    buttonVariant = "destructive";
    buttonClassName = cn(buttonClassName);
  } else if (isEditButton && !action.variant) {
    buttonVariant = "default";
    // Use the project's primary green color
    buttonClassName = cn("!bg-primary !text-primary-foreground hover:!opacity-[var(--hover-opacity)]", buttonClassName);
  } else if (isRefreshButton && !action.variant) {
    buttonVariant = "outline";
    buttonClassName = cn(buttonClassName);
  }

  // For refresh buttons, always show spinning icon when loading
  const showSpinningIcon = action.loading || (isRefreshButton && action.loading);

  // If the label is a React element, render it directly
  if (isReactElement) {
    return action.label as React.ReactElement;
  }

  // If action has href, render as a link
  if (action.href) {
    return (
      <Button
        key={action.key}
        variant={buttonVariant}
        size={isIconOnly ? "icon" : action.size || "sm"}
        disabled={action.disabled}
        className={cn(!isIconOnly && "gap-2", buttonClassName)}
        asChild
      >
        <a href={action.href} className={cn("flex items-center", !isIconOnly && "gap-2")}>
          {showSpinningIcon ? <IconRefresh className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}
          {!isIconOnly && <span>{action.label}</span>}
        </a>
      </Button>
    );
  }

  // Debug logging for submit button
  if (action.key === "submit" && process.env.NODE_ENV !== 'production') {
    console.error('[PageHeader ActionButton] Rendering submit button with disabled:', action.disabled);
  }

  return (
    <Button
      key={action.key}
      variant={buttonVariant}
      size={isIconOnly ? "icon" : action.size || "sm"}
      onClick={action.onClick}
      disabled={action.disabled}
      className={cn(!isIconOnly && "gap-2", buttonClassName)}
    >
      {showSpinningIcon ? <IconRefresh className="h-4 w-4 animate-spin" /> : Icon ? <Icon className="h-4 w-4" /> : null}
      {!isIconOnly && <span>{labelString}</span>}
    </Button>
  );
});

// Actions Dropdown for Mobile
const ActionsDropdown = React.memo(function ActionsDropdown({ actions }: { actions: PageAction[] }) {
  const visibleActions = useMemo(() => actions.filter((action) => !action.hidden), [actions]);

  if (visibleActions.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="h-9 w-9">
          <IconMenu2 className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {visibleActions.map((action) => {
          const Icon = action.icon;
          // Ensure label is a string before calling trim
          const label = typeof action.label === "string" ? action.label : String(action.label || "");
          const isIconOnly = label === "" || !label.trim();

          if (action.href) {
            return (
              <DropdownMenuItem key={action.key} disabled={action.disabled} asChild>
                <a href={action.href} className="flex items-center">
                  {action.loading ? <IconRefresh className="h-4 w-4 mr-2 animate-spin" /> : Icon ? <Icon className="h-4 w-4 mr-2" /> : null}
                  {!isIconOnly ? label : Icon ? (action.key === "previous" ? "Anterior" : action.key === "next" ? "Próximo" : action.key) : action.key}
                </a>
              </DropdownMenuItem>
            );
          }

          return (
            <DropdownMenuItem key={action.key} onClick={action.onClick} disabled={action.disabled}>
              {action.loading ? <IconRefresh className="h-4 w-4 mr-2 animate-spin" /> : Icon ? <Icon className="h-4 w-4 mr-2" /> : null}
              {!isIconOnly ? label : action.key === "previous" ? "Anterior" : action.key === "next" ? "Próximo" : action.key}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});

// List Controls Component
function ListControls({
  search,
  viewControls,
  filters,
  exportOption,
}: {
  search?: ListPageHeaderProps["search"];
  viewControls?: ListPageHeaderProps["viewControls"];
  filters?: ListPageHeaderProps["filters"];
  exportOption?: ListPageHeaderProps["export"];
}) {
  return (
    <div className="space-y-3">
      {/* Search and Controls Row */}
      <div className="flex flex-col gap-3 sm:flex-row">
        {/* Search Input */}
        {search && (
          <div className="flex-1 relative">
            <IconSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder={search.placeholder || "Buscar..."}
              value={search.value}
              onChange={(value) => search.onChange(value as string)}
              disabled={search.disabled}
              className="pl-10"
            />
          </div>
        )}

        {/* Action Buttons Row */}
        <div className="flex gap-2">
          {/* Show Selected Toggle */}
          {viewControls?.selectedToggle && (
            <Button
              variant={viewControls.selectedToggle.active ? "default" : "outline"}
              size="sm"
              onClick={() => viewControls.selectedToggle!.onToggle(!viewControls.selectedToggle!.active)}
              className="gap-2"
            >
              <Badge variant="secondary" className="px-1.5 py-0.5 text-xs">
                <span>{viewControls.selectedToggle.count}</span>
              </Badge>
              Selecionados
            </Button>
          )}

          {/* View Mode Toggle */}
          {viewControls?.viewMode && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const current = viewControls.viewMode!.current;
                let next: typeof current;

                if (current === "minimized") {
                  next = "maximized";
                } else if (current === "maximized") {
                  next = "minimized";
                } else {
                  // For grid/table toggle
                  next = current === "grid" ? "table" : "grid";
                }

                viewControls.viewMode!.onModeChange(next);
              }}
              title={
                viewControls.viewMode.current === "minimized"
                  ? "Maximizar"
                  : viewControls.viewMode.current === "maximized"
                    ? "Minimizar"
                    : `Alternar para ${viewControls.viewMode.current === "grid" ? "tabela" : "grade"}`
              }
            >
              {viewControls.viewMode.current === "minimized" && <IconMaximize className="h-4 w-4" />}
              {viewControls.viewMode.current === "maximized" && <IconMinimize className="h-4 w-4" />}
              {viewControls.viewMode.current === "grid" && <IconFilter className="h-4 w-4" />}
              {viewControls.viewMode.current === "table" && <IconFilter className="h-4 w-4" />}
            </Button>
          )}

          {/* Filter Button */}
          {filters && (
            <Button variant="outline" size="sm" onClick={filters.onOpenFilters} className="group gap-2">
              <IconFilter className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
              <span className="text-foreground">Filtros</span>
              {(filters.count || filters.active.length) > 0 && (
                <Badge variant="default" className="ml-1">
                  <span>{filters.count || filters.active.length}</span>
                </Badge>
              )}
            </Button>
          )}

          {/* Export Button */}
          {exportOption && (
            <Button variant="outline" size="sm" onClick={exportOption.onExport} disabled={exportOption.disabled || exportOption.loading} className="gap-2">
              {exportOption.loading ? <IconRefresh className="h-4 w-4 animate-spin" /> : <IconRefresh className="h-4 w-4" />}
              Exportar
            </Button>
          )}
        </div>
      </div>

      {/* Filter Indicators */}
      {filters && filters.active.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Filtros ativos:</span>
          {filters.active.map((filter) => (
            <Badge
              key={filter.key}
              variant="secondary"
              className="gap-1 cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => filters.onClearFilter(filter.key)}
            >
              {filter.label}: {filter.value}
              <span className="ml-1">×</span>
            </Badge>
          ))}
          <Button variant="ghost" size="sm" onClick={filters.onClearAll} className="h-6 px-2 text-xs">
            Limpar todos
          </Button>
        </div>
      )}
    </div>
  );
}

// Progress Indicator for Forms
function FormProgress({ progress }: { progress: FormPageHeaderProps["progress"] }) {
  if (!progress) return null;

  return (
    <div className="mt-4 pt-4 border-t">
      <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
        <span>Progresso</span>
        <span>
          {progress.current} de {progress.total}
        </span>
      </div>
      <div className="w-full bg-muted rounded-full h-2">
        <div className="bg-primary h-2 rounded-full transition-all duration-300" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
      </div>
      {progress.steps && (
        <div className="flex justify-between mt-2 text-xs text-muted-foreground">
          {progress.steps.map((step, index) => (
            <span key={index} className={cn(step.completed && "text-primary font-medium")}>
              {step.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Batch Selection Info
function BatchSelectionInfo({ selection, progress }: { selection?: BatchPageHeaderProps["selection"]; progress?: BatchPageHeaderProps["progress"] }) {
  if (!selection) return null;

  return (
    <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
      <Badge variant="default">
        <span>{selection.count} selecionado{selection.count !== 1 ? "s" : ""}</span>
      </Badge>
      <span className="text-sm text-muted-foreground">{selection.entityName} selecionados</span>

      {selection.total && (
        <>
          <Separator orientation="vertical" className="h-4" />
          <span className="text-sm text-muted-foreground">de {selection.total} total</span>
        </>
      )}

      {progress && (
        <>
          <Separator orientation="vertical" className="h-4" />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>
              Processando: {progress.current}/{progress.total}
            </span>
            <div className="w-16 bg-muted rounded-full h-1">
              <div className="bg-primary h-1 rounded-full transition-all duration-300" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
            </div>
          </div>
        </>
      )}

      <div className="flex-1" />
      <Button variant="ghost" size="sm" onClick={selection.onClearSelection}>
        Limpar Seleção
      </Button>
    </div>
  );
}

/**
 * Generic page header component that provides:
 * - Entity icon and name display (detail variant)
 * - Breadcrumb navigation
 * - Search and filter controls (list variant)
 * - View mode toggles including minimize/maximize (list variant)
 * - Progress indicators (form/batch variants)
 * - Flexible action system
 * - Responsive design with mobile dropdown menu
 * - Support for all page types in the application
 */
export function PageHeader<T extends BaseEntity = BaseEntity>(props: PageHeaderProps<T>) {
  const { title, subtitle, breadcrumbs, backButton, icon: Icon, className, variant = "default", mobileCollapsed = true, actions = [], favoritePage, onBreadcrumbNavigate, ...variantProps } = props;

  // Extract specific values to avoid variantProps dependency issues
  const entity = variant === "detail" && "entity" in variantProps ? (variantProps as EntityPageHeaderProps<T>).entity : undefined;
  const onRefresh = variant === "detail" && "onRefresh" in variantProps ? (variantProps as any).onRefresh : undefined;
  const onEdit = variant === "detail" && "onEdit" in variantProps ? (variantProps as any).onEdit : undefined;
  const customActions = variant === "detail" && "customActions" in variantProps ? (variantProps as any).customActions : undefined;

  // Handle responsive action grouping
  const { primaryActions, secondaryActions, mobileActions } = useMemo(() => {
    const allActions = [...actions];

    // Add entity-specific default actions for detail pages
    if (variant === "detail") {
      // Legacy support for old DetailPageHeader props pattern
      if (onRefresh) {
        allActions.push({
          key: "refresh",
          label: "Atualizar",
          icon: IconRefresh,
          onClick: onRefresh,
          variant: "outline" as const,
          group: "secondary" as const,
        });
      }

      if (onEdit) {
        allActions.push({
          key: "edit",
          label: "Editar",
          icon: IconEdit,
          onClick: onEdit,
          variant: "default" as const,
          group: "primary" as const,
        });
      }

      if (customActions) {
        customActions.forEach((action: any, index: number) => {
          allActions.push({
            key: `custom-${index}`,
            label: action.label,
            icon: action.icon,
            onClick: action.onClick,
            variant: action.variant || "outline",
            group: action.variant === "destructive" ? "danger" : "secondary",
          });
        });
      }
    }

    const primary = allActions.filter((a) => a.group === "primary" || (!a.group && a.variant === "default"));
    const secondary = allActions.filter((a) => a.group === "secondary" || (!a.group && a.variant !== "default" && a.variant !== "destructive"));
    const danger = allActions.filter((a) => a.group === "danger" || a.variant === "destructive");
    const mobile = allActions.filter((a) => !a.hideOnMobile && !a.hidden).sort((a, b) => (a.mobileOrder || 0) - (b.mobileOrder || 0));

    return {
      primaryActions: [...primary, ...danger],
      secondaryActions: secondary,
      mobileActions: mobile,
    };
  }, [actions, variant, onRefresh, onEdit, customActions]);

  // Get entity info for detail pages (backward compatibility)
  const entityInfo = useMemo(() => {
    return entity || null;
  }, [entity]);

  // Prioritize explicit title prop over entity name
  const displayTitle = title || entityInfo?.name;

  // Extract string title for FavoriteButton (if title is ReactNode, extract text or use fallback)
  const titleString = typeof displayTitle === "string" ? displayTitle : entityInfo?.name || "Page";

  return (
    <Card className={cn("shadow-sm border border-border", className)}>
      <CardContent className="p-0">
        {/* Header Section */}
        <div className="px-4 py-3">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-1.5">
                  {/* Back Button (inline with title) */}
                  <div className="flex items-center gap-3 h-7">
                    {backButton && (
                      <Button variant="ghost" size="icon" onClick={backButton.onClick} className="shrink-0">
                        <IconArrowLeft className="h-4 w-4" />
                      </Button>
                    )}

                    {/* Page Title */}
                    <h2 className="text-base sm:text-lg font-bold leading-none">{displayTitle}</h2>

                    {/* Favorite Button */}
                    {favoritePage && <FavoriteButton page={favoritePage} pageTitle={titleString} size="sm" variant="ghost" />}

                    {/* Status Badge for Detail Pages */}
                    {variant === "detail" && (variantProps as EntityPageHeaderProps<T>).status && (
                      <Badge variant={(variantProps as EntityPageHeaderProps<T>).status!.variant || "default"}>
                        <span>{(variantProps as EntityPageHeaderProps<T>).status!.label}</span>
                      </Badge>
                    )}
                  </div>

                  {/* Subtitle */}
                  {subtitle && <div className="text-sm text-muted-foreground">{typeof subtitle === "string" ? <p>{subtitle}</p> : subtitle}</div>}

                  {/* Breadcrumb Navigation */}
                  {breadcrumbs && (
                    <div>
                      <Breadcrumb items={breadcrumbs} onNavigate={onBreadcrumbNavigate} />
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                {(primaryActions.length > 0 || secondaryActions.length > 0) && (
                  <div className="flex items-start pt-1 flex-shrink-0">
                    {/* Desktop Actions */}
                    <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
                      {secondaryActions.map((action) => (
                        <ActionButton key={action.key} action={action} />
                      ))}
                      {primaryActions.map((action) => (
                        <ActionButton key={action.key} action={action} />
                      ))}
                    </div>

                    {/* Mobile Actions Menu */}
                    {mobileCollapsed && mobileActions.length > 0 && (
                      <div className="flex sm:hidden">
                        <ActionsDropdown actions={mobileActions} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Variant-specific content */}
          {variant === "list" &&
            ((variantProps as ListPageHeaderProps).search ||
             (variantProps as ListPageHeaderProps).viewControls ||
             (variantProps as ListPageHeaderProps).filters ||
             (variantProps as ListPageHeaderProps).export) && (
            <div className="mt-4">
              <ListControls
                search={(variantProps as ListPageHeaderProps).search}
                viewControls={(variantProps as ListPageHeaderProps).viewControls}
                filters={(variantProps as ListPageHeaderProps).filters}
                exportOption={(variantProps as ListPageHeaderProps).export}
              />
            </div>
          )}

          {variant === "form" && <FormProgress progress={(variantProps as FormPageHeaderProps).progress} />}

          {variant === "batch" && (
            <div className="mt-4 pt-4 border-t">
              <BatchSelectionInfo selection={(variantProps as BatchPageHeaderProps).selection} progress={(variantProps as BatchPageHeaderProps).progress} />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Export legacy DetailPageHeader interface and props for backward compatibility
export type DetailPageHeaderProps<T extends BaseEntity> = EntityPageHeaderProps<T> & {
  // Legacy props mapping
  onRefresh?: () => void;
  onEdit?: () => void;
  customActions?: Array<{
    label: string;
    icon: TablerIcon;
    onClick: () => void;
    variant?: "default" | "outline" | "secondary" | "destructive" | "ghost" | "link";
  }>;
  breadcrumbItems?: Array<{
    label: string;
    href?: string;
  }>;
  onBack?: () => void;
  backLabel?: string;
};

// Legacy DetailPageHeader component for backward compatibility
export function DetailPageHeader<T extends BaseEntity>(props: DetailPageHeaderProps<T>) {
  const { entity, onRefresh, onEdit, customActions, breadcrumbItems, onBack, backLabel, ...restProps } = props;

  return (
    <PageHeader<T>
      {...restProps}
      variant="detail"
      entity={entity}
      title={entity?.name || "Entity"}
      breadcrumbs={breadcrumbItems}
      backButton={
        onBack
          ? {
              label: backLabel,
              onClick: onBack,
            }
          : undefined
      }
      // Convert legacy props to new action system
      actions={[
        ...(onRefresh
          ? [
              {
                key: "refresh",
                label: "Atualizar",
                icon: IconRefresh,
                onClick: onRefresh,
                variant: "outline" as const,
              },
            ]
          : []),
        ...(customActions?.map((action, index) => ({
          key: `custom-${index}`,
          label: action.label,
          icon: action.icon,
          onClick: action.onClick,
          variant: action.variant || ("outline" as const),
        })) || []),
        ...(onEdit
          ? [
              {
                key: "edit",
                label: "Editar",
                icon: IconEdit,
                onClick: onEdit,
                variant: "default" as const,
              },
            ]
          : []),
      ]}
    />
  );
}

// Re-export types for convenience
export type { PageHeaderProps };
