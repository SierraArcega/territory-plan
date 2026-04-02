"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useSearchContacts } from "@/features/activities/lib/queries";
import { useCreateContact } from "@/features/shared/lib/queries";
import { useDistrictNameSearch } from "@/features/plans/lib/queries";

export interface SelectedContact {
  id: number;
  leaid: string;
  name: string;
  title: string | null;
  districtName: string | null;
}

interface ContactSelectProps {
  selectedContacts: SelectedContact[];
  onChange: (contacts: SelectedContact[]) => void;
}

export default function ContactSelect({ selectedContacts, onChange }: ContactSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [districtFilter, setDistrictFilter] = useState<{ leaid: string; name: string } | null>(null);
  const [districtSearch, setDistrictSearch] = useState("");
  const [showDistrictPicker, setShowDistrictPicker] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Inline create state
  const [newName, setNewName] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newDistrictSearch, setNewDistrictSearch] = useState("");
  const [newDistrict, setNewDistrict] = useState<{ leaid: string; name: string } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { data: contactsData } = useSearchContacts(search, districtFilter?.leaid);
  const createContact = useCreateContact();

  // District search for filter
  const { data: filterDistricts } = useDistrictNameSearch(districtSearch);
  // District search for inline create
  const { data: createDistricts } = useDistrictNameSearch(newDistrictSearch);

  const contacts = contactsData?.contacts ?? [];
  const selectedIds = useMemo(() => new Set(selectedContacts.map((c) => c.id)), [selectedContacts]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowDistrictPicker(false);
        setShowCreateForm(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleToggleContact = (contact: {
    id: number;
    leaid: string;
    name: string;
    title: string | null;
    districtName: string | null;
  }) => {
    if (selectedIds.has(contact.id)) {
      onChange(selectedContacts.filter((c) => c.id !== contact.id));
    } else {
      onChange([...selectedContacts, { id: contact.id, leaid: contact.leaid, name: contact.name, title: contact.title, districtName: contact.districtName }]);
    }
  };

  const handleRemove = (id: number) => {
    onChange(selectedContacts.filter((c) => c.id !== id));
  };

  const handleCreateContact = async () => {
    if (!newName.trim() || !newDistrict) return;

    try {
      const created = await createContact.mutateAsync({
        leaid: newDistrict.leaid,
        name: newName.trim(),
        title: newTitle.trim() || undefined,
        email: newEmail.trim() || undefined,
      });

      onChange([...selectedContacts, {
        id: created.id,
        leaid: newDistrict.leaid,
        name: created.name,
        title: created.title,
        districtName: newDistrict.name,
      }]);

      // Reset create form
      setNewName("");
      setNewTitle("");
      setNewEmail("");
      setNewDistrictSearch("");
      setNewDistrict(null);
      setShowCreateForm(false);
    } catch {
      // Error handled by mutation state
    }
  };

  const handleSelectFilterDistrict = (d: { leaid: string; name: string }) => {
    setDistrictFilter(d);
    setDistrictSearch("");
    setShowDistrictPicker(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-medium text-[#8A80A8] mb-1">Contacts</label>

      {/* Selected chips */}
      {selectedContacts.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {selectedContacts.map((c) => (
            <span
              key={c.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#EFEDF5] text-[#403770] rounded-md text-xs"
            >
              <span className="truncate max-w-[140px]">{c.name}</span>
              <button
                type="button"
                onClick={() => handleRemove(c.id)}
                className="text-[#A69DC0] hover:text-[#403770] transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div
        className="flex items-center border border-[#C2BBD4] rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#F37167] focus-within:border-transparent cursor-text"
        onClick={() => {
          setIsOpen(true);
          searchInputRef.current?.focus();
        }}
      >
        <svg className="w-4 h-4 text-[#A69DC0] ml-2.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={searchInputRef}
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search contacts..."
          className="w-full px-2 py-2 text-sm text-[#403770] placeholder:text-[#A69DC0] focus:outline-none"
        />
        {districtFilter && (
          <span className="flex items-center gap-1 px-2 py-1 mr-1 bg-[#F7F5FA] border border-[#D4CFE2] rounded text-xs text-[#403770] whitespace-nowrap">
            {districtFilter.name.length > 20 ? districtFilter.name.slice(0, 20) + "..." : districtFilter.name}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDistrictFilter(null);
              }}
              className="text-[#A69DC0] hover:text-[#403770]"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-[#D4CFE2] rounded-lg shadow-lg max-h-64 overflow-hidden flex flex-col">
          {/* District filter bar */}
          <div className="px-3 py-2 border-b border-[#EFEDF5] flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowDistrictPicker(!showDistrictPicker)}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-[#403770] bg-[#F7F5FA] border border-[#D4CFE2] rounded-md hover:bg-[#EFEDF5] transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              {districtFilter ? "Change District" : "Filter by District"}
            </button>
          </div>

          {/* District picker (shown when toggled) */}
          {showDistrictPicker && (
            <div className="px-3 py-2 border-b border-[#EFEDF5] bg-[#F7F5FA]">
              <input
                type="text"
                value={districtSearch}
                onChange={(e) => setDistrictSearch(e.target.value)}
                placeholder="Search districts..."
                className="w-full px-2 py-1.5 text-xs border border-[#C2BBD4] rounded-md focus:outline-none focus:ring-1 focus:ring-[#403770] text-[#403770] placeholder:text-[#A69DC0]"
                autoFocus
              />
              {filterDistricts && filterDistricts.length > 0 && (
                <div className="mt-1.5 max-h-32 overflow-y-auto space-y-0.5">
                  {filterDistricts.map((d) => (
                    <button
                      key={d.leaid}
                      type="button"
                      onClick={() => handleSelectFilterDistrict({ leaid: d.leaid, name: d.name })}
                      className="w-full text-left px-2 py-1.5 text-xs text-[#403770] hover:bg-[#EFEDF5] rounded transition-colors"
                    >
                      {d.name} <span className="text-[#A69DC0]">({d.stateAbbrev})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Contact results */}
          <div className="flex-1 overflow-y-auto">
            {contacts.length === 0 && search.length > 0 && (
              <p className="px-3 py-3 text-xs text-[#A69DC0] text-center">No contacts found</p>
            )}
            {contacts.length === 0 && search.length === 0 && !districtFilter && (
              <p className="px-3 py-3 text-xs text-[#A69DC0] text-center">Type to search contacts</p>
            )}
            {contacts.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleToggleContact(c)}
                className={`w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[#F7F5FA] transition-colors ${
                  selectedIds.has(c.id) ? "bg-[#EFEDF5]" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#403770] truncate">{c.name}</p>
                  <p className="text-xs text-[#A69DC0] truncate">
                    {[c.title, c.districtName].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {selectedIds.has(c.id) && (
                  <svg className="w-4 h-4 text-[#6ec992] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>

          {/* Create new */}
          {!showCreateForm ? (
            <button
              type="button"
              onClick={() => setShowCreateForm(true)}
              className="w-full px-3 py-2.5 text-xs font-medium text-[#403770] border-t border-[#EFEDF5] hover:bg-[#F7F5FA] transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create New Contact
            </button>
          ) : (
            <div className="border-t border-[#EFEDF5] px-3 py-3 bg-[#F7F5FA] space-y-2">
              <p className="text-xs font-semibold text-[#403770]">New Contact</p>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Name *"
                className="w-full px-2 py-1.5 text-xs border border-[#C2BBD4] rounded-md focus:outline-none focus:ring-1 focus:ring-[#403770] text-[#403770] placeholder:text-[#A69DC0]"
                autoFocus
              />
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Title / Role"
                className="w-full px-2 py-1.5 text-xs border border-[#C2BBD4] rounded-md focus:outline-none focus:ring-1 focus:ring-[#403770] text-[#403770] placeholder:text-[#A69DC0]"
              />
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="Email"
                className="w-full px-2 py-1.5 text-xs border border-[#C2BBD4] rounded-md focus:outline-none focus:ring-1 focus:ring-[#403770] text-[#403770] placeholder:text-[#A69DC0]"
              />
              {/* District search for new contact */}
              <div className="relative">
                {newDistrict ? (
                  <div className="flex items-center gap-1 px-2 py-1.5 text-xs border border-[#C2BBD4] rounded-md bg-white text-[#403770]">
                    <span className="flex-1 truncate">{newDistrict.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setNewDistrict(null);
                        setNewDistrictSearch("");
                      }}
                      className="text-[#A69DC0] hover:text-[#403770]"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <>
                    <input
                      type="text"
                      value={newDistrictSearch}
                      onChange={(e) => setNewDistrictSearch(e.target.value)}
                      placeholder="District * (search...)"
                      className="w-full px-2 py-1.5 text-xs border border-[#C2BBD4] rounded-md focus:outline-none focus:ring-1 focus:ring-[#403770] text-[#403770] placeholder:text-[#A69DC0]"
                    />
                    {createDistricts && createDistricts.length > 0 && newDistrictSearch.length >= 2 && (
                      <div className="absolute z-30 mt-1 w-full bg-white border border-[#D4CFE2] rounded-md shadow-md max-h-28 overflow-y-auto">
                        {createDistricts.map((d) => (
                          <button
                            key={d.leaid}
                            type="button"
                            onClick={() => {
                              setNewDistrict({ leaid: d.leaid, name: d.name });
                              setNewDistrictSearch("");
                            }}
                            className="w-full text-left px-2 py-1.5 text-xs text-[#403770] hover:bg-[#EFEDF5] transition-colors"
                          >
                            {d.name} <span className="text-[#A69DC0]">({d.stateAbbrev})</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
              {createContact.error && (
                <p className="text-xs text-[#F37167]">Failed to create contact</p>
              )}
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewName("");
                    setNewTitle("");
                    setNewEmail("");
                    setNewDistrictSearch("");
                    setNewDistrict(null);
                  }}
                  className="px-2.5 py-1.5 text-xs font-medium text-[#403770] hover:bg-[#EFEDF5] rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateContact}
                  disabled={!newName.trim() || !newDistrict || createContact.isPending}
                  className="px-2.5 py-1.5 text-xs font-medium text-white bg-[#403770] rounded-md hover:bg-[#322a5a] disabled:opacity-50 transition-colors"
                >
                  {createContact.isPending ? "Creating..." : "Add Contact"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
