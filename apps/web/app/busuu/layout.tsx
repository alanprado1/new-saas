import type { Metadata } from 'next';
import CourseChrome from '@/components/busuu/CourseChrome';

export const metadata: Metadata = { title: 'Complete Japanese · ani語', description: 'Explore your Japanese course, chapters and lessons.' };
export default function CourseLayout({ children }: { children: React.ReactNode }) {
  return <CourseChrome>{children}</CourseChrome>;
}
