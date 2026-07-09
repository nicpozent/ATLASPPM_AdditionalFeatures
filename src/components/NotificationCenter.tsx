import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { api } from "@/api";
import { Icon } from "./Icon";
import { Modal } from "./ui";
import { useRole } from "./RoleContext";

// ---------------------------------------------------------------------------
// Notification center — the topbar bell. Shows the caller's in-app inbox with
// an unread badge, lets them mark items read, and opens per-event preferences
// (in-app / email). Subscriptions to individual projects/programs/products are
// managed from those items' detail screens (SubscribeButton).
// ---------------------------------------------------------------------------
interface Notif { id: number; eventType: string; title: string; body: string; targetType: string; targetId: string; read: boolean; at: string; }
interface Inbox { unreadCount: number; items: Notif[]; }
interface Pref { eventType: string; label: string; detail: string; entityScoped: boolean; inApp: boolean; email: boolean; }

const EVENT_TINT: Record<string, { ink: string; bg: string; icon: string }> = {
  risk: { ink: color.dangerInk, bg: color.dangerTint, icon: "alert" },
  date_slip: { ink: color.warningInk, bg: color.warningTint, icon: "clock" },
  status_change: { ink: "#6A2E9E", bg: color.accentTint, icon: "refresh" },
  approval: { ink: color.successInk, bg: color.successTint, icon: "check" },
  created: { ink: "#0F6CBD", bg: color.primaryTint, icon: "plus" },
};

function relTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (!t) return "";
  const s = Math.max(0, Math.round((Date.now() - t) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60); if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24); return d < 7 ? `${d}d ago` : new Date(iso).toLocaleDateString();
}

export function NotificationCenter() {
  const { role } = useRole();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["inbox", role], retry: false, refetchInterval: 30_000,
    queryFn: async (): Promise<Inbox> => (await api<Inbox>("/notifications")) ?? { unreadCount: 0, items: [] },
  });
  const markRead = useMutation({
    mutationFn: (body: { ids?: number[]; all?: boolean }) => api("/notifications/read", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inbox"] }),
  });

  const inbox = data ?? { unreadCount: 0, items: [] };

  return (
    <>
      <button onClick={() => setOpen((v) => !v)} title="Notifications" style={{
        position: "relative", width: 40, height: 40, borderRadius: 9,
        border: `1px solid ${color.border3}`, background: open ? color.primaryTint : color.surface,
        display: "flex", alignItems: "center", justifyContent: "center", color: open ? color.primary : color.subtle, cursor: "pointer",
      }}>
        <Icon name="bell" size={18} />
        {inbox.unreadCount > 0 && (
          <span style={{
            position: "absolute", top: -5, right: -5, minWidth: 18, height: 18, padding: "0 4px",
            borderRadius: 9, background: color.danger, color: "#fff", border: "2px solid #fff",
            fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
          }}>{inbox.unreadCount > 99 ? "99+" : inbox.unreadCount}</span>
        )}
      </button>

      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div style={{
            position: "absolute", top: 58, right: 26, width: 380, maxHeight: 520, zIndex: 50,
            background: color.surface, border: `1px solid ${color.border}`, borderRadius: 14,
            boxShadow: "0 12px 40px rgba(20,26,60,0.18)", display: "flex", flexDirection: "column", overflow: "hidden",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "13px 16px", borderBottom: `1px solid ${color.bg}` }}>
              <span style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.navy, flex: 1 }}>Notifications</span>
              {inbox.unreadCount > 0 && (
                <button onClick={() => markRead.mutate({ all: true })} style={linkBtn}>Mark all read</button>
              )}
              <button onClick={() => { setPrefsOpen(true); setOpen(false); }} title="Notification settings" style={{ background: "none", border: "none", cursor: "pointer", color: color.faint3, display: "flex", padding: 3 }}><Icon name="gear" size={16} /></button>
            </div>

            <div style={{ overflowY: "auto" }}>
              {inbox.items.length === 0 ? (
                <div style={{ padding: "40px 20px", textAlign: "center", color: color.faint3 }}>
                  <div style={{ display: "flex", justifyContent: "center", marginBottom: 10, color: color.border2 }}><Icon name="inbox" size={30} /></div>
                  <div style={{ fontSize: 13 }}>You're all caught up.</div>
                  <div style={{ fontSize: 11.5, marginTop: 4 }}>Subscribe to a project, program or product to get updates here.</div>
                </div>
              ) : inbox.items.map((n) => {
                const t = EVENT_TINT[n.eventType] ?? EVENT_TINT.status_change;
                return (
                  <div key={n.id} onClick={() => !n.read && markRead.mutate({ ids: [n.id] })}
                    style={{ display: "flex", gap: 11, padding: "12px 16px", borderBottom: `1px solid ${color.surfaceAlt}`, cursor: n.read ? "default" : "pointer", background: n.read ? "#fff" : color.surfaceAlt }}>
                    <span style={{ width: 30, height: 30, borderRadius: 8, background: t.bg, color: t.ink, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Icon name={t.icon} size={15} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: color.text }}>{n.title}</div>
                      {n.body && <div style={{ fontSize: 12, color: color.faint2, marginTop: 1 }}>{n.body}</div>}
                      <div style={{ fontSize: 11, color: color.faint3, marginTop: 3 }}>{relTime(n.at)}</div>
                    </div>
                    {!n.read && <span style={{ width: 8, height: 8, borderRadius: "50%", background: color.primary, flex: "none", marginTop: 6 }} />}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {prefsOpen && <NotificationPrefs onClose={() => setPrefsOpen(false)} />}
    </>
  );
}

const linkBtn: React.CSSProperties = { background: "none", border: "none", cursor: "pointer", color: color.primary, fontSize: 12, fontWeight: 600, fontFamily: "inherit", padding: 0 };

function NotificationPrefs({ onClose }: { onClose: () => void }) {
  const { role } = useRole();
  const qc = useQueryClient();
  const { data: prefs = [] } = useQuery({
    queryKey: ["notif-prefs", role], retry: false,
    queryFn: async (): Promise<Pref[]> => (await api<Pref[]>("/notifications/prefs")) ?? [],
  });
  const setPref = useMutation({
    mutationFn: ({ ev, inApp, email }: { ev: string; inApp: boolean; email: boolean }) =>
      api(`/notifications/prefs/${ev}`, { method: "PATCH", body: JSON.stringify({ inApp, email }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notif-prefs"] }),
  });

  return (
    <Modal onClose={onClose} width={520} label="Notification settings">
      <div style={{ fontFamily: font.head, fontSize: 17, fontWeight: 600, color: color.navy, marginBottom: 4 }}>Notification settings</div>
      <div style={{ fontSize: 12.5, color: color.faint3, marginBottom: 16 }}>
        Choose how you hear about each kind of event. Item-specific events reach you for the projects, programs and products you subscribe to; “New items” covers everything created across the portfolio.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 62px 62px", alignItems: "center", padding: "0 4px 8px", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.04em", color: color.faint3, fontWeight: 700 }}>
        <div>Event</div><div style={{ textAlign: "center" }}>In-app</div><div style={{ textAlign: "center" }}>Email</div>
      </div>
      {prefs.map((p) => (
        <div key={p.eventType} style={{ display: "grid", gridTemplateColumns: "1fr 62px 62px", alignItems: "center", padding: "11px 4px", borderTop: `1px solid ${color.bg}` }}>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: color.text }}>{p.label}{!p.entityScoped && <span style={{ fontSize: 10, fontWeight: 700, color: "#0F6CBD", background: color.primaryTint, borderRadius: 5, padding: "1px 6px", marginLeft: 7, textTransform: "uppercase" }}>Portfolio</span>}</div>
            <div style={{ fontSize: 11.5, color: color.faint3, marginTop: 1 }}>{p.detail}</div>
          </div>
          <div style={{ display: "flex", justifyContent: "center" }}><Toggle on={p.inApp} onChange={(v) => setPref.mutate({ ev: p.eventType, inApp: v, email: p.email })} /></div>
          <div style={{ display: "flex", justifyContent: "center" }}><Toggle on={p.email} onChange={(v) => setPref.mutate({ ev: p.eventType, inApp: p.inApp, email: v })} /></div>
        </div>
      ))}
      <div style={{ fontSize: 11, color: color.faint3, marginTop: 14 }}>Email delivery activates once a mail sender is configured; until then these events still arrive in-app.</div>
    </Modal>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!on)} role="switch" aria-checked={on} style={{
      width: 38, height: 22, borderRadius: 11, border: "none", cursor: "pointer", position: "relative",
      background: on ? color.primary : "#CBD2DE", transition: "background 0.15s", flex: "none",
    }}>
      <span style={{ position: "absolute", top: 2, left: on ? 18 : 2, width: 18, height: 18, borderRadius: "50%", background: color.surface, transition: "left 0.15s", boxShadow: "0 1px 2px rgba(0,0,0,0.2)" }} />
    </button>
  );
}
