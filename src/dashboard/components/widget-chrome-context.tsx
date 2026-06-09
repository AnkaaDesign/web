// Lightweight context that lets the shared WidgetCard chrome reach edit-mode
// affordances owned by the tile/page. WidgetCard reads it to wire INLINE
// double-click-to-rename on the title element (the title becomes an input in
// place — there is no rename modal).

import { createContext, useContext } from "react";

export interface WidgetChromeValue {
  /** Whether the dashboard is in edit mode. */
  isEditing: boolean;
  /** Persist a new title (writes config.title). Present only in edit mode. */
  onRenameCommit?: (title: string) => void;
  /** Current title text, used to seed the inline input. */
  currentTitle?: string;
  /**
   * Monotonic counter the tile's pencil button bumps to ask WidgetCard to
   * enter inline-edit mode from the toolbar. WidgetCard watches it.
   */
  renameSignal?: number;
}

const WidgetChromeContext = createContext<WidgetChromeValue>({ isEditing: false });

export const WidgetChromeProvider = WidgetChromeContext.Provider;

export function useWidgetChrome(): WidgetChromeValue {
  return useContext(WidgetChromeContext);
}
