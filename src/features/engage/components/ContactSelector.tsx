"use client";

import { useState, useCallback } from "react";
import {
  Search,
  X,
  AlertTriangle,
  Plus,
  Users,
  ArrowRight,
} from "lucide-react";
import { fetchJson } from "@/features/shared/lib/api-client";
import type { MergeFieldDefData } from "../types";

interface ContactResult {
  id: number;
  name: string;
  email: string | null;
  title: string | null;
  leaid: string;
  districtName?: string;
}

interface SelectedContact {
  contact: ContactResult;
  customFields: Record<string, string>;
}

interface ContactSelectorProps {
  sequenceId: number;
  mergeFieldDefs: MergeFieldDefData[];
  onLaunch: (
    contacts: Array<{ contactId: number; customFields?: Record<string, string> }>
  ) => void;
  onClose: () => void;
}

export default function ContactSelector({
  sequenceId,
  mergeFieldDefs,
  onLaunch,
  onClose,
}: ContactSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ContactResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selected, setSelected] = useState<Map<number, SelectedContact>>(
    new Map()
  );
  const [manualName, setManualName] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualIdCounter, setManualIdCounter] = useState(-1);

  const customFields = mergeFieldDefs.filter((f) => f.type === "custom");

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      const results = await fetchJson<ContactResult[]>(
        `/api/contacts?search=${encodeURIComponent(searchQuery.trim())}`
      );
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const toggleContact = (contact: ContactResult) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(contact.id)) {
        next.delete(contact.id);
      } else {
        next.set(contact.id, { contact, customFields: {} });
      }
      return next;
    });
  };

  const updateCustomField = (
    contactId: number,
    fieldName: string,
    value: string
  ) => {
    setSelected((prev) => {
      const next = new Map(prev);
      const entry = next.get(contactId);
      if (entry) {
        next.set(contactId, {
          ...entry,
          customFields: { ...entry.customFields, [fieldName]: value },
        });
      }
      return next;
    });
  };

  const addManualContact = () => {
    if (!manualName.trim() || !manualEmail.trim()) return;
    const id = manualIdCounter;
    setManualIdCounter((prev) => prev - 1);
    const contact: ContactResult = {
      id,
      name: manualName.trim(),
      email: manualEmail.trim(),
      title: null,
      leaid: "",
      districtName: "Manual",
    };
    setSelected((prev) => {
      const next = new Map(prev);
      next.set(id, { contact, customFields: {} });
      return next;
    });
    setManualName("");
    setManualEmail("");
    setShowManualAdd(false);
  };

  const handleLaunch = () => {
    const contacts = Array.from(selected.values()).map((s) => ({
      contactId: s.contact.id,
      customFields:
        Object.keys(s.customFields).length > 0 ? s.customFields : undefined,
    }));
    onLaunch(contacts);
  };

  const selectedList = Array.from(selected.values());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[#403770]/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2DEEC]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#F37167]/10 flex items-center justify-center">
              <Users className="w-4.5 h-4.5 text-[#F37167]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#403770]">
                Select Contacts
              </h2>
              <p className="text-xs text-[#8A80A8]">
                Choose contacts for this sequence run
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[#EFEDF5] transition-colors"
          >
            <X className="w-4 h-4 text-[#6B5F8A]" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-4 border-b border-[#E2DEEC]">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A69DC0]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search contacts by name, email, or district..."
                className="w-full pl-9 pr-3 py-2 text-sm text-[#403770] bg-white border border-[#C2BBD4] rounded-lg placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167]/30 focus:border-[#F37167]"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="px-4 py-2 text-sm font-medium text-[#403770] border border-[#D4CFE2] rounded-lg hover:bg-[#EFEDF5] transition-colors disabled:opacity-50"
            >
              {isSearching ? "Searching..." : "Search"}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-[#6B5F8A] uppercase tracking-wider mb-3">
                Search Results
              </h3>
              <div className="space-y-1">
                {searchResults.map((contact) => {
                  const isSelected = selected.has(contact.id);
                  return (
                    <button
                      key={contact.id}
                      onClick={() => toggleContact(contact)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                        isSelected
                          ? "bg-[#F37167]/5 border border-[#F37167]/20"
                          : "hover:bg-[#EFEDF5] border border-transparent"
                      }`}
                    >
                      <div
                        className={`w-4.5 h-4.5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                          isSelected
                            ? "bg-[#F37167] border-[#F37167]"
                            : "border-[#C2BBD4]"
                        }`}
                      >
                        {isSelected && (
                          <svg
                            className="w-3 h-3 text-white"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={3}
                          >
                            <path d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[#403770] truncate">
                            {contact.name}
                          </span>
                          {!contact.email && (
                            <AlertTriangle className="w-3.5 h-3.5 text-[#FFCF70] flex-shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[#8A80A8]">
                          {contact.email && (
                            <span className="truncate">{contact.email}</span>
                          )}
                          {!contact.email && (
                            <span className="text-[#F37167]">No email</span>
                          )}
                          {contact.title && (
                            <>
                              <span className="text-[#D4CFE2]">·</span>
                              <span className="truncate">{contact.title}</span>
                            </>
                          )}
                          {contact.districtName && (
                            <>
                              <span className="text-[#D4CFE2]">·</span>
                              <span className="truncate">
                                {contact.districtName}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selected contacts */}
          {selectedList.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-[#6B5F8A] uppercase tracking-wider mb-3">
                Selected ({selectedList.length})
              </h3>
              <div className="border border-[#D4CFE2] rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-[#F7F5FA]">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#6B5F8A] uppercase tracking-wider">
                        Contact
                      </th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-[#6B5F8A] uppercase tracking-wider">
                        Email
                      </th>
                      {customFields.map((field) => (
                        <th
                          key={field.id}
                          className="text-left px-4 py-2.5 text-xs font-semibold text-[#6B5F8A] uppercase tracking-wider"
                        >
                          {field.label}
                        </th>
                      ))}
                      <th className="w-8" />
                    </tr>
                  </thead>
                  <tbody>
                    {selectedList.map((entry, idx) => (
                      <tr
                        key={entry.contact.id}
                        className={
                          idx > 0 ? "border-t border-[#E2DEEC]" : undefined
                        }
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-[#403770]">
                              {entry.contact.name}
                            </span>
                            {!entry.contact.email && (
                              <AlertTriangle className="w-3.5 h-3.5 text-[#FFCF70]" />
                            )}
                          </div>
                          {entry.contact.title && (
                            <div className="text-xs text-[#8A80A8]">
                              {entry.contact.title}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-[#6B5F8A]">
                          {entry.contact.email || (
                            <span className="text-[#F37167] text-xs">
                              Missing
                            </span>
                          )}
                        </td>
                        {customFields.map((field) => (
                          <td key={field.id} className="px-4 py-2.5">
                            <input
                              type="text"
                              value={
                                entry.customFields[field.name] ||
                                field.defaultValue ||
                                ""
                              }
                              onChange={(e) =>
                                updateCustomField(
                                  entry.contact.id,
                                  field.name,
                                  e.target.value
                                )
                              }
                              placeholder={field.label}
                              className="w-full px-2 py-1 text-sm text-[#403770] border border-[#C2BBD4] rounded-lg placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167]/30 focus:border-[#F37167]"
                            />
                          </td>
                        ))}
                        <td className="px-2 py-2.5">
                          <button
                            onClick={() => toggleContact(entry.contact)}
                            className="p-1 rounded hover:bg-[#EFEDF5] transition-colors"
                          >
                            <X className="w-3.5 h-3.5 text-[#A69DC0]" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Manual add */}
          <div>
            {!showManualAdd ? (
              <button
                onClick={() => setShowManualAdd(true)}
                className="flex items-center gap-2 text-sm font-medium text-[#6EA3BE] hover:text-[#403770] transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add contact manually
              </button>
            ) : (
              <div className="border border-[#D4CFE2] rounded-lg p-4">
                <h4 className="text-xs font-semibold text-[#6B5F8A] uppercase tracking-wider mb-3">
                  Manual Contact
                </h4>
                <div className="flex gap-3">
                  <input
                    type="text"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    placeholder="Name"
                    className="flex-1 px-3 py-2 text-sm text-[#403770] border border-[#C2BBD4] rounded-lg placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167]/30 focus:border-[#F37167]"
                  />
                  <input
                    type="email"
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    placeholder="Email"
                    className="flex-1 px-3 py-2 text-sm text-[#403770] border border-[#C2BBD4] rounded-lg placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167]/30 focus:border-[#F37167]"
                  />
                  <button
                    onClick={addManualContact}
                    disabled={!manualName.trim() || !manualEmail.trim()}
                    className="px-4 py-2 text-sm font-medium text-white bg-[#6EA3BE] rounded-lg hover:bg-[#5a8fa8] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => setShowManualAdd(false)}
                    className="px-3 py-2 text-sm text-[#6B5F8A] hover:bg-[#EFEDF5] rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E2DEEC] flex items-center justify-between">
          <span className="text-sm text-[#8A80A8]">
            {selectedList.length} contact{selectedList.length !== 1 ? "s" : ""}{" "}
            selected
          </span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[#6B5F8A] border border-[#D4CFE2] rounded-lg hover:bg-[#EFEDF5] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleLaunch}
              disabled={selectedList.length === 0}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium text-white bg-[#F37167] rounded-lg hover:bg-[#e05e54] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Launch
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
