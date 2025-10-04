import React from "react";
import { IconStar } from "@tabler/icons-react";
import { toast } from "sonner";
import { Button } from "./button";
import { useFavorites } from "@/contexts/favorites-context";
import { FAVORITE_PAGES, FAVORITE_PAGES_LABELS } from "../../constants";
import { cn } from "@/lib/utils";

interface FavoriteButtonProps {
  page?: FAVORITE_PAGES;
  pageKey?: FAVORITE_PAGES;
  pageTitle?: string;
  className?: string;
  variant?: "outline" | "ghost" | "default";
  size?: "sm" | "default" | "lg" | "icon";
  showTooltip?: boolean;
}

export function FavoriteButton({ page, pageKey, pageTitle, className, variant = "ghost", size = "icon", showTooltip = false }: FavoriteButtonProps) {
  const favoritePage = page || pageKey;
  const { isFavorite, toggleFavorite } = useFavorites();

  // Use the enum value as the path if page is provided, otherwise use current path
  const path = favoritePage || window.location.pathname;
  const title = pageTitle || (favoritePage ? FAVORITE_PAGES_LABELS[favoritePage] : "Página");
  const isFav = isFavorite(path);

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    toggleFavorite({
      path: path,
      title: title,
      icon: "star",
      favoritePage: favoritePage,
    });

    toast(isFav ? "Removido dos favoritos" : "Adicionado aos favoritos", {
      description: isFav ? `${title} foi removido dos seus favoritos` : `${title} foi adicionado aos seus favoritos`,
    });
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleToggleFavorite}
      className={cn("transition-colors", isFav && "text-yellow-500 hover:text-yellow-600", className)}
      title={showTooltip ? (isFav ? "Remover dos favoritos" : "Adicionar aos favoritos") : undefined}
    >
      <IconStar className={cn("h-4 w-4", isFav && "fill-current")} />
    </Button>
  );
}
