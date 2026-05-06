// Home page — configurable widget gallery.
// Users can drag, resize, configure, add and remove widgets. Layout persists
// per-user via Preferences.dashboardLayoutWeb. Sector permissions are enforced
// in the registry (UI filter) and on the API (PUT validation).

import { useEffect, useState } from "react";
import { useAuth } from "../contexts/auth-context";
import { SECTOR_PRIVILEGES } from "../constants";
import { usePageTracker } from "../hooks/common/use-page-tracker";
import {
  useDashboardLayout,
  DashboardGrid,
  EditToolbar,
  AddWidgetModal,
  ConfigureWidgetModal,
} from "../dashboard";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export function HomePage() {
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [addWidgetOpen, setAddWidgetOpen] = useState(false);
  const [configuringInstanceId, setConfiguringInstanceId] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  usePageTracker({ title: "Página Inicial", icon: "home" });

  const {
    layout,
    isLoading,
    isSaving,
    isDirty,
    isEditing,
    enterEdit,
    saveAndExit,
    discardAndExit,
    addWidget,
    removeWidget,
    reorderItems,
    resizeWidget,
    configureWidget,
  } = useDashboardLayout();

  const hasBasicPrivilegeOnly =
    user?.sector?.privileges === SECTOR_PRIVILEGES.BASIC || !user?.sector;

  if (hasBasicPrivilegeOnly) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="text-center space-y-8 max-w-md">
          <h1 className="text-4xl font-bold text-foreground">Bem-vindo ao Ankaa</h1>
          <p className="text-lg text-muted-foreground">
            Você está autenticado, mas ainda não possui permissões para acessar as funcionalidades
            do sistema.
          </p>
          <p className="text-muted-foreground">
            Entre em contato com o administrador para solicitar acesso aos módulos necessários.
          </p>
        </div>
      </div>
    );
  }

  const configuringInstance =
    configuringInstanceId != null
      ? layout.items.find((it) => it.instanceId === configuringInstanceId) ?? null
      : null;

  return (
    <div className="m-4 p-4 rounded-xl flex flex-col gap-5 bg-card border border-border shadow-sm min-h-[calc(100vh-6rem)]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-base sm:text-xl md:text-2xl font-bold text-secondary-foreground">
            {getGreeting()}, {user?.name || "Usuário"}!
          </h1>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            {new Date().toLocaleDateString("pt-BR", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <EditToolbar
            isEditing={isEditing}
            isDirty={isDirty}
            isSaving={isSaving}
            onEnterEdit={enterEdit}
            onSave={() => {
              void saveAndExit();
            }}
            onDiscard={discardAndExit}
            onAddWidget={() => setAddWidgetOpen(true)}
          />
          <span className="text-sm sm:text-base md:text-lg text-secondary-foreground tabular-nums w-[5.5em] text-right">
            {currentTime.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="rounded-lg bg-muted/30 animate-pulse"
              style={{ height: 360 }}
            />
          ))}
        </div>
      ) : (
        <DashboardGrid
          layout={layout}
          isEditing={isEditing}
          onReorder={reorderItems}
          onResize={resizeWidget}
          onConfigure={(instanceId) => setConfiguringInstanceId(instanceId)}
          onRemove={removeWidget}
        />
      )}

      <AddWidgetModal
        open={addWidgetOpen}
        onClose={() => setAddWidgetOpen(false)}
        onAdd={(widgetId) => addWidget(widgetId)}
      />
      <ConfigureWidgetModal
        instance={configuringInstance}
        onClose={() => setConfiguringInstanceId(null)}
        onSave={(instanceId, config) => configureWidget(instanceId, config)}
      />
    </div>
  );
}
