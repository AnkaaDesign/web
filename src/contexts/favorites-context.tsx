import React, { createContext, useContext, useEffect, useState } from "react";

export type { FavoriteItem };

interface FavoriteItem {
  id: string;
  path: string;
  title: string;
  icon?: string;
  entityName?: string; // For cadastrar pages
  addedAt: Date;
  favoritePage?: string; // The FAVORITE_PAGES enum value
}

interface FavoritesContextType {
  favorites: FavoriteItem[];
  addFavorite: (item: Omit<FavoriteItem, "id" | "addedAt">) => void;
  removeFavorite: (id: string) => void;
  isFavorite: (path: string) => boolean;
  toggleFavorite: (item: Omit<FavoriteItem, "id" | "addedAt">) => void;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const STORAGE_KEY = "ankaa-favorites";

  const [favorites, setFavorites] = useState<FavoriteItem[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert addedAt string to Date
        return parsed.map((item: any) => ({
          ...item,
          addedAt: new Date(item.addedAt),
        }));
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error loading favorites:", error);
      }
    }
    return [];
  });

  // Save to localStorage whenever favorites change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.error("Error saving favorites:", error);
      }
    }
  }, [favorites]);

  const addFavorite = (item: Omit<FavoriteItem, "id" | "addedAt">) => {
    const newFavorite: FavoriteItem = {
      ...item,
      id: `favorite-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      addedAt: new Date(),
    };

    setFavorites((prev) => {
      // Check if already exists
      if (prev.some((fav) => fav.path === item.path)) {
        return prev;
      }
      return [...prev, newFavorite];
    });
  };

  const removeFavorite = (id: string) => {
    setFavorites((prev) => prev.filter((fav) => fav.id !== id));
  };

  const isFavorite = (path: string) => {
    return favorites.some((fav) => fav.path === path);
  };

  const toggleFavorite = (item: Omit<FavoriteItem, "id" | "addedAt">) => {
    if (isFavorite(item.path)) {
      const favorite = favorites.find((fav) => fav.path === item.path);
      if (favorite) {
        removeFavorite(favorite.id);
      }
    } else {
      addFavorite(item);
    }
  };

  return (
    <FavoritesContext.Provider
      value={{
        favorites,
        addFavorite,
        removeFavorite,
        isFavorite,
        toggleFavorite,
      }}
    >
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) {
    throw new Error("useFavorites must be used within a FavoritesProvider");
  }
  return context;
}
