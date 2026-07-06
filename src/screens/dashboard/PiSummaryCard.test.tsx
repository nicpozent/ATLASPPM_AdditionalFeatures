import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PiSummaryCard } from "./PiSummaryCard";
import { api } from "@/api";

vi.mock("@/api", () => ({ api: vi.fn() }));
const mockApi = api as unknown as Mock;

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><PiSummaryCard /></MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("PiSummaryCard (dashboard cross-link)", () => {
  beforeEach(() => mockApi.mockReset());

  it("prompts when there is no active increment", async () => {
    mockApi.mockImplementation(async (path: string) =>
      path === "/increments" ? { increments: [] } : null);
    renderCard();
    expect(await screen.findByText("No active program increment yet.")).toBeInTheDocument();
  });

  it("summarises the active increment: committed count, over-allocation and blocked deps", async () => {
    const summary = { id: 7, key: "2026-Q3", name: "PI 2026.3", startDate: "", endDate: "", state: "Active", objectives: 2, iterations: 1, dependencies: 1 };
    mockApi.mockImplementation(async (path: string) => {
      if (path === "/increments") return { increments: [summary] };
      if (path === "/increments/7") return {
        ...summary, canEdit: true, targets: [],
        objectiveList: [
          { id: 1, title: "A", description: "", entityType: "", entityId: "", entityName: "", businessValue: 8, actualValue: 0, committed: true, confidence: 4, status: "Done" },
          { id: 2, title: "B", description: "", entityType: "", entityId: "", entityName: "", businessValue: 5, actualValue: 0, committed: false, confidence: 2, status: "Planned" },
        ],
        iterationList: [{ id: 1, name: "I1", startDate: "", endDate: "", capacity: 10, load: 20 }], // over-allocated
        dependencyList: [{ id: 1, title: "D", fromType: "", fromId: "", fromName: "", toType: "", toId: "", toName: "", owner: "", dueDate: "", status: "Blocked" }],
      };
      return null;
    });

    renderCard();
    expect(await screen.findByText("PI 2026.3")).toBeInTheDocument();
    expect(screen.getByText(/Committed objectives/)).toBeInTheDocument();
    expect(screen.getByText(/Over-allocated iterations/)).toBeInTheDocument();
    expect(screen.getByText(/Blocked dependencies/)).toBeInTheDocument();
  });
});
