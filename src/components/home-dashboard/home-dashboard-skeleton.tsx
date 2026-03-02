export function HomeDashboardSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-pulse">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="bg-card border border-border rounded-lg shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <div className="h-4 w-4 bg-muted rounded" />
            <div className="h-4 w-24 bg-muted rounded" />
          </div>
          <div className="p-4 space-y-3">
            {[0, 1, 2].map((j) => (
              <div key={j} className="flex items-center gap-3">
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 bg-muted rounded" style={{ width: `${60 + (j * 10)}%` }} />
                  <div className="h-2.5 bg-muted rounded" style={{ width: `${40 + (j * 5)}%` }} />
                </div>
                <div className="h-3 w-16 bg-muted rounded" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
