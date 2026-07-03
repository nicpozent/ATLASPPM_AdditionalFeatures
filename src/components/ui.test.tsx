import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Button, Input, Modal } from "./ui";

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
