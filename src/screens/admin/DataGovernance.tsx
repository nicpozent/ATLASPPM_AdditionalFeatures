// Admin data-governance sections — database-password rotation, GDPR data-subject
// rights (DSAR export / erasure / retention) and Backups & restore. Extracted
// from Admin.tsx unchanged (ADR-0041) to keep that screen focused.
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color, font, radius } from "@/theme";
import { api, apiDownload } from "@/api";
import { Icon } from "@/components/Icon";
import { Button, Card, EmptyBlock, Input, Select } from "@/components/ui";
import { toast, toastError } from "@/components/Toast";
import { GRADIENT, sectionTitle, sectionSub, colHeadStyle } from "./styles";

const BACKUP_COLS = "1.8fr 1fr 0.8fr 0.7fr 0.9fr 1.1fr";

interface BackupComponent { name: string; schedule: string; retention: string; records: number; lastBackup: string; }
interface BackupRun { at: string; actor: string; role: string; size: string; records: number; status: string; }
interface BackupsData { canManage: boolean; autoBackups: boolean; lastBackup: string; lastSizeBytes: number; components: BackupComponent[]; runs: BackupRun[]; }

// ---- SECRET ROTATION (database password age + 90/180-day nudges) ----------
interface RotationStatus {
  rotatedAt: string | null; daysSince: number | null;
  status: "unknown" | "ok" | "warn" | "critical";
  warnDays: number; criticalDays: number; canManage: boolean;
}
const ROTATION_UI: Record<RotationStatus["status"], { label: string; fg: string; bg: string }> = {
  unknown:  { label: "Not recorded", fg: color.subtle, bg: color.bg },
  ok:       { label: "Healthy",      fg: "#15A34A", bg: color.successTint },
  warn:     { label: "Rotate soon",  fg: "#9A6800", bg: color.warningTint },
  critical: { label: "Change it now!", fg: "#A1282B", bg: color.dangerTint },
};

function SecretRotationCard() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["secret-rotation"], retry: false, staleTime: 30_000,
    queryFn: async (): Promise<RotationStatus | null> => {
      try { return await api<RotationStatus>("/admin/secret-rotation"); } catch { return null; }
    },
  });
  const mark = useMutation({
    mutationFn: () => api("/admin/secret-rotation/mark", { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["secret-rotation"] }); toast("Recorded — database password marked rotated today.", "info"); },
    onError: (e) => toast(`Couldn’t record rotation: ${(e as Error).message}`, "error"),
  });
  if (!data) return null;
  const ui = ROTATION_UI[data.status];
  const age = data.daysSince == null ? "—" : `${data.daysSince} day${data.daysSince === 1 ? "" : "s"} ago`;

  return (
    <div style={{ marginBottom: 18 }}>
      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={sectionTitle}>Database password rotation</div>
            <div style={sectionSub}>
              Last changed: <b style={{ color: color.text }}>{data.rotatedAt ?? "not recorded yet"}</b>
              {data.daysSince != null && <> · {age}</>} · warn at {data.warnDays}d, critical at {data.criticalDays}d
            </div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: ui.fg, background: ui.bg, padding: "6px 12px", borderRadius: 20 }}>
            {ui.label}
          </span>
          {data.canManage && (
            <button onClick={() => mark.mutate()} disabled={mark.isPending}
              style={{ fontSize: 12.5, fontWeight: 600, color: "#fff", background: color.primary, border: "none", padding: "9px 15px", borderRadius: 9, cursor: mark.isPending ? "default" : "pointer", fontFamily: "inherit", opacity: mark.isPending ? 0.7 : 1 }}>
              Mark as rotated today
            </button>
          )}
        </div>
        {data.status !== "ok" && data.status !== "unknown" && (
          <div style={{ marginTop: 12, fontSize: 12.5, color: ui.fg, background: ui.bg, borderRadius: 8, padding: "9px 12px" }}>
            {data.status === "critical"
              ? "This password is overdue for rotation. Rotate it, then mark it here."
              : "This password is approaching its rotation window. Plan to rotate it soon."}
          </div>
        )}
      </Card>
    </div>
  );
}

// ---- DATA PRIVACY (GDPR) --------------------------------------------------
// Platform-Admin surface for the data-subject rights already implemented on the
// API: portability/access (DSAR export), erasure (anonymise a subject), and an
// on-demand run of the age-based retention pass. All three are Platform-Admin
// gated and audited server-side; this just wires them up.
interface Subject { name: string; email: string; }

export function PrivacySection() {
  const [subject, setSubject] = useState("");
  const [confirmErase, setConfirmErase] = useState(false);

  const { data: subjects } = useQuery({
    queryKey: ["gdpr-subjects"], retry: false, staleTime: 60_000,
    queryFn: async (): Promise<Subject[]> => (await api<Subject[]>("/gdpr/subjects")) ?? [],
  });

  // A subject may be picked from the directory or typed (name, email or key).
  const options = subjects ?? [];
  const s = subject.trim();

  const exporting = useMutation({
    mutationFn: () => apiDownload(`/gdpr/export?subject=${encodeURIComponent(s)}`, `atlas-dsar-${slugify(s)}.json`),
    onSuccess: () => toast("Data-subject export downloaded"),
    onError: (e) => toastError(e),
  });
  const erasing = useMutation({
    mutationFn: () => api<{ subject: string; anonymised: number }>(`/gdpr/erase?subject=${encodeURIComponent(s)}`, { method: "POST" }),
    onSuccess: (r) => { setConfirmErase(false); toast(`Erased ${s} — ${r?.anonymised ?? 0} record(s) anonymised`); },
    onError: (e) => toastError(e),
  });
  const retention = useMutation({
    mutationFn: () => api<{ anonymised: number; cutoff: string }>(`/admin/retention/run`, { method: "POST" }),
    onSuccess: (r) => toast(`Retention pass complete — ${r?.anonymised ?? 0} record(s) anonymised`),
    onError: (e) => toastError(e),
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* Data-subject requests */}
      <Card padding={0} style={{ overflow: "hidden" }}>
        <div style={{ padding: "16px 22px", borderBottom: `1px solid ${color.bg}` }}>
          <div style={sectionTitle}>Data-subject requests (GDPR Art. 15, 17 & 20)</div>
          <div style={sectionSub}>Export or erase everything Atlas holds about one person. Matching is exact (case-insensitive) on name, email or user key. Every action is audited.</div>
        </div>
        <div style={{ padding: "18px 22px" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 260px", minWidth: 220 }}>
              <label style={{ ...colHeadStyle, display: "block", marginBottom: 6 }}>Subject</label>
              {options.length > 0 && (
                <Select value={options.some((o) => (o.email || o.name) === subject) ? subject : ""} onChange={(e) => setSubject(e.target.value)} style={{ marginBottom: 8 }}>
                  <option value="">Pick from directory…</option>
                  {options.map((o) => {
                    const val = o.email || o.name;
                    return <option key={val} value={val}>{o.name}{o.email ? ` · ${o.email}` : ""}</option>;
                  })}
                </Select>
              )}
              <Input value={subject} onChange={(e) => { setSubject(e.target.value); setConfirmErase(false); }} placeholder="Name, email or user key" />
            </div>
            <Button variant="secondary" disabled={!s || exporting.isPending} onClick={() => exporting.mutate()}>
              <Icon name="download" size={15} /> {exporting.isPending ? "Exporting…" : "Export data (DSAR)"}
            </Button>
          </div>

          <div style={{ marginTop: 16, borderTop: `1px solid ${color.bg}`, paddingTop: 14 }}>
            {!confirmErase ? (
              <button onClick={() => setConfirmErase(true)} disabled={!s} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600, color: s ? "#A1282B" : color.faint3, background: "none", border: "none", cursor: s ? "pointer" : "not-allowed", fontFamily: "inherit", padding: "4px 0" }}>
                <Icon name="trash" size={15} /> Erase this subject (right to be forgotten)
              </button>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12.5, color: color.dangerInk, fontWeight: 600 }}>Anonymise every record referencing “{s}”? Rows are kept but identifiers are irreversibly pseudonymised.</span>
                <Button onClick={() => erasing.mutate()} disabled={erasing.isPending} style={{ background: "#D13438", borderColor: color.danger }}>{erasing.isPending ? "Erasing…" : "Confirm erasure"}</Button>
                <Button variant="secondary" onClick={() => setConfirmErase(false)}>Cancel</Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Retention */}
      <Card padding={0} style={{ overflow: "hidden" }}>
        <div style={{ padding: "16px 22px", borderBottom: `1px solid ${color.bg}` }}>
          <div style={sectionTitle}>Data retention</div>
          <div style={sectionSub}>Records past the retention window (default 10 years) have their personal identifiers anonymised. A background pass runs daily; you can also run it on demand.</div>
        </div>
        <div style={{ padding: "18px 22px", display: "flex", alignItems: "center", gap: 14 }}>
          <Button variant="secondary" disabled={retention.isPending} onClick={() => retention.mutate()}>
            <Icon name="refresh" size={15} /> {retention.isPending ? "Running…" : "Run retention now"}
          </Button>
          <span style={{ fontSize: 12, color: color.faint2 }}>Anonymises expired audit actors and notification keys. Safe to run anytime — nothing within the window is touched.</span>
        </div>
      </Card>
    </div>
  );
}

function slugify(s: string): string {
  const out = s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return out || "subject";
}

export function BackupsSection() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["backups"], retry: false, staleTime: 15_000,
    queryFn: async (): Promise<BackupsData> => (await api<BackupsData>("/backups")) ?? { canManage: false, autoBackups: true, lastBackup: "Never", lastSizeBytes: 0, components: [], runs: [] },
  });
  const d = data ?? { canManage: false, autoBackups: true, lastBackup: "Never", lastSizeBytes: 0, components: [], runs: [] };
  const runBackup = useMutation({
    mutationFn: () => api<{ size?: string; records?: number }>("/backups/run", { method: "POST" }),
    onSuccess: async (res) => {
      qc.invalidateQueries({ queryKey: ["backups"] });
      const detail = res?.records != null ? ` — ${res.records.toLocaleString()} records${res.size ? `, ${res.size}` : ""}` : "";
      toast(`Backup complete${detail}. Downloading snapshot…`, "info");
      try { await apiDownload("/backups/snapshot.json", "atlas-backup.json"); }
      catch (e) { toast(`Backup ran, but the download failed: ${(e as Error).message}`, "error"); }
    },
    onError: (e) => toast(`Backup failed: ${(e as Error).message}`, "error"),
  });
  const toggleAuto = useMutation({
    mutationFn: (on: boolean) => api("/settings/backups.auto", { method: "PATCH", body: JSON.stringify({ value: on ? "true" : "false" }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["backups"] }),
  });
  const restore = useMutation({
    mutationFn: (text: string) => api<{ ok: boolean; restored: Record<string, number> }>("/backups/restore", { method: "POST", body: text }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["backups"] });
      const n = Object.values(res?.restored ?? {}).reduce((a, b) => a + b, 0);
      toast(`Restored ${n} record${n === 1 ? "" : "s"} (merge). Reload to see changes.`, "info");
    },
    onError: (e) => toast(`Restore failed: ${(e as Error).message}`, "error"),
  });
  const onRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";   // allow re-selecting the same file
    if (!file) return;
    if (!confirm("Restore from this backup? This MERGES the file into the current data (upsert by id) — it updates and re-creates rows but never deletes. Child rows and attachments are not restored (use a database dump for full recovery).")) return;
    file.text().then((t) => restore.mutate(t));
  };

  return (
    <>
      <SecretRotationCard />
      <div style={{ background: GRADIENT, borderRadius: radius.xxl, padding: "20px 24px", marginBottom: 18, color: "#fff", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontFamily: font.head, fontSize: 17, fontWeight: 600 }}>Backups & restore</div>
          <div style={{ fontSize: 13, color: "#C9D6EE", marginTop: 3 }}>Last backup: <b style={{ color: "#fff" }}>{d.lastBackup}</b>{d.runs.length ? ` · ${d.runs[0].size} · ${d.runs[0].records} records` : ""}</div>
        </div>
        <button onClick={() => d.canManage && toggleAuto.mutate(!d.autoBackups)} disabled={!d.canManage} title={d.canManage ? "Toggle automatic nightly backups" : "Platform Admin only"}
          style={{ display: "flex", alignItems: "center", gap: 9, background: "rgba(255,255,255,0.12)", borderRadius: 10, padding: "8px 13px", border: "none", cursor: d.canManage ? "pointer" : "default", fontFamily: "inherit" }}>
          <span style={{ fontSize: 12.5, color: "#fff" }}>Automatic backups</span>
          <span style={{ position: "relative", width: 40, height: 22, display: "inline-block" }}>
            <span style={{ position: "absolute", inset: 0, background: d.autoBackups ? "#3BD17A" : "rgba(255,255,255,0.25)", borderRadius: 20 }} />
            <span style={{ position: "absolute", top: 3, [d.autoBackups ? "right" : "left"]: 3, width: 16, height: 16, background: color.surface, borderRadius: "50%" } as React.CSSProperties} />
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: d.autoBackups ? "#3BD17A" : "#C9D6EE" }}>{d.autoBackups ? "ON" : "OFF"}</span>
        </button>
        {d.canManage && (
          <>
            <button onClick={() => runBackup.mutate()} disabled={runBackup.isPending} style={{ display: "flex", alignItems: "center", gap: 8, background: color.surface, color: color.primary, border: "none", borderRadius: 10, padding: "11px 17px", fontSize: 13.5, fontWeight: 700, cursor: runBackup.isPending ? "default" : "pointer", fontFamily: "inherit", opacity: runBackup.isPending ? 0.7 : 1 }}>
              <Icon name="download" size={16} /> {runBackup.isPending ? "Backing up…" : "Back up all now"}
            </button>
            <label title="Restore (merge) from a downloaded Atlas backup file"
              style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.12)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 10, padding: "11px 17px", fontSize: 13.5, fontWeight: 700, cursor: restore.isPending ? "default" : "pointer", fontFamily: "inherit", opacity: restore.isPending ? 0.7 : 1 }}>
              <Icon name="refresh" size={16} /> {restore.isPending ? "Restoring…" : "Restore…"}
              <input type="file" accept="application/json,.json" onChange={onRestoreFile} disabled={restore.isPending} style={{ display: "none" }} />
            </label>
          </>
        )}
      </div>
      <div style={{ marginBottom: 18 }}>
        <Card padding={0} style={{ overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: BACKUP_COLS, padding: "13px 22px", borderBottom: `1px solid ${color.bg}`, ...colHeadStyle, letterSpacing: "0.04em" }}>
            <div>Component</div><div>Schedule</div><div>Retention</div><div>Records</div><div>Last backup</div><div style={{ textAlign: "right" }}>Actions</div>
          </div>
          {d.components.length === 0 ? (
            <EmptyBlock message="No backup components." />
          ) : d.components.map((c) => (
            <div key={c.name} style={{ display: "grid", gridTemplateColumns: BACKUP_COLS, alignItems: "center", padding: "13px 22px", borderBottom: `1px solid ${color.surfaceAlt}`, fontSize: 12.5 }}>
              <div style={{ fontWeight: 600, color: color.text }}>{c.name}</div>
              <div style={{ color: color.subtle }}>{c.schedule}</div>
              <div style={{ color: color.subtle }}>{c.retention}</div>
              <div style={{ fontFamily: font.mono, color: color.textMuted }}>{c.records.toLocaleString()}</div>
              <div style={{ color: color.subtle }}>{c.lastBackup}</div>
              <div style={{ textAlign: "right" }}>
                {d.canManage && <button onClick={() => apiDownload("/backups/snapshot.json", "atlas-backup.json")} style={{ fontSize: 11.5, fontWeight: 600, color: color.primary, background: color.primaryTint, border: "none", borderRadius: 7, padding: "5px 10px", cursor: "pointer", fontFamily: "inherit" }}>Download</button>}
              </div>
            </div>
          ))}
        </Card>
      </div>
      <Card padding={0} style={{ overflow: "hidden" }}>
        <div style={{ padding: "16px 22px", borderBottom: `1px solid ${color.bg}`, ...sectionTitle }}>Recent backup runs</div>
        {d.runs.length === 0 ? (
          <EmptyBlock message="No backup runs recorded yet — click “Back up all now”." />
        ) : d.runs.map((r, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 22px", borderBottom: `1px solid ${color.surfaceAlt}`, fontSize: 12.5 }}>
            <span style={{ fontFamily: font.mono, fontSize: 11.5, color: color.faint3, minWidth: 168 }}>{r.at}</span>
            <span style={{ flex: 1, color: color.text }}>{r.actor} <span style={{ color: color.faint3 }}>({r.role})</span></span>
            <span style={{ fontFamily: font.mono, color: color.textMuted }}>{r.records.toLocaleString()} records</span>
            <span style={{ fontFamily: font.mono, color: color.textMuted, minWidth: 70, textAlign: "right" }}>{r.size}</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: color.successInk, background: color.successTint, padding: "3px 9px", borderRadius: 6 }}>{r.status}</span>
          </div>
        ))}
      </Card>
    </>
  );
}
