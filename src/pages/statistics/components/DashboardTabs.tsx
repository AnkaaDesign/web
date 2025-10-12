/**
 * Dashboard Tabs Component
 *
 * Tab navigation for different dashboard sections:
 * - Overview
 * - Inventory
 * - Production
 * - HR
 * - Financial
 */

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  IconLayoutDashboard,
  IconBox,
  IconTool,
  IconUsers,
  IconCurrencyDollar,
} from "@tabler/icons-react";

export interface DashboardTabsProps {
  defaultTab?: string;
  onTabChange?: (value: string) => void;
  overviewContent: React.ReactNode;
  inventoryContent: React.ReactNode;
  productionContent: React.ReactNode;
  hrContent: React.ReactNode;
  financialContent: React.ReactNode;
}

/**
 * Dashboard Tabs Component
 */
export function DashboardTabs({
  defaultTab = "overview",
  onTabChange,
  overviewContent,
  inventoryContent,
  productionContent,
  hrContent,
  financialContent,
}: DashboardTabsProps) {
  return (
    <Tabs defaultValue={defaultTab} onValueChange={onTabChange} className="w-full">
      <TabsList className="grid w-full grid-cols-5 mb-6">
        <TabsTrigger value="overview" className="gap-2">
          <IconLayoutDashboard className="h-4 w-4" />
          <span className="hidden sm:inline">Visão Geral</span>
        </TabsTrigger>
        <TabsTrigger value="inventory" className="gap-2">
          <IconBox className="h-4 w-4" />
          <span className="hidden sm:inline">Estoque</span>
        </TabsTrigger>
        <TabsTrigger value="production" className="gap-2">
          <IconTool className="h-4 w-4" />
          <span className="hidden sm:inline">Produção</span>
        </TabsTrigger>
        <TabsTrigger value="hr" className="gap-2">
          <IconUsers className="h-4 w-4" />
          <span className="hidden sm:inline">RH</span>
        </TabsTrigger>
        <TabsTrigger value="financial" className="gap-2">
          <IconCurrencyDollar className="h-4 w-4" />
          <span className="hidden sm:inline">Financeiro</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview">{overviewContent}</TabsContent>
      <TabsContent value="inventory">{inventoryContent}</TabsContent>
      <TabsContent value="production">{productionContent}</TabsContent>
      <TabsContent value="hr">{hrContent}</TabsContent>
      <TabsContent value="financial">{financialContent}</TabsContent>
    </Tabs>
  );
}
