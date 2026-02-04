// src/components/common/__tests__/InlineEditCell.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import InlineEditCell from "../InlineEditCell";

describe("InlineEditCell", () => {
  describe("type='text'", () => {
    it("renders display value", () => {
      render(<InlineEditCell type="text" value="Test Value" onSave={vi.fn()} />);
      expect(screen.getByText("Test Value")).toBeInTheDocument();
    });

    it("shows input on click", async () => {
      render(<InlineEditCell type="text" value="Test Value" onSave={vi.fn()} />);

      fireEvent.click(screen.getByText("Test Value"));

      expect(screen.getByRole("textbox")).toBeInTheDocument();
      expect(screen.getByRole("textbox")).toHaveValue("Test Value");
    });

    it("saves on blur", async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      render(<InlineEditCell type="text" value="Test Value" onSave={onSave} />);

      fireEvent.click(screen.getByText("Test Value"));
      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "New Value" } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith("New Value");
      });
    });

    it("saves on Enter", async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      render(<InlineEditCell type="text" value="Test Value" onSave={onSave} />);

      fireEvent.click(screen.getByText("Test Value"));
      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "New Value" } });
      fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith("New Value");
      });
    });

    it("cancels on Escape without saving", () => {
      const onSave = vi.fn();
      render(<InlineEditCell type="text" value="Test Value" onSave={onSave} />);

      fireEvent.click(screen.getByText("Test Value"));
      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "New Value" } });
      fireEvent.keyDown(input, { key: "Escape" });

      expect(onSave).not.toHaveBeenCalled();
      expect(screen.getByText("Test Value")).toBeInTheDocument();
    });

    it("shows placeholder when empty", () => {
      render(
        <InlineEditCell
          type="text"
          value={null}
          onSave={vi.fn()}
          placeholder="Enter text..."
        />
      );
      expect(screen.getByText("Enter text...")).toBeInTheDocument();
    });

    it("focuses input when entering edit mode", async () => {
      render(<InlineEditCell type="text" value="Test Value" onSave={vi.fn()} />);

      fireEvent.click(screen.getByText("Test Value"));
      const input = screen.getByRole("textbox");

      await waitFor(() => {
        expect(document.activeElement).toBe(input);
      });
    });
  });

  describe("type='select'", () => {
    const options = [
      { value: "option1", label: "Option 1" },
      { value: "option2", label: "Option 2" },
      { value: "option3", label: "Option 3" },
    ];

    it("renders label for selected value", () => {
      render(
        <InlineEditCell
          type="select"
          value="option1"
          onSave={vi.fn()}
          options={options}
        />
      );
      expect(screen.getByText("Option 1")).toBeInTheDocument();
    });

    it("shows dropdown on click", () => {
      render(
        <InlineEditCell
          type="select"
          value="option1"
          onSave={vi.fn()}
          options={options}
        />
      );

      fireEvent.click(screen.getByText("Option 1"));

      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it("saves on change", async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      render(
        <InlineEditCell
          type="select"
          value="option1"
          onSave={onSave}
          options={options}
        />
      );

      fireEvent.click(screen.getByText("Option 1"));
      const select = screen.getByRole("combobox");
      fireEvent.change(select, { target: { value: "option2" } });

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith("option2");
      });
    });
  });

  describe("type='date'", () => {
    it("renders formatted date", () => {
      render(
        <InlineEditCell
          type="date"
          value="2026-02-04"
          onSave={vi.fn()}
        />
      );
      expect(screen.getByText("Feb 4, 2026")).toBeInTheDocument();
    });

    it("shows date picker on click", () => {
      render(
        <InlineEditCell
          type="date"
          value="2026-02-04"
          onSave={vi.fn()}
        />
      );

      fireEvent.click(screen.getByText("Feb 4, 2026"));

      const input = screen.getByDisplayValue("2026-02-04");
      expect(input).toHaveAttribute("type", "date");
    });

    it("saves on change", async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      render(
        <InlineEditCell
          type="date"
          value="2026-02-04"
          onSave={onSave}
        />
      );

      fireEvent.click(screen.getByText("Feb 4, 2026"));
      const input = screen.getByDisplayValue("2026-02-04");
      fireEvent.change(input, { target: { value: "2026-03-15" } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith("2026-03-15");
      });
    });
  });

  describe("type='textarea'", () => {
    it("renders text", () => {
      render(
        <InlineEditCell
          type="textarea"
          value="Multi-line text"
          onSave={vi.fn()}
        />
      );
      expect(screen.getByText("Multi-line text")).toBeInTheDocument();
    });

    it("shows textarea on click", () => {
      render(
        <InlineEditCell
          type="textarea"
          value="Multi-line text"
          onSave={vi.fn()}
        />
      );

      fireEvent.click(screen.getByText("Multi-line text"));

      expect(screen.getByRole("textbox")).toBeInTheDocument();
      expect(screen.getByRole("textbox").tagName).toBe("TEXTAREA");
    });

    it("saves on Ctrl+Enter", async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      render(
        <InlineEditCell
          type="textarea"
          value="Original text"
          onSave={onSave}
        />
      );

      fireEvent.click(screen.getByText("Original text"));
      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, { target: { value: "Updated text" } });
      fireEvent.keyDown(textarea, { key: "Enter", ctrlKey: true });

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith("Updated text");
      });
    });

    it("does not save on plain Enter (allows newlines)", async () => {
      const onSave = vi.fn();
      render(
        <InlineEditCell
          type="textarea"
          value="Original text"
          onSave={onSave}
        />
      );

      fireEvent.click(screen.getByText("Original text"));
      const textarea = screen.getByRole("textbox");
      fireEvent.change(textarea, { target: { value: "Updated text" } });
      fireEvent.keyDown(textarea, { key: "Enter" });

      expect(onSave).not.toHaveBeenCalled();
    });
  });

  describe("general behavior", () => {
    it("shows loading state while saving", async () => {
      let resolvePromise: () => void;
      const savePromise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      const onSave = vi.fn().mockReturnValue(savePromise);

      render(<InlineEditCell type="text" value="Test Value" onSave={onSave} />);

      fireEvent.click(screen.getByText("Test Value"));
      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "New Value" } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(screen.getByRole("textbox")).toBeDisabled();
      });

      resolvePromise!();

      await waitFor(() => {
        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      });
    });

    it("does not call onSave if value unchanged", async () => {
      const onSave = vi.fn();
      render(<InlineEditCell type="text" value="Test Value" onSave={onSave} />);

      fireEvent.click(screen.getByText("Test Value"));
      const input = screen.getByRole("textbox");
      // Don't change value, just blur
      fireEvent.blur(input);

      expect(onSave).not.toHaveBeenCalled();
    });

    it("shows success flash on save", async () => {
      const onSave = vi.fn().mockResolvedValue(undefined);
      const { container } = render(
        <InlineEditCell type="text" value="Test Value" onSave={onSave} />
      );

      fireEvent.click(screen.getByText("Test Value"));
      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "New Value" } });
      fireEvent.blur(input);

      await waitFor(() => {
        // Check for success styling (green flash)
        const cell = container.firstChild;
        expect(cell).toHaveClass("bg-green-100");
      });
    });

    it("shows hover hint with robin's egg tint", () => {
      const { container } = render(
        <InlineEditCell type="text" value="Test Value" onSave={vi.fn()} />
      );

      const cell = container.firstChild;
      expect(cell).toHaveClass("hover:bg-[#C4E7E6]/30");
    });

    it("shows focus ring in edit mode", async () => {
      render(<InlineEditCell type="text" value="Test Value" onSave={vi.fn()} />);

      fireEvent.click(screen.getByText("Test Value"));
      const input = screen.getByRole("textbox");

      expect(input).toHaveClass("ring-2");
      expect(input).toHaveClass("ring-[#403770]");
    });
  });
});
