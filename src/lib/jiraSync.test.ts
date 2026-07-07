import { describe, it, expect } from "vitest";
import { syncToast, type JiraSyncOutcome } from "./jiraSync";

describe("syncToast", () => {
  it("summarises a completed sync with counts", () => {
    const o: JiraSyncOutcome = { ok: true, state: "done", tasks: 12, sprints: 3, epics: 1 };
    expect(syncToast(o)).toBe("Synced from Jira — 12 tasks · 3 sprints · 1 epics");
  });
  it("handles a completed sync with no counts", () => {
    expect(syncToast({ ok: true, state: "done" })).toBe("Synced from Jira");
  });
  it("reports a still-running background job", () => {
    expect(syncToast({ ok: true, state: "running" })).toMatch(/still running/i);
  });
  it("reports a failure with its error", () => {
    expect(syncToast({ ok: false, state: "failed", error: "boom" })).toBe("Jira sync failed: boom");
  });
  it("surfaces a config error / nothing-to-sync message", () => {
    expect(syncToast({ ok: false, error: "Jira isn't configured" })).toBe("Jira isn't configured");
    expect(syncToast({ ok: false })).toBe("Nothing to sync.");
  });
});
