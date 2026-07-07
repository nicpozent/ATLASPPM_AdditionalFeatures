import { describe, it, expect } from "vitest";
import { resolveIdleMs, isIdle, DEFAULT_IDLE_MINUTES } from "./idle";

describe("resolveIdleMs", () => {
  it("defaults to 15 minutes when unset / empty / non-numeric", () => {
    const def = DEFAULT_IDLE_MINUTES * 60_000;
    expect(resolveIdleMs(undefined)).toBe(def);
    expect(resolveIdleMs(null)).toBe(def);
    expect(resolveIdleMs("")).toBe(def);
    expect(resolveIdleMs("  ")).toBe(def);
    expect(resolveIdleMs("abc")).toBe(def);
    expect(resolveIdleMs("0")).toBe(def);
    expect(resolveIdleMs("-5")).toBe(def);
  });

  it("honours a valid configured value", () => {
    expect(resolveIdleMs("30")).toBe(30 * 60_000);
    expect(resolveIdleMs(" 10 ")).toBe(10 * 60_000);
    expect(resolveIdleMs("2.5")).toBe(2.5 * 60_000);
  });

  it("clamps to [1, 480] minutes so a typo can't disable or over-extend the policy", () => {
    expect(resolveIdleMs("0.1")).toBe(1 * 60_000);
    expect(resolveIdleMs("100000")).toBe(480 * 60_000);
  });
});

describe("isIdle", () => {
  const idleMs = 15 * 60_000;
  it("is false before the window elapses", () => {
    expect(isIdle(1_000_000, 1_000_000 + 14 * 60_000, idleMs)).toBe(false);
  });
  it("is true at or after the window", () => {
    expect(isIdle(1_000_000, 1_000_000 + idleMs, idleMs)).toBe(true);
    expect(isIdle(1_000_000, 1_000_000 + 20 * 60_000, idleMs)).toBe(true);
  });
});
