import { Outlet } from "react-router-dom";
import { Header } from "@/components/navigation/header";
import { Sidebar } from "@/components/navigation/sidebar";
import { ContextMenuProvider } from "@/components/ui/context-menu";
import { usePricing } from "@/contexts/pricing-context";

export const MainLayout = () => {
  const { pricingVisible } = usePricing();
  return (
    <ContextMenuProvider>
      {/* h-full (not h-screen): under root `zoom: 0.8` a 100vh box would be scaled
          to 80% of the screen, leaving an empty strip at the bottom. The
          html/body/#root height:100% chain (index.css) lets h-full fill the real
          viewport correctly inside zoomed space. */}
      <div className="flex h-full overflow-hidden relative" data-pricing-visible={pricingVisible}>
        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <Header />
          <main className="bg-background flex-1 overflow-y-auto transition-colors">
            <Outlet />
          </main>
        </div>

        {/* Sidebar on the right */}
        <Sidebar />
      </div>
    </ContextMenuProvider>
  );
};
