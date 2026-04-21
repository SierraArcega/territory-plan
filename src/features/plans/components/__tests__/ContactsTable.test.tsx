import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ContactsTable from "../ContactsTable";
import type { Contact } from "@/lib/api";

function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: 1,
    leaid: "d1",
    salutation: null,
    name: "Default Contact",
    title: null,
    email: null,
    phone: null,
    isPrimary: false,
    linkedinUrl: null,
    persona: null,
    seniorityLevel: null,
    createdAt: "2026-01-01T00:00:00Z",
    lastEnrichedAt: null,
    schoolContacts: [],
    ...overrides,
  };
}

function renderTable(contacts: Contact[]) {
  return render(
    <ContactsTable
      contacts={contacts}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
    />
  );
}

describe("ContactsTable sorting", () => {
  it("clicking Person header sorts contacts by name ascending", () => {
    const contacts = [
      makeContact({ id: 1, name: "Zara Smith" }),
      makeContact({ id: 2, name: "Aaron Jones" }),
    ];
    renderTable(contacts);
    fireEvent.click(screen.getByRole("columnheader", { name: /person/i }));
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Aaron Jones");
    expect(rows[1]).toHaveTextContent("Zara Smith");
  });

  it("clicking Person again sorts descending", () => {
    const contacts = [
      makeContact({ id: 1, name: "Zara Smith" }),
      makeContact({ id: 2, name: "Aaron Jones" }),
    ];
    renderTable(contacts);
    const th = screen.getByRole("columnheader", { name: /person/i });
    fireEvent.click(th);
    fireEvent.click(th);
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Zara Smith");
    expect(rows[1]).toHaveTextContent("Aaron Jones");
  });

  it("third click restores original order", () => {
    const contacts = [
      makeContact({ id: 1, name: "Charlie Brown" }),
      makeContact({ id: 2, name: "Aaron Jones" }),
      makeContact({ id: 3, name: "Betty White" }),
    ];
    renderTable(contacts);
    const th = screen.getByRole("columnheader", { name: /person/i });
    fireEvent.click(th);  // asc: Aaron, Betty, Charlie
    fireEvent.click(th);  // desc: Charlie, Betty, Aaron
    fireEvent.click(th);  // reset: Charlie, Aaron, Betty (original)
    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("Charlie Brown"); // original first
    expect(rows[1]).toHaveTextContent("Aaron Jones");   // original second
    expect(rows[2]).toHaveTextContent("Betty White");   // original third
  });

  it("Last Activity column header has no sort", () => {
    renderTable([makeContact()]);
    const lastActivityHeader = screen.getByRole("columnheader", { name: /last activity/i });
    expect(lastActivityHeader).not.toHaveAttribute("aria-sort");
  });
});
