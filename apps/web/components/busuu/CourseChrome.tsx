'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AppShell from '@/components/shell/AppShell';
import styles from '@/app/busuu/busuu.module.css';

// Map pages sit inside the app shell (dock navigation); an open lesson fills the screen with no shell (as in Busuu).
export function isLessonPath(pathname: string | null) {
  return Boolean(pathname && /^\/busuu\/[^/]+\/lesson\/[^/]+/.test(pathname));
}
export default function CourseChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const lesson = isLessonPath(pathname);
  const root = <div className={`${styles.courseRoot} ${lesson ? styles.courseRootLesson : ''}`}>
    <a href="#course-main" className={styles.skipLink}>Skip to course</a>
    {children}
    {!lesson && pathname !== '/busuu/credits' && <Link href="/busuu/credits" className={styles.creditsLink}>Credits</Link>}
  </div>;
  return lesson ? root : <AppShell active="course">{root}</AppShell>;
}
