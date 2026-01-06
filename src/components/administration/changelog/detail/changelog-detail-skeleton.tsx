import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { IconHistory } from "@tabler/icons-react";

export function ChangelogDetailSkeleton() {
  return (
    <div className="flex flex-col h-full space-y-6">
      <PageHeader
        variant="detail"
        title="Carregando..."
        icon={IconHistory}
        breadcrumbs={[{ label: "Início", href: "/" }, { label: "Administração" }, { label: "Histórico de Alterações" }, { label: "..." }]}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="space-y-6">
          {/* Core Information Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-sm border border-border">
              <CardHeader className="pb-6">
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                <div className="space-y-3">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="bg-muted/50 rounded-lg px-4 py-3">
                      <Skeleton className="h-4 w-full" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border border-border">
              <CardHeader className="pb-6">
                <Skeleton className="h-6 w-36" />
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                <div className="space-y-3">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="bg-muted/50 rounded-lg px-4 py-3">
                      <Skeleton className="h-4 w-full" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Metadata and Triggered By Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="shadow-sm border border-border">
              <CardHeader className="pb-6">
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-muted/50 rounded-lg px-4 py-3">
                      <Skeleton className="h-4 w-full" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border border-border">
              <CardHeader className="pb-6">
                <Skeleton className="h-6 w-44" />
              </CardHeader>
              <CardContent className="pt-0 space-y-4">
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="bg-muted/50 rounded-lg px-4 py-3">
                      <Skeleton className="h-4 w-full" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
