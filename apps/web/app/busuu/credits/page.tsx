import styles from '../busuu.module.css';

export default function CreditsPage() {
  return <main id="course-main" className={styles.courseColumn}>
    <h1>Credits</h1>
    <p>Kanji stroke animations use artwork from <a href="https://github.com/parsimonhi/animCJK">AnimCJK</a>, adapted from Arphic fonts, under the <a href="/kanji/ARPHICPL.TXT">Arphic Public License</a>.</p>
  </main>;
}
