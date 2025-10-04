import { type Service } from "../../../../types";
import { formatDateTime } from "../../../../utils";
import { CHANGE_LOG_ENTITY_TYPE } from "../../../../constants";
import { ChangelogHistory } from "@/components/ui/changelog-history";

interface ServiceDetailsProps {
  service: Service;
}

export const ServiceDetails = ({ service }: ServiceDetailsProps) => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Service Information */}
      <div className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">Informações do Serviço</h3>

          <div>
            <p className="text-sm text-muted-foreground">Descrição</p>
            <p className="font-medium">{service.description}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Criado em</p>
            <p className="font-medium">{formatDateTime(service.createdAt)}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Atualizado em</p>
            <p className="font-medium">{formatDateTime(service.updatedAt)}</p>
          </div>
        </div>
      </div>

      {/* Changelog History */}
      <div>
        <ChangelogHistory
          entityType={CHANGE_LOG_ENTITY_TYPE.SERVICE}
          entityId={service.id}
          entityName={service.description}
          entityCreatedAt={service.createdAt}
          className="h-full"
          maxHeight="400px"
        />
      </div>
    </div>
  );
};
