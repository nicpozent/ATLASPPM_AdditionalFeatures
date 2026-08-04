import { describe, it, expect, vi, afterEach } from "vitest";
import { api, ApiError } from "./api";

// A network-level failure (API down, offline, DNS, CORS) makes fetch reject with
// a TypeError. api() must translate that to an ApiError with status 0 so the app
// can tell it apart from a legitimate empty result — otherwise it renders as a
// healthy, empty portfolio.
afterEach(() => vi.unstubAllGlobals());

describe("api() error translation", () => {
  it("rethrows a fetch rejection as ApiError with status 0", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(api("/projects")).rejects.toMatchObject({ name: "ApiError", status: 0 });
  });

  it("still surfaces a non-ok response as an ApiError carrying the server message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Your role doesn’t have access." }), { status: 403 }),
    ));
    const err = await api("/projects").catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(403);
    expect(err.message).toContain("access");
  });

  it("returns parsed JSON on a successful response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify([{ id: "PRJ-1" }]), { status: 200 }),
    ));
    await expect(api<{ id: string }[]>("/projects")).resolves.toEqual([{ id: "PRJ-1" }]);
  });
});
