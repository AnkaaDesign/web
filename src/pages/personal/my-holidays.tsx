import { PageHeader } from "@/components/ui/page-header";
import { HolidaysList } from "@/components/integrations/secullum/holidays/list";

export function MyHolidaysPage() {
  return (
    <div className="h-full flex flex-col px-4 pt-4">
      <div className="flex-shrink-0">
        <PageHeader
          title="Feriados"
          subtitle="Feriados e datas comemorativas do calendário"
        />
      </div>
      <HolidaysList className="flex-1 min-h-0 mt-4" />
    </div>
  );
}

export default MyHolidaysPage;
