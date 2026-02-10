"use client";

// InlineEditCell - A click-to-edit table cell supporting text, textarea, select, and date inputs.
// Used in table views for inline editing of plan and activity data.

import { useState, useRef, useEffect } from "react";

interface BaseProps {
  value: string | null;
  onSave: (value: string) => Promise<void>;
  placeholder?: string;
  className?: string;
  /** Optional formatter for display mode (e.g. currency formatting). Receives raw value string. */
  displayFormat?: (value: string) => string;
}

interface TextProps extends BaseProps {
  type: "text";
}

interface TextareaProps extends BaseProps {
  type: "textarea";
}

interface SelectProps extends BaseProps {
  type: "select";
  options: Array<{ value: string; label: string }>;
}

interface DateProps extends BaseProps {
  type: "date";
}

type InlineEditCellProps = TextProps | TextareaProps | SelectProps | DateProps;

// Format date for display as MM/DD/YYYY (e.g., "02/05/2026")
// Extracts the YYYY-MM-DD portion first so it works with both
// bare date strings ("2026-02-05") and full ISO strings ("2026-02-05T00:00:00.000Z").
// The "T00:00:00" suffix (without Z) forces local-time parsing to avoid off-by-one timezone issues.
function formatDate(dateString: string): string {
  const datePart = dateString.split("T")[0];
  const date = new Date(datePart + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

export default function InlineEditCell(props: InlineEditCellProps) {
  const { type, value, onSave, placeholder = "—", className = "", displayFormat } = props;
  const options = type === "select" ? props.options : [];

  // For date inputs, normalize ISO strings ("2026-02-05T00:00:00.000Z") to "YYYY-MM-DD"
  // since HTML <input type="date"> requires that format.
  const normalizeValue = (v: string | null): string => {
    if (!v) return "";
    if (type === "date" && v.includes("T")) return v.split("T")[0];
    return v;
  };

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(normalizeValue(value));
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);

  // Sync editValue when value prop changes
  useEffect(() => {
    setEditValue(normalizeValue(value));
  }, [value]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  // Clear success flash timeout on unmount to prevent memory leaks
  useEffect(() => {
    if (!showSuccess) return;
    const timer = setTimeout(() => setShowSuccess(false), 500);
    return () => clearTimeout(timer);
  }, [showSuccess]);

  // Get display value for rendering
  const getDisplayValue = (): string => {
    if (!value) return placeholder;

    if (type === "select") {
      const option = options.find((opt) => opt.value === value);
      return option?.label ?? value;
    }

    if (type === "date") {
      return formatDate(value);
    }

    if (displayFormat) {
      return displayFormat(value);
    }

    return value;
  };

  // Handle saving the value
  const handleSave = async () => {
    // Don't save if value unchanged
    if (editValue === (value ?? "")) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(editValue);
      setIsEditing(false);
      // Show success flash
      setShowSuccess(true);
    } catch (error) {
      // Keep editing mode on error so user can retry
      console.error("InlineEditCell save failed:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle cancel (Escape key)
  const handleCancel = () => {
    setEditValue(value ?? "");
    setIsEditing(false);
  };

  // Handle keydown for different input types
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      handleCancel();
      return;
    }

    if (type === "textarea") {
      // Textarea: Ctrl+Enter to save
      if (e.key === "Enter" && e.ctrlKey) {
        handleSave();
      }
    } else if (type === "text" || type === "date") {
      // Text/Date: Enter to save
      if (e.key === "Enter") {
        handleSave();
      }
    }
  };

  // Handle select change (auto-save)
  const handleSelectChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    setEditValue(newValue);

    // Auto-save for select
    if (newValue !== (value ?? "")) {
      setIsSaving(true);
      try {
        await onSave(newValue);
        setIsEditing(false);
        setShowSuccess(true);
      } catch (error) {
        // Keep editing mode on error so user can retry
        console.error("InlineEditCell save failed:", error);
      } finally {
        setIsSaving(false);
      }
    } else {
      setIsEditing(false);
    }
  };

  // Base container styles — compact padding to fit neatly in table cells
  const containerStyles = `
    cursor-pointer px-1.5 py-0.5 rounded transition-colors
    hover:bg-[#C4E7E6]/30
    ${showSuccess ? "bg-green-100" : ""}
    ${className}
  `.trim();

  // Input styles — compact to match display size
  const inputStyles = `
    w-full px-1.5 py-0.5 text-sm rounded border border-gray-300
    ring-2 ring-[#403770]
    focus:outline-none
  `.trim();

  // Render display mode
  if (!isEditing) {
    return (
      <div
        className={containerStyles}
        onClick={() => setIsEditing(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsEditing(true);
          }
        }}
      >
        <span className={!value ? "text-gray-400" : ""}>
          {getDisplayValue()}
        </span>
      </div>
    );
  }

  // Render edit mode based on type
  if (type === "textarea") {
    return (
      <div className={containerStyles}>
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          className={inputStyles}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
          rows={3}
        />
      </div>
    );
  }

  if (type === "select") {
    return (
      <div className={containerStyles}>
        <select
          ref={inputRef as React.RefObject<HTMLSelectElement>}
          className={inputStyles}
          value={editValue}
          onChange={handleSelectChange}
          onBlur={() => setIsEditing(false)}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (type === "date") {
    return (
      <div className={containerStyles}>
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="date"
          className={inputStyles}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
        />
      </div>
    );
  }

  // Default: text input
  return (
    <div className={containerStyles}>
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="text"
        className={inputStyles}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        disabled={isSaving}
      />
    </div>
  );
}
