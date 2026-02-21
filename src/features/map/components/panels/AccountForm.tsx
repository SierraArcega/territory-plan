"use client";

import { useState, useMemo } from "react";
import { useMapV2Store } from "@/features/map/lib/store";
import { useCreateAccount, useDuplicateCheck } from "@/lib/api";
import { ACCOUNT_TYPES } from "@/lib/account-types";
import { getAccountTypeLabel } from "@/lib/account-types";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
  "DC",
];

export default function AccountForm() {
  const closeAccountForm = useMapV2Store((s) => s.closeAccountForm);
  const selectDistrict = useMapV2Store((s) => s.selectDistrict);
  const accountFormDefaults = useMapV2Store((s) => s.accountFormDefaults);

  // Required fields
  const [name, setName] = useState(accountFormDefaults?.name || "");
  const [accountType, setAccountType] = useState("");

  // Optional fields
  const [stateAbbrev, setStateAbbrev] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [mailingState, setMailingState] = useState("");
  const [zip, setZip] = useState("");
  const [salesExecutive, setSalesExecutive] = useState("");
  const [phone, setPhone] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [showOptional, setShowOptional] = useState(false);

  const createMutation = useCreateAccount();

  // Debounced duplicate check — uses the name when 3+ chars
  const trimmedName = useMemo(() => name.trim(), [name]);
  const duplicateCheck = useDuplicateCheck(trimmedName, stateAbbrev || undefined);
  const duplicates = duplicateCheck.data as Array<{
    leaid: string;
    name: string;
    stateAbbrev: string | null;
    accountType: string | null;
  }> | undefined;

  const handleSubmit = async () => {
    if (!name.trim() || !accountType) return;

    try {
      const result = await createMutation.mutateAsync({
        name: name.trim(),
        accountType,
        stateAbbrev: stateAbbrev || undefined,
        street: street || undefined,
        city: city || undefined,
        state: mailingState || undefined,
        zip: zip || undefined,
        salesExecutive: salesExecutive || undefined,
        phone: phone || undefined,
        websiteUrl: websiteUrl || undefined,
      });

      closeAccountForm();
      if (result?.leaid) {
        selectDistrict(result.leaid);
      }
    } catch {
      // Error handled by mutation state
    }
  };

  const isValid = name.trim().length > 0 && accountType.length > 0;
  const isSubmitting = createMutation.isPending;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100">
        <button
          onClick={closeAccountForm}
          className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
          aria-label="Close form"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 3L5 7L9 11" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          Add Account
        </span>
      </div>

      {/* Form */}
      <div className="flex-1 p-3 space-y-4 overflow-y-auto">
        {/* Account Name (required) */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Account Name <span className="text-coral">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Texas Charter Network"
            className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-plum/20 focus:border-plum/30 placeholder:text-gray-400"
            autoFocus
          />
        </div>

        {/* Duplicate Warning */}
        {trimmedName.length >= 3 && duplicates && duplicates.length > 0 && (
          <div className="bg-amber-50 border border-amber-200/60 rounded-xl px-3 py-2.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1L13 12H1L7 1Z" stroke="#D97706" strokeWidth="1.2" strokeLinejoin="round" />
                <path d="M7 5.5V8" stroke="#D97706" strokeWidth="1.2" strokeLinecap="round" />
                <circle cx="7" cy="10" r="0.5" fill="#D97706" />
              </svg>
              <span className="text-xs font-medium text-amber-700">
                Similar accounts found:
              </span>
            </div>
            <div className="space-y-1">
              {duplicates.map((d) => (
                <div
                  key={d.leaid}
                  className="text-xs text-amber-800 bg-amber-100/50 rounded-lg px-2 py-1 flex items-center justify-between"
                >
                  <span className="font-medium truncate">{d.name}</span>
                  <span className="text-amber-600 shrink-0 ml-2">
                    {[d.stateAbbrev, d.accountType ? getAccountTypeLabel(d.accountType) : null]
                      .filter(Boolean)
                      .join(" / ")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Account Type (required) */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Account Type <span className="text-coral">*</span>
          </label>
          <select
            value={accountType}
            onChange={(e) => setAccountType(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-plum/20 focus:border-plum/30 text-gray-700"
          >
            <option value="">Select type...</option>
            {ACCOUNT_TYPES.filter((t) => t.value !== "district").map((t) => (
              <option key={t.value} value={t.value} title={t.tooltip}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* State */}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            State
          </label>
          <select
            value={stateAbbrev}
            onChange={(e) => setStateAbbrev(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-plum/20 focus:border-plum/30 text-gray-700"
          >
            <option value="">Select state...</option>
            {US_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Optional Fields Toggle */}
        <button
          type="button"
          onClick={() => setShowOptional(!showOptional)}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            className={`transition-transform ${showOptional ? "rotate-90" : ""}`}
          >
            <path d="M3 1L7 5L3 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {showOptional ? "Hide" : "Show"} optional fields
        </button>

        {showOptional && (
          <div className="space-y-3 pl-0.5">
            {/* Street Address */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Street Address
              </label>
              <input
                type="text"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="123 Main St"
                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-plum/20 focus:border-plum/30 placeholder:text-gray-400"
              />
            </div>

            {/* City + State (mailing) + ZIP row */}
            <div className="grid grid-cols-[1fr_60px_80px] gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  City
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-plum/20 focus:border-plum/30 placeholder:text-gray-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  ST
                </label>
                <input
                  type="text"
                  value={mailingState}
                  onChange={(e) => setMailingState(e.target.value.toUpperCase().slice(0, 2))}
                  placeholder="TX"
                  maxLength={2}
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-plum/20 focus:border-plum/30 placeholder:text-gray-400 text-center"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  ZIP
                </label>
                <input
                  type="text"
                  value={zip}
                  onChange={(e) => setZip(e.target.value.slice(0, 10))}
                  placeholder="78701"
                  className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-plum/20 focus:border-plum/30 placeholder:text-gray-400"
                />
              </div>
            </div>

            {/* Sales Executive */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Sales Executive
              </label>
              <input
                type="text"
                value={salesExecutive}
                onChange={(e) => setSalesExecutive(e.target.value)}
                placeholder="e.g., Jane Smith"
                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-plum/20 focus:border-plum/30 placeholder:text-gray-400"
              />
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Phone
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(555) 123-4567"
                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-plum/20 focus:border-plum/30 placeholder:text-gray-400"
              />
            </div>

            {/* Website URL */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Website URL
              </label>
              <input
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://example.org"
                className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-plum/20 focus:border-plum/30 placeholder:text-gray-400"
              />
            </div>
          </div>
        )}

        {/* Error message */}
        {createMutation.isError && (
          <div className="bg-red-50 text-red-600 text-xs rounded-xl px-3 py-2">
            Failed to create account. Please try again.
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!isValid || isSubmitting}
          className="w-full py-2.5 bg-plum text-white text-sm font-medium rounded-xl hover:bg-plum/90 transition-all hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full tile-loading-spinner" />
              Creating...
            </span>
          ) : (
            "Create Account"
          )}
        </button>
      </div>
    </div>
  );
}
