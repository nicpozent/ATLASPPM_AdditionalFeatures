import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { api } from "@/api";
import { Icon } from "@/components/Icon";

// ---- theme presets (from the prototype) ----------------------------------
type ThemeKey = "aurora" | "sunrise" | "forest" | "slate";
const THEMES: Record<ThemeKey, { name: string; hero: string; ink: string }> = {
  aurora: { name: "Aurora", hero: "linear-gradient(120deg,#11163A,#0F6CBD 55%,#7A3FB0)", ink: "#fff" },
  sunrise: { name: "Sunrise", hero: "linear-gradient(120deg,#C24A1F,#E0A100)", ink: "#fff" },
  forest: { name: "Forest", hero: "linear-gradient(120deg,#0B6B37,#15A34A)", ink: "#fff" },
  slate: { name: "Slate", hero: "linear-gradient(120deg,#1C2233,#3A4358)", ink: "#fff" },
};

type Layout = "masonry" | "grid" | "feed";
const LAYOUTS: { key: Layout; label: string }[] = [
  { key: "masonry", label: "Masonry" },
  { key: "grid", label: "Even grid" },
  { key: "feed", label: "Single column" },
];

type BlockKind = "headline" | "highlight" | "shoutout" | "image" | "milestone" | "doc";
type NewsBlock = {
  id: number; kind: BlockKind;
  title?: string; body?: string; metric?: string; label?: string; tone?: "good" | "bad";
  who?: string; caption?: string; date?: string; meta?: string;
};

const PALETTE: { kind: BlockKind; label: string; icon: string }[] = [
  { kind: "headline", label: "Announcement", icon: "megaphone" },
  { kind: "highlight", label: "Highlight metric", icon: "star" },
  { kind: "shoutout", label: "Shout-out", icon: "star" },
  { kind: "image", label: "Image", icon: "image" },
  { kind: "milestone", label: "Milestone", icon: "flag" },
  { kind: "doc", label: "Document", icon: "paperclip" },
];

// ---- small style helpers -------------------------------------------------
const inpStyle: React.CSSProperties = {
  width: "100%", border: `1px solid ${color.border2}`, borderRadius: 8, padding: "7px 9px",
  fontSize: 13, fontFamily: "inherit", color: color.text, outline: "none", marginBottom: 8, background: color.surface,
};
const txtStyle: React.CSSProperties = {
  width: "100%", minHeight: 60, resize: "vertical", border: `1px solid ${color.border2}`, borderRadius: 8,
  padding: "7px 9px", fontSize: 13, fontFamily: "inherit", color: color.text, outline: "none",
};
const kicker: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: color.faint3, marginBottom: 8,
};

function BlockWrap({ editing, extra, onRemove, children }: {
  editing: boolean; extra?: React.CSSProperties; onRemove: () => void; children: React.ReactNode;
}) {
  return (
    <div style={{
      position: "relative", background: color.surface, border: `1px solid ${color.border}`, borderRadius: 16,
      padding: 18, breakInside: "avoid", marginBottom: 16, boxShadow: "0 1px 2px rgba(20,26,60,0.04)", ...extra,
    }}>
      {editing && (
        <button onClick={onRemove} title="Remove" style={{
          position: "absolute", top: 8, right: 8, width: 24, height: 24, borderRadius: 6,
          border: `1px solid ${color.border3}`, background: color.surface, color: color.faint3, cursor: "pointer",
          fontSize: 14, lineHeight: 1, zIndex: 2,
        }}>×</button>
      )}
      {children}
    </div>
  );
}

function NewsBlockEl({ block, editing, onField, onCommit, onRemove }: {
  block: NewsBlock; editing: boolean;
  onField: (id: number, field: keyof NewsBlock, v: string) => void;
  onCommit: (b: NewsBlock) => void; onRemove: (id: number) => void;
}) {
  const b = block;
  const inp = (field: keyof NewsBlock, ph: string, st?: React.CSSProperties) => (
    <input value={(b[field] as string) || ""} placeholder={ph} onChange={(e) => onField(b.id, field, e.target.value)} onBlur={() => onCommit(b)} style={{ ...inpStyle, ...st }} />
  );
  const txt = (field: keyof NewsBlock, ph: string) => (
    <textarea value={(b[field] as string) || ""} placeholder={ph} onChange={(e) => onField(b.id, field, e.target.value)} onBlur={() => onCommit(b)} style={txtStyle} />
  );
  const remove = () => onRemove(b.id);

  if (b.kind === "headline") {
    return (
      <BlockWrap editing={editing} onRemove={remove}>
        {editing ? (
          <>
            <div style={kicker}>Announcement</div>
            {inp("title", "Headline", { fontWeight: 600 })}
            {txt("body", "Write your update…")}
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, color: color.primary }}>
              <Icon name="megaphone" size={16} strokeWidth={1.8} />
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: color.faint3 }}>Announcement</span>
            </div>
            <div style={{ fontFamily: font.head, fontSize: 18, fontWeight: 600, color: color.navy, marginBottom: 6, lineHeight: 1.25 }}>{b.title}</div>
            <div style={{ fontSize: 13.5, lineHeight: 1.55, color: color.subtle }}>{b.body}</div>
          </>
        )}
      </BlockWrap>
    );
  }
  if (b.kind === "highlight") {
    const grad = `linear-gradient(135deg,${color.surfaceAlt},${color.primaryTint})`;
    return (
      <BlockWrap editing={editing} extra={{ background: grad }} onRemove={remove}>
        {editing ? (
          <>
            <div style={kicker}>Highlight metric</div>
            {inp("metric", "Value (e.g. 71%)", { fontWeight: 700, fontSize: 20 })}
            {inp("label", "Label", { marginBottom: 0 })}
          </>
        ) : (
          <>
            <div style={{ fontFamily: font.head, fontSize: 40, fontWeight: 700, color: b.tone === "bad" ? color.danger : color.successInk, lineHeight: 1 }}>{b.metric}</div>
            <div style={{ fontSize: 13, color: color.subtle, marginTop: 8 }}>{b.label}</div>
          </>
        )}
      </BlockWrap>
    );
  }
  if (b.kind === "shoutout") {
    const grad = `linear-gradient(135deg,${color.surfaceAlt},${color.warningTint})`;
    return (
      <BlockWrap editing={editing} extra={{ background: grad }} onRemove={remove}>
        {editing ? (
          <>
            <div style={kicker}>Shout-out</div>
            {inp("who", "Who / which team", { fontWeight: 700 })}
            {txt("body", "Message…")}
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ display: "flex", color: color.warning }}><Icon name="star" size={16} strokeWidth={1.8} /></span>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: color.text }}>{b.who}</span>
            </div>
            <div style={{ fontSize: 13.5, lineHeight: 1.55, color: color.subtle }}>{b.body}</div>
          </>
        )}
      </BlockWrap>
    );
  }
  if (b.kind === "image") {
    return (
      <BlockWrap editing={editing} onRemove={remove}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", height: 180,
          borderRadius: 12, background: color.surfaceInput, color: color.faint3, fontSize: 12.5,
        }}>
          <Icon name="image" size={22} strokeWidth={1.8} /> Drop an image
        </div>
        {editing ? inp("caption", "Caption", { marginTop: 9, marginBottom: 0 })
          : <div style={{ fontSize: 12.5, color: color.subtle, marginTop: 9 }}>{b.caption}</div>}
      </BlockWrap>
    );
  }
  if (b.kind === "milestone") {
    return (
      <BlockWrap editing={editing} onRemove={remove}>
        {editing ? (
          <>
            <div style={kicker}>Milestone</div>
            {inp("title", "Milestone name", { fontWeight: 600 })}
            {inp("date", "Date (e.g. 29 Aug 2026)")}
            {txt("body", "Details…")}
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 7 }}>
              <span style={{ width: 12, height: 12, background: color.accent, transform: "rotate(45deg)", flex: "none" }} />
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: color.faint3 }}>Milestone · {b.date}</span>
            </div>
            <div style={{ fontFamily: font.head, fontSize: 16, fontWeight: 600, color: color.navy, marginBottom: 5 }}>{b.title}</div>
            <div style={{ fontSize: 13, lineHeight: 1.5, color: color.subtle }}>{b.body}</div>
          </>
        )}
      </BlockWrap>
    );
  }
  // doc
  return (
    <BlockWrap editing={editing} onRemove={remove}>
      {editing ? (
        <>
          <div style={kicker}>Document</div>
          {inp("title", "File name")}
          {inp("meta", "Description / size", { marginBottom: 0 })}
        </>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 40, height: 40, borderRadius: 10, background: color.dangerTint, color: color.danger, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
            <Icon name="sheet" size={20} strokeWidth={1.8} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: color.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.title}</div>
            <div style={{ fontSize: 11.5, color: color.faint3 }}>{b.meta}</div>
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: color.primary }}>Open</span>
        </div>
      )}
    </BlockWrap>
  );
}

interface NewsWall { canEdit: boolean; theme: string; layout: string; blocks: NewsBlock[] }

function useNews() {
  return useQuery({
    queryKey: ["news"], retry: false, staleTime: 30_000,
    queryFn: async (): Promise<NewsWall> => {
      try {
        return (await api<NewsWall>("/news")) ?? { canEdit: false, theme: "aurora", layout: "masonry", blocks: [] };
      } catch { return { canEdit: false, theme: "aurora", layout: "masonry", blocks: [] }; }
    },
  });
}

export default function News() {
  const { data } = useNews();
  const qc = useQueryClient();
  const canEdit = data?.canEdit ?? false;

  // Server is the source of truth; local state only holds the edit toggle,
  // in-progress field drafts, and immediate theme/layout feedback.
  const [edit, setEdit] = useState(false);
  const [themeOverride, setThemeOverride] = useState<ThemeKey | null>(null);
  const [layoutOverride, setLayoutOverride] = useState<Layout | null>(null);
  const [drafts, setDrafts] = useState<Record<number, Partial<NewsBlock>>>({});

  const serverTheme = (data && THEMES[data.theme as ThemeKey] ? data.theme : "aurora") as ThemeKey;
  const serverLayout = (data && LAYOUTS.some((l) => l.key === data.layout) ? data.layout : "masonry") as Layout;
  const theme = themeOverride ?? serverTheme;
  const layout = layoutOverride ?? serverLayout;
  const blocks: NewsBlock[] = (data?.blocks ?? []).map((b) => (drafts[b.id] ? { ...b, ...drafts[b.id] } : b));
  const nt = THEMES[theme];

  const addBlock = useMutation({
    mutationFn: (kind: BlockKind) => api<NewsBlock>("/news/blocks", { method: "POST", body: JSON.stringify({ kind }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["news"] }),
  });
  const removeBlockMut = useMutation({
    mutationFn: (id: number) => api<void>(`/news/blocks/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["news"] }),
  });
  const commitBlock = useMutation({
    mutationFn: (b: NewsBlock) => api<NewsBlock>(`/news/blocks/${b.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: b.title ?? "", body: b.body ?? "", metric: b.metric ?? "", label: b.label ?? "",
        tone: b.tone ?? "good", who: b.who ?? "", caption: b.caption ?? "", date: b.date ?? "", meta: b.meta ?? "",
      }),
    }),
    onSuccess: (_r, b) => {
      setDrafts((d) => { const next = { ...d }; delete next[b.id]; return next; });
      qc.invalidateQueries({ queryKey: ["news"] });
    },
  });
  const saveConfig = useMutation({
    mutationFn: (cfg: { theme?: string; layout?: string }) =>
      api<void>("/news/config", { method: "PATCH", body: JSON.stringify(cfg) }),
    onSuccess: () => {
      setThemeOverride(null); setLayoutOverride(null);
      qc.invalidateQueries({ queryKey: ["news"] });
    },
  });

  const chooseTheme = (k: ThemeKey) => { setThemeOverride(k); saveConfig.mutate({ theme: k }); };
  const chooseLayout = (k: Layout) => { setLayoutOverride(k); saveConfig.mutate({ layout: k }); };
  const removeBlock = (id: number) => removeBlockMut.mutate(id);
  const updateField = (id: number, field: keyof NewsBlock, v: string) =>
    setDrafts((d) => ({ ...d, [id]: { ...d[id], [field]: v } }));

  const wallStyle: React.CSSProperties =
    layout === "masonry" ? { columnCount: 3, columnGap: 16 }
      : layout === "grid" ? { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, alignItems: "start" }
        : { maxWidth: 680, margin: "0 auto" };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      {/* hero banner */}
      <div style={{ background: nt.hero, borderRadius: 18, padding: "30px 32px", marginBottom: 20, color: nt.ink, position: "relative", overflow: "hidden" }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.8 }}>Week 26 · 2026</div>
        <div style={{ fontFamily: font.head, fontSize: 30, fontWeight: 700, margin: "6px 0 4px", letterSpacing: "-0.01em" }}>Biltema Portfolio — Weekly Updates</div>
        <div style={{ fontSize: 14.5, opacity: 0.9, maxWidth: 600 }}>Curated by the PMO. Highlights, milestones, shout-outs and the documents you need this week.</div>
      </div>

      {/* PMO editor toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap", background: color.surface, border: `1px solid ${color.border}`, borderRadius: 13, padding: "13px 16px" }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: color.navy }}>PMO editor</span>
        <button onClick={() => setEdit((e) => !e)} disabled={!canEdit}
          title={canEdit ? undefined : "Your role can't edit the news wall"} style={{
          display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, cursor: canEdit ? "pointer" : "not-allowed", fontFamily: "inherit",
          color: edit ? "#fff" : color.primary, background: edit ? color.primaryFill : color.primaryTint,
          border: `1px solid ${edit ? color.primary : color.primaryTint2}`, padding: "7px 13px", borderRadius: 8,
          opacity: canEdit ? 1 : 0.55,
        }}>
          <Icon name={edit ? "check" : "edit"} size={15} /> {edit ? "Done editing" : "Edit wall"}
        </button>
        <span style={{ width: 1, height: 24, background: color.border3 }} />
        <span style={{ fontSize: 11.5, color: color.faint3 }}>Theme</span>
        <div style={{ display: "flex", gap: 6 }}>
          {(Object.keys(THEMES) as ThemeKey[]).map((k) => (
            <button key={k} onClick={() => chooseTheme(k)} disabled={!canEdit} title={THEMES[k].name} style={{
              width: 30, height: 24, borderRadius: 7, background: THEMES[k].hero,
              border: `2px solid ${theme === k ? color.navy : "transparent"}`, cursor: "pointer",
            }} />
          ))}
        </div>
        <span style={{ width: 1, height: 24, background: color.border3 }} />
        <span style={{ fontSize: 11.5, color: color.faint3 }}>Layout</span>
        <div style={{ display: "inline-flex", background: color.border3, borderRadius: 8, padding: 2, gap: 2 }}>
          {LAYOUTS.map((lo) => {
            const a = layout === lo.key;
            return (
              <button key={lo.key} onClick={() => chooseLayout(lo.key)} disabled={!canEdit} style={{
                padding: "5px 11px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit",
                background: a ? color.surface : "transparent", color: a ? color.primary : color.subtle,
              }}>{lo.label}</button>
            );
          })}
        </div>
      </div>

      {/* add-block palette (edit mode only) */}
      {edit && (
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", marginBottom: 18 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: color.subtle }}>Add block:</span>
          {PALETTE.map((ab) => (
            <button key={ab.kind} onClick={() => addBlock.mutate(ab.kind)} style={{
              display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: color.primary,
              background: color.surface, border: `1px solid ${color.primaryTint2}`, padding: "8px 12px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit",
            }}>
              <Icon name={ab.icon} size={16} /> {ab.label}
            </button>
          ))}
        </div>
      )}

      {/* the wall */}
      {blocks.length === 0 ? (
        <div style={{ background: color.surface, border: `1px dashed ${color.border2}`, borderRadius: 16, padding: "56px 22px", textAlign: "center", color: color.faint3 }}>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12, color: color.faint2 }}>
            <Icon name="megaphone" size={26} strokeWidth={1.6} />
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: color.subtle }}>No updates posted yet</div>
          <div style={{ fontSize: 12.5, marginTop: 4 }}>
            {edit ? "Add a block from the palette above to start the wall." : "Turn on Edit wall to add announcements, highlights and milestones."}
          </div>
        </div>
      ) : (
        <div style={wallStyle}>
          {blocks.map((b) => (
            <NewsBlockEl key={b.id} block={b} editing={edit && canEdit} onField={updateField} onCommit={(bl) => commitBlock.mutate(bl)} onRemove={removeBlock} />
          ))}
        </div>
      )}
    </div>
  );
}
