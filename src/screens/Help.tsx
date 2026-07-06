import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { api } from "@/api";
import { Icon } from "@/components/Icon";
import { Card, Button, Modal, Input, Textarea, Select } from "@/components/ui";
import { toast } from "@/components/Toast";

// ---------------------------------------------------------------------------
// Help & Support — data-driven. Role-based guides and error-category
// troubleshooting are served from /help (seeded baseline, editable by a Platform
// Admin). The error UI deep-links here with ?code=SRV-… to surface the matching
// troubleshooting entry.
// ---------------------------------------------------------------------------
interface Article { id: number; kind: string; audience: string; code: string; title: string; summary: string; body: string; ord: number; }
interface HelpData { canManage: boolean; guides: Article[]; troubleshooting: Article[]; }

const ROLE_TABS: { id: string; label: string }[] = [
  { id: "all", label: "Getting started" },
  { id: "admin", label: "Platform Admin" }, { id: "pmo", label: "PMO" }, { id: "pm", label: "Project Manager" },
  { id: "team", label: "Team Member" }, { id: "exec", label: "Executive" },
];
const roleLabel = (id: string) => ROLE_TABS.find((r) => r.id === id)?.label ?? id;

// Where "Contact the PMO" sends mail. UI chrome — a Platform Admin can change it.
const SUPPORT_MAILBOX = "pmo-support@birgma.com";
const CAT_TINT: Record<string, { ink: string; tint: string; icon: string }> = {
  NET: { ink: "#0C5798", tint: "#E6EFFB", icon: "cloud" }, AUTH: { ink: "#5E2E89", tint: "#F0E8F7", icon: "key" },
  VAL: { ink: "#8A6300", tint: "#FBF2D7", icon: "edit" }, SRV: { ink: "#A1282B", tint: "#FBE7E8", icon: "server" },
  INT: { ink: "#0B6B37", tint: "#E7F4EC", icon: "plug" }, APP: { ink: "#A1282B", tint: "#FBE7E8", icon: "alert" },
};

export default function Help() {
  const qc = useQueryClient();
  const [params] = useSearchParams();
  const codePrefix = (params.get("code") ?? "").split("-")[0].toUpperCase();
  const [role, setRole] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Article | null>(null);
  const [adding, setAdding] = useState(false);

  const { data } = useQuery({
    queryKey: ["help"], retry: false, staleTime: 60_000,
    queryFn: async (): Promise<HelpData> => (await api<HelpData>("/help")) ?? { canManage: false, guides: [], troubleshooting: [] },
  });
  const canManage = data?.canManage ?? false;

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  // When searching, look across every role; otherwise show the selected role's guides.
  const guides = useMemo(() => {
    const hit = (a: Article) => !q || [a.title, a.summary, a.body].some((s) => (s ?? "").toLowerCase().includes(q));
    const all = data?.guides ?? [];
    return q ? all.filter(hit) : all.filter((g) => g.audience === role);
  }, [data, role, q]);
  const troubleshooting = useMemo(() => {
    const hit = (a: Article) => !q || [a.title, a.summary, a.body].some((s) => (s ?? "").toLowerCase().includes(q));
    return (data?.troubleshooting ?? []).filter(hit);
  }, [data, q]);

  const del = useMutation({
    mutationFn: (id: number) => api(`/help/articles/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["help"] }); toast("Article removed.", "info"); },
  });

  return (
    <div style={{ maxWidth: 1040, margin: "0 auto" }}>
      {/* hero */}
      <div style={{ background: "linear-gradient(115deg,#11163A,#0F6CBD)", borderRadius: 18, padding: "34px 32px", marginBottom: 24, color: "#fff", textAlign: "center" }}>
        <div style={{ fontFamily: font.head, fontSize: 25, fontWeight: 600, marginBottom: 7 }}>How can we help?</div>
        <div style={{ fontSize: 14, color: "#C9D6EE", marginBottom: 20 }}>Role guides, troubleshooting and release notes — or reach the PMO support team.</div>
        <div style={{ maxWidth: 540, margin: "0 auto", display: "flex", alignItems: "center", gap: 10, background: "#fff", borderRadius: 11, padding: "10px 14px" }}>
          <span style={{ color: color.faint3, display: "flex" }}><Icon name="search" size={18} /></span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search guides and troubleshooting…"
            aria-label="Search the help centre"
            style={{ flex: 1, border: "none", outline: "none", fontSize: 14, fontFamily: "inherit", color: color.text, background: "transparent" }}
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Clear search" title="Clear"
              style={{ border: "none", background: "none", cursor: "pointer", color: color.faint3, display: "flex", padding: 2 }}>
              <Icon name="x" size={16} />
            </button>
          )}
        </div>
        {searching && (
          <div style={{ fontSize: 12.5, color: "#C9D6EE", marginTop: 12 }}>
            {guides.length + troubleshooting.length} result{guides.length + troubleshooting.length === 1 ? "" : "s"} for “{query.trim()}”
          </div>
        )}
      </div>

      {/* Troubleshooting — surfaced first when arriving from an error link */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <span style={{ fontFamily: font.head, fontSize: 16, fontWeight: 600, color: color.ink, flex: 1 }}>Troubleshooting</span>
        {codePrefix && <span style={{ fontSize: 11.5, color: color.faint3 }}>Showing help for code <b style={{ color: color.text }}>{params.get("code")}</b></span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14, marginBottom: 28 }}>
        {troubleshooting.map((t) => {
          const c = CAT_TINT[t.code] ?? CAT_TINT.SRV;
          const highlight = codePrefix && (t.code === codePrefix || (codePrefix === "APP" && t.code === "SRV"));
          return (
            <Card key={t.id} style={{ border: `1px solid ${highlight ? c.ink : color.border}`, boxShadow: highlight ? `0 0 0 3px ${c.tint}` : undefined }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ width: 32, height: 32, borderRadius: 8, background: c.tint, color: c.ink, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><Icon name={c.icon} size={16} /></span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: color.ink }}>{t.title}</div>
                  <div style={{ fontFamily: font.mono, fontSize: 10.5, fontWeight: 700, color: c.ink }}>{t.code}-…</div>
                </div>
                {canManage && <button onClick={() => setEditing(t)} title="Edit" style={iconBtn}><Icon name="edit" size={14} /></button>}
              </div>
              <div style={{ fontSize: 12.5, color: color.faint, marginBottom: 8 }}>{t.summary}</div>
              <div style={{ fontSize: 12.5, color: color.subtle, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{t.body}</div>
            </Card>
          );
        })}
        {troubleshooting.length === 0 && <div style={{ color: color.faint3, fontSize: 13 }}>{searching ? "No troubleshooting entries match your search." : "No troubleshooting entries yet."}</div>}
      </div>

      {/* role selector for guides — hidden while searching (results span roles) */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <span style={{ fontFamily: font.head, fontSize: 16, fontWeight: 600, color: color.ink }}>Guides</span>
        {!searching && (
          <div style={{ display: "inline-flex", background: "#E4E8F1", borderRadius: 10, padding: 3, gap: 2, flexWrap: "wrap" }}>
            {ROLE_TABS.map((rt) => {
              const active = role === rt.id;
              return (
                <button key={rt.id} onClick={() => setRole(rt.id)} style={{
                  padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit",
                  background: active ? "#fff" : "transparent", color: active ? color.primary : "#6A7488",
                  boxShadow: active ? "0 1px 3px rgba(20,26,60,0.12)" : "none",
                }}>{rt.label}</button>
              );
            })}
          </div>
        )}
        {searching && <span style={{ fontSize: 12.5, color: color.faint2 }}>matching “{query.trim()}” across all roles</span>}
        <div style={{ flex: 1 }} />
        {canManage && !searching && <Button variant="secondary" onClick={() => setAdding(true)}><Icon name="plus" size={15} /> Add guide</Button>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 18, alignItems: "start" }}>
        <Card padding={0} style={{ overflow: "hidden" }}>
          <div style={{ padding: "16px 22px", borderBottom: `1px solid ${color.bg}`, fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.ink }}>{searching ? "Search results" : `${roleLabel(role)} guides`}</div>
          {guides.length === 0 ? (
            <div style={{ padding: "28px 22px", textAlign: "center", color: color.faint3, fontSize: 13 }}>{searching ? "No guides match your search." : "No guides for this role yet."}</div>
          ) : guides.map((art) => (
            <div key={art.id} style={{ display: "flex", alignItems: "flex-start", gap: 13, padding: "14px 22px", borderBottom: "1px solid #F2F4F9" }}>
              <span style={{ color: color.primary, display: "flex", marginTop: 2 }}><Icon name="book" size={18} /></span>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: color.text }}>{art.title}</span>
                  {searching && <span style={{ fontSize: 10.5, fontWeight: 700, color: "#56607A", background: "#EEF1F6", padding: "2px 7px", borderRadius: 5 }}>{roleLabel(art.audience)}</span>}
                </div>
                {art.summary && <div style={{ fontSize: 12.5, color: color.faint2, marginTop: 2 }}>{art.summary}</div>}
                {art.body && art.body !== art.summary && <div style={{ fontSize: 12.5, color: color.subtle, marginTop: 4, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{art.body}</div>}
              </div>
              {canManage && (
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => setEditing(art)} title="Edit" style={iconBtn}><Icon name="edit" size={14} /></button>
                  <button onClick={() => del.mutate(art.id)} title="Delete" style={iconBtn}><Icon name="trash" size={14} /></button>
                </div>
              )}
            </div>
          ))}
        </Card>
        <Card padding={22}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: "#E7F4EC", color: "#0B6B37", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}><Icon name="message" size={20} /></div>
          <div style={{ fontFamily: font.head, fontSize: 16, fontWeight: 600, color: color.ink, marginBottom: 6 }}>Contact the PMO</div>
          <div style={{ fontSize: 13, lineHeight: 1.55, color: color.subtle, marginBottom: 12 }}>Can't find an answer here? Email the Atlas support team and we'll respond within one business day.</div>
          <div style={{ fontSize: 12, lineHeight: 1.5, color: color.faint2, background: color.surfaceAlt, border: `1px solid ${color.border}`, borderRadius: 10, padding: "10px 12px", marginBottom: 14 }}>
            <b style={{ color: color.textMuted }}>For the fastest answer, include:</b>
            <ul style={{ margin: "6px 0 0", paddingLeft: 16 }}>
              <li>the error code, if you saw one (e.g. SRV-… or INT-…)</li>
              <li>the screen you were on and what you were doing</li>
              <li>the approximate time it happened</li>
            </ul>
          </div>
          <a
            href={`mailto:${SUPPORT_MAILBOX}?subject=${encodeURIComponent("Atlas support request")}&body=${encodeURIComponent(
              `Role: ${roleLabel(role)}\nScreen: \nError code (if any): ${params.get("code") ?? ""}\nWhen it happened: \n\nWhat I expected:\n\nWhat happened instead:\n`)}`}
            style={{ display: "block", width: "100%", boxSizing: "border-box", textAlign: "center", textDecoration: "none", fontSize: 13.5, fontWeight: 600, color: "#fff", background: color.primary, border: "none", padding: 11, borderRadius: 10, cursor: "pointer", fontFamily: "inherit", marginBottom: 9 }}>
            Email the PMO
          </a>
          <button onClick={() => { setQuery(""); setRole("all"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            style={{ width: "100%", fontSize: 13.5, fontWeight: 600, color: color.textMuted, background: "#fff", border: `1px solid ${color.border2}`, padding: 11, borderRadius: 10, cursor: "pointer", fontFamily: "inherit" }}>
            Browse getting-started guides
          </button>
        </Card>
      </div>

      {(editing || adding) && (
        <EditArticleModal article={editing} defaultAudience={role} onClose={() => { setEditing(null); setAdding(false); }} />
      )}
    </div>
  );
}

const iconBtn: React.CSSProperties = { background: "none", border: "none", cursor: "pointer", color: color.faint3, display: "flex", padding: 4 };

function EditArticleModal({ article, defaultAudience, onClose }: { article: Article | null; defaultAudience: string; onClose: () => void }) {
  const qc = useQueryClient();
  const isTrouble = article?.kind === "troubleshooting";
  const [title, setTitle] = useState(article?.title ?? "");
  const [audience, setAudience] = useState(article?.audience || defaultAudience);
  const [summary, setSummary] = useState(article?.summary ?? "");
  const [body, setBody] = useState(article?.body ?? "");

  const save = useMutation({
    mutationFn: () => article
      ? api(`/help/articles/${article.id}`, { method: "PATCH", body: JSON.stringify({ kind: article.kind, title, summary, body, audience }) })
      : api("/help/articles", { method: "POST", body: JSON.stringify({ kind: "guide", audience, title, summary, body }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["help"] }); toast("Saved.", "info"); onClose(); },
  });

  return (
    <Modal onClose={onClose} width={560} label={article ? "Edit article" : "Add guide"}>
      <div style={{ fontFamily: font.head, fontSize: 17, fontWeight: 600, color: color.navy, marginBottom: 14 }}>
        {article ? (isTrouble ? `Edit troubleshooting · ${article.code}` : "Edit guide") : "Add guide"}
      </div>
      <Lbl>Title</Lbl>
      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Article title" />
      {!isTrouble && (
        <>
          <Lbl>Audience</Lbl>
          <Select value={audience} onChange={(e) => setAudience(e.target.value)}>
            {ROLE_TABS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </Select>
        </>
      )}
      <Lbl>{isTrouble ? "Symptom" : "Summary"}</Lbl>
      <Input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder={isTrouble ? "What the user sees" : "One-line summary"} />
      <Lbl>{isTrouble ? "Resolution steps" : "Body"}</Lbl>
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} placeholder="Full content — line breaks are preserved." />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={() => title.trim() && save.mutate()} disabled={save.isPending || !title.trim()}>{save.isPending ? "Saving…" : "Save"}</Button>
      </div>
    </Modal>
  );
}

function Lbl({ children }: { children: React.ReactNode }) {
  return <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#56607A", margin: "12px 0 5px" }}>{children}</label>;
}
