import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button, Input, Modal, RowMenu, MenuItem } from "./ui";

describe("Button", () => {
  it("renders its children and fires onClick", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Save</Button>);
    const btn = screen.getByRole("button", { name: "Save" });
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("does not fire onClick when disabled", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick} disabled>Save</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("Input", () => {
  it("forwards value/onChange", () => {
    const onChange = vi.fn();
    render(<Input value="hi" onChange={onChange} aria-label="field" />);
    fireEvent.change(screen.getByLabelText("field"), { target: { value: "bye" } });
    expect(onChange).toHaveBeenCalled();
  });
});

describe("Modal (accessibility)", () => {
  it("exposes a labelled dialog and closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <Modal onClose={onClose} label="Test dialog">
        <button>Inside</button>
      </Modal>
    );
    const dialog = screen.getByRole("dialog", { name: "Test dialog" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("locks body scroll while open and restores it on unmount", () => {
    const onClose = vi.fn();
    const { unmount } = render(
      <Modal onClose={onClose}><span>content</span></Modal>
    );
    expect(document.body.style.overflow).toBe("hidden");
    unmount();
    expect(document.body.style.overflow).not.toBe("hidden");
  });
});

describe("RowMenu (accessibility & interaction)", () => {
  it("is a labelled menu trigger, opens/reveals items, runs an action and closes", () => {
    const onEdit = vi.fn();
    render(
      <RowMenu ariaLabel="Row actions">
        {(close) => <MenuItem label="Edit" onClick={() => { onEdit(); close(); }} />}
      </RowMenu>
    );
    const trigger = screen.getByRole("button", { name: "Row actions" });
    expect(trigger).toHaveAttribute("aria-haspopup", "menu");
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const item = screen.getByRole("menuitem", { name: "Edit" });
    fireEvent.click(item);
    expect(onEdit).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menuitem", { name: "Edit" })).toBeNull(); // closed after action
  });

  it("closes on Escape", () => {
    render(
      <RowMenu ariaLabel="Row actions">
        {() => <MenuItem label="Delete" onClick={() => {}} />}
      </RowMenu>
    );
    fireEvent.click(screen.getByRole("button", { name: "Row actions" }));
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menuitem", { name: "Delete" })).toBeNull();
  });
});

describe("Button (keyboard focus)", () => {
  it("shows a focus ring on focus and clears it on blur", () => {
    render(<Button>Focusable</Button>);
    const btn = screen.getByRole("button", { name: "Focusable" });
    fireEvent.focus(btn);
    expect(btn.style.boxShadow).not.toBe("");
    fireEvent.blur(btn);
    expect(btn.style.boxShadow).toBe("");
  });
});
