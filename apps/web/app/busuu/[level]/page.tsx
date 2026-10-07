import { notFound } from 'next/navigation';
import { getCourseEntry, getLevelInventory, inventory } from '@/lib/busuu/inventory';
import { buildLevelViews } from '@/lib/busuu/map-views';
import SavedCourseMap from '@/components/busuu/SavedCourseMap';
import styles from '../busuu.module.css';

export default async function CourseLevelPage({ params, searchParams }: {
  params: Promise<{ level: string }>; searchParams: Promise<{ selected?: string | string[] }>;
}) {
  const { level: levelId } = await params;
  const level = getLevelInventory(levelId);
  if (!level) notFound();
  const query = await searchParams;
  const selected = typeof query.selected === 'string' && getCourseEntry(level.id, query.selected) ? query.selected : undefined;
  const choices = inventory.levels.map(l => ({ id: l.id, name: l.name, chapterCount: l.chapters.length }));
  return <main id="course-main" className={styles.courseColumn}>
    <h1>Complete Japanese</h1>
    <SavedCourseMap level={level} views={buildLevelViews(level)} choices={choices} selected={selected} />
  </main>;
}
