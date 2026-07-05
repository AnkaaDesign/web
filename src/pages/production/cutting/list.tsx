import { CutTablePage } from "@/components/production/cut/table";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export default function CutListPage() {
  // Track page access
  usePageTracker({
    title: "Lista de Recortes",
    icon: "scissors",
  });

  return <CutTablePage />;
}
