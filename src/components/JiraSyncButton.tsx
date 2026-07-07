import { useQueryClient, useMutation } from "@tanstack/react-query";
import { color, radius } from "@/theme";
import { api } from "@/api";
import { Icon } from "@/components/Icon";
import { usePermissions } from "@/components/usePermissions";
import { toast, toastError } from "@/components/Toast";

// Reusable "Sync from Jira" control for an entity's Overview. Default click does
// a DELTA pull (only issues changed since the last sync); a "Full" link forces a
// complete re-sync. Editing needs Edit on "Integrations & connectors".
interface SyncResult { ok: boolean; projects?: number; sprints?: number; epics?: number; tasks?: number; error?: string; message?: string; }

export function JiraSyncButton({ path, lastSync, invalidateKeys = [] }: {
  path: string;                 // e.g. "/projects/PRJ-1/jira/sync"
  lastSync?: string;            // "yyyy-MM-dd HH:mm" UTC, if known
  invalidateKeys?: string[];    // react-query keys to refresh after a sync
}) {
  const qc = useQueryClient();
  const { can } = usePermissions();
  const maySync = can("cap-integrations", "E");

  const sync = useMutation({
    mutationFn: (delta: boolean) => api<SyncResult>(`${path}?delta=${delta}`, { method: "POST" }),
    onSuccess: (r) => {
      if (r && r.ok === false) { toast(r.error || r.message || "Nothing to sync."); return; }
      const bits = [r?.tasks != null ? `${r.tasks} tasks` : null, r?.sprints != null ? `${r.sprints} sprints` : null, r?.epics != null ? `${r.epics} epics` : null].filter(Boolean).join(" · ");
      toast(bits ? `Synced from Jira — ${bits}` : "Synced from Jira");
      invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
    onError: (e) => toastError(e),
  });

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      <button
        onClick={() => maySync && sync.mutate(true)}
        disabled={!maySync || sync.isPending}
        title={maySync ? "Pull only what changed since the last sync" : "Needs Edit on Integrations & connectors"}
        style={{
          display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, fontFamily: "inherit",
          color: maySync ? color.primaryDark : color.faint3, background: color.primaryTint, border: `1px solid ${color.border2}`,
          borderRadius: radius.md, padding: "7px 12px", cursor: maySync && !sync.isPending ? "pointer" : "not-allowed",
        }}>
        <Icon name="refresh" size={15} /> {sync.isPending ? "Syncing…" : "Sync from Jira"}
      </button>
      {maySync && (
        <button onClick={() => sync.mutate(false)} disabled={sync.isPending}
          title="Force a complete re-sync (slower; reconciles deletions)"
          style={{ fontSize: 11.5, fontWeight: 600, color: color.faint2, background: "none", border: "none", cursor: sync.isPending ? "not-allowed" : "pointer", fontFamily: "inherit", textDecoration: "underline" }}>
          Full re-sync
        </button>
      )}
      {lastSync && <span style={{ fontSize: 11, color: color.faint3 }}>Last synced {lastSync} UTC</span>}
    </div>
  );
}
