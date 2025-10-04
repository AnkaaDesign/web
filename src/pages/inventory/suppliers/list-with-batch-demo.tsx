import { SupplierListWithBatch } from "@/components/inventory/supplier";
import { PageHeader } from "@/components/ui/page-header";
import { routes } from "../../../constants";

/**
 * Demo page showing the complete supplier list with integrated batch operations
 * This demonstrates how to use the SupplierListWithBatch component
 */
export const SupplierListWithBatchDemoPage = () => {
  return (
    <div className="container mx-auto space-y-6 py-6">
      <PageHeader
        title="Fornecedores"
        subtitle="Gerencie fornecedores com operações em lote avançadas"
        breadcrumbs={[
          { label: "Dashboard", href: "/" },
          { label: "Estoque", href: routes.inventory.root },
          { label: "Fornecedores", href: routes.inventory.suppliers.root },
        ]}
      />

      <SupplierListWithBatch />
    </div>
  );
};
