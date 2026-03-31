import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Toast } from "../../src/components/Toast";

describe("Toast accessibility", () => {
  it("a11y - has role='alert' and aria-live='polite'", () => {
    const toast = { id: "1", message: "Test message", type: "success" as const };
    const onClose = vi.fn();

    render(<Toast toast={toast} onClose={onClose} />);

    const toastElement = screen.getByRole("alert");
    expect(toastElement.getAttribute("role")).toBe("alert");
    expect(toastElement.getAttribute("aria-live")).toBe("polite");
  });

  it("a11y - close button has accessible label", () => {
    const toast = { id: "1", message: "Test message", type: "success" as const };
    const onClose = vi.fn();

    render(<Toast toast={toast} onClose={onClose} />);

    const closeButton = screen.getByRole("button");
    expect(closeButton.getAttribute("aria-label")).toBe("Fermer");
  });

  it("closes on Escape key press", () => {
    const toast = { id: "1", message: "Test message", type: "success" as const };
    const onClose = vi.fn();

    render(<Toast toast={toast} onClose={onClose} />);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onClose).toHaveBeenCalled();
  });
});
