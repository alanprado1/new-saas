import type { ReactNode } from "react";
import Link from "next/link";
import ShellControls from "./ShellControls";
import DockFrame from "./DockFrame";
import { NAV_ITEMS, type ShellSection } from "./nav";
import { ChatIcon, CourseIcon, HomeIcon, LibraryIcon, StudyIcon } from "./icons";
import styles from "./shell.module.css";

export type { ShellSection };

const ICONS: Record<ShellSection, ReactNode> = {
  home: <HomeIcon />,
  library: <LibraryIcon />,
  course: <CourseIcon />,
  study: <StudyIcon />,
  chat: <ChatIcon />,
};

/**
 * Page chrome: a fixed Dock (88px) on desktop and a bottom tab bar on phones.
 * The theme control and account button sit at the bottom of the Dock, and in a slim top bar on phones.
 *
 * Content area: margin-left 88px on desktop; on phones it starts below the slim top bar and
 * ends above the tab bar. Pass the section the page belongs to as `active`.
 * Full-screen surfaces (lesson runner, flashcard session, login) do not use the shell.
 * `collapsed` hides the Dock and phone bars for pages that need the whole screen (the scene player);
 * such a page opens the Dock as an overlay through `useDock()`.
 */
export default function AppShell({
  active,
  collapsed = false,
  children,
}: {
  active: ShellSection;
  collapsed?: boolean;
  children: ReactNode;
}) {
  return (
    <DockFrame collapsed={collapsed}>
      <nav className={styles.dock} aria-label="Main">
        <Link href="/" className={styles.mark} aria-label="ani語 home">語</Link>
        {NAV_ITEMS.map(item => (
          <Link key={item.key} href={item.href} className={styles.item} aria-current={item.key === active ? "page" : undefined}>
            {ICONS[item.key]}
            {item.label}
          </Link>
        ))}
        <div className={styles.spacer} />
        <ShellControls placement="dock" />
      </nav>

      <div className={styles.content}>
        <div className={styles.topbar}>
          <Link href="/" className={styles.wordmark} aria-label="ani語 home">ani<b>語</b></Link>
          <ShellControls placement="bar" />
        </div>
        <div className={styles.page}>{children}</div>
      </div>

      <nav className={styles.tabs} aria-label="Main">
        {NAV_ITEMS.map(item => (
          <Link key={item.key} href={item.href} className={styles.tab} aria-current={item.key === active ? "page" : undefined}>
            {ICONS[item.key]}
            {item.label}
          </Link>
        ))}
      </nav>
    </DockFrame>
  );
}
