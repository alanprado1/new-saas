"use client";

import { useCallback, useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { GROUNDS, THEMES } from "@/lib/themes";
import { useTheme } from "@/hooks/useTheme";
import { CheckIcon, ChevronDownIcon, InfoIcon, PaletteIcon, PersonIcon } from "./icons";
import styles from "./shell.module.css";

type MenuId = "accent" | "ground" | "account";

/**
 * The theme control (palette button joined to a chevron button) and the account button.
 *   palette  -> accent list (sets the accent only)
 *   chevron  -> ground list (sets the ground only)
 *   avatar   -> account menu (signed-in address, Credits)
 * One popover is open at a time. Escape and an outside click close it; focus returns to its trigger.
 */
export default function ShellControls({ placement }: { placement: "dock" | "bar" }) {
  const { theme, setTheme, ground, setGround } = useTheme();
  const [open, setOpen] = useState<MenuId | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggers = useRef<Partial<Record<MenuId, HTMLButtonElement | null>>>({});
  const baseId = useId();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user.email ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const close = useCallback((returnFocus: boolean) => {
    if (open && returnFocus) triggers.current[open]?.focus();
    setOpen(null);
  }, [open]);

  // Outside pointer press and Escape close the open popover.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(null);
    };
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") close(true);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, close]);

  // Move focus into the popover when it opens (the current choice, else the first option).
  useEffect(() => {
    if (!open) return;
    const panel = rootRef.current?.querySelector<HTMLElement>(`[data-menu="${open}"]`);
    const target = panel?.querySelector<HTMLElement>('[aria-current="true"]') ?? panel?.querySelector<HTMLElement>("button, a");
    target?.focus();
  }, [open]);

  const toggle = (menu: MenuId) => setOpen(current => (current === menu ? null : menu));

  // Tabbing to a control outside this group closes the popover. A null relatedTarget (some browsers on click) is ignored.
  const onBlur = (event: FocusEvent) => {
    const next = event.relatedTarget as Node | null;
    if (open && next && rootRef.current && !rootRef.current.contains(next)) setOpen(null);
  };

  const onMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(event.key)) return;
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("button, a"));
    if (!items.length) return;
    event.preventDefault();
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === "Home" ? 0
      : event.key === "End" ? items.length - 1
      : event.key === "ArrowDown" ? (index + 1) % items.length
      : (index - 1 + items.length) % items.length;
    items[next].focus();
  };

  const id = (menu: MenuId) => `${baseId}-${menu}`;
  const initial = email ? email.trim().charAt(0).toUpperCase() : "";

  return (
    <div ref={rootRef} className={styles.controls} data-placement={placement} onBlur={onBlur}>
      <div className={styles.pair}>
        <button
          type="button"
          ref={el => { triggers.current.accent = el; }}
          className={styles.pairMain}
          aria-label={`Accent colour: ${theme.label}`}
          aria-haspopup="true"
          aria-expanded={open === "accent"}
          aria-controls={open === "accent" ? id("accent") : undefined}
          onClick={() => toggle("accent")}
        >
          <PaletteIcon />
          <span className={styles.dot} aria-hidden="true" />
        </button>
        <button
          type="button"
          ref={el => { triggers.current.ground = el; }}
          className={styles.pairChev}
          aria-label={`Background: ${ground.label}`}
          aria-haspopup="true"
          aria-expanded={open === "ground"}
          aria-controls={open === "ground" ? id("ground") : undefined}
          onClick={() => toggle("ground")}
        >
          <ChevronDownIcon />
        </button>
      </div>

      <button
        type="button"
        ref={el => { triggers.current.account = el; }}
        className={styles.avatar}
        aria-label="Account"
        aria-haspopup="true"
        aria-expanded={open === "account"}
        aria-controls={open === "account" ? id("account") : undefined}
        onClick={() => toggle("account")}
      >
        {initial || <PersonIcon />}
      </button>

      {open === "accent" && (
        <div id={id("accent")} data-menu="accent" role="group" aria-labelledby={`${id("accent")}-title`} className={styles.pop} onKeyDown={onMenuKeyDown}>
          <h2 id={`${id("accent")}-title`} className={styles.popTitle}>Accent colour</h2>
          {THEMES.map(t => (
            <button
              key={t.name}
              type="button"
              className={styles.option}
              aria-current={t.name === theme.name ? "true" : undefined}
              onClick={() => { setTheme(t); close(true); }}
            >
              <span className={styles.swatch} style={{ background: t.accent }} aria-hidden="true" />
              {t.label}
              {t.name === theme.name && <CheckIcon className={styles.tick} />}
            </button>
          ))}
        </div>
      )}

      {open === "ground" && (
        <div id={id("ground")} data-menu="ground" role="group" aria-labelledby={`${id("ground")}-title`} className={styles.pop} onKeyDown={onMenuKeyDown}>
          <h2 id={`${id("ground")}-title`} className={styles.popTitle}>Background</h2>
          {GROUNDS.map(g => (
            <button
              key={g.name}
              type="button"
              className={styles.option}
              aria-current={g.name === ground.name ? "true" : undefined}
              onClick={() => { setGround(g); close(true); }}
            >
              <span className={styles.swatch} style={{ background: g.swatch }} aria-hidden="true" />
              {g.label}
              {g.name === ground.name && <CheckIcon className={styles.tick} />}
            </button>
          ))}
        </div>
      )}

      {open === "account" && (
        <div id={id("account")} data-menu="account" role="group" aria-labelledby={`${id("account")}-title`} className={styles.pop} onKeyDown={onMenuKeyDown}>
          <h2 id={`${id("account")}-title`} className={styles.popTitle}>Account</h2>
          {email && <p className={styles.accountName}>{email}</p>}
          <Link href="/busuu/credits" className={styles.option} onClick={() => setOpen(null)}>
            <InfoIcon className={styles.optionIcon} />
            Credits
          </Link>
        </div>
      )}
    </div>
  );
}
