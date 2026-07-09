import { useQuery } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { api } from "@/api";
import { Card } from "@/components/ui";

// ---------------------------------------------------------------------------
// Read-only skills matrix for the people ASSIGNED to a project/program/product/
// release, shown on the entity's Overview. Editing stays in My Team; this just
// surfaces the assigned team's competencies. Renders nothing until there are
// both assigned people and defined skills, so it stays quiet otherwise.
// ---------------------------------------------------------------------------
interface Skill { id: number; name: string }
interface Rating { skillId: number; person: string; level: number }
interface SkillsData { canEdit: boolean; skills: Skill[]; people: string[]; ratings: Rating[] }

const LEVEL_LABEL = ["—", "1", "2", "3", "4"];
const levelColor = (n: number) => (n >= 4 ? "#0B6B37" : n === 3 ? "#15A34A" : n >= 1 ? "#C98A00" : color.faint3);
const levelTint = (n: number) => (n >= 4 ? color.successTint : n === 3 ? color.successTint : n >= 1 ? color.warningTint : "transparent");

export function SkillsPanel({ entityType, entityId }: { entityType: string; entityId: string }) {
  const { data } = useQuery({
    queryKey: ["skills-entity", entityType, entityId], enabled: !!entityId, retry: false, staleTime: 30_000,
    queryFn: async (): Promise<SkillsData> =>
      (await api<SkillsData>(`/skills/entity/${entityType}/${entityId}`)) ?? { canEdit: false, skills: [], people: [], ratings: [] },
  });
  const skills = data?.skills ?? [];
  const people = data?.people ?? [];
  const rating = new Map((data?.ratings ?? []).map((r) => [`${r.skillId}|${r.person}`, r.level]));
  // Nothing assigned here yet → stay quiet. But once people are assigned, always
  // show the panel — with a helpful nudge if no skills are defined yet — rather
  // than vanishing (which read as "broken").
  if (people.length === 0) return null;

  const NAME_COL = 200;
  return (
    <Card padding={0} style={{ overflow: "hidden" }}>
      <div style={{ padding: "15px 20px", borderBottom: `1px solid ${color.bg}` }}>
        <div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 700, color: color.ink }}>Team skills</div>
        <div style={{ fontSize: 12, color: color.faint2, marginTop: 2 }}>Competency (0–4) of the people assigned here · maintained in My Team</div>
      </div>
      {skills.length === 0 && (
        <div style={{ padding: "18px 20px", fontSize: 12.5, color: color.faint3 }}>
          {people.length} {people.length === 1 ? "person" : "people"} assigned. No skills defined yet — add skill columns and rate people in <b style={{ color: color.subtle }}>My Team → Skills &amp; competency matrix</b>, and their ratings will appear here.
        </div>
      )}
      {skills.length > 0 && (
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: NAME_COL + skills.length * 64 }}>
          {/* header */}
          <div style={{ display: "flex", borderBottom: `1px solid ${color.bg}`, background: color.surfaceAlt }}>
            <div style={{ width: NAME_COL, flex: "none", padding: "9px 20px", fontSize: 11, fontWeight: 600, color: color.faint3, letterSpacing: "0.04em", textTransform: "uppercase" }}>Person</div>
            {skills.map((s) => (
              <div key={s.id} title={s.name} style={{ width: 64, flex: "none", padding: "9px 4px", textAlign: "center", fontSize: 11, fontWeight: 600, color: color.subtle, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</div>
            ))}
          </div>
          {/* rows */}
          {people.map((p) => (
            <div key={p} style={{ display: "flex", borderBottom: `1px solid ${color.surfaceAlt}`, alignItems: "stretch" }}>
              <div style={{ width: NAME_COL, flex: "none", padding: "8px 20px", fontSize: 12.5, color: color.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p}</div>
              {skills.map((s) => {
                const lvl = rating.get(`${s.id}|${p}`) ?? 0;
                return (
                  <div key={s.id} style={{ width: 64, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", background: levelTint(lvl) }}>
                    <span style={{ fontFamily: font.mono, fontSize: 13, fontWeight: 700, color: levelColor(lvl) }}>{lvl === 0 ? "—" : LEVEL_LABEL[lvl]}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      )}
    </Card>
  );
}
