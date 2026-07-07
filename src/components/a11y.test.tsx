import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { axe } from "vitest-axe";
import { Button, Input, Select, Textarea, Modal, Card, EmptyBlock } from "./ui";

// Automated WCAG sweep over the shared primitives. These components are the
// building blocks of every screen, so a violation here would propagate app-wide.
// axe runs the same rule engine as the browser extension / CI a11y gates.
describe("axe: shared primitives have no violations", () => {
  it("Button", async () => {
    const { container } = render(<Button>Save changes</Button>);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("labelled form controls", async () => {
    const { container } = render(
      <form>
        <label htmlFor="name">Name</label>
        <Input id="name" value="Ada" onChange={() => {}} />
        <label htmlFor="dept">Department</label>
        <Select id="dept" value="eng" onChange={() => {}}>
          <option value="eng">Engineering</option>
          <option value="pmo">PMO</option>
        </Select>
        <label htmlFor="notes">Notes</label>
        <Textarea id="notes" value="" onChange={() => {}} />
      </form>
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("Card with heading + EmptyBlock", async () => {
    const { container } = render(
      <Card>
        <h2>Active projects</h2>
        <EmptyBlock message="No projects yet — they appear here once created." />
      </Card>
    );
    expect(await axe(container)).toHaveNoViolations();
  });

  it("Modal dialog", async () => {
    const { container } = render(
      <Modal onClose={() => {}} label="Create demand">
        <h2>Create demand</h2>
        <label htmlFor="title">Title</label>
        <Input id="title" value="" onChange={() => {}} />
        <Button>Create</Button>
      </Modal>
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});
