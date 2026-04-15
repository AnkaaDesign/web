import React, { useState, useRef, useEffect, useCallback } from "react";
import { TaskPreparationView } from "@/components/production/task/preparation/task-preparation-view";
import { PrivilegeRoute } from "@/components/navigation/privilege-route";
import { PageHeader } from "@/components/ui/page-header";
import { SECTOR_PRIVILEGES, routes, FAVORITE_PAGES } from "../../constants";
import { usePageTracker } from "@/hooks/common/use-page-tracker";
import { IconClipboardList, IconPlus } from "@tabler/icons-react";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";

export const PreparationPage = () => {
  const { user } = useAuth();

  // Track page access
  usePageTracker({
    title: "Agenda de Tarefas",
    icon: "clipboard-list",
  });

  // Sticky header: hide on scroll down, show on scroll up
  const [headerVisible, setHeaderVisible] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const lastScrollY = useRef(0);
  const headerRef = useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = useState(0);

  // Measure header height for table header offset
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    setHeaderHeight(el.offsetHeight);
    const observer = new ResizeObserver(() => {
      setHeaderHeight(el.offsetHeight);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;

    const handleScroll = () => {
      const currentScrollY = main.scrollTop;

      setIsScrolled(currentScrollY > 20);

      if (currentScrollY < 20) {
        setHeaderVisible(true);
      } else if (currentScrollY < lastScrollY.current) {
        // Any upward scroll shows header immediately
        setHeaderVisible(true);
      } else if (currentScrollY > lastScrollY.current + 5) {
        setHeaderVisible(false);
      }

      lastScrollY.current = currentScrollY;
    };

    main.addEventListener("scroll", handleScroll, { passive: true });
    return () => main.removeEventListener("scroll", handleScroll);
  }, []);

  // Callback ref for the controls portal container
  const [controlsContainer, setControlsContainer] = useState<HTMLDivElement | null>(null);
  const controlsRef = useCallback((node: HTMLDivElement | null) => {
    setControlsContainer(node);
  }, []);

  // ADMIN, COMMERCIAL, LOGISTIC, and PRODUCTION_MANAGER can create tasks
  const canCreateTasks =
    user?.sector?.privileges === SECTOR_PRIVILEGES.ADMIN ||
    user?.sector?.privileges === SECTOR_PRIVILEGES.COMMERCIAL ||
    user?.sector?.privileges === SECTOR_PRIVILEGES.LOGISTIC ||
    user?.sector?.privileges === SECTOR_PRIVILEGES.PRODUCTION_MANAGER;

  return (
    <PrivilegeRoute requiredPrivilege={[SECTOR_PRIVILEGES.PRODUCTION, SECTOR_PRIVILEGES.WAREHOUSE, SECTOR_PRIVILEGES.DESIGNER, SECTOR_PRIVILEGES.LOGISTIC, SECTOR_PRIVILEGES.PRODUCTION_MANAGER, SECTOR_PRIVILEGES.COMMERCIAL, SECTOR_PRIVILEGES.ADMIN]}>
      <div
        className="flex flex-col gap-4 bg-background px-4 pt-4 pb-4"
        style={{
          '--sticky-header-offset': headerVisible && headerHeight > 0
            ? `${headerHeight}px`
            : '0.5rem',
        } as React.CSSProperties}
      >
        <div
          ref={headerRef}
          className={cn(
            "sticky -top-px z-20 bg-background pt-4 -mt-4 transition-transform duration-200 ease-out",
            isScrolled && "after:content-[''] after:block after:h-4 after:bg-background",
            !headerVisible && "-translate-y-full"
          )}
        >
          <PageHeader
            variant="default"
            title="Agenda"
            icon={IconClipboardList}
            favoritePage={FAVORITE_PAGES.PRODUCAO_AGENDA_LISTAR}
            breadcrumbs={[
              { label: "Início", href: routes.home },
              { label: "Produção", href: routes.production.root },
              { label: "Agenda" },
            ]}
            actions={
              canCreateTasks
                ? [
                    {
                      key: "create-task",
                      label: "Criar Tarefa",
                      icon: IconPlus,
                      onClick: () => window.location.href = routes.production.preparation.create,
                      variant: "default" as const,
                    },
                  ]
                : undefined
            }
          />
          <div ref={controlsRef} className="flex flex-col gap-3 pt-3 [&_input]:bg-card [&_button]:bg-card" />
        </div>
        <TaskPreparationView
          storageKey="task-preparation-visible-columns"
          searchPlaceholder="Buscar por nome, número de série, placa..."
          controlsContainer={controlsContainer}
        />
      </div>
    </PrivilegeRoute>
  );
};

export default PreparationPage;
