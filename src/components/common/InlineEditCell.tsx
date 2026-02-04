"use client";

// InlineEditCell - A click-to-edit table cell supporting text, textarea, select, and date inputs.
// Used in table views for inline editing of plan and activity data.

import { useState, useRef, useEffect } from "react";

interface BaseProps {
  value: string | null;
  onSave: (value: string) => Promise<void>;
  placeholder?: string;
  className?: string;
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

// Format date for display (e.g., "Feb 4, 2026")
function formatDate(dateString: string): string {
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function InlineEditCell(props: InlineEditCellProps) {
  const { type, value, onSave, placeholder = "—", className = "" } = props;
  const options = type === "select" ? props.options : [];

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);

  // Sync editValue when value prop changes
  useEffect(() => {
    setEditValue(value ?? "");
  }, [value]);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

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
      setTimeout(() => setShowSuccess(false), 500);
    } catch {
      // Keep editing mode on error
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
        setTimeout(() => setShowSuccess(false), 500);
      } catch {
        // Keep editing mode on error
      } finally {
        setIsSaving(false);
      }
    } else {
      setIsEditing(false);
    }
  };

  // Base container styles
  const containerStyles = `
    cursor-pointer px-2 py-1 rounded transition-colors
    hover:bg-[#C4E7E6]/30
    ${showSuccess ? "bg-green-100" : ""}
    ${className}
  `.trim();

  // Input styles
  const inputStyles = `
    w-full px-2 py-1 rounded border border-gray-300
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
        onKeyDown={(e) => e.key === "Enter" && setIsEditing(true)}
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
