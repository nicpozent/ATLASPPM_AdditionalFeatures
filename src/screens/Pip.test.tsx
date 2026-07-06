import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Pip from "./Pip";
import { api } from "@/api";

// The screen is pure presentation over the API + permissions; mock both so we
// can assert the empty state and the loaded shell without a live backend.
vi.mock("@/api", () => ({ api: vi.fn() }));
vi.mock("@/components/usePermissions", () => ({ usePermissions: () => ({ can: () => true }) }));

const mockApi = api as unknown as Mock;

function renderPip() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><Pip /></QueryClientProvider>);
}

describe("Pip screen", () => {
  beforeEach(() => mockApi.mockReset());

  it("shows the empty state when there are no increments", async () => {
    mockApi.mockImplementation(async (path: string) =>
      path === "/increments" ? { canEdit: true, increments: [] } : null);

    renderPip();
    expect(await screen.findByText("No program increments yet")).toBeInTheDocument();
    // The create affordance is offered (permissions mocked to allow).
    expect(screen.getAllByText(/New increment/).length).toBeGreaterThan(0);
  });

  it("renders the increment shell and the four view tabs when data loads", async () => {
    const increment = {
      id: 1, key: "2026-Q3", name: "PI 2026.3", startDate: "2026-07-01", endDate: "2026-09-30", state: "Active",
      objectives: 0, iterations: 0, dependencies: 0,
    };
    mockApi.mockImplementation(async (path: string) => {
      if (path === "/increments") return { canEdit: true, increments: [increment] };
      if (path === "/increments/1") return { ...increment, canEdit: true, iterationList: [], objectiveList: [], dependencyList: [], targets: [] };
      return null;
    });

    renderPip();
    expect(await screen.findByText("PI 2026.3")).toBeInTheDocument();
    // Tab bar for the four views.
    expect(screen.getByText(/PI Objectives/)).toBeInTheDocument();
    expect(screen.getByText(/Calendar/)).toBeInTheDocument();
    expect(screen.getByText(/Capacity & Load/)).toBeInTheDocument();
    expect(screen.getByText(/Dependencies/)).toBeInTheDocument();
    // Objectives view is the default and shows its empty state.
    expect(await screen.findByText(/No committed objectives/)).toBeInTheDocument();
  });
});
