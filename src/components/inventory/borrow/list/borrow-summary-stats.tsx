import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { IconPackageExport, IconPackageImport, IconPackages } from "@tabler/icons-react";
import { formatNumber } from "../../../../utils";
import { cn } from "@/lib/utils";

interface BorrowSummaryStatsProps {
  activeCount: number;
  returnedCount: number;
  totalCount: number;
  isLoading?: boolean;
  className?: string;
}

export function BorrowSummaryStats({ activeCount, returnedCount, totalCount, isLoading = false, className }: BorrowSummaryStatsProps) {
  const stats = [
    {
      title: "Empréstimos Ativos",
      value: activeCount,
      icon: IconPackageExport,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Devolvidos",
      value: returnedCount,
      icon: IconPackageImport,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Total de Empréstimos",
      value: totalCount,
      icon: IconPackages,
      color: "text-gray-600",
      bgColor: "bg-gray-50",
    },
  ];

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-4", className)}>
      {stats.map((stat) => (
        <Card key={stat.title} className="hover:shadow-sm transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <div className={cn("p-2 rounded-lg", stat.bgColor)}>
                <stat.icon className={cn("h-4 w-4", stat.color)} />
              </div>
            </div>
          </CardHeader>
          <CardContent>{isLoading ? <Skeleton className="h-8 w-20" /> : <div className="text-2xl font-bold">{formatNumber(stat.value)}</div>}</CardContent>
        </Card>
      ))}
    </div>
  );
}
