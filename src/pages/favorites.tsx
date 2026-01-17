import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { useFavorites } from "@/contexts/favorites-context";
import type { FavoriteItem } from "@/contexts/favorites-context";
import { FAVORITE_PAGES_LABELS } from "../constants";
import { getPageIconInfo, isPageCadastrar, getPageIconName } from "../utils";
import { getTablerIcon } from "../utils";
import { ThemedBackground } from "@/components/ui";
import { IconStar, IconStarOff, IconPlus, IconFile } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import * as TablerIcons from "@tabler/icons-react";
import { DETAIL_PAGE_SPACING } from "@/lib/layout-constants";

export function FavoritesPage() {
  const navigate = useNavigate();
  const { favorites } = useFavorites();

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  // Function to render favorite icon with plus overlay for cadastrar pages (same as sidebar)
  const renderFavoriteIcon = (fav: FavoriteItem, size: number = 24) => {
    // Try to get icon name from the path itself
    const iconName = getPageIconName(fav.path);
    const isCadastrar = isPageCadastrar(fav.path);

    if (!iconName) {
      return <IconFile size={size} stroke={1.5} />;
    }

    // Convert kebab-case to camelCase for TABLER_ICONS lookup
    const camelCaseName = iconName.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const tablerName = getTablerIcon(camelCaseName);
    const IconComponent = TablerIcons[tablerName as keyof typeof TablerIcons] as React.ComponentType<{ size?: number; stroke?: number; className?: string }>;

    if (!IconComponent) {
      return <IconFile size={size} stroke={1.5} />;
    }

    const mainIcon = <IconComponent size={size} stroke={1.5} />;

    if (isCadastrar) {
      return (
        <div className="relative">
          {mainIcon}
          <div className="absolute -top-1.5 -right-1.5 bg-white dark:bg-gray-800 rounded-full p-0.5">
            <IconPlus size={10} className="text-green-600" strokeWidth={3} />
          </div>
        </div>
      );
    }

    return mainIcon;
  };

  return (
    <div className="h-full flex flex-col px-4 pt-4">
      <div className="flex-shrink-0">
        <PageHeader variant="list" title="Favoritos" icon={IconStar} breadcrumbs={[{ label: "Início", href: "/" }, { label: "Favoritos" }]} />
      </div>
      <div className="flex-1 overflow-y-auto pb-6">
        <div className="mt-4">
          {favorites.length === 0 ? (
        <ThemedBackground className="p-4 rounded-lg flex-1">
          <div className="flex items-center justify-center min-h-[calc(100vh-16rem)]">
            <div className="text-center space-y-4 max-w-md">
              <div className="flex justify-center mb-4">
                <div className="bg-yellow-100 dark:bg-yellow-900/20 p-4 rounded-full">
                  <IconStarOff className="h-16 w-16 text-yellow-600 dark:text-yellow-500" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">Nenhum favorito ainda</h2>
              <p className="text-gray-600 dark:text-gray-400">Adicione suas páginas favoritas clicando no ícone de estrela ao lado do título de cada página.</p>
            </div>
          </div>
        </ThemedBackground>
      ) : (
        <ThemedBackground className="p-4 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
            {favorites.map((favorite) => {
              const iconInfo = getPageIconInfo(favorite.path);
              const label = FAVORITE_PAGES_LABELS[favorite.path as keyof typeof FAVORITE_PAGES_LABELS] || favorite.title;

              return (
                <Card
                  key={favorite.id}
                  className={cn(
                    "cursor-pointer transition-shadow duration-200",
                    "rounded-md border border-border",
                    "hover:shadow-sm hover:shadow-neutral-200 dark:hover:shadow-neutral-900",
                  )}
                  onClick={() => handleNavigate(favorite.path)}
                >
                  <CardContent className="p-4">
                    <div className={cn(iconInfo.color, "text-white p-3 rounded-lg inline-block mb-3")}>{renderFavoriteIcon(favorite, 24)}</div>
                    <h3 className="font-semibold text-sm text-secondary-foreground line-clamp-2">{label}</h3>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </ThemedBackground>
      )}
        </div>
      </div>
    </div>
  );
}
