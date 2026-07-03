import { describe, it, expect } from "vitest";
import { AUTH_ENABLED, msal, currentUser, getToken } from "./auth";

// With VITE_AUTH_ENABLED unset (the test default), auth must be fully inert so
// the app runs with no backend and no sign-in gate.
describe("auth (disabled by default)", () => {
  it("is disabled and creates no MSAL instance", () => {
    expect(AUTH_ENABLED).toBe(false);
    expect(msal).toBeNull();
  });

  it("reports no signed-in user", () => {
    expect(currentUser()).toBeNull();
  });

  it("returns no token", async () => {
    await expect(getToken()).resolves.toBeUndefined();
  });
});
