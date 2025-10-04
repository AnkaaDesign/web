import React, { createContext, useContext, useState, useCallback, useMemo, memo, useRef, useEffect } from "react";
import type { ReactNode } from "react";

interface SidebarContextType {
  isOpen: boolean;
  toggle: () => void;
  setIsOpen: (isOpen: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export const SidebarProvider: React.FC<{ children: ReactNode }> = memo(({ children }) => {
  const [isOpen, setIsOpen] = useState(true);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      isOpen,
      toggle,
      setIsOpen,
    }),
    [isOpen, toggle],
  );

  return <SidebarContext.Provider value={contextValue}>{children}</SidebarContext.Provider>;
});

SidebarProvider.displayName = "SidebarProvider";

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

// Performance tracking hook for development
export const useSidebarPerformance = () => {
  const context = useContext(SidebarContext);
  const renderCount = useRef(0);

  if (!context) {
    throw new Error("useSidebarPerformance must be used within a SidebarProvider");
  }

  useEffect(() => {
    renderCount.current += 1;

    if (process.env.NODE_ENV === "development") {
    }
  });

  return { renderCount: renderCount.current, ...context };
};
