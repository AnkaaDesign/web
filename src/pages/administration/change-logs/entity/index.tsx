import { useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import { IconHistory } from "@tabler/icons-react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { routes, CHANGE_LOG_ENTITY_TYPE, CHANGE_LOG_ENTITY_TYPE_LABELS } from "../../../../constants";
import {
  userService,
  itemService,
  getItemBrands,
  getItemCategories,
  taskService,
  orderService,
  customerService,
  supplierService,
  paintService,
  paintTypeService,
  paintProductionService,
  maintenanceService,
  borrowService,
  activityService,
  airbrushingService,
  externalWithdrawalService,
  positionService,
  sectorService,
  bonusService,
  ppeDeliveryService,
  fileService,
  notificationService,
  vacationService,
  observationService,
  serviceOrderService,
} from "../../../../api-client";

// Service mapping for each entity type with proper method names
const getEntityService = (entityType: string) => {
  const serviceMap: Record<string, any> = {
    [CHANGE_LOG_ENTITY_TYPE.USER]: {
      getMany: async (params: any) => {
        return await userService.getUsers(params);
      },
    },
    [CHANGE_LOG_ENTITY_TYPE.ITEM]: {
      getMany: async (params: any) => {
        return await itemService.getItems(params);
      },
    },
    [CHANGE_LOG_ENTITY_TYPE.ITEM_BRAND]: {
      getMany: async (params: any) => {
        return await getItemBrands(params);
      },
    },
    [CHANGE_LOG_ENTITY_TYPE.ITEM_CATEGORY]: {
      getMany: async (params: any) => {
        return await getItemCategories(params);
      },
    },
    [CHANGE_LOG_ENTITY_TYPE.TASK]: {
      getMany: async (params: any) => {
        return await taskService.getTasks(params);
      },
    },
    [CHANGE_LOG_ENTITY_TYPE.ORDER]: {
      getMany: async (params: any) => {
        return await orderService.getOrders(params);
      },
    },
    [CHANGE_LOG_ENTITY_TYPE.CUSTOMER]: {
      getMany: async (params: any) => {
        return await customerService.getCustomers(params);
      },
    },
    [CHANGE_LOG_ENTITY_TYPE.SUPPLIER]: {
      getMany: async (params: any) => {
        return await supplierService.getSuppliers(params);
      },
    },
    [CHANGE_LOG_ENTITY_TYPE.PAINT]: {
      getMany: async (params: any) => {
        return await paintService.getPaints(params);
      },
    },
    [CHANGE_LOG_ENTITY_TYPE.PAINT_TYPE]: {
      getMany: async (params: any) => {
        return await paintTypeService.getPaintTypes(params);
      },
    },
    [CHANGE_LOG_ENTITY_TYPE.PAINT_PRODUCTION]: {
      getMany: async (params: any) => {
        return await paintProductionService.getPaintProductions(params);
      },
    },
    [CHANGE_LOG_ENTITY_TYPE.MAINTENANCE]: {
      getMany: async (params: any) => {
        return await maintenanceService.getMaintenances(params);
      },
    },
    [CHANGE_LOG_ENTITY_TYPE.BORROW]: {
      getMany: async (params: any) => {
        return await borrowService.getBorrows(params);
      },
    },
    [CHANGE_LOG_ENTITY_TYPE.ACTIVITY]: {
      getMany: async (params: any) => {
        return await activityService.getActivities(params);
      },
    },
    [CHANGE_LOG_ENTITY_TYPE.AIRBRUSHING]: {
      getMany: async (params: any) => {
        return await airbrushingService.getAirbrushings(params);
      },
    },
    [CHANGE_LOG_ENTITY_TYPE.EXTERNAL_WITHDRAWAL]: {
      getMany: async (params: any) => {
        return await externalWithdrawalService.getExternalWithdrawals(params);
      },
    },
    [CHANGE_LOG_ENTITY_TYPE.POSITION]: {
      getMany: async (params: any) => {
        return await positionService.getPositions(params);
      },
    },
    [CHANGE_LOG_ENTITY_TYPE.SECTOR]: {
      getMany: async (params: any) => {
        return await sectorService.getSectors(params);
      },
    },
    [CHANGE_LOG_ENTITY_TYPE.BONUS]: {
      getMany: async (params: any) => {
        return await bonusService.getMany(params);
      },
    },
    [CHANGE_LOG_ENTITY_TYPE.PPE_DELIVERY]: {
      getMany: async (params: any) => {
        return await ppeDeliveryService.getPpeDeliveries(params);
      },
    },
    [CHANGE_LOG_ENTITY_TYPE.FILE]: {
      getMany: async (params: any) => {
        return await fileService.getFiles(params);
      },
    },
    [CHANGE_LOG_ENTITY_TYPE.NOTIFICATION]: {
      getMany: async (params: any) => {
        return await notificationService.getNotifications(params);
      },
    },
    [CHANGE_LOG_ENTITY_TYPE.VACATION]: {
      getMany: async (params: any) => {
        return await vacationService.getVacations(params);
      },
    },
    [CHANGE_LOG_ENTITY_TYPE.PRODUCTION]: {
      getMany: async (params: any) => {
        return await observationService.getObservations(params);
      },
    },
    [CHANGE_LOG_ENTITY_TYPE.SERVICE_ORDER]: {
      getMany: async (params: any) => {
        return await serviceOrderService.getServiceOrders(params);
      },
    },
  };
  return serviceMap[entityType];
};

// Get display label for entity
const getEntityDisplayLabel = (entity: unknown, entityType: string): string => {
  const typedEntity = entity as Record<string, any>;
  // Special cases first
  if (entityType === CHANGE_LOG_ENTITY_TYPE.USER) {
    return typedEntity.name || typedEntity.email || typedEntity.id?.substring(0, 8);
  }
  if (entityType === CHANGE_LOG_ENTITY_TYPE.CUSTOMER) {
    return typedEntity.fantasyName || typedEntity.name || typedEntity.email || typedEntity.id?.substring(0, 8);
  }
  if (entityType === CHANGE_LOG_ENTITY_TYPE.SUPPLIER) {
    return typedEntity.fantasyName || typedEntity.name || typedEntity.id?.substring(0, 8);
  }
  if (entityType === CHANGE_LOG_ENTITY_TYPE.TASK) {
    const code = typedEntity.taskCode ? `#${typedEntity.taskCode}` : "";
    const desc = typedEntity.description || typedEntity.title || "";
    return code && desc ? `${code} - ${desc}` : code || desc || typedEntity.id?.substring(0, 8);
  }
  if (entityType === CHANGE_LOG_ENTITY_TYPE.ORDER) {
    return typedEntity.orderCode ? `Pedido #${typedEntity.orderCode}` : `Pedido ${typedEntity.id?.substring(0, 8)}`;
  }
  if (entityType === CHANGE_LOG_ENTITY_TYPE.PAINT) {
    return typedEntity.paintCode || typedEntity.name || typedEntity.description || typedEntity.id?.substring(0, 8);
  }
  if (entityType === CHANGE_LOG_ENTITY_TYPE.ITEM) {
    const barcode = typedEntity.barcode ? `[${typedEntity.barcode}]` : "";
    const name = typedEntity.name || typedEntity.description || "";
    return barcode && name ? `${barcode} ${name}` : barcode || name || typedEntity.id?.substring(0, 8);
  }
  if (entityType === CHANGE_LOG_ENTITY_TYPE.MAINTENANCE) {
    return typedEntity.description || typedEntity.maintenanceCode || typedEntity.id?.substring(0, 8);
  }
  if (entityType === CHANGE_LOG_ENTITY_TYPE.VACATION) {
    const userName = typedEntity.user?.name || "";
    const dates = typedEntity.startDate ? `(${new Date(typedEntity.startDate).toLocaleDateString("pt-BR")})` : "";
    return userName && dates ? `${userName} ${dates}` : userName || dates || typedEntity.id?.substring(0, 8);
  }
  if (entityType === CHANGE_LOG_ENTITY_TYPE.BONUS) {
    const userName = typedEntity.user?.name || "";
    const value = typedEntity.value ? `R$ ${typedEntity.value.toFixed(2)}` : "";
    return userName && value ? `${userName} - ${value}` : userName || value || typedEntity.id?.substring(0, 8);
  }

  // Common patterns for entity labels
  if (typedEntity.name) return typedEntity.name;
  if (typedEntity.fantasyName) return typedEntity.fantasyName;
  if (typedEntity.description) return typedEntity.description;
  if (typedEntity.title) return typedEntity.title;
  if (typedEntity.code) return typedEntity.code;

  // Fallback to ID
  return typedEntity.id?.substring(0, 8) || "Unknown";
};

export default function ChangeLogEntitySelector() {
  const navigate = useNavigate();

  // State for entity selector
  const [selectedEntityType, setSelectedEntityType] = useState<string>("");
  const [selectedEntityId, setSelectedEntityId] = useState<string>("");

  // Get sorted entity types for the select
  const sortedEntityTypes = useMemo(() => {
    return Object.entries(CHANGE_LOG_ENTITY_TYPE_LABELS)
      .sort(([, a], [, b]) => a.localeCompare(b, "pt-BR"))
      .map(([value, label]) => ({ value, label }));
  }, []);

  // Query function for async combobox
  const queryEntities = useCallback(
    async (search: string) => {
      if (!selectedEntityType) return [];

      const service = getEntityService(selectedEntityType);
      if (!service?.getMany) {
        // Some entities might not have services yet
        console.warn(`No service found for entity type: ${selectedEntityType}`);
        return [];
      }

      try {
        const response = await service.getMany({
          searchingFor: search,
          limit: 20,
          page: 1,
        });
        return response.data || [];
      } catch (error) {
        console.error("Error fetching entities:", error);
        return [];
      }
    },
    [selectedEntityType],
  );

  // Handle view changelog
  const handleViewChangelog = () => {
    if (selectedEntityType && selectedEntityId) {
      navigate(routes.administration.changeLogs.entity(selectedEntityType, selectedEntityId));
    }
  };

  // Handle entity type change
  const handleEntityTypeChange = (value: string) => {
    setSelectedEntityType(value);
    setSelectedEntityId(""); // Clear entity selection when type changes
  };

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="flex-shrink-0">
        <div className="px-4 pt-4">
          <div className="max-w-3xl mx-auto">
            <PageHeader
              variant="form"
              title="Histórico por Entidade"
              icon={IconHistory}
              breadcrumbs={[
                { label: "Início", href: "/" },
                { label: "Administração", href: "/administracao" },
                { label: "Histórico de Alterações", href: routes.administration.changeLogs.root },
                { label: "Por Entidade" },
              ]}
              actions={[
                {
                  key: "view",
                  label: "Visualizar Histórico",
                  icon: IconHistory,
                  onClick: handleViewChangelog,
                  disabled: !selectedEntityType || !selectedEntityId,
                  variant: "default",
                },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Form Container */}
      <div className="flex-1 min-h-0 p-4">
        <div className="max-w-3xl mx-auto">
          <Card className="shadow-sm border border-border">
            <CardContent className="p-6">
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-1">Selecionar Entidade</h3>
                  <p className="text-sm text-muted-foreground">Escolha o tipo de entidade e depois selecione a entidade específica para visualizar seu histórico de alterações.</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="entity-type">Tipo de Entidade</Label>
                    <Combobox
                      value={selectedEntityType}
                      onValueChange={(value) => handleEntityTypeChange(value || "")}
                      options={sortedEntityTypes}
                      placeholder="Selecione o tipo de entidade"
                      emptyText="Nenhum tipo encontrado"
                    />
                  </div>

                  {selectedEntityType && (
                    <div className="space-y-2">
                      <Label htmlFor="entity">Entidade Específica</Label>
                      <Combobox
                        value={selectedEntityId}
                        onValueChange={(value) => setSelectedEntityId(value || "")}
                        placeholder="Pesquisar entidade..."
                        emptyText="Nenhuma entidade encontrada"
                        searchPlaceholder="Digite para buscar..."
                        async={true}
                        queryKey={["entities", selectedEntityType]}
                        queryFn={queryEntities}
                        getOptionLabel={(entity: unknown) => getEntityDisplayLabel(entity, selectedEntityType)}
                        getOptionValue={(entity: unknown) => (entity as any).id}
                        renderOption={(entity: unknown) => {
                          const typedEntity = entity as Record<string, any>;
                          return (
                            <div className="flex flex-col">
                              <span className="font-medium">{getEntityDisplayLabel(entity, selectedEntityType)}</span>
                              {typedEntity.description && typedEntity.description !== getEntityDisplayLabel(entity, selectedEntityType) && (
                                <span className="text-xs text-muted-foreground">{typedEntity.description}</span>
                              )}
                              {typedEntity.email && <span className="text-xs text-muted-foreground">{typedEntity.email}</span>}
                            </div>
                          );
                        }}
                        disabled={!selectedEntityType}
                      />
                    </div>
                  )}
                </div>

                {selectedEntityType && selectedEntityId && (
                  <div className="bg-muted/50 rounded-lg p-4 mt-6">
                    <div className="flex items-center gap-3">
                      <IconHistory className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-sm font-medium">Pronto para visualizar</p>
                        <p className="text-xs text-muted-foreground">Clique no botão acima para ver o histórico de alterações desta entidade.</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
