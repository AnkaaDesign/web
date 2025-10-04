import { PageHeader } from "@/components/ui/page-header";
import { HolidaysList } from "@/components/integrations/secullum/holidays/list";

export function MyHolidaysPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader title="Feriados" subtitle="Feriados e datas comemorativas do calendário" />
      <HolidaysList />
    </div>
  );
}

export default MyHolidaysPage;
