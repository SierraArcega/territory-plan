"use client";

import type { Contact } from "@/lib/api";
import ContactsList from "./ContactsList";

interface ContactsTabProps {
  leaid: string;
  contacts: Contact[];
}

export default function ContactsTab({ leaid, contacts }: ContactsTabProps) {
  return (
    <div className="px-3 py-3">
      <ContactsList leaid={leaid} contacts={contacts} />
    </div>
  );
}
