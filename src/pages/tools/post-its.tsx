// post-its.tsx
// Página Ferramentas › Post-its. A interação (canvas livre, arrastar/redimensionar,
// zoom/pan, cores, arquivar) vive no componente compartilhado `PostitBoard`
// (web/src/components/postits/postit-board.tsx), que é REUTILIZADO pelo widget
// de Post-its na Home — ambos consomem `usePostits` (mesma cache do react-query),
// então são literalmente os mesmos post-its.

import { IconNote } from "@tabler/icons-react";

import { FAVORITE_PAGES, routes } from "@/constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { PostitBoard } from "@/components/postits/postit-board";

export function PostItsPage() {
  usePageTracker({ title: "Post-its", icon: "note" });

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <PageHeader
        title="Post-its"
        icon={IconNote}
        favoritePage={FAVORITE_PAGES.FERRAMENTAS_POST_ITS}
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Ferramentas", href: routes.tools.root },
          { label: "Post-its" },
        ]}
        className="flex-shrink-0"
      />

      <div className="flex-1 min-h-0 flex flex-col pb-6">
        <Card className="flex-1 min-h-0 flex flex-col border border-border shadow-sm overflow-hidden">
          <CardContent className="p-3 flex flex-col flex-1 min-h-0">
            <PostitBoard className="flex-1" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default PostItsPage;
