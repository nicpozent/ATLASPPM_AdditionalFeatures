import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { api } from "@/api";
import { Icon } from "@/components/Icon";

type Source = "jira" | "ado";

interface Task { id: string; title: string; status: string; points: number; dateISO: string; mappedRelease: string }
interface Member { name: string; alloc: number }
interface Product {
  id: string; name: string; owner: string; source: Source; projects: string[];
  tasks: Task[]; members?: Member[]; releases?: string[];
}

const SOURCE_META: Record<Source, { label: string; c: string }> = {
  jira: { label: "Jira", c: "#2684FF" },
  ado: { label: "Azure DevOps", c: "#0078D7" },
};
const STATUS_COLOR: Record<string, { ink: string; tint: string }> = {
  "Done": { ink: "#0B6B37", tint: "#E7F4EC" },
  "In Progress": { ink: "#6A2E9E", tint: "#F0E8F7" },
  "To Do": { ink: "#566077", tint: "#EEF0F4" },
  "Backlog": { ink: "#566077", tint: "#EEF0F4" },
  "Blocked": { ink: "#A1282B", tint: "#FBE7E8" },
};

function useProducts() {
  return useQuery({
    queryKey: ["products"], retry: false, staleTime: 60_000,
    queryFn: async (): Promise<Product[]> => { try { return (await api<Product[]>("/products")) ?? []; } catch { return []; } },
  });
}

const pct = (done: number, total: number) => (total > 0 ? Math.round((done / total) * 100) : 0);

export default function Products() {
  const { data: products = [] } = useProducts();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => products.find((p) => p.id === selectedId) ?? null, [products, selectedId]);

  if (selected) {
    return (
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <ProductDetail product={selected} onClose={() => setSelectedId(null)} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ fontSize: 13.5, color: color.subtle, marginBottom: 16 }}>Products are durable containers; projects &amp; programs deliver against them. Tasks sync from Jira/ADO and are mapped to releases.</div>
      {products.length === 0 ? (
        <div style={{ background: "#fff", border: `1px solid ${color.border}`, borderRadius: 16, padding: "56px 22px", textAlign: "center", color: color.faint3, fontSize: 13.5 }}>
          No products yet. Products appear here once synced from Jira or Azure DevOps.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
          {products.map((p) => {
            const done = p.tasks.filter((t) => t.status === "Done").length;
            const pts = p.tasks.reduce((s, t) => s + (t.points || 0), 0);
            const src = SOURCE_META[p.source];
            return (
              <div key={p.id} onClick={() => setSelectedId(p.id)} style={{ background: "#fff", border: `1px solid ${color.border}`, borderRadius: 16, padding: 20, cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 13 }}>
                  <span style={boxBadge(40)}><Icon name="box" size={20} /></span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: color.navy }}>{p.name}</div>
                    <div style={{ fontSize: 11.5, color: color.faint3 }}>{p.id} · {p.owner}</div>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: src.c, padding: "3px 9px", borderRadius: 6 }}>{src.label}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                  <div style={{ flex: 1, height: 7, background: color.bg, borderRadius: 4, overflow: "hidden" }}><div style={{ height: "100%", width: `${pct(done, p.tasks.length)}%`, background: color.primary }} /></div>
                  <span style={{ fontFamily: font.mono, fontSize: 11.5, fontWeight: 700, color: color.subtle }}>{done}/{p.tasks.length}</span>
                </div>
                <div style={{ fontSize: 12, color: color.subtle }}>{p.tasks.length} tasks · {pts} pts · projects: {p.projects.join(", ") || "—"}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProductDetail({ product, onClose }: { product: Product; onClose: () => void }) {
  const src = SOURCE_META[product.source];
  const [tasks, setTasks] = useState<Task[]>(product.tasks);
  const [members, setMembers] = useState<Member[]>(product.members ?? []);
  const relOpts = useMemo(() => {
    const set = new Set<string>(product.releases ?? []);
    tasks.forEach((t) => t.mappedRelease && set.add(t.mappedRelease));
    return ["Unassigned", ...Array.from(set)];
  }, [product.releases, tasks]);

  const sectionCard: React.CSSProperties = { background: "#fff", border: `1px solid ${color.border}`, borderRadius: 16, overflow: "hidden", marginBottom: 18 };
  const sectionTitle: React.CSSProperties = { padding: "16px 22px 13px", fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.navy };
  const taskCols = "110px minmax(200px,2fr) 100px 50px 140px 150px";

  return (
    <div>
      <button onClick={onClose} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: color.primary, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", marginBottom: 14, padding: 0 }}>← All products</button>

      {/* header */}
      <div style={{ background: "#fff", border: `1px solid ${color.border}`, borderRadius: 16, padding: 22, marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
          <span style={boxBadge(44)}><Icon name="box" size={22} /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: font.head, fontSize: 20, fontWeight: 600, color: color.navy }}>{product.name}</div>
            <div style={{ fontSize: 12.5, color: color.faint2 }}>Owner {product.owner} · Projects: {product.projects.join(", ") || "—"}</div>
          </div>
          <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600, color: "#fff", background: src.c, padding: "6px 12px", borderRadius: 8 }}><Icon name="sync" size={16} /> Synced from {src.label}</span>
        </div>
      </div>

      {/* linked projects */}
      <div style={sectionCard}>
        <div style={sectionTitle}>Linked projects</div>
        <div style={{ padding: "0 22px 16px", fontSize: 13, color: color.faint3 }}>
          {product.projects.length ? product.projects.join(" · ") : "No projects linked to this product yet."}
        </div>
      </div>

      {/* release timeline */}
      <div style={sectionCard}>
        <div style={sectionTitle}>Product release timeline</div>
        <div style={{ padding: "0 22px 20px", minHeight: 80, display: "flex", alignItems: "center", justifyContent: "center", color: color.faint3, fontSize: 13 }}>No releases scheduled yet.</div>
      </div>

      {/* team & allocation */}
      <div style={sectionCard}>
        <div style={sectionTitle}>Product team &amp; allocation</div>
        <div style={{ padding: "0 22px 16px" }}>
          {members.length === 0 ? (
            <div style={{ padding: "16px 0", textAlign: "center", color: color.faint3, fontSize: 13 }}>No team members allocated yet.</div>
          ) : members.map((m, i) => (
            <div key={m.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 0", borderTop: "1px solid #F4F6FA" }}>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: color.text }}>{m.name}</span>
              <div style={{ width: 160, height: 7, background: color.bg, borderRadius: 4, overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.min(100, m.alloc)}%`, background: color.primary }} /></div>
              <input type="number" min={0} max={100} value={m.alloc}
                onChange={(e) => { const v = Math.max(0, Math.min(100, +e.target.value)); setMembers((l) => l.map((x, xi) => (xi === i ? { ...x, alloc: v } : x))); }}
                style={{ width: 58, textAlign: "center", border: `1px solid ${color.border2}`, borderRadius: 7, padding: "5px 0", fontSize: 12, fontWeight: 700, fontFamily: font.mono, color: color.text, outline: "none" }} />
            </div>
          ))}
          <div style={{ fontSize: 11, color: color.faint3, marginTop: 10 }}>Editable by the product owner · feeds resource planning (by person / project / product).</div>
        </div>
      </div>

      {/* tasks → release mapping */}
      <div style={{ background: "#fff", border: `1px solid ${color.border}`, borderRadius: 16, overflow: "hidden" }}>
        <div style={sectionTitle}>Tasks → release mapping</div>
        <div style={{ overflowX: "auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: taskCols, minWidth: 760, padding: "0 22px 9px", fontSize: 10.5, color: color.faint3, letterSpacing: "0.04em", textTransform: "uppercase", fontWeight: 600, borderBottom: `1px solid ${color.bg}` }}>
            <div>Task</div><div>Title</div><div>Status</div><div>Pts</div><div>Date</div><div>Release</div>
          </div>
          {tasks.length === 0 ? (
            <div style={{ padding: "40px 22px", textAlign: "center", color: color.faint3, fontSize: 13, minWidth: 760 }}>No tasks synced yet.</div>
          ) : tasks.map((t, i) => {
            const sc = STATUS_COLOR[t.status] ?? STATUS_COLOR["To Do"];
            return (
              <div key={t.id} style={{ display: "grid", gridTemplateColumns: taskCols, minWidth: 760, alignItems: "center", padding: "12px 22px", borderBottom: "1px solid #F2F4F9" }}>
                <div style={{ fontFamily: font.mono, fontSize: 11.5, color: color.primaryDark }}>{t.id}</div>
                <div style={{ fontSize: 13, color: color.text, fontWeight: 500 }}>{t.title}</div>
                <div><span style={{ fontSize: 11, fontWeight: 700, color: sc.ink, background: sc.tint, padding: "3px 9px", borderRadius: 6 }}>{t.status}</span></div>
                <div style={{ fontFamily: font.mono, fontSize: 12, color: color.textMuted }}>{t.points}</div>
                <div><input type="date" value={t.dateISO} title="From Jira — editable"
                  onChange={(e) => setTasks((l) => l.map((x, xi) => (xi === i ? { ...x, dateISO: e.target.value } : x)))}
                  style={{ width: "100%", fontSize: 11.5, color: color.textMuted, fontFamily: font.mono, border: `1px solid ${color.border2}`, borderRadius: 6, padding: "4px 6px", outline: "none" }} /></div>
                <div><select value={t.mappedRelease}
                  onChange={(e) => setTasks((l) => l.map((x, xi) => (xi === i ? { ...x, mappedRelease: e.target.value } : x)))}
                  style={{ width: "100%", fontSize: 12, fontWeight: 600, color: color.text, border: `1px solid ${color.border2}`, borderRadius: 7, padding: "5px 7px", fontFamily: "inherit", cursor: "pointer", background: "#fff" }}>
                  {relOpts.map((o) => <option key={o} value={o}>{o}</option>)}
                </select></div>
              </div>
            );
          })}
        </div>
      </div>

      {/* team vacations */}
      <div style={{ background: "#fff", border: `1px solid ${color.border}`, borderRadius: 16, padding: 20, marginTop: 18 }}>
        <div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.navy, marginBottom: 6 }}>Team vacations</div>
        <div style={{ fontSize: 11.5, color: color.faint2, marginBottom: 14 }}>Absences for resources on this product</div>
        <div style={{ minHeight: 60, display: "flex", alignItems: "center", justifyContent: "center", color: color.faint3, fontSize: 13 }}>No absences recorded.</div>
      </div>
    </div>
  );
}

function boxBadge(size: number): React.CSSProperties {
  return { width: size, height: size, borderRadius: 11, background: "#EEF3FB", color: color.primary, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" };
}
