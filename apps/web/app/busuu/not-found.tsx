import Link from 'next/link';
import styles from './busuu.module.css';

export default function CourseNotFound() {
  return <main id="course-main" className={styles.launchColumn}>
    <h1>Course entry not found</h1><p>Choose a course level to find its chapters and lessons.</p>
    <Link href="/busuu">Back to Complete Japanese</Link>
  </main>;
}
