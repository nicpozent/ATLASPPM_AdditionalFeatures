import { useQuery } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { api } from "@/api";
import { Card, EmptyBlock } from "@/components/ui";
import { Icon } from "@/components/Icon";

// ---------------------------------------------------------------------------
// My Team — members come from Entra groups mapped to a manager slot in Admin →
// Teams. A manager sees their own team plus every team beneath them in the
// roll-up tree; the Platform Admin sees all mapped teams. Skills/allocation are
// enriched elsewhere; here we show the roster cleanly.
// ---------------------------------------------------------------------------
interface Member { id: number; displayName: string; email: string; jobTitle: string; }
interface Group { id: string; displayName: string; members: Member[]; }
interface ManagerTeam { key: string; label: string; isSelf: boolean; groups: Group[]; memberCount: number; }
interface MyTeam { isAdmin: boolean; managerKey: string; managerLabel: string; teams: ManagerTeam[]; }

const AVATAR_COLORS = ["#0F6CBD", "#7A3FB0", "#0E7C7B", "#C98A00", "#15A34A", "#A1282B"];
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
const avatarColor = (name: string) => AVATAR_COLORS[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_COLORS.length];

export default function Teams() {
  const { data } = useQuery({
    queryKey: ["myteam"], retry: false, staleTime: 30_000,
    queryFn: async (): Promise<MyTeam> => (await api<MyTeam>("/myteam")) ?? { isAdmin: false, managerKey: "", managerLabel: "", teams: [] },
  });
  const teams = data?.teams ?? [];
  const totalMembers = teams.reduce((s, t) => s + t.memberCount, 0);

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13.5, color: color.subtle, flex: 1 }}>
          {data?.isAdmin
            ? "All teams, grouped by manager. Members sync from the Entra groups mapped in Administration → Teams."
            : data?.managerLabel
              ? <>Your team{teams.some((t) => !t.isSelf) ? " and the teams that roll up to you" : ""} — synced from Entra groups.</>
              : "Members sync from Entra groups mapped to a manager. Ask a Platform Admin to map your groups in Administration → Teams."}
        </div>
        {totalMembers > 0 && <span style={{ fontSize: 12, fontWeight: 600, color: color.textMuted, background: color.bg, borderRadius: 20, padding: "5px 12px" }}>{totalMembers} member{totalMembers === 1 ? "" : "s"}</span>}
      </div>

      {teams.length === 0 ? (
        <Card><EmptyBlock minHeight={200} message="No team members yet — a Platform Admin maps Entra groups to managers in Administration → Teams." /></Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {teams.map((t) => (
            <Card key={t.key} padding={0} style={{ overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "15px 22px", borderBottom: `1px solid ${color.bg}` }}>
                <span style={{ width: 34, height: 34, borderRadius: 9, background: "#EEF3FB", color: color.primary, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Icon name="users" size={18} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: font.head, fontSize: 15.5, fontWeight: 600, color: color.navy }}>{t.label}</span>
                    {t.isSelf && <span style={{ fontSize: 10, fontWeight: 700, color: "#0B6B37", background: "#E7F4EC", borderRadius: 5, padding: "1px 7px", textTransform: "uppercase", letterSpacing: "0.03em" }}>You</span>}
                    {!t.isSelf && !data?.isAdmin && <span style={{ fontSize: 10, fontWeight: 700, color: "#566077", background: "#EEF0F4", borderRadius: 5, padding: "1px 7px", textTransform: "uppercase", letterSpacing: "0.03em" }}>Reports to you</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: color.faint3 }}>{t.memberCount} member{t.memberCount === 1 ? "" : "s"} · {t.groups.length} group{t.groups.length === 1 ? "" : "s"}</div>
                </div>
              </div>
              {t.memberCount === 0 ? (
                <EmptyBlock minHeight={80} message="No members in this team's Entra groups yet." />
              ) : (
                <div style={{ padding: "8px 12px" }}>
                  {t.groups.map((g) => (
                    <div key={g.id} style={{ padding: "8px 10px" }}>
                      {t.groups.length > 1 && <div style={{ fontSize: 11, fontWeight: 700, color: color.faint3, textTransform: "uppercase", letterSpacing: "0.04em", margin: "4px 0 10px" }}>{g.displayName}</div>}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 10 }}>
                        {g.members.map((m) => (
                          <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 11, border: `1px solid ${color.border}`, borderRadius: 12, padding: "10px 12px" }}>
                            <span style={{ width: 34, height: 34, borderRadius: "50%", background: avatarColor(m.displayName), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flex: "none" }}>{initials(m.displayName)}</span>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 600, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.displayName}</div>
                              <div style={{ fontSize: 11.5, color: color.faint3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.jobTitle || m.email || "—"}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
