import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import GridPager from "../GridPager";

describe("GridPager", () => {
  it("shows the 1-based row range and total on the first page", () => {
    render(<GridPager total={738} page={1} pageSize={50} onPageChange={vi.fn()} />);
    expect(screen.getByText("Showing 1–50 of 738")).toBeInTheDocument();
  });

  it("shows the correct range on an interior page", () => {
    render(<GridPager total={738} page={3} pageSize={50} onPageChange={vi.fn()} />);
    expect(screen.getByText("Showing 101–150 of 738")).toBeInTheDocument();
  });

  it("disables Previous on the first page and enables Next", () => {
    render(<GridPager total={738} page={1} pageSize={50} onPageChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /previous page/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /next page/i })).toBeEnabled();
  });

  it("disables Next on the last page and enables Previous", () => {
    render(<GridPager total={738} page={15} pageSize={50} onPageChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /next page/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /previous page/i })).toBeEnabled();
  });

  it("advances to the next page when Next is clicked", () => {
    const onPageChange = vi.fn();
    render(<GridPager total={738} page={1} pageSize={50} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByRole("button", { name: /next page/i }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("goes back a page when Previous is clicked", () => {
    const onPageChange = vi.fn();
    render(<GridPager total={738} page={3} pageSize={50} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByRole("button", { name: /previous page/i }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("renders one dropdown option per page", () => {
    render(<GridPager total={738} page={1} pageSize={50} onPageChange={vi.fn()} />);
    const select = screen.getByRole("combobox", { name: /go to page/i });
    expect(within(select).getAllByRole("option")).toHaveLength(15);
  });

  it("reflects the current page as the dropdown's selected value", () => {
    render(<GridPager total={738} page={7} pageSize={50} onPageChange={vi.fn()} />);
    const select = screen.getByRole("combobox", { name: /go to page/i }) as HTMLSelectElement;
    expect(select.value).toBe("7");
  });

  it("jumps to the page chosen in the dropdown", () => {
    const onPageChange = vi.fn();
    render(<GridPager total={738} page={1} pageSize={50} onPageChange={onPageChange} />);
    const select = screen.getByRole("combobox", { name: /go to page/i });
    fireEvent.change(select, { target: { value: "7" } });
    expect(onPageChange).toHaveBeenCalledWith(7);
  });

  it("shows the page count in 'of N' form", () => {
    render(<GridPager total={738} page={1} pageSize={50} onPageChange={vi.fn()} />);
    expect(screen.getByText(/of 15/)).toBeInTheDocument();
  });
});
