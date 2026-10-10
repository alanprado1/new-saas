import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getLevelInventory } from '@/lib/busuu/inventory';

// Opens the level the learner used last (set by the course map), A1 the first time.
export default async function CourseIndex() {
  const saved = (await cookies()).get('anigo-course-level')?.value;
  const level = saved ? getLevelInventory(saved) : undefined;
  redirect(`/busuu/${level?.id ?? 'A1'}`);
}
