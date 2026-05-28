// pages/questionnaire/mine.tsx
//
// Resolver for /pessoal/questionarios. There is no standalone list page — when
// the user has an OPEN/PENDING questionnaire entry, we redirect straight to its
// fill page; otherwise we show a minimal empty state. The Pessoal sidebar item
// is also conditionally hidden when there's nothing pending, so this page is
// effectively the safety net for direct URL hits.

import { Navigate } from "react-router-dom";
import { IconClipboardCheck, IconLoader2 } from "@tabler/icons-react";

import { routes } from "@/constants";
import { useMyPendingQuestionnaireEntries } from "@/hooks/questionnaire/use-questionnaire-entry";
import { Card, CardContent } from "@/components/ui/card";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const MyQuestionnairesPage = () => {
  usePageTracker({ title: "Questionários", icon: "clipboard-list" });
  const { data, isLoading } = useMyPendingQuestionnaireEntries();
  const pending = ((data?.data ?? []) as any[]).filter((e) => e.status !== "SUBMITTED");

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <IconLoader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (pending.length > 0) {
    // First pending entry — the user will submit it, then a refresh routes
    // them to the next pending one (or to the empty state below).
    return <Navigate to={routes.questionnaire.fill(pending[0].id)} replace />;
  }

  return (
    <div className="flex h-full items-center justify-center px-4">
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
          <IconClipboardCheck className="h-10 w-10 text-muted-foreground" />
          <h2 className="text-lg font-semibold">Nenhum questionário aberto</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            Você não tem questionários pendentes no momento.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default MyQuestionnairesPage;
