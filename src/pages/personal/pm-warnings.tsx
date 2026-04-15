import { routes } from "../../constants";
import { PageHeader } from "@/components/ui/page-header";
import { WarningList } from "@/components/human-resources/warning/list";
import { usePageTracker } from "@/hooks/common/use-page-tracker";

export const PmWarningsPage = () => {
  usePageTracker({ title: "Advertências", icon: "alert-triangle" });

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4">
      <PageHeader
        variant="list"
        title="Advertências"
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Pessoal", href: routes.personal.root },
          { label: "Advertências" },
        ]}
        className="flex-shrink-0"
      />
      <div className="flex-1 min-h-0 pb-6 flex flex-col">
        <WarningList className="h-full" />
      </div>
    </div>
  );
};

export default PmWarningsPage;
