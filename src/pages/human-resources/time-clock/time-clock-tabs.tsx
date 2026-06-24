import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { routes, SECTOR_PRIVILEGES } from "../../../constants";
import { useAuth } from "@/contexts/auth-context";
import { hasAnyPrivilege } from "@/utils/user";

const LAST_PAGE_KEY = "time-clock-last-page";

interface TabDef {
  label: string;
  // The sidebar submenu title — tabs are ordered by this so they match the
  // (alphabetically-sorted) sidebar menu order exactly.
  menuTitle: string;
  path: string;
  hrOnly: boolean;
}

const TABS: TabDef[] = [
  { label: "Espelho de Ponto", menuTitle: "Espelho de Ponto", path: routes.personnelDepartment.timeClock.colaborador, hrOnly: false },
  { label: "Resumo do Dia", menuTitle: "Resumo do Dia", path: routes.personnelDepartment.timeClock.dia, hrOnly: false },
  { label: "Edição", menuTitle: "Edição", path: routes.personnelDepartment.timeClock.edicao, hrOnly: true },
  { label: "Ausências", menuTitle: "Ausências", path: routes.personnelDepartment.timeClock.ausencias, hrOnly: false },
  { label: "Fechamento", menuTitle: "Fechamento", path: routes.personnelDepartment.timeClock.fechamento.list, hrOnly: true },
  { label: "Requisições", menuTitle: "Requisições", path: routes.personnelDepartment.requisicoes.list, hrOnly: true },
].sort((a, b) => a.menuTitle.localeCompare(b.menuTitle, "pt-BR", { sensitivity: "base" }));

// The last Controle de Ponto subpage the user can access (used by the
// /controle-ponto entry route + the parent menu to return them where they were).
export function getLastTimeClockPage(canEdit: boolean): string {
  try {
    const stored = window.localStorage.getItem(LAST_PAGE_KEY);
    const tab = stored ? TABS.find((t) => t.path === stored) : undefined;
    if (tab && (!tab.hrOnly || canEdit)) return tab.path;
  } catch {
    /* storage unavailable */
  }
  return routes.personnelDepartment.timeClock.colaborador;
}

// Segmented "tab" selector kept on every Controle de Ponto subpage — switching a
// tab navigates to that subpage. The active tab is derived from the route.
export function TimeClockTabs() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { user } = useAuth();
  const canEdit = hasAnyPrivilege(user as any, [
    SECTOR_PRIVILEGES.HUMAN_RESOURCES,
    SECTOR_PRIVILEGES.ADMIN,
    SECTOR_PRIVILEGES.ACCOUNTING,
  ]);
  const tabs = TABS.filter((t) => !t.hrOnly || canEdit);
  const active = tabs.find((t) => pathname.startsWith(t.path));

  useEffect(() => {
    if (active) {
      try {
        window.localStorage.setItem(LAST_PAGE_KEY, active.path);
      } catch {
        /* storage unavailable */
      }
    }
  }, [active?.path]);

  return (
    <div className="flex items-center gap-1 rounded-md border border-border p-0.5 bg-background flex-shrink-0">
      {tabs.map((t) => (
        <Button
          key={t.path}
          type="button"
          size="sm"
          variant={active?.path === t.path ? "default" : "ghost"}
          onClick={() => navigate(t.path)}
          className="h-9 px-3"
        >
          {t.label}
        </Button>
      ))}
    </div>
  );
}
