"use client";

// ============================================================================
// Feed row components — one per feed section type
// ============================================================================

// ---- Shared action button ----

function ActionButton({
  label,
  onClick,
}: {
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className="shrink-0 bg-[#F7F5FA] rounded-lg px-3 py-1.5 text-xs font-semibold text-[#403770] hover:bg-[#EFEDF5] transition-colors"
    >
      {label}
    </button>
  );
}

// ---- Task checkbox ----

function TaskCheckbox({
  checked,
  onToggle,
}: {
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={`
        w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all
        ${checked ? "bg-[#F37167] border-[#F37167]" : "border-[#C2BBD4] hover:border-[#F37167]"}
      `}
    >
      {checked && (
        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  );
}

// ============================================================================
// TaskRow
// ============================================================================

interface TaskRowProps {
  title: string;
  territory?: string;
  territoryColor?: string;
  priority?: string;
  dueDate?: string;
  isCompleted?: boolean;
  onComplete?: () => void;
  onClick?: () => void;
}

export function TaskRow({
  title,
  territory,
  territoryColor,
  priority,
  dueDate,
  isCompleted = false,
  onComplete,
  onClick,
}: TaskRowProps) {
  return (
    <div
      className="flex items-center gap-3.5 px-5 py-4 hover:bg-[#F7F5FA]/50 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <TaskCheckbox checked={isCompleted} onToggle={() => onComplete?.()} />
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isCompleted ? "line-through text-[#A69DC0]" : "text-[#403770]"}`}>
          {title}
        </p>
        {(territory || priority) && (
          <div className="flex items-center gap-1.5 mt-0.5">
            {territory && (
              <>
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: territoryColor || "#6EA3BE" }}
                />
                <span className="text-xs text-[#8A80A8]">{territory}</span>
              </>
            )}
            {territory && priority && <span className="text-xs text-[#8A80A8]">·</span>}
            {priority && (
              <span className="text-xs text-[#8A80A8]">{priority} priority</span>
            )}
          </div>
        )}
      </div>
      {dueDate && (
        <span className="text-xs text-[#8A80A8] shrink-0">{dueDate}</span>
      )}
      <ActionButton label={isCompleted ? "Undo" : "Complete"} onClick={onComplete} />
    </div>
  );
}

// ============================================================================
// OpportunityRow
// ============================================================================

interface OpportunityRowProps {
  title: string;
  territory?: string;
  closeDate?: string;
  amount?: number;
  onMap?: () => void;
}

export function OpportunityRow({
  title,
  territory,
  closeDate,
  amount,
  onMap,
}: OpportunityRowProps) {
  return (
    <div className="flex items-center gap-3.5 px-5 py-4 hover:bg-[#F7F5FA]/50 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#403770] truncate">{title}</p>
        {(territory || closeDate) && (
          <p className="text-xs text-[#8A80A8] mt-0.5">
            {[territory, closeDate && `Closes ${closeDate}`].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
      {amount != null && (
        <span className="text-sm font-semibold text-[#403770] shrink-0">
          ${amount.toLocaleString()}
        </span>
      )}
      <ActionButton label="Map" onClick={onMap} />
    </div>
  );
}

// ============================================================================
// ActivityRow
// ============================================================================

interface ActivityRowProps {
  title: string;
  completedDate?: string;
  details?: string;
  onAddNextSteps?: () => void;
}

export function ActivityRow({
  title,
  completedDate,
  details,
  onAddNextSteps,
}: ActivityRowProps) {
  return (
    <div className="flex items-center gap-3.5 px-5 py-4 hover:bg-[#F7F5FA]/50 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#403770] truncate">{title}</p>
        {(completedDate || details) && (
          <p className="text-xs text-[#8A80A8] mt-0.5">
            {[completedDate && `Completed ${completedDate}`, details].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
      <ActionButton label="Add next steps" onClick={onAddNextSteps} />
    </div>
  );
}

// ============================================================================
// MeetingRow
// ============================================================================

interface MeetingRowProps {
  title: string;
  source?: string;
  time?: string;
  onLogActivity?: () => void;
}

export function MeetingRow({
  title,
  source,
  time,
  onLogActivity,
}: MeetingRowProps) {
  return (
    <div className="flex items-center gap-3.5 px-5 py-4 hover:bg-[#F7F5FA]/50 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#403770] truncate">{title}</p>
        {source && (
          <p className="text-xs text-[#8A80A8] mt-0.5">{source}</p>
        )}
      </div>
      {time && (
        <span className="text-xs text-[#8A80A8] shrink-0">{time}</span>
      )}
      <ActionButton label="Log activity" onClick={onLogActivity} />
    </div>
  );
}
