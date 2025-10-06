import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useTruck, useLayoutsByTruck, useLayoutMutations } from "../../../../hooks";
import { routes, CHANGE_LOG_ENTITY_TYPE, LAYOUT_SIDE, LAYOUT_SIDE_LABELS } from "../../../../constants";
import { IconTruck, IconRefresh, IconEdit, IconLayout, IconDownload } from "@tabler/icons-react";
import { toast } from "sonner";
import { ChangelogHistory } from "@/components/ui/changelog-history";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "../../../../utils";
import type { LayoutCreateFormData } from "../../../../schemas";

const TruckLayoutPreview = ({ truck }: { truck: any }) => {
  const [selectedSide, setSelectedSide] = useState<'left' | 'right' | 'back'>('left');

  const generatePreviewSVG = (layout: any, side: string) => {
    if (!layout || !layout.sections || layout.sections.length === 0) {
      return `
        <svg width="400" height="200" viewBox="0 0 400 200" xmlns="http://www.w3.org/2000/svg">
          <text x="200" y="100" text-anchor="middle" fill="#666" font-family="Arial, sans-serif" font-size="14">
            Nenhum layout disponível
          </text>
        </svg>
      `;
    }

    const sections = layout.sections;
    const totalWidth = sections.reduce((sum: number, section: any) => sum + (section.width || 0), 0);
    const height = layout.height || 240;

    const scale = Math.min(800 / (totalWidth * 100), 400 / (height * 100));
    const svgWidth = totalWidth * 100 * scale + 100;
    const svgHeight = height * 100 * scale + 150;

    const taskName = truck.task?.name || truck.task?.plate || 'Caminhão';
    const sideLabels = { left: 'Motorista', right: 'Sapo', back: 'Traseira' };
    const sideLabel = sideLabels[side as keyof typeof sideLabels];

    let svg = `
      <svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#333" />
          </marker>
        </defs>

        <!-- Title and side label -->
        <text x="50" y="30" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="#333">
          ${taskName} - ${sideLabel}
        </text>
    `;

    let currentX = 50;
    const layoutY = 80;
    const layoutHeight = height * 100 * scale;

    // Draw sections
    sections.forEach((section: any, index: number) => {
      const sectionWidth = (section.width || 0) * 100 * scale;

      // Section rectangle
      svg += `
        <rect x="${currentX}" y="${layoutY}" width="${sectionWidth}" height="${layoutHeight}"
              fill="none" stroke="#333" stroke-width="2"/>
      `;

      // Door if present
      if (section.hasDoor && section.doors && section.doors.length > 0) {
        section.doors.forEach((door: any) => {
          const doorOffset = (door.offset || 0) * 100 * scale;
          const doorWidth = (door.width || 60) * scale;

          svg += `
            <rect x="${currentX + doorOffset}" y="${layoutY}" width="${doorWidth}" height="${layoutHeight}"
                  fill="none" stroke="#666" stroke-width="1" stroke-dasharray="5,5"/>
            <text x="${currentX + doorOffset + doorWidth/2}" y="${layoutY + layoutHeight/2}"
                  text-anchor="middle" font-family="Arial, sans-serif" font-size="10" fill="#666">
              PORTA
            </text>
          `;
        });
      }

      currentX += sectionWidth;
    });

    // Width measurement arrow
    const arrowY = layoutY + layoutHeight + 30;
    svg += `
      <line x1="50" y1="${arrowY}" x2="${currentX}" y2="${arrowY}" stroke="#333" stroke-width="1" marker-end="url(#arrowhead)"/>
      <line x1="${currentX}" y1="${arrowY}" x2="50" y2="${arrowY}" stroke="#333" stroke-width="1" marker-end="url(#arrowhead)"/>
      <text x="${(50 + currentX) / 2}" y="${arrowY - 5}" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#333">
        ${(totalWidth / 100).toFixed(2)}
      </text>
    `;

    // Height measurement arrow
    const heightArrowX = currentX + 30;
    svg += `
      <line x1="${heightArrowX}" y1="${layoutY}" x2="${heightArrowX}" y2="${layoutY + layoutHeight}" stroke="#333" stroke-width="1" marker-end="url(#arrowhead)"/>
      <line x1="${heightArrowX}" y1="${layoutY + layoutHeight}" x2="${heightArrowX}" y2="${layoutY}" stroke="#333" stroke-width="1" marker-end="url(#arrowhead)"/>
      <text x="${heightArrowX + 15}" y="${layoutY + layoutHeight/2}" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#333" transform="rotate(90, ${heightArrowX + 15}, ${layoutY + layoutHeight/2})">
        ${(height / 100).toFixed(2)}
      </text>
    `;

    svg += '</svg>';
    return svg;
  };

  const downloadSVG = (svgContent: string, filename: string) => {
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getCurrentLayout = () => {
    switch (selectedSide) {
      case 'left': return truck.leftSideLayout;
      case 'right': return truck.rightSideLayout;
      case 'back': return truck.backSideLayout;
      default: return null;
    }
  };

  const currentLayout = getCurrentLayout();
  const svgContent = generatePreviewSVG(currentLayout, selectedSide);

  const handleDownload = () => {
    const taskName = truck.task?.name || truck.task?.plate || 'caminhao';
    const sideLabels = { left: 'motorista', right: 'sapo', back: 'traseira' };
    const sideLabel = sideLabels[selectedSide];
    const filename = `${taskName}-layout-${sideLabel}.svg`;
    downloadSVG(svgContent, filename);
    toast.success(`Layout ${sideLabel} baixado com sucesso!`);
  };

  return (
    <div className="space-y-6">
      {/* Side selector */}
      <div className="flex justify-center">
        <div className="flex bg-muted rounded-lg p-1">
          <Button
            variant={selectedSide === 'left' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSelectedSide('left')}
            className="rounded-md"
          >
            Motorista
          </Button>
          <Button
            variant={selectedSide === 'right' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSelectedSide('right')}
            className="rounded-md"
          >
            Sapo
          </Button>
          <Button
            variant={selectedSide === 'back' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSelectedSide('back')}
            className="rounded-md"
          >
            Traseira
          </Button>
        </div>
      </div>

      {/* Layout preview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <IconLayout className="h-5 w-5" />
            Preview do Layout - {selectedSide === 'left' ? 'Motorista' : selectedSide === 'right' ? 'Sapo' : 'Traseira'}
          </CardTitle>
          {currentLayout && (
            <Button onClick={handleDownload} variant="outline" size="sm">
              <IconDownload className="h-4 w-4 mr-2" />
              Baixar SVG
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg p-4 bg-white overflow-auto">
            <div dangerouslySetInnerHTML={{ __html: svgContent }} />
          </div>
          {!currentLayout && (
            <p className="text-center text-muted-foreground mt-4">
              Nenhum layout configurado para este lado
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const TruckDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("info");

  const {
    data: response,
    isLoading,
    error,
    refetch,
  } = useTruck(id!, {
    include: {
      task: {
        include: {
          customer: true,
        },
      },
      garage: true,
      leftSideLayout: {
        include: {
          photo: true,
        },
      },
      rightSideLayout: {
        include: {
          photo: true,
        },
      },
      backSideLayout: {
        include: {
          photo: true,
        },
      },
    },
  });

  const { data: layouts, refetch: refetchLayouts } = useLayoutsByTruck(id!);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-in fade-in-50 duration-500">
          <Skeleton className="h-32 w-full" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (error || !response?.data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Detalhes do Caminhão"
          icon={IconTruck}
          variant="detail"
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Produção", href: routes.production.root },
            { label: "Caminhões", href: routes.production.trucks?.list || "#" },
            { label: "Detalhes" },
          ]}
        />
        <Card>
          <CardContent className="p-6">
            <p className="text-center text-muted-foreground">{error ? "Erro ao carregar caminhão" : "Caminhão não encontrado"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const truck = response.data;

  const handleEdit = () => {
    navigate(routes.production.trucks?.edit?.(truck.id) || "#");
  };

  const handleRefresh = () => {
    refetch();
    refetchLayouts();
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      {/* Header */}
      <div className="animate-in fade-in-50 duration-500">
        <PageHeader
          variant="detail"
          title={truck.task?.plate || truck.task?.name || `Caminhão ${truck.id.slice(0, 8)}`}
          icon={IconTruck}
          actions={[
            {
              key: "refresh",
              label: "Atualizar",
              icon: IconRefresh,
              onClick: handleRefresh,
            },
            {
              key: "edit",
              label: "Editar",
              icon: IconEdit,
              onClick: handleEdit,
            },
          ]}
          breadcrumbs={[
            { label: "Início", href: routes.home },
            { label: "Produção", href: routes.production.root },
            { label: "Caminhões", href: routes.production.trucks?.list || "#" },
            { label: truck.task?.plate || "Detalhes" },
          ]}
          className="shadow-lg"
        />
      </div>

      {/* Main Content with Scrollable Area */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="info">Informações</TabsTrigger>
              <TabsTrigger value="layout">Layout</TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Truck Information */}
                <div className="space-y-6">
                  {/* Basic Info Card */}
                  <Card className="animate-in fade-in-50 duration-700">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <IconTruck className="h-5 w-5" />
                        Informações do Caminhão
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <p className="text-sm text-muted-foreground">ID</p>
                        <p className="font-medium">{truck.id}</p>
                      </div>

                      {truck.task && (
                        <>
                          <div>
                            <p className="text-sm text-muted-foreground">Placa</p>
                            <p className="font-medium">{truck.task.plate || "—"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Número de Série</p>
                            <p className="font-medium">{truck.task.serialNumber || "—"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Tarefa</p>
                            <p className="font-medium">{truck.task.name || "—"}</p>
                          </div>
                          {truck.task.customer && (
                            <div>
                              <p className="text-sm text-muted-foreground">Cliente</p>
                              <p className="font-medium">{truck.task.customer.fantasyName || truck.task.customer.corporateName}</p>
                            </div>
                          )}
                        </>
                      )}

                      {truck.garage && (
                        <div>
                          <p className="text-sm text-muted-foreground">Garagem</p>
                          <p className="font-medium">{truck.garage.name}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>


                  {/* Position Card */}
                  {(truck.xPosition !== null || truck.yPosition !== null) && (
                    <Card className="animate-in fade-in-50 duration-900">
                      <CardHeader>
                        <CardTitle>Posição de Estacionamento</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Posição X</p>
                            <p className="font-medium">{truck.xPosition !== null ? `${truck.xPosition}m` : "—"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Posição Y</p>
                            <p className="font-medium">{truck.yPosition !== null ? `${truck.yPosition}m` : "—"}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Dates Card */}
                  <Card className="animate-in fade-in-50 duration-1000">
                    <CardHeader>
                      <CardTitle>Datas</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Criado em</p>
                        <p className="font-medium">{formatDateTime(truck.createdAt)}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Atualizado em</p>
                        <p className="font-medium">{formatDateTime(truck.updatedAt)}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Changelog History */}
                <div className="animate-in fade-in-50 duration-900">
                  <ChangelogHistory
                    entityType={CHANGE_LOG_ENTITY_TYPE.TRUCK}
                    entityId={truck.id}
                    entityName={truck.task?.plate || truck.task?.name || `Caminhão ${truck.id.slice(0, 8)}`}
                    entityCreatedAt={truck.createdAt}
                    className="h-full"
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="layout" className="space-y-6">
              <TruckLayoutPreview truck={truck} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default TruckDetailsPage;
