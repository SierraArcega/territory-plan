import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ContactRolePicker from "../ContactRolePicker";

const { mockMutateAsync } = vi.hoisted(() => ({ mockMutateAsync: vi.fn() }));

vi.mock("@/features/document-generation/lib/queries", () => ({
  useDistrictContacts: () => ({
    data: { contacts: [{ id: 1, name: "Jane Smith", title: "Superintendent", email: "j@d.org", phone: "5" }] },
    isLoading: false,
  }),
}));
vi.mock("@/features/shared/lib/queries", () => ({
  useCreateContact: () => ({ mutateAsync: mockMutateAsync, isPending: false }),
}));

beforeEach(() => {
  mockMutateAsync.mockReset();
});

function setup(onChange = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <ContactRolePicker label="Client contact" leaid="0612345" value={null} onChange={onChange} />
    </QueryClientProvider>,
  );
  return { onChange };
}

describe("ContactRolePicker", () => {
  it("renders the role label and existing contacts", () => {
    setup();
    expect(screen.getByText("Client contact")).toBeInTheDocument();
    expect(screen.getByText(/Jane Smith/)).toBeInTheDocument();
  });

  it("selecting a contact emits a ContactRef via onChange", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByText(/Jane Smith/));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ contactId: 1, firstName: "Jane", lastName: "Smith", title: "Superintendent" }),
    );
  });

  it("creating a new contact auto-selects it and closes the form", async () => {
    mockMutateAsync.mockResolvedValue({ id: 9, name: "Mark Lee", salutation: "Mr.", title: "AP", email: "m@d.org", phone: "7" });
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: /Add new/i }));
    fireEvent.change(screen.getByLabelText("name"), { target: { value: "Mark Lee" } });
    fireEvent.click(screen.getByRole("button", { name: /Save contact/i }));
    await waitFor(() =>
      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ contactId: 9, firstName: "Mark", lastName: "Lee", salutation: "Mr.", title: "AP" }),
      ),
    );
    expect(screen.queryByLabelText("name")).not.toBeInTheDocument(); // form closed
  });

  it("shows an error and keeps the form open when create fails", async () => {
    mockMutateAsync.mockRejectedValue(new Error("Email already exists"));
    const { onChange } = setup();
    fireEvent.click(screen.getByRole("button", { name: /Add new/i }));
    fireEvent.change(screen.getByLabelText("name"), { target: { value: "Dup Person" } });
    fireEvent.click(screen.getByRole("button", { name: /Save contact/i }));
    await waitFor(() => expect(screen.getByText("Email already exists")).toBeInTheDocument());
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText("name")).toBeInTheDocument(); // still open
  });
});
