import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { color, font } from "@/theme";
import { api } from "@/api";
import { Icon } from "@/components/Icon";
import { Button, Input, Select, Modal as Overlay } from "@/components/ui";
import { usePermissions } from "@/components/usePermissions";
import { CostsModal } from "@/components/CostsModal";
import { SubscribeButton } from "@/components/SubscribeButton";

type Source = "jira" | "ado" | "manual";

interface Task { id: string; title: string; status: string; points: number; dateISO: string; mappedRelease: string }
interface Member { name: string; alloc: number }
interface Product {
  id: string; name: string; owner: string; source: Source; projects: string[];
  tasks: Task[]; members?: Member[]; releases?: string[]; status?: string;
  startDate?: string; endDate?: string; canManage?: boolean;
  teamKey?: string; teamLabel?: string; teamSize?: number;
}
interface RelOpt { id: string; name: string; date: string; status: string }
interface TeamOption { key: string; label: string }
interface Allocation { id: number; name: string; email: string; title: string; teamKey: string; teamLabel: string; alloc: number }
interface Assignable { name: string; email: string; jobTitle: string; teamKey: string; teamLabel: string }
interface ProductTeam {
  productId: string; teamKey: string; teamLabel: string;
  canAssignTeam: boolean; canAllocate: boolean;
  allocations: Allocation[]; assignable: Assignable[]; teamOptions: TeamOption[];
}
const PRD_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const prdToDisplay = (iso: string): string => { if (!iso) return ""; const [y, m, dd] = iso.split("-").map(Number); return y && m && dd ? `${dd} ${PRD_MONTHS[m - 1]} ${y}` : ""; };
type ProductStatus = "Active" | "Retired" | "Replaced";
const PRODUCT_STATUS_COLOR: Record<string, { ink: string; tint: string }> = {
  Active: { ink: "#0B6B37", tint: "#E7F4EC" }, Retired: { ink: "#566077", tint: "#EEF0F4" }, Replaced: { ink: "#8A6300", tint: "#FBF2D7" },
};

const SOURCE_META: Record<Source, { label: string; c: string }> = {
  jira: { label: "Jira", c: "#2684FF" },
  ado: { label: "Azure DevOps", c: "#0078D7" },
  manual: { label: "Manual", c: "#566077" },
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

interface NewProduct { name: string; owner: string; source: Source; projects: string[]; startDate: string; endDate: string; teamKey: string }

export default function Products() {
  const { data: products = [] } = useProducts();
  const qc = useQueryClient();
  const { can } = usePermissions();
  const mayCreate = can("cap-products", "F");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [pstatus, setPstatus] = useState<ProductStatus>("Active");
  const selected = useMemo(() => products.find((p) => p.id === selectedId) ?? null, [products, selectedId]);
  const shown = products.filter((p) => (p.status ?? "Active") === pstatus);
  const countBy = (s: ProductStatus) => products.filter((p) => (p.status ?? "Active") === s).length;
  const createProduct = useMutation({
    mutationFn: (body: NewProduct) => api<Product>("/products", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });

  if (selected) {
    return (
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <ProductDetail product={selected} onClose={() => setSelectedId(null)} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <div style={{ fontSize: 13.5, color: color.subtle, flex: 1 }}>Products are durable containers; projects &amp; programs deliver against them. Tasks sync from Jira/ADO and are mapped to releases.</div>
        <Button onClick={() => setModal(true)} disabled={!mayCreate} title={mayCreate ? undefined : "Your role can't create products"}><Icon name="plus" size={16} /> New product</Button>
      </div>
      {/* Products aren't deleted — they move through Active / Retired / Replaced. */}
      <div style={{ display: "inline-flex", background: "#E4E8F1", borderRadius: 10, padding: 3, gap: 2, marginBottom: 16 }}>
        {(["Active", "Retired", "Replaced"] as ProductStatus[]).map((s) => (
          <button key={s} onClick={() => setPstatus(s)} style={{ padding: "7px 15px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit", background: pstatus === s ? "#fff" : "transparent", color: pstatus === s ? color.primary : "#6A7488", boxShadow: pstatus === s ? "0 1px 3px rgba(20,26,60,0.12)" : "none" }}>
            {s} · {countBy(s)}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <div style={{ background: "#fff", border: `1px solid ${color.border}`, borderRadius: 16, padding: "56px 22px", textAlign: "center", color: color.faint3, fontSize: 13.5 }}>
          {products.length === 0 ? "No products yet. Products appear here once synced from Jira or Azure DevOps." : `No ${pstatus.toLowerCase()} products.`}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 }}>
          {shown.map((p) => {
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
                {(p.teamLabel || (p.teamSize ?? 0) > 0) && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 11.5, color: color.faint3 }}>
                    <Icon name="users" size={13} />
                    <span>{p.teamLabel || "Team"}{(p.teamSize ?? 0) > 0 ? ` · ${p.teamSize} member${p.teamSize === 1 ? "" : "s"}` : ""}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {modal && (
        <NewProductModal
          submitting={createProduct.isPending}
          onClose={() => setModal(false)}
          onCreate={(body) => createProduct.mutate(body, { onSuccess: () => setModal(false) })}
        />
      )}
    </div>
  );
}

function Lbl({ children }: { children: React.ReactNode }) {
  return <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#56607A", margin: "12px 0 5px" }}>{children}</label>;
}

function NewProductModal({ onClose, onCreate, submitting }: {
  onClose: () => void; onCreate: (p: NewProduct) => void; submitting?: boolean;
}) {
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const [source, setSource] = useState<Source>("manual");
  const [projects, setProjects] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [teamKey, setTeamKey] = useState("");
  const { data: teamOptions = [] } = useQuery({
    queryKey: ["team-slots"], retry: false, staleTime: 300_000,
    queryFn: async (): Promise<TeamOption[]> => { try { return (await api<TeamOption[]>("/teams/slots")) ?? []; } catch { return []; } },
  });
  const submit = () => {
    if (!name.trim()) return;
    onCreate({
      name: name.trim(), owner: owner.trim(), source,
      projects: projects.split(",").map((s) => s.trim()).filter(Boolean),
      startDate: prdToDisplay(startDate), endDate: prdToDisplay(endDate), teamKey,
    });
  };
  return (
    <Overlay onClose={onClose}>
      <div style={{ fontFamily: font.head, fontSize: 17, fontWeight: 600, color: color.navy, marginBottom: 4 }}>New product</div>
      <div style={{ fontSize: 12.5, color: color.faint3, marginBottom: 16 }}>A durable product container. Tasks &amp; releases sync in from its source once connected.</div>
      <Lbl>Name</Lbl>
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Storefront Web" />
      <Lbl>Owner</Lbl>
      <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Product owner" />
      <Lbl>Source</Lbl>
      <Select value={source} onChange={(e) => setSource(e.target.value as Source)}>
        <option value="manual">Manual (created here)</option>
        <option value="jira">Jira</option>
        <option value="ado">Azure DevOps</option>
      </Select>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div><Lbl>Start date</Lbl><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></div>
        <div><Lbl>End date</Lbl><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></div>
      </div>
      <Lbl>Delivery team</Lbl>
      <Select value={teamKey} onChange={(e) => setTeamKey(e.target.value)}>
        <option value="">Unassigned — assign a team later</option>
        {teamOptions.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
      </Select>
      <Lbl>Linked projects (comma-separated)</Lbl>
      <Input value={projects} onChange={(e) => setProjects(e.target.value)} placeholder="PRJ-204, PRJ-176" />
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={submit} disabled={submitting || !name.trim()}>{submitting ? "Creating…" : "Create product"}</Button>
      </div>
    </Overlay>
  );
}

function ProductDetail({ product, onClose }: { product: Product; onClose: () => void }) {
  const src = SOURCE_META[product.source];
  const qc = useQueryClient();
  const { can } = usePermissions();
  const mayManage = product.canManage ?? can("cap-products", "E");
  const [costsOpen, setCostsOpen] = useState(false);
  const setStatus = useMutation({
    mutationFn: (status: string) => api(`/products/${product.id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
  const updateProduct = useMutation({
    mutationFn: (body: Partial<{ projects: string[]; releases: string[]; startDate: string; endDate: string }>) =>
      api(`/products/${product.id}`, { method: "PATCH", body: JSON.stringify(body) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
  const { data: allProjects = [] } = useQuery({
    queryKey: ["products-projopts"], retry: false, staleTime: 60_000,
    queryFn: async (): Promise<{ id: string; name: string }[]> => { try { return (await api<{ id: string; name: string }[]>("/projects")) ?? []; } catch { return []; } },
  });
  const { data: allReleases = [] } = useQuery({
    queryKey: ["products-relopts"], retry: false, staleTime: 60_000,
    queryFn: async (): Promise<RelOpt[]> => { try { return (await api<RelOpt[]>("/releases")) ?? []; } catch { return []; } },
  });
  const [tasks, setTasks] = useState<Task[]>(product.tasks);
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
            <div style={{ fontSize: 12.5, color: color.faint2 }}>Owner {product.owner} · Projects: {product.projects.join(", ") || "—"}{product.startDate ? ` · ${product.startDate}${product.endDate ? ` → ${product.endDate}` : ""}` : ""}</div>
          </div>
          <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 600, color: "#fff", background: src.c, padding: "6px 12px", borderRadius: 8 }}><Icon name={product.source === "manual" ? "edit" : "sync"} size={16} /> {product.source === "manual" ? "Manually created" : `Synced from ${src.label}`}</span>
          {(() => { const c = PRODUCT_STATUS_COLOR[product.status ?? "Active"] ?? PRODUCT_STATUS_COLOR.Active; return (
            <span style={{ fontSize: 12, fontWeight: 700, color: c.ink, background: c.tint, padding: "5px 11px", borderRadius: 20 }}>{product.status ?? "Active"}</span>
          ); })()}
          {mayManage && (
            <select value={product.status ?? "Active"} onChange={(e) => setStatus.mutate(e.target.value)} title="Lifecycle status — products aren't deleted"
              style={{ border: `1px solid ${color.border}`, borderRadius: 8, padding: "7px 10px", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", color: color.text, background: "#fff", cursor: "pointer" }}>
              {["Active", "Retired", "Replaced"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          <SubscribeButton targetType="product" targetId={product.id} />
          <Button variant="secondary" onClick={() => setCostsOpen(true)}><Icon name="coins" size={15} /> Costs</Button>
        </div>
      </div>

      {/* linked projects */}
      <div style={sectionCard}>
        <div style={sectionTitle}>Linked projects</div>
        <div style={{ padding: "0 22px 16px" }}>
          <LinkManager
            kind="project"
            linked={product.projects}
            options={allProjects.map((p) => ({ id: p.id, label: `${p.id} · ${p.name}` }))}
            canManage={mayManage}
            onChange={(projects) => updateProduct.mutate({ projects })}
          />
        </div>
      </div>

      {/* linked releases */}
      <div style={sectionCard}>
        <div style={sectionTitle}>Linked releases</div>
        <div style={{ padding: "0 22px 16px" }}>
          <LinkManager
            kind="release"
            linked={product.releases ?? []}
            options={allReleases.map((r) => ({ id: r.id, label: `${r.name}${r.date ? ` · ${r.date}` : ""}` }))}
            canManage={mayManage}
            onChange={(releases) => updateProduct.mutate({ releases })}
          />
        </div>
      </div>

      {/* product timeline */}
      <ProductTimeline
        startDate={product.startDate ?? ""}
        endDate={product.endDate ?? ""}
        releases={(product.releases ?? []).map((id) => allReleases.find((r) => r.id === id)).filter(Boolean) as RelOpt[]}
        canManage={mayManage}
        onDates={(startDate, endDate) => updateProduct.mutate({ startDate, endDate })}
      />

      {/* team & allocation — members come from the Entra teams mapped in Admin → Teams */}
      <ProductTeamSection productId={product.id} />


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
      {costsOpen && <CostsModal scope="products" id={product.id} name={product.name} onClose={() => setCostsOpen(false)} />}
    </div>
  );
}

// Manage a list of linked entity IDs — chips with remove + an add dropdown.
function LinkManager({ kind, linked, options, canManage, onChange }: {
  kind: "project" | "release"; linked: string[]; options: { id: string; label: string }[];
  canManage: boolean; onChange: (ids: string[]) => void;
}) {
  const [pick, setPick] = useState("");
  const labelOf = (id: string) => options.find((o) => o.id === id)?.label ?? id;
  const available = options.filter((o) => !linked.includes(o.id));
  return (
    <>
      {linked.length === 0 ? (
        <div style={{ fontSize: 13, color: color.faint3, padding: "2px 0 10px" }}>No {kind}s linked to this product yet.</div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: canManage ? 12 : 0 }}>
          {linked.map((id) => (
            <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: color.bg, border: `1px solid ${color.border}`, borderRadius: 8, padding: "5px 10px", fontSize: 12.5, color: color.text }}>
              {labelOf(id)}
              {canManage && <button onClick={() => onChange(linked.filter((x) => x !== id))} title={`Unlink ${kind}`} style={{ background: "none", border: "none", cursor: "pointer", color: color.faint3, display: "flex", padding: 0 }}><Icon name="x" size={13} /></button>}
            </span>
          ))}
        </div>
      )}
      {canManage && (
        <div style={{ display: "flex", gap: 8 }}>
          <Select value={pick} onChange={(e) => setPick(e.target.value)} style={{ flex: 1 }}>
            <option value="">{available.length ? `Link a ${kind}…` : `All ${kind}s already linked`}</option>
            {available.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </Select>
          <Button variant="secondary" onClick={() => { if (pick) { onChange([...linked, pick]); setPick(""); } }} disabled={!pick}><Icon name="link" size={15} /> Link</Button>
        </div>
      )}
    </>
  );
}

const toIso = (display: string) => { const t = Date.parse(display); return isNaN(t) ? "" : new Date(t).toISOString().slice(0, 10); };

// Product timeline — a start→end span with linked releases plotted as milestones.
function ProductTimeline({ startDate, endDate, releases, canManage, onDates }: {
  startDate: string; endDate: string; releases: RelOpt[]; canManage: boolean; onDates: (start: string, end: string) => void;
}) {
  const s = Date.parse(startDate), e = Date.parse(endDate);
  const hasSpan = !isNaN(s) && !isNaN(e) && e > s;
  const dated = releases.map((r) => ({ ...r, t: Date.parse(r.date) })).sort((a, b) => (isNaN(a.t) ? 0 : a.t) - (isNaN(b.t) ? 0 : b.t));
  const card: React.CSSProperties = { background: "#fff", border: `1px solid ${color.border}`, borderRadius: 16, overflow: "hidden", marginBottom: 18 };
  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 22px 13px" }}>
        <div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.navy, flex: 1 }}>Product timeline</div>
        {canManage && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: color.faint3 }}>
            <input type="date" value={toIso(startDate)} title="Start" onChange={(e2) => onDates(prdToDisplay(e2.target.value), endDate)}
              style={{ border: `1px solid ${color.border2}`, borderRadius: 7, padding: "5px 7px", fontSize: 12, fontFamily: font.mono, color: color.text }} />
            <span>→</span>
            <input type="date" value={toIso(endDate)} title="End" onChange={(e2) => onDates(startDate, prdToDisplay(e2.target.value))}
              style={{ border: `1px solid ${color.border2}`, borderRadius: 7, padding: "5px 7px", fontSize: 12, fontFamily: font.mono, color: color.text }} />
          </div>
        )}
      </div>
      <div style={{ padding: "0 22px 22px" }}>
        {!hasSpan ? (
          <div style={{ fontSize: 13, color: color.faint3 }}>{startDate || endDate ? "Set a start and end date to plot the timeline." : "No start/end dates set yet."}{dated.length > 0 && ` ${dated.length} linked release${dated.length === 1 ? "" : "s"}.`}</div>
        ) : (
          <div style={{ position: "relative", margin: "26px 8px 8px" }}>
            <div style={{ height: 6, background: color.bg, borderRadius: 3 }}>
              <div style={{ height: "100%", background: "#DCE6F5", borderRadius: 3 }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7, fontSize: 11, color: color.faint3, fontFamily: font.mono }}>
              <span>{startDate}</span><span>{endDate}</span>
            </div>
            {dated.map((r) => {
              const pct = isNaN(r.t) ? 50 : Math.max(0, Math.min(100, ((r.t - s) / (e - s)) * 100));
              return (
                <div key={r.id} title={`${r.name}${r.date ? ` · ${r.date}` : ""}`} style={{ position: "absolute", top: -20, left: `${pct}%`, transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: color.primary, whiteSpace: "nowrap" }}>{r.name}</span>
                  <span style={{ width: 11, height: 11, borderRadius: "50%", background: color.primary, border: "2px solid #fff", boxShadow: "0 0 0 1px " + color.primary, marginTop: 2 }} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const AVATAR_COLORS = ["#0F6CBD", "#7A3FB0", "#0E7C7B", "#C98A00", "#15A34A", "#A1282B"];
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
const avatarColor = (name: string) => AVATAR_COLORS[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_COLORS.length];

// Product delivery team. Members are allocated from the Entra teams a manager
// owns (Admin → Teams); anyone with product access sees the roster read-only.
function ProductTeamSection({ productId }: { productId: string }) {
  const qc = useQueryClient();
  const [pick, setPick] = useState("");     // "email|name|teamKey" of the assignable member to add
  const [alloc, setAlloc] = useState(50);
  const { data } = useQuery({
    queryKey: ["product-team", productId], retry: false,
    queryFn: async (): Promise<ProductTeam | null> => { try { return await api<ProductTeam>(`/products/${productId}/team`); } catch { return null; } },
  });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["product-team", productId] }); qc.invalidateQueries({ queryKey: ["products"] }); };
  const setTeam = useMutation({
    mutationFn: (teamKey: string) => api(`/products/${productId}/team`, { method: "PATCH", body: JSON.stringify({ teamKey }) }),
    onSuccess: refresh,
  });
  const addAlloc = useMutation({
    mutationFn: (m: Assignable) => api(`/products/${productId}/allocations`, { method: "POST", body: JSON.stringify({ name: m.name, email: m.email, title: m.jobTitle, sourceTeamKey: m.teamKey, alloc }) }),
    onSuccess: () => { setPick(""); setAlloc(50); refresh(); },
  });
  const setAllocPct = useMutation({
    mutationFn: ({ id, v }: { id: number; v: number }) => api(`/products/allocations/${id}`, { method: "PATCH", body: JSON.stringify({ alloc: v }) }),
    onSuccess: refresh,
  });
  const removeAlloc = useMutation({
    mutationFn: (id: number) => api(`/products/allocations/${id}`, { method: "DELETE" }),
    onSuccess: refresh,
  });

  const sectionCard: React.CSSProperties = { background: "#fff", border: `1px solid ${color.border}`, borderRadius: 16, overflow: "hidden", marginBottom: 18 };
  const t = data;
  const canEdit = !!(t?.canAllocate || t?.canAssignTeam);
  const assignKey = (m: Assignable) => `${m.email}|${m.name}|${m.teamKey}`;
  const picked = t?.assignable.find((m) => assignKey(m) === pick) ?? null;

  return (
    <div style={sectionCard}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 22px 13px" }}>
        <div style={{ fontFamily: font.head, fontSize: 15, fontWeight: 600, color: color.navy, flex: 1 }}>Product team &amp; allocation</div>
        {t && (t.canAssignTeam ? (
          <select value={t.teamKey} onChange={(e) => setTeam.mutate(e.target.value)} title="Owning delivery team"
            style={{ border: `1px solid ${color.border}`, borderRadius: 8, padding: "6px 10px", fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", color: color.text, background: "#fff", cursor: "pointer" }}>
            <option value="">No team assigned</option>
            {t.teamOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        ) : t.teamLabel ? (
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: color.primary, background: "#EEF3FB", borderRadius: 8, padding: "5px 11px" }}><Icon name="users" size={14} /> {t.teamLabel}</span>
        ) : null)}
      </div>

      <div style={{ padding: "0 22px 16px" }}>
        {!t ? (
          <div style={{ padding: "16px 0", textAlign: "center", color: color.faint3, fontSize: 13 }}>Loading team…</div>
        ) : (
          <>
            {t.allocations.length === 0 ? (
              <div style={{ padding: "18px 0", textAlign: "center", color: color.faint3, fontSize: 13 }}>
                No team members allocated yet.{canEdit ? "" : " A team manager allocates members from their Entra teams."}
              </div>
            ) : t.allocations.map((a) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderTop: "1px solid #F4F6FA" }}>
                <span style={{ width: 34, height: 34, borderRadius: "50%", background: avatarColor(a.name), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flex: "none" }}>{initials(a.name)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: color.text }}>{a.name}</div>
                  <div style={{ fontSize: 11.5, color: color.faint3 }}>{a.title || a.email || "—"}{a.teamLabel ? ` · ${a.teamLabel}` : ""}</div>
                </div>
                <div style={{ width: 140, height: 7, background: color.bg, borderRadius: 4, overflow: "hidden" }}><div style={{ height: "100%", width: `${Math.min(100, a.alloc)}%`, background: color.primary }} /></div>
                {canEdit ? (
                  <input type="number" min={0} max={100} defaultValue={a.alloc}
                    onBlur={(e) => { const v = Math.max(0, Math.min(100, +e.target.value)); if (v !== a.alloc) setAllocPct.mutate({ id: a.id, v }); }}
                    style={{ width: 58, textAlign: "center", border: `1px solid ${color.border2}`, borderRadius: 7, padding: "5px 0", fontSize: 12, fontWeight: 700, fontFamily: font.mono, color: color.text, outline: "none" }} />
                ) : (
                  <span style={{ width: 44, textAlign: "right", fontSize: 12, fontWeight: 700, fontFamily: font.mono, color: color.textMuted }}>{a.alloc}%</span>
                )}
                {canEdit && (
                  <button onClick={() => removeAlloc.mutate(a.id)} title="Remove from team"
                    style={{ background: "none", border: "none", cursor: "pointer", color: color.faint3, display: "flex", padding: 4 }}><Icon name="trash" size={15} /></button>
                )}
              </div>
            ))}

            {t.canAllocate && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${color.bg}`, flexWrap: "wrap" }}>
                <select value={pick} onChange={(e) => setPick(e.target.value)}
                  style={{ flex: 1, minWidth: 200, border: `1px solid ${color.border}`, borderRadius: 8, padding: "8px 10px", fontSize: 12.5, fontFamily: "inherit", color: color.text, background: "#fff", cursor: "pointer" }}>
                  <option value="">{t.assignable.length ? "Add a member from your teams…" : "No unallocated members in your teams"}</option>
                  {t.assignable.map((m) => <option key={assignKey(m)} value={assignKey(m)}>{m.name}{m.jobTitle ? ` — ${m.jobTitle}` : ""} · {m.teamLabel}</option>)}
                </select>
                <input type="number" min={0} max={100} value={alloc} onChange={(e) => setAlloc(Math.max(0, Math.min(100, +e.target.value)))} title="Allocation %"
                  style={{ width: 66, textAlign: "center", border: `1px solid ${color.border2}`, borderRadius: 8, padding: "8px 0", fontSize: 12.5, fontWeight: 700, fontFamily: font.mono, color: color.text, outline: "none" }} />
                <Button onClick={() => picked && addAlloc.mutate(picked)} disabled={!picked || addAlloc.isPending}><Icon name="plus" size={15} /> Allocate</Button>
              </div>
            )}
            <div style={{ fontSize: 11, color: color.faint3, marginTop: 12 }}>
              {t.canAllocate ? "You can allocate members from the Entra teams you manage." : "Managed by the team's manager · feeds resource planning."}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function boxBadge(size: number): React.CSSProperties {
  return { width: size, height: size, borderRadius: 11, background: "#EEF3FB", color: color.primary, display: "flex", alignItems: "center", justifyContent: "center", flex: "none" };
}
