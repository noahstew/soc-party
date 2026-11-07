import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("calls the supplied action when activated", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Refresh status</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Refresh status" }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("prevents activation when disabled", () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Refresh status
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Refresh status" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
