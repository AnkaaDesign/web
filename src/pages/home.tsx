import { useAuth } from "../contexts/auth-context";
import { SECTOR_PRIVILEGES } from "../constants";
import { getMostAccessedPages, hasPrivilege } from "../utils";
import { IconFileText, IconPackage, IconUsers, IconTool, IconPaint, IconChartBar, IconRefresh } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import { routes } from "../constants";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { usePageTracker } from "../hooks/use-page-tracker";
import { ThemedBackground } from "@/components/ui";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export function HomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [mostAccessedPages, setMostAccessedPages] = useState(getMostAccessedPages(6));
  const [currentTime, setCurrentTime] = useState(new Date());
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000); // Atualiza a cada segundo

    return () => clearInterval(interval); // Limpa ao desmontar
  }, []);

  // Track page access
  usePageTracker({
    title: "Página Inicial",
    icon: "home",
  });

  useEffect(() => {
    // Update most accessed pages when component mounts
    setMostAccessedPages(getMostAccessedPages(6));
  }, []);

  const isAdmin = user?.sector?.privileges ? hasPrivilege(user as any, SECTOR_PRIVILEGES.ADMIN) : false;
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

  // Quick access items for admin
  const adminQuickAccess = [
    { title: "Tarefas", icon: IconFileText, path: routes.production.schedule.root, color: "bg-blue-500 dark:bg-blue-600" },
    { title: "Produtos", icon: IconPackage, path: routes.inventory.products.root, color: "bg-green-500 dark:bg-green-600" },
    { title: "Colaboradores", icon: IconUsers, path: routes.administration.collaborators.root, color: "bg-purple-500 dark:bg-purple-600" },
    { title: "Clientes", icon: IconUsers, path: routes.administration.customers.root, color: "bg-orange-500 dark:bg-orange-600" },
    { title: "Manutenções", icon: IconTool, path: routes.inventory.maintenance.root, color: "bg-red-500 dark:bg-red-600" },
    { title: "Pintura", icon: IconPaint, path: routes.painting.catalog.root, color: "bg-indigo-500 dark:bg-indigo-600" },
  ];

  // Regular home page content
  return (
    <ThemedBackground key={refreshKey} className="p-4 rounded-lg flex flex-col gap-4">
      {/* Welcome Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-3xl font-bold text-secondary-foreground">
            {getGreeting()}, {user?.name || "Usuário"}!
          </h1>
          <p className="text-muted-foreground mt-1">
            {new Date().toLocaleDateString("pt-BR", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
        <div className="flex items-center gap-2 text-secondary-foreground">
          <span className="text-xl">
            {currentTime.toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit", // Se quiser mostrar os segundos
            })}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setIsSpinning(true);
              setRefreshKey((prev) => prev + 1);
              setTimeout(() => setIsSpinning(false), 500); // Stop spin after 0.5s
            }}
            title="Atualizar conteúdo"
          >
            <IconRefresh className={`h-6 w-6 transition-transform ${isSpinning ? "animate-spin  [animation-direction:reverse]" : ""}`} />
          </Button>
        </div>
      </div>
      {/* Admin Dashboard Summary */}
      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          {adminQuickAccess.map((item) => (
            <Card
              key={item.path}
              className="cursor-pointer hover:shadow-lg shadow-[#fff] transition-shadow duration-200 rounded-md border border-neutral-300 dark:border-neutral-700"
              onClick={() => navigate(item.path)}
            >
              <CardContent className="p-4">
                <div className={`${item.color} text-white p-3 rounded-lg inline-block mb-2`}>
                  <item.icon className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-sm text-secondary-foreground">{item.title}</h3>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {/* Most Accessed Pages */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <IconChartBar className="h-5 w-5" />
            Páginas Mais Acessadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {mostAccessedPages.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {mostAccessedPages.map((page) => (
                <Button key={page.path} variant="outline" className="justify-start h-auto py-3 px-4" onClick={() => navigate(page.path)}>
                  <div className="text-left">
                    <div className="font-medium">{page.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {page.count} {page.count === 1 ? "acesso" : "acessos"}
                    </div>
                  </div>
                </Button>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">Navegue pelo sistema para ver suas páginas mais acessadas aqui.</p>
          )}
        </CardContent>
      </Card>
      {/* Quick Stats for non-admin users */}
      {!isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Production Access */}
          {user?.sector?.privileges && hasPrivilege(user as any, SECTOR_PRIVILEGES.PRODUCTION) && (
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate(routes.production.schedule.root)}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <IconFileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  Produção
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Acessar tarefas e cronogramas</p>
              </CardContent>
            </Card>
          )}

          {/* Warehouse Access */}
          {user?.sector?.privileges && hasPrivilege(user as any, SECTOR_PRIVILEGES.WAREHOUSE) && (
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate(routes.inventory.products.root)}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <IconPackage className="h-5 w-5 text-green-600 dark:text-green-400" />
                  Estoque
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Gerenciar produtos e inventário</p>
              </CardContent>
            </Card>
          )}

          {/* Maintenance Access */}
          {user?.sector?.privileges && hasPrivilege(user as any, SECTOR_PRIVILEGES.MAINTENANCE) && (
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate(routes.inventory.maintenance.root)}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <IconTool className="h-5 w-5 text-red-600 dark:text-red-400" />
                  Manutenção
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Registrar e acompanhar manutenções</p>
              </CardContent>
            </Card>
          )}

          {/* HR Access */}
          {user?.sector?.privileges && hasPrivilege(user as any, SECTOR_PRIVILEGES.HUMAN_RESOURCES) && (
            <Card className="cursor-pointer hover:shadow-lg transition-shadow" onClick={() => navigate(routes.humanResources.root)}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <IconUsers className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  Recursos Humanos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">Gerenciar colaboradores e férias</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </ThemedBackground>
  );
}
