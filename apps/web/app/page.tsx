import AppShell from "@/components/shell/AppShell";
import HomeView from "@/components/shell/HomeView";
import { buildCourseIndex } from "@/components/shell/course-index";

/**
 * Home. The scene library lives at /library.
 * The course index is static inventory data (titles and order only), built once on the server;
 * everything personal is read in the browser by HomeView.
 */
export default function HomePage() {
  return (
    <AppShell active="home">
      <HomeView index={buildCourseIndex()} />
    </AppShell>
  );
}
