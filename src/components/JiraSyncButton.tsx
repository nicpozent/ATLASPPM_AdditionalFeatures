import { useQueryClient, useMutation } from "@tanstack/react-query";
import { color, radius } from "@/theme";
import { Icon } from "@/components/Icon";
import { toast, toastError } from "@/components/Toast";
import { syncJira, syncToast } from "@/lib/jiraSync";

// Reusable "Sync from Jira" control for an entity's Overview. Default click does
// a DELTA pull (only issues changed since the last sync); a "Full" link forces a
// complete re-sync. Editing needs Edit on "Integrations & connectors".
// The sync runs in the background (see syncJira) so a large pull can't 504.

export function JiraSyncButton({ path, lastSync, invalidateKeys = [] }: {
  path: string;                 // e.g. "/projects/PRJ-1/jira/sync"
  lastSync?: string;            // "yyyy-MM-dd HH:mm" UTC, if known
  invalidateKeys?: string[];    // react-query keys to refresh after a sync
}) {
  const qc = useQueryClient();
  // A Jira sync is an idempotent, pull-only refresh of shared project data, so it
  // is open to every authenticated role (server-enforced the same way) — no
  // capability gate on the per-entity "Sync from Jira" / "Full re-sync" buttons.
  const maySync = true;

  const sync = useMutation({
    mutationFn: (delta: boolean) => syncJira(path, delta),
    onSuccess: (o) => {
      toast(syncToast(o));
      if (o.ok || o.state === "running") invalidateKeys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
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
