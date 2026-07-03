import { EmptyState } from "@/components/EmptyState";
import { SCREENS } from "@/nav";

// TODO(Claude Code): replace <EmptyState/> with the full "gantt" screen, built
// 1:1 from design/Atlas PPM.dc.html. Empty state (no seed data) until then.
export default function Gantt() {
  const s = SCREENS.gantt;
  return <EmptyState title={s.title} subtitle={s.subtitle} icon={s.icon} />;
}
