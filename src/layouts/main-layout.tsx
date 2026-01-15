import { Outlet } from "react-router-dom";
import { Header } from "@/components/navigation/header";
import { Sidebar } from "@/components/navigation/sidebar";
import { ContextMenuProvider } from "@/components/ui/context-menu";

export const MainLayout = () => {
  return (
    <ContextMenuProvider>
      <div className="flex h-screen overflow-hidden relative">
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
