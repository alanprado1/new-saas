import Link from 'next/link';
import styles from '@/app/busuu/busuu.module.css';

export default function CourseHeader() {
  return <header className={styles.header}>
    <Link href="/" className={styles.brand} aria-label="ani語 Library">ani<span>語</span></Link>
    <nav aria-label="Main navigation" className={styles.navigation}>
      <Link href="/" className={styles.navLink}>Library</Link>
      <Link href="/busuu" aria-current="page" className={`${styles.navLink} ${styles.activeNav}`}>Course</Link>
      <Link href="/study" className={styles.navLink}>Study</Link>
      <Link href="/voicechat" className={styles.navLink}>Chat</Link>
    </nav>
    <Link href="/" className={styles.accountLink}>Account &amp; settings</Link>
  </header>;
}
