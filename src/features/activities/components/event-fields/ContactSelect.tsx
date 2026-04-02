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

type DropdownMode = "search" | "create";

export default function ContactSelect({ selectedContacts, onChange }: ContactSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<DropdownMode>("search");
  const [search, setSearch] = useState("");
  const [districtFilter, setDistrictFilter] = useState<{ leaid: string; name: string } | null>(null);
  const [districtSearch, setDistrictSearch] = useState("");
  const [showDistrictPicker, setShowDistrictPicker] = useState(false);

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

  const { data: filterDistricts } = useDistrictNameSearch(districtSearch);
  const { data: createDistricts } = useDistrictNameSearch(newDistrictSearch);

  const contacts = contactsData?.contacts ?? [];
  const selectedIds = useMemo(() => new Set(selectedContacts.map((c) => c.id)), [selectedContacts]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowDistrictPicker(false);
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

  const resetCreateForm = () => {
    setNewName("");
    setNewTitle("");
    setNewEmail("");
    setNewDistrictSearch("");
    setNewDistrict(null);
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

      resetCreateForm();
      setMode("search");
    } catch {
      // Error handled by mutation state
    }
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
                className="text-[#A69DC0] hover:text-[#403770] transition-colors duration-100"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input with inline filter */}
      <div
        className="flex items-center border border-[#C2BBD4] rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#F37167] focus-within:border-transparent cursor-text"
        onClick={() => {
          setIsOpen(true);
          if (mode === "search") searchInputRef.current?.focus();
        }}
      >
        <svg className="w-4 h-4 text-[#A69DC0] ml-2.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        {districtFilter && (
          <span className="flex items-center gap-1 pl-2 pr-1 py-1 ml-1 bg-[#EFEDF5] rounded text-xs text-[#403770] whitespace-nowrap">
            {districtFilter.name.length > 15 ? districtFilter.name.slice(0, 15) + "..." : districtFilter.name}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setDistrictFilter(null);
              }}
              className="text-[#A69DC0] hover:text-[#403770] p-0.5"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        )}
        <input
          ref={searchInputRef}
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setIsOpen(true);
            setMode("search");
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={districtFilter ? "Search in district..." : "Search contacts..."}
          className="flex-1 min-w-0 px-2 py-2 text-sm text-[#403770] placeholder:text-[#A69DC0] focus:outline-none"
        />
        {/* Filter icon button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(true);
            setShowDistrictPicker(!showDistrictPicker);
            setMode("search");
          }}
          className={`p-2 transition-colors duration-100 ${
            districtFilter || showDistrictPicker
              ? "text-[#403770] bg-[#EFEDF5]"
              : "text-[#A69DC0] hover:text-[#403770] hover:bg-[#F7F5FA]"
          }`}
          title="Filter by district"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
        </button>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-[#D4CFE2] rounded-xl shadow-lg overflow-hidden flex flex-col">

          {/* District picker — slides in below search when toggled */}
          {showDistrictPicker && mode === "search" && (
            <div className="px-3 py-2.5 border-b border-[#E2DEEC] bg-[#F7F5FA]">
              <input
                type="text"
                value={districtSearch}
                onChange={(e) => setDistrictSearch(e.target.value)}
                placeholder="Type a district name..."
                className="w-full px-2.5 py-1.5 text-xs border border-[#C2BBD4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent text-[#403770] placeholder:text-[#A69DC0] bg-white"
                autoFocus
              />
              {filterDistricts && filterDistricts.length > 0 && (
                <div className="mt-2 max-h-28 overflow-y-auto -mx-1">
                  {filterDistricts.map((d) => (
                    <button
                      key={d.leaid}
                      type="button"
                      onClick={() => {
                        setDistrictFilter({ leaid: d.leaid, name: d.name });
                        setDistrictSearch("");
                        setShowDistrictPicker(false);
                      }}
                      className="w-full text-left px-3 py-1.5 text-xs text-[#403770] hover:bg-[#EFEDF5] rounded-lg transition-colors duration-100"
                    >
                      {d.name} <span className="text-[#A69DC0]">({d.stateAbbrev})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Search results mode */}
          {mode === "search" && (
            <>
              <div className="flex-1 overflow-y-auto max-h-48">
                {contacts.length === 0 && search.length > 0 && (
                  <div className="px-4 py-6 text-center">
                    <p className="text-xs text-[#A69DC0]">No contacts found</p>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("create");
                        setNewName(search);
                      }}
                      className="mt-2 text-xs font-medium text-[#403770] hover:text-[#322a5a] transition-colors duration-100"
                    >
                      + Create &ldquo;{search}&rdquo; as new contact
                    </button>
                  </div>
                )}
                {contacts.length === 0 && search.length === 0 && !districtFilter && (
                  <p className="px-4 py-6 text-xs text-[#A69DC0] text-center">Type to search contacts</p>
                )}
                {contacts.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleToggleContact(c)}
                    className={`w-full text-left px-3 py-2 flex items-center gap-2.5 transition-colors duration-100 ${
                      selectedIds.has(c.id)
                        ? "bg-[#EFEDF5]"
                        : "hover:bg-[#F7F5FA]"
                    }`}
                  >
                    {/* Avatar circle */}
                    <span className="w-7 h-7 rounded-full bg-[#EFEDF5] text-[#403770] flex items-center justify-center text-xs font-semibold flex-shrink-0">
                      {c.name.charAt(0).toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[#403770] truncate leading-tight">{c.name}</p>
                      <p className="text-[11px] text-[#A69DC0] truncate leading-tight">
                        {[c.title, c.districtName].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {selectedIds.has(c.id) && (
                      <svg className="w-4 h-4 text-[#69B34A] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>

              {/* Create new — footer action */}
              <button
                type="button"
                onClick={() => setMode("create")}
                className="flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium text-[#403770] border-t border-[#E2DEEC] hover:bg-[#F7F5FA] transition-colors duration-100"
              >
                <svg className="w-3.5 h-3.5 text-[#F37167]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create New Contact
              </button>
            </>
          )}

          {/* Create mode — replaces results */}
          {mode === "create" && (
            <div className="p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-[#403770]">New Contact</p>
                <button
                  type="button"
                  onClick={() => {
                    setMode("search");
                    resetCreateForm();
                  }}
                  className="text-[#A69DC0] hover:text-[#403770] transition-colors duration-100"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Row 1: Name + District */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-[#8A80A8] mb-0.5">Name <span className="text-[#F37167]">*</span></label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Jane Smith"
                    className="w-full px-2.5 py-1.5 text-xs border border-[#C2BBD4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent text-[#403770] placeholder:text-[#A69DC0]"
                    autoFocus
                  />
                </div>
                <div className="relative">
                  <label className="block text-[11px] font-medium text-[#8A80A8] mb-0.5">District <span className="text-[#F37167]">*</span></label>
                  {newDistrict ? (
                    <div className="flex items-center gap-1 px-2.5 py-1.5 text-xs border border-[#C2BBD4] rounded-lg bg-white text-[#403770]">
                      <span className="flex-1 truncate">{newDistrict.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setNewDistrict(null);
                          setNewDistrictSearch("");
                        }}
                        className="text-[#A69DC0] hover:text-[#403770] flex-shrink-0"
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
                        placeholder="Search..."
                        className="w-full px-2.5 py-1.5 text-xs border border-[#C2BBD4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent text-[#403770] placeholder:text-[#A69DC0]"
                      />
                      {createDistricts && createDistricts.length > 0 && newDistrictSearch.length >= 2 && (
                        <div className="absolute z-30 mt-1 w-full bg-white border border-[#D4CFE2] rounded-lg shadow-lg max-h-28 overflow-y-auto">
                          {createDistricts.map((d) => (
                            <button
                              key={d.leaid}
                              type="button"
                              onClick={() => {
                                setNewDistrict({ leaid: d.leaid, name: d.name });
                                setNewDistrictSearch("");
                              }}
                              className="w-full text-left px-2.5 py-1.5 text-xs text-[#403770] hover:bg-[#F7F5FA] transition-colors duration-100"
                            >
                              {d.name} <span className="text-[#A69DC0]">({d.stateAbbrev})</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Row 2: Title + Email */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-[#8A80A8] mb-0.5">Title</label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Superintendent"
                    className="w-full px-2.5 py-1.5 text-xs border border-[#C2BBD4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent text-[#403770] placeholder:text-[#A69DC0]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[#8A80A8] mb-0.5">Email</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="jane@district.edu"
                    className="w-full px-2.5 py-1.5 text-xs border border-[#C2BBD4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent text-[#403770] placeholder:text-[#A69DC0]"
                  />
                </div>
              </div>

              {createContact.error && (
                <p className="text-xs text-[#F37167]">Failed to create contact</p>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setMode("search");
                    resetCreateForm();
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-[#403770] hover:bg-[#EFEDF5] rounded-lg transition-colors duration-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateContact}
                  disabled={!newName.trim() || !newDistrict || createContact.isPending}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] disabled:opacity-50 transition-colors duration-100"
                >
                  {createContact.isPending ? "Adding..." : "Add Contact"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
