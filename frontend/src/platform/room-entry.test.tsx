import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/toast";
import { RoomEntry } from "./room-entry";

function Entry({ busy = false, onEnter = vi.fn() }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("ABCDEF");
  return (
    <ToastProvider>
      <RoomEntry
        name={name}
        code={code}
        busy={busy}
        onNameChange={setName}
        onCodeChange={setCode}
        onEnter={onEnter}
      />
    </ToastProvider>
  );
}

describe("room entry", () => {
  it("validates before flipping, moves focus and preserves inputs when editing the name", async () => {
    const onEnter = vi.fn();
    render(<Entry onEnter={onEnter} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a name");
    expect(
      screen.queryByRole("button", { name: "Connect" }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Player Name"), {
      target: { value: "Alex" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Continue" }).closest("form")!,
    );
    expect(
      screen.queryByRole("textbox", { name: "Player Name" }),
    ).not.toBeInTheDocument();
    const back = screen.getByRole("button", { name: "Back" });
    expect(
      back.compareDocumentPosition(screen.getByLabelText("Room Code")) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const code = screen.getByRole("textbox", { name: "Room Code" });
    expect(code).toHaveValue("ABCDEF");
    await waitFor(() => expect(code).toHaveFocus());
    fireEvent.change(code, { target: { value: "bcdefg" } });
    fireEvent.submit(
      screen.getByRole("button", { name: "Connect" }).closest("form")!,
    );
    expect(onEnter).toHaveBeenCalledWith("join");
    fireEvent.click(screen.getByRole("button", { name: "Create Room" }));
    expect(onEnter).toHaveBeenCalledWith("create");
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("textbox", { name: "Player Name" })).toHaveValue(
      "Alex",
    );
    await waitFor(() =>
      expect(screen.getByLabelText("Player Name")).toHaveFocus(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("textbox", { name: "Room Code" })).toHaveValue(
      "BCDEFG",
    );
  });

  it("sizes the card to the active face in both directions", () => {
    const height = vi
      .spyOn(HTMLElement.prototype, "offsetHeight", "get")
      .mockImplementation(function (this: HTMLElement) {
        return this.classList.contains("room-entry-back") ? 500 : 300;
      });
    try {
      const { container } = render(<Entry />);
      const flipper = container.querySelector(".room-entry-flipper");
      expect(flipper).toHaveStyle({ height: "300px" });
      fireEvent.change(screen.getByLabelText("Player Name"), {
        target: { value: "Alex" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));
      expect(flipper).toHaveStyle({ height: "500px" });
      fireEvent.click(screen.getByRole("button", { name: "Back" }));
      expect(flipper).toHaveStyle({ height: "300px" });
    } finally {
      height.mockRestore();
    }
  });

  it("disables admission while restoring a session", () => {
    render(<Entry busy />);
    expect(screen.getByRole("textbox", { name: "Player Name" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });
});
