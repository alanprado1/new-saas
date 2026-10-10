import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import type { LibraryLesson } from "@/lib/lesson";
import styles from "./scene-card.module.css";

/** "ramen_shop" -> "Ramen shop" */
function placeName(tag: string): string {
  const spaced = tag.replace(/_/g, " ").trim();
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : "";
}

/** "4 Jul 2026" */
export function formatSceneDate(createdAt: string): string {
  return new Date(createdAt).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * One scene: art undimmed at 16:10, level pill bottom-left, title and "place · date" below.
 * Pass `href` for a link card (Home) or `onOpen` for a button card (Library, which tracks the loading state).
 * `actions` is positioned over the top-right of the art (the owner's delete button).
 */
export default function SceneCard({
  lesson,
  href,
  onOpen,
  loading = false,
  actions,
}: {
  lesson: LibraryLesson;
  href?: string;
  onOpen?: () => void;
  loading?: boolean;
  actions?: ReactNode;
}) {
  const title = lesson.structured_content?.title ?? "Untitled scene";
  const place = placeName(lesson.structured_content?.background_tag ?? "");
  const meta = [place, formatSceneDate(lesson.created_at)].filter(Boolean).join(" · ");

  const body = (
    <>
      <span
        className={styles.art}
        style={lesson.background_image_url ? { backgroundImage: `url(${lesson.background_image_url})` } : undefined}
      >
        <span className={styles.pill} data-level={lesson.level}>{lesson.level}</span>
      </span>
      <span className={styles.text}>
        {loading ? (
          <span role="status" className={styles.opening}>
            <i /><i /><i />
            Opening scene…
          </span>
        ) : (
          <>
            <span className={styles.title}>{title}</span>
            <span className={styles.meta}>{meta}</span>
          </>
        )}
      </span>
    </>
  );

  return (
    <div className={styles.wrap}>
      {href ? (
        <Link href={href} className={styles.card}>{body}</Link>
      ) : (
        <button type="button" className={styles.card} onClick={onOpen} disabled={loading} aria-busy={loading}>
          {body}
        </button>
      )}
      {actions}
    </div>
  );
}

/** Owner-only delete control for the `actions` slot. */
export function SceneDeleteButton({
  deleting,
  disabled,
  onClick,
}: {
  deleting: boolean;
  disabled: boolean;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      className={styles.delete}
      onClick={onClick}
      disabled={disabled}
      aria-busy={deleting}
      aria-label={deleting ? "Deleting scene" : "Delete scene"}
      title={deleting ? "Deleting scene…" : "Delete scene"}
    >
      {deleting ? "…" : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      )}
    </button>
  );
}
