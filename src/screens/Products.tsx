import { EmptyState } from "@/components/EmptyState";
import { SCREENS } from "@/nav";

// TODO(Claude Code): replace <EmptyState/> with the full "products" screen, built
// 1:1 from design/Atlas PPM.dc.html. Empty state (no seed data) until then.
export default function Products() {
  const s = SCREENS.products;
  return <EmptyState title={s.title} subtitle={s.subtitle} icon={s.icon} />;
}
