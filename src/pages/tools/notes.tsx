// notes.tsx
// Página Ferramentas › Notas. A interação (canvas livre no modo "postit" ou
// quadro de cards no modo "board", arrastar/redimensionar, zoom/pan, cores,
// compartilhamento, arquivar) vive no componente compartilhado `NoteBoard`
// (web/src/components/notes/note-board.tsx), REUTILIZADO pelo widget de Notas na
// Home — ambos consomem `useNotes` (mesma cache do react-query), então são
// literalmente as mesmas notas.

import { useRef } from "react";
import { IconNote, IconPlus } from "@tabler/icons-react";

import { FAVORITE_PAGES, routes } from "@/constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { NoteBoard, type NoteBoardHandle } from "@/components/notes/note-board";

export function NotesPage() {
  usePageTracker({ title: "Notas", icon: "note" });
  const boardRef = useRef<NoteBoardHandle>(null);

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <PageHeader
        title="Notas"
        icon={IconNote}
        favoritePage={FAVORITE_PAGES.FERRAMENTAS_NOTAS}
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Ferramentas", href: routes.tools.root },
          { label: "Notas" },
        ]}
        className="flex-shrink-0"
        actions={[
          {
            key: "add-note",
            label: "Adicionar",
            icon: IconPlus,
            onClick: () => boardRef.current?.addNote(),
          },
        ]}
      />

      <div className="flex-1 min-h-0 flex flex-col pb-6">
        <Card className="flex-1 min-h-0 flex flex-col border border-border shadow-sm overflow-hidden">
          <CardContent className="p-3 flex flex-col flex-1 min-h-0">
            <NoteBoard
              ref={boardRef}
              className="flex-1"
              showViewToggle
              defaultViewMode="postit"
              showAddButton={false}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default NotesPage;
