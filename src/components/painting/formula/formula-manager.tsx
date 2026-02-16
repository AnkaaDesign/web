import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { IconFlask, IconCalculator, IconBuildingFactory, IconSettings, IconPlus, IconAlertTriangle, IconCircleCheck } from "@tabler/icons-react";
import type { PaintFormula, Item } from "../../../types";
import { PaintFormulaDetail } from "./paint-formula-detail";
import { PaintFormulaRatioCalculator } from "./paint-formula-ratio-calculator";
import { ComponentForm } from "./component-form";
import { DensityValidator } from "./density-validator";
import { ProductionCalculator, type ProductionPlan } from "../production/production-calculator";

interface FormulaManagerProps {
  formula: PaintFormula;
  availableItems: Item[];
  onUpdateFormula?: (updatedFormula: Partial<PaintFormula>) => void;
  onStartProduction?: (productionPlan: ProductionPlan) => void;
  onAddComponent?: (componentData: { itemId: string; weightInGrams: number }) => void;
  onUpdateComponent?: (componentId: string, componentData: { itemId: string; weightInGrams: number }) => void;
  onRemoveComponent?: (componentId: string) => void;
}

export function FormulaManager({ formula, availableItems, onStartProduction, onAddComponent, onUpdateComponent, onRemoveComponent }: FormulaManagerProps) {
  const [activeTab, setActiveTab] = useState("overview");
  const [showComponentForm, setShowComponentForm] = useState(false);
  const [editingComponent, setEditingComponent] = useState<string | null>(null);

  const components = formula.components || [];

  // Calculate formula health metrics
  const formulaHealth = {
    hasComponents: components.length > 0,
    hasRatios: components.some((c) => c.ratio > 0),
    hasPaint: !!formula.paint,
    allComponentsHaveStock: components.every((c) => (c.item?.quantity || 0) > 0),
    allComponentsHaveItems: components.every((c) => !!c.item),
    densityValidated: true, // This would come from DensityValidator
  };

  const healthScore = Object.values(formulaHealth).filter(Boolean).length;
  const maxScore = Object.keys(formulaHealth).length;
  const healthPercentage = (healthScore / maxScore) * 100;

  const getHealthStatus = () => {
    if (healthPercentage >= 80) return { status: "good", color: "green", icon: IconCircleCheck };
    if (healthPercentage >= 60) return { status: "warning", color: "yellow", icon: IconAlertTriangle };
    return { status: "poor", color: "red", icon: IconAlertTriangle };
  };

  const health = getHealthStatus();

  const handleAddComponent = (componentData: { itemId: string; weightInGrams: number }) => {
    onAddComponent?.(componentData);
    setShowComponentForm(false);
  };

  const handleUpdateComponent = (componentData: { itemId: string; weightInGrams: number }) => {
    if (editingComponent) {
      onUpdateComponent?.(editingComponent, componentData);
      setEditingComponent(null);
    }
  };

  const handleCancelComponentForm = () => {
    setShowComponentForm(false);
    setEditingComponent(null);
  };

  return (
    <div className="space-y-6">
      {/* Formula Health Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <IconFlask className="h-5 w-5" />
                Gerenciador de Fórmula
              </CardTitle>
              <CardDescription>{formula.description}</CardDescription>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2">
                <health.icon className={`h-5 w-5 text-${health.color}-500`} />
                <span className="text-lg font-semibold">Status: {healthPercentage.toFixed(0)}%</span>
              </div>
              <div className="text-sm text-muted-foreground">
                {healthScore}/{maxScore} critérios atendidos
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
            <Badge variant={formulaHealth.hasComponents ? "default" : "secondary"}>
              <span className="font-enhanced-unicode check-symbol">{formulaHealth.hasComponents ? "✓" : "✗"}</span> Componentes
            </Badge>
            <Badge variant={formulaHealth.hasRatios ? "default" : "secondary"}>
              <span className="font-enhanced-unicode check-symbol">{formulaHealth.hasRatios ? "✓" : "✗"}</span> Proporções
            </Badge>
            <Badge variant={formulaHealth.hasPaint ? "default" : "secondary"}>
              <span className="font-enhanced-unicode check-symbol">{formulaHealth.hasPaint ? "✓" : "✗"}</span> Tinta
            </Badge>
            <Badge variant={formulaHealth.allComponentsHaveItems ? "default" : "secondary"}>
              <span className="font-enhanced-unicode check-symbol">{formulaHealth.allComponentsHaveItems ? "✓" : "✗"}</span> Itens
            </Badge>
            <Badge variant={formulaHealth.allComponentsHaveStock ? "default" : "secondary"}>
              <span className="font-enhanced-unicode check-symbol">{formulaHealth.allComponentsHaveStock ? "✓" : "✗"}</span> Estoque
            </Badge>
            <Badge variant={formulaHealth.densityValidated ? "default" : "secondary"}>
              <span className="font-enhanced-unicode check-symbol">{formulaHealth.densityValidated ? "✓" : "✗"}</span> Validada
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <IconFlask className="h-4 w-4" />
            Visão Geral
          </TabsTrigger>
          <TabsTrigger value="calculator" className="flex items-center gap-2">
            <IconCalculator className="h-4 w-4" />
            Calculadora
          </TabsTrigger>
          <TabsTrigger value="production" className="flex items-center gap-2">
            <IconBuildingFactory className="h-4 w-4" />
            Produção
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <IconSettings className="h-4 w-4" />
            Configurações
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <PaintFormulaDetail formula={formula} />
        </TabsContent>

        {/* Calculator Tab */}
        <TabsContent value="calculator" className="space-y-6">
          <PaintFormulaRatioCalculator formula={formula} />
        </TabsContent>

        {/* Production Tab */}
        <TabsContent value="production" className="space-y-6">
          <ProductionCalculator formula={formula} onStartProduction={onStartProduction} />
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-6">
          {/* Density Validation Details */}
          <DensityValidator formula={formula} showDetails={true} />

          <Separator />

          {/* Component Management */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Gerenciar Componentes</CardTitle>
                  <CardDescription>Adicione, edite ou remova componentes da fórmula</CardDescription>
                </div>
                <Button onClick={() => setShowComponentForm(true)} disabled={showComponentForm || editingComponent !== null}>
                  <IconPlus className="h-4 w-4 mr-2" />
                  Adicionar Componente
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Component Form */}
              {(showComponentForm || editingComponent) && (
                <div className="mb-6">
                  <ComponentForm
                    component={editingComponent ? components.find((c) => c.id === editingComponent) : undefined}
                    availableItems={availableItems}
                    onSubmit={(editingComponent ? handleUpdateComponent : handleAddComponent) as (data: any) => void}
                    onCancel={handleCancelComponentForm}
                    isEditing={!!editingComponent}
                    selectedComponentIds={components.map((c) => c.itemId).filter(Boolean)}
                    existingComponents={components}
                    totalFormulaDensity={Number(formula.density) || 1.0}
                  />
                </div>
              )}

              {/* Components List */}
              <div className="space-y-3">
                {components.map((component, index) => (
                  <div key={component.id || index} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h5 className="font-medium">
                          {component.item?.uniCode && <span className="font-mono text-blue-600 mr-2">[{component.item.uniCode}]</span>}
                          {component.item?.name || `Componente ${index + 1}`}
                        </h5>
                        <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                          <span>Proporção: {component.ratio}%</span>
                          {component.item?.quantity !== undefined && <span>Estoque: {component.item.quantity}</span>}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setEditingComponent(component.id || "")} disabled={showComponentForm || editingComponent !== null}>
                          Editar
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => onRemoveComponent?.(component.id || "")} disabled={showComponentForm || editingComponent !== null}>
                          Remover
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}

                {components.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <IconFlask className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhum componente adicionado ainda</p>
                    <p className="text-sm">Clique em "Adicionar Componente" para começar</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
