import { useAuth } from "../contexts/auth-context";
import { useFavorites } from "../contexts/favorites-context";
import { SECTOR_PRIVILEGES } from "../constants";
import { getMostAccessedPages, getRecentPages, getIconInfoByPath } from "../utils";
import { IconStar, IconClock, IconFlame } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { usePageTracker } from "../hooks/common/use-page-tracker";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export function HomePage() {
  const { user } = useAuth();
  const { favorites } = useFavorites();
  const navigate = useNavigate();
  const [mostAccessedPages, setMostAccessedPages] = useState(getMostAccessedPages(12));
  const [recentPages, setRecentPages] = useState(getRecentPages(12));
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Track page access
  usePageTracker({
    title: "Página Inicial",
    icon: "home",
  });

  useEffect(() => {
    // Update most accessed and recent pages when component mounts
    setMostAccessedPages(getMostAccessedPages(12));
    setRecentPages(getRecentPages(12));
  }, []);

  const hasBasicPrivilegeOnly = user?.sector?.privileges === SECTOR_PRIVILEGES.BASIC || !user?.sector;

  // Welcome screen for users with only basic privilegess
  if (hasBasicPrivilegeOnly) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-4rem)]">
        <div className="text-center space-y-8 max-w-md">
          <h1 className="text-4xl font-bold text-foreground">Bem-vindo ao Ankaa</h1>
          <p className="text-lg text-muted-foreground">Você está autenticado, mas ainda não possui permissões para acessar as funcionalidades do sistema.</p>
          <p className="text-muted-foreground">Entre em contato com o administrador para solicitar acesso aos módulos necessários.</p>
        </div>
      </div>
    );
  }

  // Regular home page content
  return (
    <div className="m-4 p-4 rounded-xl flex flex-col gap-4 bg-card border border-border shadow-sm min-h-[calc(100vh-6rem)]">
      {/* Welcome Header */}
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
        <span className="text-sm sm:text-base md:text-lg text-secondary-foreground">
          {currentTime.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
      </div>

      {/* Favoritos - horizontal scroll */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-secondary-foreground flex items-center gap-2">
          <IconStar className="h-5 w-5 text-yellow-500" />
          Favoritos
        </h2>
        {favorites.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {favorites.map((fav) => {
              const iconInfo = getIconInfoByPath(fav.path);
              const IconComponent = iconInfo.icon;
              return (
                <div
                  key={fav.id}
                  className="cursor-pointer hover:shadow-sm transition-shadow duration-200 rounded-lg bg-secondary border border-border flex-shrink-0 w-36 p-4"
                  onClick={() => navigate(fav.path)}
                >
                  <div className={`${iconInfo.color} text-white p-3 rounded-lg inline-block mb-2`}>
                    <IconComponent className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-sm text-secondary-foreground">{fav.title}</h3>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm py-4">Marque páginas como favoritas para acessá-las rapidamente.</p>
        )}
      </div>

      {/* Recentes - 2 rows */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-secondary-foreground flex items-center gap-2">
          <IconClock className="h-5 w-5 text-blue-500" />
          Recentes
        </h2>
        {recentPages.length > 0 ? (
          <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {recentPages.map((page) => {
              const iconInfo = getIconInfoByPath(page.path);
              const IconComponent = iconInfo.icon;
              return (
                <div
                  key={page.path}
                  className="cursor-pointer hover:shadow-sm transition-shadow duration-200 rounded-lg bg-secondary border border-border p-4"
                  onClick={() => navigate(page.path)}
                >
                  <div className={`${iconInfo.color} text-white p-3 rounded-lg inline-block mb-2`}>
                    <IconComponent className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-sm text-secondary-foreground">{page.title}</h3>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm py-4">Navegue pelo sistema para ver suas páginas recentes aqui.</p>
        )}
      </div>

      {/* Mais Acessadas - 2 rows */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold text-secondary-foreground flex items-center gap-2">
          <IconFlame className="h-5 w-5 text-orange-500" />
          Mais Acessadas
        </h2>
        {mostAccessedPages.length > 0 ? (
          <div className="grid grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {mostAccessedPages.map((page) => {
              const iconInfo = getIconInfoByPath(page.path);
              const IconComponent = iconInfo.icon;
              return (
                <div
                  key={page.path}
                  className="cursor-pointer hover:shadow-sm transition-shadow duration-200 rounded-lg bg-secondary border border-border p-4"
                  onClick={() => navigate(page.path)}
                >
                  <div className={`${iconInfo.color} text-white p-3 rounded-lg inline-block mb-2`}>
                    <IconComponent className="h-6 w-6" />
                  </div>
                  <h3 className="font-semibold text-sm text-secondary-foreground">{page.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {page.count} {page.count === 1 ? "acesso" : "acessos"}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm py-4">Navegue pelo sistema para ver suas páginas mais acessadas aqui.</p>
        )}
      </div>
    </div>
  );
}
