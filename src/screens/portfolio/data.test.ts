import { describe, it, expect } from "vitest";
import { STATUS_FILTERS, type Project } from "./data";

const mk = (status: Project["status"]): Project =>
  ({ status } as Project);

describe("STATUS_FILTERS", () => {
  it("'all' matches every project", () => {
    const all = STATUS_FILTERS.find((f) => f.key === "all")!;
    expect(all.match(mk("green"))).toBe(true);
    expect(all.match(mk("red"))).toBe(true);
  });

  it("status filters match only their own status", () => {
    for (const key of ["green", "amber", "red", "hold"] as const) {
      const f = STATUS_FILTERS.find((x) => x.key === key)!;
      expect(f.match(mk(key))).toBe(true);
      const other = key === "green" ? "red" : "green";
      expect(f.match(mk(other))).toBe(false);
    }
  });
});
