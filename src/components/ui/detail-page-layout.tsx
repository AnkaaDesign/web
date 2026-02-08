import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  DETAIL_PAGE_SPACING,
  getDetailGridClasses,
} from "@/lib/layout-constants";
import { PageHeader, PageHeaderProps } from "@/components/ui/page-header";
import { SectionVisibilityManager } from "@/components/ui/section-visibility-manager";
import { useSectionVisibility } from "@/hooks/common/use-section-visibility";
import type { SectionConfig } from "@/hooks/common/use-section-visibility";

interface DetailPageLayoutProps {
  /** Page header configuration */
  header: Omit<PageHeaderProps, "variant">;

  /** Main content to render (sections/cards) */
  children: ReactNode;

  /** Optional section visibility configuration */
  sectionConfig?: {
    /** Unique storage key for localStorage */
    storageKey: string;
    /** Section definitions */
    sections: SectionConfig[];
  };

  /** Custom className for the container */
  className?: string;

  /** Custom className for the content grid */
  gridClassName?: string;

  /** Whether to use a grid layout (default: true) */
  useGrid?: boolean;

  /** Loading state */
  isLoading?: boolean;

  /** Error state */
  error?: Error | null;

  /** Custom loading component */
  loadingComponent?: ReactNode;

  /** Custom error component */
  errorComponent?: ReactNode;
}

/**
 * Standardized layout wrapper for detail pages
 *
 * Provides:
 * - Consistent spacing between header and content
 * - Optional section visibility management
 * - Responsive grid layout for sections
 * - Loading and error states
 *
 * @example
 * ```tsx
 * <DetailPageLayout
 *   header={{
 *     title: "Task Details",
 *     breadcrumbs: [...],
 *     actions: [...]
 *   }}
 *   sectionConfig={{
 *     storageKey: "task-detail-visibility",
 *     sections: [...]
 *   }}
 * >
 *   <TaskOverviewCard />
 *   <TaskDatesCard />
 * </DetailPageLayout>
 * ```
 */
export function DetailPageLayout({
  header,
  children,
  sectionConfig,
  className,
  gridClassName,
  useGrid = true,
  isLoading = false,
  error = null,
  loadingComponent,
  errorComponent,
}: DetailPageLayoutProps) {
  const sectionVisibility = sectionConfig
    ? useSectionVisibility(sectionConfig.storageKey, sectionConfig.sections)
    : null;

  // Show loading state
  if (isLoading) {
    return (
      <div className={cn("h-full flex flex-col", DETAIL_PAGE_SPACING.CONTAINER, className)}>
        {loadingComponent || (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-2">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className={cn("h-full flex flex-col", DETAIL_PAGE_SPACING.CONTAINER, className)}>
        {errorComponent || (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-2">
              <p className="text-sm font-semibold text-destructive">Error loading data</p>
              <p className="text-xs text-muted-foreground">{error.message}</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Enhance header actions with section visibility manager
  const enhancedActions = header.actions ? [...header.actions] : [];
  if (sectionVisibility && sectionConfig) {
    enhancedActions.push({
      key: "section-visibility",
      label: (
        <SectionVisibilityManager
          sections={sectionConfig.sections}
          visibilityState={sectionVisibility.visibilityState}
          onToggleSection={sectionVisibility.toggleSection}
          onToggleField={sectionVisibility.toggleField}
          onReset={sectionVisibility.resetToDefaults}
        />
      ) as any,
      onClick: () => {},
      hideOnMobile: false,
    });
  }

  return (
    <div className={cn("h-full flex flex-col", DETAIL_PAGE_SPACING.CONTAINER, className)}>
      {/* Page Header */}
      <div className="flex-shrink-0">
        <PageHeader
          {...header}
          variant="detail"
          actions={enhancedActions}
        />
      </div>

      {/* Main Content Grid */}
      <div
        className={cn(
          "flex-1 overflow-auto",
          DETAIL_PAGE_SPACING.HEADER_TO_GRID,
          useGrid && getDetailGridClasses(),
          gridClassName
        )}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * Wrapper for individual sections within DetailPageLayout
 * Integrates with section visibility system
 */
interface DetailSectionProps {
  /** Unique section ID (must match SectionConfig id) */
  sectionId: string;

  /** Section content */
  children: ReactNode;

  /** Custom className */
  className?: string;

  /** Whether section should span full width in grid */
  fullWidth?: boolean;

  /** Section visibility hook (from parent) */
  visibility?: ReturnType<typeof useSectionVisibility>;
}

export function DetailSection({
  sectionId,
  children,
  className,
  fullWidth = false,
  visibility,
}: DetailSectionProps) {
  // If visibility management is enabled, check if section is visible
  if (visibility && !visibility.isSectionVisible(sectionId)) {
    return null;
  }

  return (
    <div
      className={cn(
        "animate-in fade-in-50 duration-500",
        fullWidth && DETAIL_PAGE_SPACING.FULL_WIDTH,
        className
      )}
      data-section-id={sectionId}
    >
      {children}
    </div>
  );
}

/**
 * Wrapper for individual fields within sections
 * Integrates with field visibility system
 */
interface DetailFieldProps {
  /** Unique field ID (must match FieldConfig id) */
  fieldId: string;

  /** Field content */
  children: ReactNode;

  /** Custom className */
  className?: string;

  /** Field visibility hook (from parent) */
  visibility?: ReturnType<typeof useSectionVisibility>;
}

export function DetailField({
  fieldId,
  children,
  className,
  visibility,
}: DetailFieldProps) {
  // If visibility management is enabled, check if field is visible
  if (visibility && !visibility.isFieldVisible(fieldId)) {
    return null;
  }

  return (
    <div className={className} data-field-id={fieldId}>
      {children}
    </div>
  );
}
