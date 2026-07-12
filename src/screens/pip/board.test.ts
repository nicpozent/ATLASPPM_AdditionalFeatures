import { describe, it, expect } from "vitest";
import {
  laneKey, deriveLanes, columns, placedColumn, cardsFor, dependencyLaneLinks, arrowPath, UNASSIGNED,
} from "./board";
import type { Objective, Dependency, Iteration } from "./data";

const obj = (id: number, entityType = "", entityId = "", entityName = ""): Objective => ({
  id, title: `O${id}`, description: "", entityType, entityId, entityName,
  businessValue: 5, actualValue: 0, committed: true, confidence: 3, status: "Planned",
});
const dep = (id: number, fromType: string, fromId: string, toType: string, toId: string, status = "Identified"): Dependency => ({
  id, title: `D${id}`, fromType, fromId, fromName: fromId, toType, toId, toName: toId, owner: "", dueDate: "", status,
});
const iter = (id: number, name: string): Iteration => ({ id, name, startDate: "", endDate: "", capacity: 0, load: 0 });

describe("laneKey", () => {
  it("keys by type:id and folds empties into the shared unassigned lane", () => {
    expect(laneKey("project", "PRJ-1")).toBe("project:PRJ-1");
    expect(laneKey("", "")).toBe(UNASSIGNED);
    expect(laneKey("project", "")).toBe(UNASSIGNED);
  });
});

describe("deriveLanes", () => {
  it("collects distinct lanes from objectives and dependency ends, unassigned last", () => {
    const lanes = deriveLanes(
      [obj(1, "project", "PRJ-1", "Alpha"), obj(2, "", "", ""), obj(3, "project", "PRJ-1", "Alpha")],
      [dep(9, "project", "PRJ-1", "program", "PRG-2")],
    );
    expect(lanes.map((l) => l.key)).toEqual(["project:PRJ-1", "program:PRG-2", UNASSIGNED]);
    expect(lanes.find((l) => l.key === "project:PRJ-1")?.name).toBe("Alpha");
    expect(lanes.at(-1)?.name).toBe("Unassigned");
  });
});

describe("columns", () => {
  it("prepends an Unscheduled tray before the iterations", () => {
    expect(columns([iter(1, "It 1"), iter(2, "It 2")])).toEqual([
      { id: null, name: "Unscheduled" }, { id: 1, name: "It 1" }, { id: 2, name: "It 2" },
    ]);
  });
});

describe("placedColumn", () => {
  const iters = new Set([1, 2]);
  it("returns the placed iteration when it still exists", () => {
    expect(placedColumn(5, { "5": 2 }, iters)).toBe(2);
  });
  it("falls back to Unscheduled for missing or stale placements", () => {
    expect(placedColumn(5, {}, iters)).toBeNull();
    expect(placedColumn(5, { "5": 99 }, iters)).toBeNull(); // iteration deleted
  });
});

describe("cardsFor", () => {
  const iters = new Set([1, 2]);
  const objs = [obj(1, "project", "PRJ-1"), obj(2, "project", "PRJ-1"), obj(3, "program", "PRG-2")];
  it("selects objectives by lane and column", () => {
    const placements = { "1": 2 }; // obj1 → iteration 2; obj2 unscheduled
    expect(cardsFor(objs, "project:PRJ-1", 2, placements, iters).map((o) => o.id)).toEqual([1]);
    expect(cardsFor(objs, "project:PRJ-1", null, placements, iters).map((o) => o.id)).toEqual([2]);
    expect(cardsFor(objs, "program:PRG-2", null, placements, iters).map((o) => o.id)).toEqual([3]);
  });
});

describe("dependencyLaneLinks", () => {
  it("maps deps to lane pairs and drops self-links", () => {
    const links = dependencyLaneLinks([
      dep(1, "project", "PRJ-1", "program", "PRG-2", "Blocked"),
      dep(2, "project", "PRJ-1", "project", "PRJ-1"), // self-link → dropped
    ]);
    expect(links).toEqual([{ id: 1, from: "project:PRJ-1", to: "program:PRG-2", status: "Blocked", title: "D1" }]);
  });
});

describe("arrowPath", () => {
  it("produces a cubic bezier bowed by the given amount", () => {
    expect(arrowPath(0, 10, 0, 50, 40)).toBe("M 0 10 C 40 10, 40 50, 0 50");
  });
});
