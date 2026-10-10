"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import styles from "./shell.module.css";

type DockState = { collapsed: boolean; open: boolean; setOpen: (open: boolean) => void };

const DockContext = createContext<DockState | null>(null);

/** Collapsed-dock state for pages that need the whole screen (the scene player). */
export function useDock(): DockState | null {
  return useContext(DockContext);
}

/**
 * Root of the shell. When `collapsed`, the Dock, phone top bar and tab bar are hidden;
 * the page opens the Dock as an overlay through `useDock().setOpen(true)`.
 */
export default function DockFrame({ collapsed, children }: { collapsed: boolean; children: ReactNode }) {
  const [open, setOpenState] = useState(false);
  const setOpen = useCallback((next: boolean) => setOpenState(collapsed && next), [collapsed]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenState(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const value = useMemo(() => ({ collapsed, open, setOpen }), [collapsed, open, setOpen]);

  return (
    <DockContext.Provider value={value}>
      <div className={styles.root} data-collapsed={collapsed ? "true" : undefined} data-open={open ? "true" : undefined}>
        {children}
        {collapsed && open && <button type="button" className={styles.scrimClose} aria-label="Close navigation" onClick={() => setOpenState(false)} />}
      </div>
    </DockContext.Provider>
  );
}
