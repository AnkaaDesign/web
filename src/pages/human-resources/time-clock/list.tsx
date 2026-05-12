import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { IconDeviceFloppy, IconRestore, IconSignature } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import {
  TimeClockEntryEditList,
  type TimeClockEntryEditActions,
} from "@/components/human-resources/time-clock-entry/time-clock-edit-list";
import { TimeClockDayView } from "@/components/human-resources/time-clock-entry/time-clock-day-view";
import {
  TimeClockDayViewExport,
  type DayExportRow,
} from "@/components/human-resources/time-clock-entry/time-clock-day-view-export";
import {
  TimeClockEntryEditExport,
  type EditExportRow,
} from "@/components/human-resources/time-clock-entry/time-clock-entry-edit-export";
import {
  CalculationList,
  CalculationExport,
} from "@/components/integrations/secullum/calculations/list";
import { routes, FAVORITE_PAGES, SECTOR_PRIVILEGES } from "../../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { useAuth } from "@/contexts/auth-context";
import { hasAnyPrivilege } from "@/utils/user";
import type { User } from "@/types";

type ViewMode = "colaborador-unico" | "multiplos-colaboradores" | "edit";
const DEFAULT_VIEW: ViewMode = "colaborador-unico";
const VALID_VIEWS: ViewMode[] = ["colaborador-unico", "multiplos-colaboradores", "edit"];
const VIEW_STORAGE_KEY = "time-clock-view-mode";

function isValidView(v: string | null): v is ViewMode {
  return !!v && (VALID_VIEWS as string[]).includes(v);
}

function readStoredView(): ViewMode | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(VIEW_STORAGE_KEY);
    return isValidView(stored) ? stored : null;
  } catch {
    return null;
  }
}

interface ViewOption {
  value: ViewMode;
  label: string;
  visible: boolean;
}

interface ViewSelectorProps {
  view: ViewMode;
  options: ViewOption[];
  onChange: (next: ViewMode) => void;
}

// Segmented-control style toggle — same shape as the Mês/Ano selector on the
// absences calendar (rounded outer container, ghost/default buttons inside).
function ViewSelector({ view, options, onChange }: ViewSelectorProps) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-border p-0.5 bg-background flex-shrink-0">
      {options
        .filter((o) => o.visible)
        .map((o) => (
          <Button
            key={o.value}
            type="button"
            size="sm"
            variant={view === o.value ? "default" : "ghost"}
            onClick={() => onChange(o.value)}
            className="h-9 px-3"
          >
            {o.label}
          </Button>
        ))}
    </div>
  );
}

export default function TimeClockListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user: currentUser } = useAuth();

  usePageTracker({ title: "Controle de Ponto", icon: "clock" });

  const canEdit = useMemo(
    () =>
      hasAnyPrivilege(currentUser as any, [
        SECTOR_PRIVILEGES.HUMAN_RESOURCES,
        SECTOR_PRIVILEGES.ADMIN,
      ]),
    [currentUser],
  );

  const rawView = searchParams.get("view");
  const view: ViewMode = isValidView(rawView) ? rawView : DEFAULT_VIEW;

  // On first mount, hydrate the URL from localStorage when no ?view= was given,
  // so the previously-chosen tab is restored across reloads.
  useEffect(() => {
    if (!searchParams.get("view")) {
      const stored = readStoredView();
      if (stored && (stored !== "edit" || canEdit)) {
        const params = new URLSearchParams(searchParams);
        params.set("view", stored);
        setSearchParams(params, { replace: true });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bounce off ?view=edit when the user can't edit, or off any unknown value.
  useEffect(() => {
    if (rawView === "edit" && !canEdit) {
      const params = new URLSearchParams(searchParams);
      params.set("view", DEFAULT_VIEW);
      setSearchParams(params, { replace: true });
    } else if (rawView && !isValidView(rawView)) {
      const params = new URLSearchParams(searchParams);
      params.set("view", DEFAULT_VIEW);
      setSearchParams(params, { replace: true });
    }
  }, [rawView, canEdit, searchParams, setSearchParams]);

  const handleViewChange = (next: ViewMode) => {
    if (next === "edit" && !canEdit) return;
    try {
      window.localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // Storage may be unavailable in private mode — non-fatal.
    }
    const params = new URLSearchParams(searchParams);
    params.set("view", next);
    setSearchParams(params);
  };

  // Per-mode export data — each child mode pushes its data via callback.
  const [calcExport, setCalcExport] = useState<{
    rows: any[];
    visibleColumns: Set<string>;
    filters: any;
  } | null>(null);

  const [dayExport, setDayExport] = useState<{
    rows: DayExportRow[];
    visibleColumns: Set<string>;
    date: Date;
  } | null>(null);

  const [editExport, setEditExport] = useState<{
    rows: EditExportRow[];
    visibleColumns: Set<string>;
    user: User | null;
    userId: string | null;
    startDate: Date | null;
    endDate: Date | null;
  } | null>(null);

  const [editActions, setEditActions] = useState<TimeClockEntryEditActions | null>(null);

  const viewOptions: ViewOption[] = [
    { value: "colaborador-unico", label: "Visualização Colaborador", visible: true },
    { value: "multiplos-colaboradores", label: "Visualização Dia", visible: true },
    { value: "edit", label: "Edição", visible: canEdit },
  ];

  return (
    <div className="h-full flex flex-col gap-4 bg-background px-4 pt-4 pb-4">
      <PageHeader
        className="flex-shrink-0"
        title="Controle de Ponto"
        favoritePage={FAVORITE_PAGES.RECURSOS_HUMANOS_CARGOS_LISTAR}
        breadcrumbs={[
          { label: "Início", href: routes.home },
          { label: "Recursos Humanos", href: routes.humanResources.root },
          { label: "Controle de Ponto" },
        ]}
        headerExtra={
          <div className="flex items-center gap-2">
            <ViewSelector view={view} options={viewOptions} onChange={handleViewChange} />
            {canEdit && (
              <Button
                type="button"
                variant="outline"
                size="default"
                onClick={() =>
                  navigate(routes.humanResources.timeClock.assinaturaDigital.list)
                }
                title="Abrir Assinatura Digital de Cartão Ponto"
              >
                <IconSignature className="h-4 w-4 mr-2" />
                Assinatura Digital
              </Button>
            )}
            {view === "colaborador-unico" && calcExport && (
              <CalculationExport
                filters={calcExport.filters}
                currentItems={calcExport.rows}
                totalRecords={calcExport.rows.length}
                visibleColumns={calcExport.visibleColumns}
              />
            )}
            {view === "multiplos-colaboradores" && dayExport && (
              <TimeClockDayViewExport
                currentItems={dayExport.rows}
                visibleColumns={dayExport.visibleColumns}
                date={dayExport.date}
              />
            )}
            {view === "edit" && editExport && (
              <TimeClockEntryEditExport
                currentItems={editExport.rows}
                visibleColumns={editExport.visibleColumns}
                user={editExport.user}
                userId={editExport.userId}
                startDate={editExport.startDate}
                endDate={editExport.endDate}
              />
            )}
            {view === "edit" && editActions && editActions.changedRowsCount > 0 && (
              <div className="flex items-center gap-1">
                <Button type="button" variant="outline" onClick={editActions.onRestore}>
                  <IconRestore className="h-4 w-4 mr-2" />
                  Restaurar
                </Button>
                <Button type="button" variant="default" onClick={editActions.onSave}>
                  <IconDeviceFloppy className="h-4 w-4 mr-2" />
                  Salvar ({editActions.changedRowsCount})
                </Button>
              </div>
            )}
          </div>
        }
      />

      <div className="flex-1 min-h-0">
        {view === "colaborador-unico" && (
          <CalculationList className="h-full" onExportDataChange={setCalcExport} />
        )}
        {view === "multiplos-colaboradores" && (
          <TimeClockDayView className="h-full" onExportDataChange={setDayExport} />
        )}
        {view === "edit" && canEdit && (
          <TimeClockEntryEditList
            className="h-full"
            onExportDataChange={setEditExport}
            onActionsChange={setEditActions}
          />
        )}
      </div>
    </div>
  );
}
