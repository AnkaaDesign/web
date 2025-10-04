import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

// =====================
// Statistics Card Skeleton
// =====================

interface StatisticsCardSkeletonProps {
  showChart?: boolean;
  cardCount?: number;
  chartHeight?: number;
}

export function StatisticsCardSkeleton({
  showChart = true,
  cardCount = 1,
  chartHeight = 300,
}: StatisticsCardSkeletonProps) {
  return (
    <>
      {Array.from({ length: cardCount }).map((_, index) => (
        <Card key={index} className="w-full">
          <CardHeader className="space-y-2">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent className="space-y-4">
            {showChart && (
              <div className="space-y-2">
                <Skeleton className={`h-[${chartHeight}px] w-full rounded-md`} />
                <div className="flex justify-center space-x-4">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
}

// =====================
// Chart Skeleton
// =====================

interface ChartSkeletonProps {
  type?: 'line' | 'bar' | 'pie' | 'area';
  height?: number;
  showLegend?: boolean;
  showAxes?: boolean;
}

export function ChartSkeleton({
  type = 'line',
  height = 300,
  showLegend = true,
  showAxes = true,
}: ChartSkeletonProps) {
  const renderChart = () => {
    switch (type) {
      case 'pie':
        return (
          <div className="flex items-center justify-center">
            <Skeleton className="h-48 w-48 rounded-full" />
          </div>
        );
      case 'bar':
        return (
          <div className="flex items-end justify-between space-x-2 px-4">
            {Array.from({ length: 8 }).map((_, i) => {
              const height = Math.random() * 150 + 50;
              return (
                <Skeleton key={i} className={`w-8 rounded-t-sm`} style={{ height: `${height}px` }} />
              );
            })}
          </div>
        );
      case 'area':
      case 'line':
      default:
        return (
          <div className="relative px-4 pb-4">
            <svg className="w-full" style={{ height: height - 60 }}>
              <path
                d={`M 10 ${height - 80} Q 100 ${height - 120} 200 ${height - 100} T 400 ${height - 110} T 600 ${height - 90}`}
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-muted-foreground/20"
              />
              <circle cx="10" cy={height - 80} r="3" className="fill-muted-foreground/20" />
              <circle cx="200" cy={height - 100} r="3" className="fill-muted-foreground/20" />
              <circle cx="400" cy={height - 110} r="3" className="fill-muted-foreground/20" />
              <circle cx="600" cy={height - 90} r="3" className="fill-muted-foreground/20" />
            </svg>
          </div>
        );
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>

      <div
        className="relative border rounded-lg bg-background p-4"
        style={{ height }}
      >
        {showAxes && type !== 'pie' && (
          <>
            {/* Y-axis */}
            <div className="absolute left-2 top-4 bottom-8 flex flex-col justify-between text-xs">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-3 w-8" />
              ))}
            </div>

            {/* X-axis */}
            <div className="absolute bottom-2 left-8 right-4 flex justify-between text-xs">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-3 w-12" />
              ))}
            </div>
          </>
        )}

        <div className="ml-8 mr-4 mt-4 mb-8 h-full">
          {renderChart()}
        </div>
      </div>

      {showLegend && (
        <div className="flex flex-wrap justify-center gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center space-x-2">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// =====================
// Metrics Grid Skeleton
// =====================

interface MetricsGridSkeletonProps {
  columns?: number;
  rows?: number;
  showTrend?: boolean;
}

export function MetricsGridSkeleton({
  columns = 4,
  rows = 2,
  showTrend = true,
}: MetricsGridSkeletonProps) {
  return (
    <div className={`grid gap-4 grid-cols-1 md:grid-cols-${Math.min(columns, 4)}`}>
      {Array.from({ length: rows * columns }).map((_, index) => (
        <Card key={index}>
          <CardContent className="p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-4 rounded" />
            </div>
            <div className="space-y-1">
              <Skeleton className="h-8 w-20" />
              {showTrend && (
                <div className="flex items-center space-x-2">
                  <Skeleton className="h-3 w-3" />
                  <Skeleton className="h-3 w-16" />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// =====================
// Table Skeleton
// =====================

interface TableSkeletonProps {
  columns?: number;
  rows?: number;
  showHeader?: boolean;
  showActions?: boolean;
}

export function TableSkeleton({
  columns = 5,
  rows = 10,
  showHeader = true,
  showActions = true,
}: TableSkeletonProps) {
  return (
    <div className="space-y-4">
      {/* Table Header */}
      {showHeader && (
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <div className="flex space-x-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
      )}

      {/* Table Content */}
      <div className="border rounded-lg">
        {/* Table Header Row */}
        <div className="border-b bg-muted/50 p-4">
          <div className="flex items-center space-x-4">
            {Array.from({ length: columns }).map((_, i) => (
              <Skeleton key={i} className="h-4 flex-1" />
            ))}
            {showActions && <Skeleton className="h-4 w-16" />}
          </div>
        </div>

        {/* Table Rows */}
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="border-b last:border-b-0 p-4">
            <div className="flex items-center space-x-4">
              {Array.from({ length: columns }).map((_, colIndex) => (
                <div key={colIndex} className="flex-1">
                  {colIndex === 0 ? (
                    <Skeleton className="h-5 w-3/4" />
                  ) : (
                    <Skeleton className="h-4 w-1/2" />
                  )}
                </div>
              ))}
              {showActions && (
                <div className="flex space-x-2">
                  <Skeleton className="h-6 w-6 rounded" />
                  <Skeleton className="h-6 w-6 rounded" />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-32" />
        <div className="flex space-x-2">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>
    </div>
  );
}

// =====================
// Filter Bar Skeleton
// =====================

export function FilterBarSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex flex-wrap items-end gap-4">
          {/* Period Selector */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-32" />
          </div>

          {/* Date Range */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <div className="flex space-x-2">
              <Skeleton className="h-10 w-32" />
              <Skeleton className="h-10 w-32" />
            </div>
          </div>

          {/* Filters */}
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-36" />
            </div>
          ))}

          {/* Actions */}
          <div className="flex space-x-2 ml-auto">
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// =====================
// Dashboard Grid Skeleton
// =====================

export function DashboardGridSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex space-x-2">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>

      {/* Filter Bar */}
      <FilterBarSkeleton />

      {/* Metrics Grid */}
      <MetricsGridSkeleton columns={4} rows={1} />

      {/* Charts Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        <StatisticsCardSkeleton chartHeight={350} />
        <StatisticsCardSkeleton chartHeight={350} />
      </div>

      {/* Large Chart */}
      <StatisticsCardSkeleton chartHeight={400} />

      {/* Data Table */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <TableSkeleton rows={8} />
        </CardContent>
      </Card>
    </div>
  );
}

// =====================
// Loading States for Different Chart Types
// =====================

export function PieChartSkeleton() {
  return <ChartSkeleton type="pie" height={350} showAxes={false} />;
}

export function BarChartSkeleton() {
  return <ChartSkeleton type="bar" height={300} />;
}

export function LineChartSkeleton() {
  return <ChartSkeleton type="line" height={300} />;
}

export function AreaChartSkeleton() {
  return <ChartSkeleton type="area" height={300} />;
}

// =====================
// Specialized Statistics Skeletons
// =====================

export function StockAnalysisSkeleton() {
  return (
    <div className="space-y-6">
      <MetricsGridSkeleton columns={3} rows={1} />
      <div className="grid gap-6 md:grid-cols-2">
        <AreaChartSkeleton />
        <BarChartSkeleton />
      </div>
      <LineChartSkeleton />
    </div>
  );
}

export function ActivityAnalysisSkeleton() {
  return (
    <div className="space-y-6">
      <MetricsGridSkeleton columns={4} rows={1} />
      <div className="grid gap-6 lg:grid-cols-3">
        <PieChartSkeleton />
        <BarChartSkeleton />
        <AreaChartSkeleton />
      </div>
      <TableSkeleton columns={6} rows={5} />
    </div>
  );
}

export function PerformanceMetricsSkeleton() {
  return (
    <div className="space-y-6">
      <MetricsGridSkeleton columns={2} rows={2} showTrend />
      <div className="grid gap-6 md:grid-cols-2">
        <LineChartSkeleton />
        <BarChartSkeleton />
      </div>
    </div>
  );
}