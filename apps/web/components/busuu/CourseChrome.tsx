'use client';
import { usePathname } from 'next/navigation';
import CourseHeader from './CourseHeader';
import styles from '@/app/busuu/busuu.module.css';

// The course has its top navigation on the map pages only; an open lesson fills the screen (as in Busuu).
export function isLessonPath(pathname: string | null) {
  return Boolean(pathname && /^\/busuu\/[^/]+\/lesson\/[^/]+/.test(pathname));
}
export default function CourseChrome({ children }: { children: React.ReactNode }) {
  const lesson = isLessonPath(usePathname());
  return <div className={`${styles.courseRoot} ${lesson ? styles.courseRootLesson : ''}`}>
    <a href="#course-main" className={styles.skipLink}>Skip to course</a>
    {!lesson && <CourseHeader />}
    {children}
  </div>;
}
