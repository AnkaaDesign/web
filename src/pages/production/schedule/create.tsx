import { UnderConstruction } from "@/components/navigation/under-construction";

export const ScheduleCreate = () => {
  return (
    <div className="h-full">
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto space-y-4 pb-6">
            <UnderConstruction title="Criar Cronograma" />
          </div>
        </div>
      </div>
    </div>
  );
};
