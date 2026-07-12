// ============================================================================
//  Program Board — pure derivations (no React/DOM). The board lays PI
//  objectives on a swimlane grid: rows are the linked deliverables, columns are
//  the increment's iterations (plus an "Unscheduled" column), and cross-team
//  dependencies are drawn as arrows between lanes. Kept separate from the view
//  so the layout maths stays unit-testable. See ADR-0061.
// ============================================================================
import type { Objective, Dependency, Iteration } from "./data";

export interface Lane { key: string; type: string; id: string; name: string }
export interface BoardColumn { id: number | null; name: string } // id null ⇒ Unscheduled

export const UNASSIGNED = "unassigned";

// A stable lane key for an entity reference. Empty type/id ⇒ the shared
// "unassigned" lane (objectives/dependency ends with no linked deliverable).
export function laneKey(type: string, id: string): string {
  return type && id ? `${type}:${id}` : UNASSIGNED;
}

// The lanes present on the board: every distinct deliverable referenced by an
// objective or a dependency end. "Unassigned" (if any) always sorts last.
export function deriveLanes(objectives: Objective[], dependencies: Dependency[]): Lane[] {
  const map = new Map<string, Lane>();
  const add = (type: string, id: string, name: string) => {
    const key = laneKey(type, id);
    if (!map.has(key)) {
      map.set(key, key === UNASSIGNED
        ? { key, type: "", id: "", name: "Unassigned" }
        : { key, type, id, name: name || id });
    }
  };
  for (const o of objectives) add(o.entityType, o.entityId, o.entityName);
  for (const d of dependencies) {
    add(d.fromType, d.fromId, d.fromName);
    add(d.toType, d.toId, d.toName);
  }
  return [...map.values()].sort((a, b) =>
    a.key === UNASSIGNED ? 1 : b.key === UNASSIGNED ? -1 : 0);
}

// Board columns: an "Unscheduled" tray first, then the increment's iterations
// in order.
export function columns(iterations: Iteration[]): BoardColumn[] {
  return [{ id: null, name: "Unscheduled" }, ...iterations.map((i) => ({ id: i.id, name: i.name }))];
}

// Which column an objective sits in: its stored placement if that iteration
// still exists, otherwise the Unscheduled tray (null).
export function placedColumn(
  objId: number,
  placements: Record<string, number>,
  iterationIds: ReadonlySet<number>,
): number | null {
  const it = placements[String(objId)];
  return it != null && iterationIds.has(it) ? it : null;
}

// Objectives that belong in one cell (lane × column).
export function cardsFor(
  objectives: Objective[],
  lane: string,
  colId: number | null,
  placements: Record<string, number>,
  iterationIds: ReadonlySet<number>,
): Objective[] {
  return objectives.filter(
    (o) => laneKey(o.entityType, o.entityId) === lane && placedColumn(o.id, placements, iterationIds) === colId,
  );
}

// Dependencies as lane→lane links (self-links dropped — nothing to draw).
export interface LaneLink { id: number; from: string; to: string; status: string; title: string }
export function dependencyLaneLinks(dependencies: Dependency[]): LaneLink[] {
  return dependencies
    .map((d) => ({ id: d.id, from: laneKey(d.fromType, d.fromId), to: laneKey(d.toType, d.toId), status: d.status, title: d.title }))
    .filter((l) => l.from !== l.to);
}

// A cubic-bezier path between two points, bowed horizontally by `bow` px so
// parallel arrows on the same rail stay legible. Used for the dependency arrows.
export function arrowPath(x1: number, y1: number, x2: number, y2: number, bow = 42): string {
  const cx1 = x1 + bow;
  const cx2 = x2 + bow;
  return `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`;
}
