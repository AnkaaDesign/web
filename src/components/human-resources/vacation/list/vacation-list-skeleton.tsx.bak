export function VacationListSkeleton() {
  return (
    <div className="bg-background rounded-xl shadow-sm border overflow-hidden">
      <div className="h-full flex flex-col">
        {/* Header Skeleton */}
        <div className="flex-shrink-0 p-4 border-b bg-card/50">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 flex flex-col sm:flex-row gap-2">
              <div className="flex-1">
                <div className="h-10 bg-muted animate-pulse rounded-md" />
              </div>
              <div className="h-10 w-24 bg-muted animate-pulse rounded-md" />
            </div>
          </div>
        </div>

        {/* Table Skeleton */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-auto">
            <table className="w-full">
              <thead className="bg-muted/50 border-b sticky top-0 z-10">
                <tr>
                  <th className="w-12 p-4">
                    <div className="h-4 w-4 bg-muted animate-pulse rounded" />
                  </th>
                  <th className="p-4 text-left">
                    <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                  </th>
                  <th className="p-4 text-left">
                    <div className="h-4 w-20 bg-muted animate-pulse rounded" />
                  </th>
                  <th className="p-4 text-left">
                    <div className="h-4 w-12 bg-muted animate-pulse rounded" />
                  </th>
                  <th className="p-4 text-left">
                    <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                  </th>
                  <th className="p-4 text-center">
                    <div className="h-4 w-16 bg-muted animate-pulse rounded mx-auto" />
                  </th>
                  <th className="p-4 text-center">
                    <div className="h-4 w-12 bg-muted animate-pulse rounded mx-auto" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 10 }).map((_, index) => (
                  <tr key={index} className="border-b">
                    <td className="p-4">
                      <div className="h-4 w-4 bg-muted animate-pulse rounded" />
                    </td>
                    <td className="p-4">
                      <div className="space-y-2">
                        <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                        <div className="flex gap-2">
                          <div className="h-5 w-16 bg-muted animate-pulse rounded-full" />
                          <div className="h-5 w-20 bg-muted animate-pulse rounded-full" />
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="h-4 w-24 bg-muted animate-pulse rounded" />
                    </td>
                    <td className="p-4">
                      <div className="h-6 w-20 bg-muted animate-pulse rounded-full" />
                    </td>
                    <td className="p-4">
                      <div className="h-6 w-20 bg-muted animate-pulse rounded-full" />
                    </td>
                    <td className="p-4 text-center">
                      <div className="h-4 w-8 bg-muted animate-pulse rounded mx-auto" />
                    </td>
                    <td className="p-4">
                      <div className="h-8 w-8 bg-muted animate-pulse rounded mx-auto" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination Skeleton */}
        <div className="flex-shrink-0 border-t bg-card/50 p-4">
          <div className="flex items-center justify-between">
            <div className="h-4 w-32 bg-muted animate-pulse rounded" />
            <div className="flex gap-2">
              <div className="h-8 w-8 bg-muted animate-pulse rounded" />
              <div className="h-8 w-8 bg-muted animate-pulse rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
