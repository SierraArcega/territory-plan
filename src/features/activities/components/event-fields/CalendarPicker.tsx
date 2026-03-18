"use client";

import { useState, useMemo, useRef, useEffect } from "react";

interface CalendarPickerProps {
  startDate: string; // yyyy-MM-dd
  endDate: string;
  isMultiDay: boolean;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onMultiDayChange: (multiDay: boolean) => void;
}

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDisplay(dateStr: string): string {
  if (!dateStr) return "Select date...";
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${SHORT_MONTHS[m - 1]} ${d}, ${y}`;
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDate(dateStr: string): { year: number; month: number } {
  if (!dateStr) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  }
  const [y, m] = dateStr.split("-").map(Number);
  return { year: y, month: m - 1 };
}

export default function CalendarPicker({
  startDate,
  endDate,
  isMultiDay,
  onStartDateChange,
  onEndDateChange,
  onMultiDayChange,
}: CalendarPickerProps) {
  const initial = parseDate(startDate);
  const [viewYear, setViewYear] = useState(initial.year);
  const [viewMonth, setViewMonth] = useState(initial.month);
  const [selecting, setSelecting] = useState<"start" | "end">("start");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const today = useMemo(() => {
    const now = new Date();
    return toDateStr(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  // Build calendar grid
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const cells: { day: number; month: number; year: number; isCurrentMonth: boolean }[] = [];

    for (let i = firstDay - 1; i >= 0; i--) {
      const prevM = viewMonth === 0 ? 11 : viewMonth - 1;
      const prevY = viewMonth === 0 ? viewYear - 1 : viewYear;
      cells.push({ day: daysInPrevMonth - i, month: prevM, year: prevY, isCurrentMonth: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, month: viewMonth, year: viewYear, isCurrentMonth: true });
    }

    const remaining = 42 - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
      const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
      cells.push({ day: d, month: nextM, year: nextY, isCurrentMonth: false });
    }

    return cells;
  }, [viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };

  const goToToday = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
  };

  const handleDayClick = (dateStr: string) => {
    if (selecting === "start" || !isMultiDay) {
      onStartDateChange(dateStr);
      if (isMultiDay) {
        if (endDate && dateStr > endDate) onEndDateChange("");
        setSelecting("end");
      } else {
        setIsOpen(false);
      }
    } else {
      if (dateStr < startDate) {
        onStartDateChange(dateStr);
        onEndDateChange("");
      } else {
        onEndDateChange(dateStr);
        setSelecting("start");
        // Don't auto-close — let the user confirm with Done
      }
    }
  };

  const isInRange = (dateStr: string) => {
    if (!isMultiDay || !startDate || !endDate) return false;
    return dateStr > startDate && dateStr < endDate;
  };

  const isRangeStart = (dateStr: string) => isMultiDay && startDate === dateStr && !!endDate;
  const isRangeEnd = (dateStr: string) => isMultiDay && endDate === dateStr;

  // Build the trigger label
  const triggerLabel = startDate
    ? isMultiDay && endDate
      ? `${formatDisplay(startDate)} → ${formatDisplay(endDate)}`
      : formatDisplay(startDate)
    : "Select date...";

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>

      {/* Trigger field */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={`w-full flex items-center justify-between px-3 py-2 border rounded-lg text-sm transition-colors bg-white ${
          isOpen
            ? "border-[#403770] ring-2 ring-[#403770]"
            : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <span className={startDate ? "text-gray-800" : "text-gray-400"}>
          {triggerLabel}
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg p-3">
          {/* Date pills when multi-day */}
          {isMultiDay && (
            <div className="flex items-center gap-2 mb-3">
              <button
                type="button"
                onClick={() => setSelecting("start")}
                className={`px-3 py-1 rounded-lg text-xs border transition-colors ${
                  selecting === "start"
                    ? "border-[#403770] bg-[#F7F5FA] text-[#403770] font-medium"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {formatDisplay(startDate)}
              </button>
              <span className="text-gray-400 text-xs">→</span>
              <button
                type="button"
                onClick={() => setSelecting("end")}
                className={`px-3 py-1 rounded-lg text-xs border transition-colors ${
                  selecting === "end"
                    ? "border-[#403770] bg-[#F7F5FA] text-[#403770] font-medium"
                    : "border-gray-200 text-gray-600 hover:border-gray-300"
                }`}
              >
                {formatDisplay(endDate)}
              </button>
            </div>
          )}

          {/* Calendar header */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-[#403770]">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={goToToday}
                className="text-xs text-gray-500 hover:text-[#403770] px-2 py-1 rounded hover:bg-gray-50 transition-colors"
              >
                Today
              </button>
              <button
                type="button"
                onClick={prevMonth}
                className="p-1 text-gray-400 hover:text-[#403770] rounded hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={nextMonth}
                className="p-1 text-gray-400 hover:text-[#403770] rounded hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map((d) => (
              <div key={d} className="text-center text-[11px] font-medium text-gray-400 py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map((cell, i) => {
              const dateStr = toDateStr(cell.year, cell.month, cell.day);
              const isToday = dateStr === today;
              const isSelected = dateStr === startDate || dateStr === endDate;
              const inRange = isInRange(dateStr);
              const rangeStart = isRangeStart(dateStr);
              const rangeEnd = isRangeEnd(dateStr);

              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleDayClick(dateStr)}
                  className={`
                    relative h-8 text-sm transition-colors
                    ${!cell.isCurrentMonth ? "text-gray-300" : "text-gray-700"}
                    ${isToday && !isSelected ? "font-bold text-[#403770]" : ""}
                    ${isSelected ? "bg-[#403770] text-white font-medium rounded-lg z-10" : ""}
                    ${inRange ? "bg-[#EDE9F7]" : ""}
                    ${rangeStart ? "rounded-l-lg" : ""}
                    ${rangeEnd ? "rounded-r-lg" : ""}
                    ${!isSelected && cell.isCurrentMonth ? "hover:bg-gray-100 rounded-lg" : ""}
                  `}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>

          {/* End date toggle */}
          <div className="mt-3 pt-3 border-t border-gray-100">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Multi-day?</span>
              <button
                type="button"
                onClick={() => {
                  const next = !isMultiDay;
                  onMultiDayChange(next);
                  if (!next) { onEndDateChange(""); setSelecting("start"); }
                  else setSelecting("end");
                }}
                className={`relative w-9 h-5 rounded-full transition-colors ${
                  isMultiDay ? "bg-[#403770]" : "bg-gray-300"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    isMultiDay ? "translate-x-4" : ""
                  }`}
                />
              </button>
            </div>

            {/* Done button — visible when multi-day range is complete */}
            {isMultiDay && startDate && endDate && (
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="mt-3 w-full py-2 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] transition-colors"
              >
                Done
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
