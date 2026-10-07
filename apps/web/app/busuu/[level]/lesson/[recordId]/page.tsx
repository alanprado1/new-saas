import { notFound } from 'next/navigation';
import { getCourseEntry, getLessonSpec, isCourseLevel } from '@/lib/busuu/inventory';
import { getLessonReadiness } from '@/lib/busuu/readiness';
import LessonLaunch from '@/components/busuu/LessonLaunch';

export default async function LessonPage({ params, searchParams }: {
  params: Promise<{ level: string; recordId: string }>; searchParams?: Promise<{ restart?: string | string[] }>;
}) {
  const { level, recordId } = await params;
  if (!isCourseLevel(level)) notFound();
  const selected = getCourseEntry(level, recordId);
  const spec = getLessonSpec(recordId);
  if (!selected || !spec) notFound();
  const restart = (await searchParams)?.restart === '1';
  return <LessonLaunch levelId={level} entry={selected.entry} chapter={selected.chapter} spec={spec} readiness={getLessonReadiness(spec)} restart={restart} />;
}
