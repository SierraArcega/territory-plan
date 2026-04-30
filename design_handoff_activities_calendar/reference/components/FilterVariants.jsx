/* global React */
// FilterVariants.jsx — the Calendar page filter UI.
//
// Filter state shape:
//   {
//     categories: Set<string>,   // activity category (meeting/event/campaign/fun)
//     types: Set<string>,        // fine-grained activity type
//     dealKinds: Set<string>,    // deal outcome overlay
//     dealStages: Set<string>,   // pipeline stage filter
//     dealMin/Max: number|null,  // deal amount range
//     statuses: Set<string>,     // activity status
//     owners: Set<string>,       // teammate display names
//     states: Set<string>,       // US state codes
//     territories: Set<string>,  // district/territory names
//     tags: Set<string>,         // derived tag vocabulary
//     text: string,              // free-text search (command bar)
//   }
//
// Plus saved-view props: savedView (id), onSavedView(id).

const fvStyles = {
  plum: '#403770',
  plumDark: '#322a5a',
  fgStrong: '#544A78',
  fgBody: '#6E6390',
  fgSec: '#8A80A8',
  fgMut: '#A69DC0',
  border: '#D4CFE2',
  borderSub: '#E2DEEC',
  surf: '#FFFCFA',
  raised: '#F7F5FA',
  hover: '#EFEDF5',
  coral: '#F37167',
  coralTint: '#FFD1CC',
  steel: '#6EA3BE',
  robinsEgg: '#C4E7E6',
  golden: '#FFCF70',
  mint: '#EDFFE3',
  sage: '#8AA891',
};

// Shared catalog — matches FilterBar in CalendarChrome.jsx
const FV_CATEGORIES = [
  { id: 'meeting',  label: 'Meetings',  color: '#6EA3BE' },
  { id: 'event',    label: 'Events',    color: '#F37167' },
  { id: 'campaign', label: 'Campaigns', color: '#403770' },
  { id: 'fun',      label: 'Moments',   color: '#FFCF70' },
];

const FV_STATUSES = [
  { id: 'planned',     label: 'Planned',     color: '#8A80A8' },
  { id: 'in_progress', label: 'In progress', color: '#6EA3BE' },
  { id: 'completed',   label: 'Completed',   color: '#69B34A' },
  { id: 'tentative',   label: 'Tentative',   color: '#FFCF70' },
  { id: 'cancelled',   label: 'Cancelled',   color: '#BFB8D4' },
];

const FV_DEAL_KINDS = [
  { id: 'won',        label: 'Won',        color: '#69B34A', glyph: '\u2197' },
  { id: 'lost',       label: 'Lost',       color: '#F37167', glyph: '\u2198' },
  { id: 'created',    label: 'New',        color: '#6EA3BE', glyph: '+' },
  { id: 'progressed', label: 'Progressed', color: '#403770', glyph: '\u2192' },
];

// Count helpers
function isSetFull(set, total) { return set && set.size === total; }
function activeCount(filters) {
  let n = 0;
  n += (FV_CATEGORIES.length - filters.categories.size);
  n += (FV_STATUSES.length   - filters.statuses.size);
  n += (filters.states?.size || 0) > 0 && filters.states.size < (window.ALL_STATES.length) ? 1 : 0;
  n += (filters.territories?.size || 0) > 0 && filters.territories.size < (window.ALL_TERRITORIES.length) ? 1 : 0;
  n += (filters.tags?.size || 0) > 0 && filters.tags.size < (window.ALL_TAGS.length) ? 1 : 0;
  const ownerTotal = Object.values(window.TEAMMATES || {}).filter((t, i, arr) => arr.findIndex(x => x.name === t.name) === i).length;
  n += filters.owners.size > 0 && filters.owners.size < ownerTotal ? 1 : 0;
  if (filters.text && filters.text.trim()) n += 1;
  return Math.max(0, n);
}

// ============================================================================
// Saved views tabs
// ============================================================================
function SavedViewTabs({ savedView, onSavedView }) {
  const views = window.DEFAULT_SAVED_VIEWS;
  const accent = fvStyles.plum;
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', gap: 2,
      borderBottom: `1px solid ${fvStyles.borderSub}`,
      padding: '0 24px',
      background: '#fff',
      marginBottom: -1,
    }}>
      {views.map(v => {
        const active = savedView === v.id;
        return (
          <button
            key={v.id}
            onClick={() => onSavedView(v.id)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '10px 14px 11px',
              fontSize: 12, fontWeight: active ? 700 : 500,
              fontFamily: 'inherit',
              border: 'none', background: 'transparent',
              color: active ? accent : fvStyles.fgSec,
              cursor: 'pointer',
              position: 'relative',
              letterSpacing: '-0.005em',
            }}
            onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = fvStyles.fgStrong; }}
            onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = fvStyles.fgSec; }}
          >
            <span style={{ fontSize: 11, color: active ? accent : fvStyles.fgMut }}>{v.icon}</span>
            {v.label}
            {active && (
              <span style={{
                position: 'absolute', left: 8, right: 8, bottom: -1, height: 2,
                background: accent, borderRadius: 2,
              }} />
            )}
          </button>
        );
      })}
      <div style={{ flex: 1 }} />
      <button
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '8px 10px', fontSize: 11, fontWeight: 600,
          fontFamily: 'inherit',
          border: 'none', background: 'transparent',
          color: fvStyles.fgSec, cursor: 'pointer',
          marginBottom: 2,
        }}
        title="Save current filters as a view"
      >
        <span style={{ fontSize: 13, lineHeight: 1 }}>+</span> Save view
      </button>
    </div>
  );
}

// ============================================================================
// Command bar — Cmd/Ctrl+K overlay with search + quick filter jumps
// ============================================================================
function CommandBar({ open, onClose, filters, setText, toggle, onJumpToView }) {
  const inputRef = React.useRef(null);
  const [q, setQ] = React.useState('');
  React.useEffect(() => {
    if (open) {
      setQ(filters.text || '');
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Keyboard shortcut
  React.useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onJumpToView();
      }
      if (e.key === 'Escape' && open) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose, onJumpToView]);

  if (!open) return null;

  const suggestions = [];
  const qLow = q.toLowerCase().trim();
  if (qLow) {
    // Match categories / statuses / states / owners / tags
    FV_CATEGORIES.forEach(c => { if (c.label.toLowerCase().includes(qLow)) suggestions.push({ kind: 'Activity type', label: c.label, onApply: () => toggle('categories', c.id) }); });
    FV_STATUSES.forEach(s => { if (s.label.toLowerCase().includes(qLow)) suggestions.push({ kind: 'Status', label: s.label, onApply: () => toggle('statuses', s.id) }); });
    (window.ALL_STATES || []).forEach(s => {
      const name = window.STATE_META[s]?.name || s;
      if (s.toLowerCase().includes(qLow) || name.toLowerCase().includes(qLow)) {
        suggestions.push({ kind: 'State', label: `${name} (${s})`, onApply: () => toggle('states', s) });
      }
    });
    (window.ALL_TAGS || []).forEach(t => { if (t.toLowerCase().includes(qLow)) suggestions.push({ kind: 'Tag', label: t, onApply: () => toggle('tags', t) }); });
    Object.values(window.TEAMMATES || {}).forEach(t => {
      if (t.name.toLowerCase().includes(qLow) && !suggestions.find(x => x.kind === 'Rep' && x.label === t.name)) {
        suggestions.push({ kind: 'Rep', label: t.name, onApply: () => toggle('owners', t.name) });
      }
    });
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(64,55,112,0.25)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      paddingTop: '12vh',
    }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 560, maxWidth: '90vw',
          background: '#fff', borderRadius: 14,
          boxShadow: '0 20px 25px -5px rgba(64,55,112,0.20), 0 8px 10px -6px rgba(64,55,112,0.12)',
          border: `1px solid ${fvStyles.border}`,
          overflow: 'hidden',
        }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 16px', borderBottom: `1px solid ${fvStyles.borderSub}`,
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke={fvStyles.fgSec} strokeWidth="1.5">
            <circle cx="7" cy="7" r="4.5" /><path d="M14 14L10.5 10.5" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setText(e.target.value); }}
            placeholder="Search activities, reps, states, tags…"
            style={{
              flex: 1, border: 'none', outline: 'none',
              fontSize: 15, fontFamily: 'inherit', color: fvStyles.plum,
              background: 'transparent',
            }} />
          <kbd style={{
            fontSize: 10, fontWeight: 700,
            padding: '2px 6px', borderRadius: 4,
            background: fvStyles.hover, color: fvStyles.fgStrong,
            border: `1px solid ${fvStyles.borderSub}`,
          }}>ESC</kbd>
        </div>
        <div style={{ maxHeight: '50vh', overflowY: 'auto', padding: 6 }}>
          {!q && (
            <div style={{ padding: 12, fontSize: 12, color: fvStyles.fgSec }}>
              Start typing to filter by rep, state, activity type, status, or tag.
              Or try <b style={{ color: fvStyles.plum }}>"Renewal"</b>, <b style={{ color: fvStyles.plum }}>"Hartford"</b>, <b style={{ color: fvStyles.plum }}>"Priya"</b>.
            </div>
          )}
          {q && suggestions.length === 0 && (
            <div style={{ padding: 14, fontSize: 13, color: fvStyles.fgSec }}>
              No matches. Press <kbd style={{ fontSize: 10, padding: '1px 5px', background: fvStyles.hover, borderRadius: 3 }}>Enter</kbd> to search activity titles for <b>"{q}"</b>.
            </div>
          )}
          {suggestions.slice(0, 10).map((s, i) => (
            <button
              key={i}
              onClick={() => { s.onApply(); onClose(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                width: '100%', padding: '9px 12px',
                border: 'none', background: 'transparent', cursor: 'pointer',
                borderRadius: 8, fontFamily: 'inherit',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = fvStyles.hover}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{
                fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                color: fvStyles.fgSec, minWidth: 64,
              }}>{s.kind}</span>
              <span style={{ fontSize: 13, color: fvStyles.plum, fontWeight: 500 }}>{s.label}</span>
              <span style={{ flex: 1 }} />
              <span style={{ fontSize: 10, color: fvStyles.fgMut }}>toggle filter</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Shared small primitives
// ============================================================================

// Dropdown: anchored popover w/ click-outside
function Popover({ open, onClose, anchorRef, children, align = 'left', width = 260 }) {
  const [pos, setPos] = React.useState(null);
  React.useLayoutEffect(() => {
    if (open && anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect();
      setPos({
        top: r.bottom + 6,
        left: align === 'right' ? r.right - width : r.left,
      });
    }
  }, [open]);
  if (!open || !pos) return null;
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
      <div style={{
        position: 'fixed', top: pos.top, left: pos.left, width, zIndex: 61,
        background: '#fff', border: `1px solid ${fvStyles.border}`,
        borderRadius: 12, boxShadow: '0 10px 15px -3px rgba(64,55,112,0.12), 0 4px 6px -4px rgba(64,55,112,0.10)',
        overflow: 'hidden',
      }}>
        {children}
      </div>
    </>
  );
}

// Checklist row
function ChecklistRow({ active, onClick, color, dot = 'square', label, trailing, indent = false }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        width: '100%', padding: indent ? '6px 12px 6px 24px' : '6px 12px',
        border: 'none', background: 'transparent', cursor: 'pointer',
        fontFamily: 'inherit', textAlign: 'left',
        borderRadius: 6,
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = fvStyles.hover}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      <span style={{
        width: 14, height: 14, borderRadius: 4,
        border: `1.5px solid ${active ? fvStyles.plum : fvStyles.border}`,
        background: active ? fvStyles.plum : '#fff',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        {active && <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M2 5.5 L4 7.5 L8 3" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </span>
      {color && dot === 'square' && <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />}
      {color && dot === 'dot' && <span style={{ width: 8, height: 8, borderRadius: 999, background: color, flexShrink: 0 }} />}
      <span style={{ flex: 1, fontSize: 13, color: fvStyles.plum, fontWeight: active ? 600 : 500 }}>{label}</span>
      {trailing && <span style={{ fontSize: 11, color: fvStyles.fgSec }}>{trailing}</span>}
    </button>
  );
}

// ============================================================================
// Chip Rail filter bar
// ============================================================================

function ChipRailFilterBar({ filters, onToggle, onToggleMany, onReset, scope, onOpenCmd }) {
  const teammates = React.useMemo(() => {
    const seen = new Set();
    return Object.values(window.TEAMMATES || {}).filter(t => {
      if (seen.has(t.name)) return false; seen.add(t.name); return true;
    });
  }, []);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 0 6px',
      flexWrap: 'wrap',
    }}>
      {/* Command bar quick-access */}
      <button
        onClick={onOpenCmd}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          height: 30, padding: '0 10px 0 10px',
          fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
          borderRadius: 8, border: `1px solid ${fvStyles.border}`,
          background: '#fff', color: fvStyles.fgStrong, cursor: 'pointer',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = fvStyles.raised}
        onMouseLeave={(e) => e.currentTarget.style.background = '#fff'}
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="7" cy="7" r="4.5" /><path d="M14 14L10.5 10.5" strokeLinecap="round" />
        </svg>
        <span style={{ color: fvStyles.fgSec }}>Search or filter…</span>
        <kbd style={{
          fontSize: 10, fontWeight: 700,
          padding: '1px 5px', borderRadius: 3,
          background: fvStyles.hover, color: fvStyles.fgStrong, border: `1px solid ${fvStyles.borderSub}`,
        }}>⌘K</kbd>
      </button>

      <span style={{ width: 1, height: 20, background: fvStyles.borderSub }} />

      {/* All activity types in one chip, grouped by category in the dropdown */}
      <ActivitiesChip
        filters={filters}
        onToggleCategory={(id) => onToggle('categories', id)}
        onToggleType={(id) => onToggle('types', id)}
        onToggleMany={onToggleMany}
      />

      <span style={{ width: 1, height: 20, background: fvStyles.borderSub }} />

      {/* Reps dropdown */}
      <DropdownChip
        label="Rep"
        selectedCount={filters.owners.size}
        total={teammates.length}
        icon={<AvatarStackIcon owners={Array.from(filters.owners).slice(0, 3)} />}
      >
        <ChecklistMenu
          title="Reps"
          options={teammates.map(t => ({ id: t.name, label: t.you ? 'Me · Alex' : t.name, color: t.color, initials: t.initials }))}
          selected={filters.owners}
          onToggle={(id) => onToggle('owners', id)}
          onAll={() => onToggleMany('owners', teammates.map(t => t.name))}
          onNone={() => onToggleMany('owners', [])}
          extraActions={[
            { label: 'Only me', onClick: () => onToggleMany('owners', ['Alex Rivera']) },
          ]}
          renderPrefix={(opt) => (
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 18, height: 18, borderRadius: 999,
              background: opt.color, color: '#fff', fontSize: 9, fontWeight: 700,
            }}>{opt.initials}</span>
          )}
        />
      </DropdownChip>

      {/* States dropdown */}
      <DropdownChip
        label="State"
        selectedCount={filters.states.size}
        total={window.ALL_STATES.length}
      >
        <ChecklistMenu
          title="States"
          options={window.ALL_STATES.map(s => ({ id: s, label: `${window.STATE_META[s]?.name || s}`, sublabel: s, color: window.STATE_META[s]?.color }))}
          selected={filters.states}
          onToggle={(id) => onToggle('states', id)}
          onAll={() => onToggleMany('states', window.ALL_STATES)}
          onNone={() => onToggleMany('states', [])}
        />
      </DropdownChip>

      {/* Territories */}
      <DropdownChip
        label="Territory"
        selectedCount={filters.territories.size}
        total={window.ALL_TERRITORIES.length}
      >
        <ChecklistMenu
          title="Districts & territories"
          options={window.ALL_TERRITORIES.map(t => ({ id: t, label: t }))}
          selected={filters.territories}
          onToggle={(id) => onToggle('territories', id)}
          onAll={() => onToggleMany('territories', window.ALL_TERRITORIES)}
          onNone={() => onToggleMany('territories', [])}
        />
      </DropdownChip>

      {/* Tags */}
      <DropdownChip
        label="Tags"
        selectedCount={filters.tags.size}
        total={window.ALL_TAGS.length}
      >
        <ChecklistMenu
          title="Tags"
          options={window.ALL_TAGS.map(t => ({ id: t, label: t }))}
          selected={filters.tags}
          onToggle={(id) => onToggle('tags', id)}
          onAll={() => onToggleMany('tags', window.ALL_TAGS)}
          onNone={() => onToggleMany('tags', [])}
        />
      </DropdownChip>

      {/* Status */}
      <DropdownChip
        label="Status"
        selectedCount={filters.statuses.size}
        total={FV_STATUSES.length}
      >
        <ChecklistMenu
          title="Status"
          options={FV_STATUSES}
          selected={filters.statuses}
          onToggle={(id) => onToggle('statuses', id)}
          onAll={() => onToggleMany('statuses', FV_STATUSES.map(s => s.id))}
          onNone={() => onToggleMany('statuses', [FV_STATUSES[0].id])}
        />
      </DropdownChip>

      <div style={{ flex: 1 }} />

      {activeCount(filters) > 0 && (
        <button onClick={onReset}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            height: 30, padding: '0 10px',
            fontSize: 11, fontWeight: 700, fontFamily: 'inherit',
            letterSpacing: '0.04em', textTransform: 'uppercase',
            borderRadius: 8, border: `1px solid ${fvStyles.border}`,
            background: '#fff', color: fvStyles.fgStrong, cursor: 'pointer',
          }}>
          Clear ({activeCount(filters)})
        </button>
      )}
    </div>
  );
}

function AvatarStackIcon({ owners }) {
  if (!owners || owners.length === 0) return null;
  return (
    <span style={{ display: 'inline-flex' }}>
      {owners.slice(0, 3).map((o, i) => {
        const t = window.getTeammate(o);
        if (!t) return null;
        return (
          <span key={o} style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 16, height: 16, borderRadius: 999,
            background: t.color, color: '#fff', fontSize: 8, fontWeight: 700,
            marginLeft: i === 0 ? 0 : -5,
            border: '1.5px solid #fff',
            lineHeight: 1,
          }}>{t.initials}</span>
        );
      })}
    </span>
  );
}


// Single condensed chip for all activity types. Opens a grouped dropdown with
// sections per category (Meetings / Events / Campaigns / Fun), each with its
// own All/None + individual type checkboxes. Replaces the 4 category chips.
function ActivitiesChip({ filters, onToggleCategory, onToggleType, onToggleMany }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const h = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const allTypes = Object.keys(window.ACTIVITY_CATEGORY || {});
  const allCatIds = FV_CATEGORIES.map(c => c.id);
  const activeCats = FV_CATEGORIES.filter(c => filters.categories.has(c.id));
  const selectedTypes = filters.types?.size || 0;
  const totalTypes = allTypes.length;
  const isAllTypes = selectedTypes === totalTypes && activeCats.length === FV_CATEGORIES.length;
  const isNoneTypes = selectedTypes === 0 || activeCats.length === 0;

  // Summary text on the chip face
  let summary;
  if (isAllTypes) summary = 'All types';
  else if (isNoneTypes) summary = 'None';
  else if (activeCats.length === 1 && selectedTypes === getTypesForCategory(activeCats[0].id).length) {
    summary = activeCats[0].label;
  } else {
    summary = `${selectedTypes}/${totalTypes}`;
  }

  // Bullet rendering — show up to 4 active category color dots
  const catDots = activeCats.slice(0, 4);

  const selectAllTypes = () => {
    onToggleMany('types', allTypes);
    onToggleMany('categories', allCatIds);
  };
  const selectNoneTypes = () => {
    onToggleMany('types', []);
    onToggleMany('categories', []);
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          height: 30, padding: '0 12px',
          fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
          borderRadius: 999,
          border: `1px solid ${open ? fvStyles.plum : fvStyles.border}`,
          background: open ? fvStyles.hover : '#fff',
          color: fvStyles.plum,
          cursor: 'pointer',
        }}>
        <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center' }}>
          {catDots.length > 0 ? (
            catDots.map(c => (
              <span key={c.id} style={{ width: 8, height: 8, borderRadius: 2, background: c.color }} />
            ))
          ) : (
            <span style={{ width: 8, height: 8, borderRadius: 2, background: fvStyles.borderSub }} />
          )}
        </span>
        Activities
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          minWidth: 20, height: 16, padding: '0 5px',
          borderRadius: 999,
          background: isAllTypes ? fvStyles.raised : fvStyles.plum + '15',
          color: fvStyles.plum,
          fontSize: 10, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
          letterSpacing: 0,
        }}>{summary}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
          <path d="M2.5 4l2.5 2.5L7.5 4" />
        </svg>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50,
          width: 320, maxHeight: 440, overflow: 'auto',
          background: '#fff',
          border: `1px solid ${fvStyles.border}`,
          borderRadius: 12,
          boxShadow: '0 14px 32px -8px rgba(64,55,112,0.22)',
          padding: 4,
        }} className="fm-scrollbar">
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 12px 6px',
            borderBottom: `1px solid ${fvStyles.borderSub}`,
          }}>
            <span style={{
              fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
              color: fvStyles.fgSec, textTransform: 'uppercase',
            }}>Activity types</span>
            <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
              <button onClick={selectAllTypes} style={menuLinkStyle}>All</button>
              <span style={{ color: fvStyles.fgMut }}>·</span>
              <button onClick={selectNoneTypes} style={menuLinkStyle}>None</button>
            </div>
          </div>
          {/* One section per category */}
          {FV_CATEGORIES.map(cat => (
            <ActivityCategorySection
              key={cat.id}
              category={cat}
              filters={filters}
              onToggleCategory={onToggleCategory}
              onToggleType={onToggleType}
              onToggleMany={onToggleMany}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function getTypesForCategory(catId) {
  return Object.entries(window.ACTIVITY_CATEGORY || {})
    .filter(([, cat]) => cat === catId)
    .map(([type]) => type);
}

function ActivityCategorySection({ category, filters, onToggleCategory, onToggleType, onToggleMany }) {
  const types = getTypesForCategory(category.id);
  const selectedCount = types.filter(t => filters.types.has(t)).length;
  const allSelected = selectedCount === types.length && filters.categories.has(category.id);
  const noneSelected = selectedCount === 0 || !filters.categories.has(category.id);

  const toggleAll = () => {
    if (allSelected) {
      // Deselect all in this category
      const remaining = Array.from(filters.types).filter(t => !types.includes(t));
      onToggleMany('types', remaining);
      // Also drop the category flag so it reads as off
      if (filters.categories.has(category.id)) onToggleCategory(category.id);
    } else {
      // Select all in this category
      const merged = Array.from(new Set([...filters.types, ...types]));
      onToggleMany('types', merged);
      if (!filters.categories.has(category.id)) onToggleCategory(category.id);
    }
  };

  const toggleType = (type) => {
    onToggleType(type);
    // Auto-enable category flag when any type is on
    if (!filters.categories.has(category.id) && !filters.types.has(type)) {
      onToggleCategory(category.id);
    }
  };

  return (
    <div style={{ padding: '6px 0' }}>
      <button onClick={toggleAll}
        style={{
          display: 'flex', alignItems: 'center', width: '100%', gap: 8,
          padding: '6px 12px',
          border: 'none', background: 'transparent',
          cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = fvStyles.hover}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <span style={{ width: 8, height: 8, borderRadius: 2, background: category.color, flexShrink: 0 }} />
        <span style={{
          fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
          color: fvStyles.plum, textTransform: 'uppercase',
          flex: 1,
        }}>{category.label}</span>
        <span style={{
          fontSize: 10, fontWeight: 700,
          color: allSelected ? category.color : fvStyles.fgSec,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {allSelected ? 'All' : noneSelected ? 'None' : `${selectedCount}/${types.length}`}
        </span>
      </button>
      <div style={{ paddingLeft: 6 }}>
        {types.map(type => {
          const active = filters.categories.has(category.id) && filters.types.has(type);
          const label = (window.ACTIVITY_TYPE_LABELS || {})[type] || type;
          return (
            <button key={type} onClick={() => toggleType(type)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                width: '100%', padding: '5px 12px 5px 14px',
                border: 'none', background: 'transparent',
                cursor: 'pointer', borderRadius: 6,
                fontFamily: 'inherit', textAlign: 'left',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = fvStyles.hover}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 14, height: 14, borderRadius: 3,
                border: `1.5px solid ${active ? category.color : fvStyles.border}`,
                background: active ? category.color : '#fff',
                color: '#fff', fontSize: 9, lineHeight: 1, fontWeight: 900,
                flexShrink: 0,
              }}>{active ? '✓' : ''}</span>
              <span style={{ fontSize: 12.5, color: fvStyles.plum, fontWeight: active ? 600 : 500 }}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DropdownChip({ label, selectedCount, total, icon, children }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const partial = selectedCount < total && selectedCount > 0;
  const none = selectedCount === 0;
  return (
    <>
      <button
        ref={ref}
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          height: 30, padding: '0 10px',
          fontSize: 12, fontWeight: partial ? 700 : 500, fontFamily: 'inherit',
          borderRadius: 999,
          border: `1px ${none ? 'dashed' : 'solid'} ${partial ? fvStyles.plum : fvStyles.border}`,
          background: partial ? '#fff' : fvStyles.raised,
          color: fvStyles.plum, cursor: 'pointer',
        }}>
        {icon}
        {label}
        {partial && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            minWidth: 16, height: 16, padding: '0 5px', borderRadius: 999,
            background: fvStyles.plum, color: '#fff',
            fontSize: 9, fontWeight: 800, letterSpacing: 0,
            fontVariantNumeric: 'tabular-nums',
          }}>{selectedCount}</span>
        )}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
          <path d="M2 3.5 L5 7 L8 3.5" />
        </svg>
      </button>
      <Popover open={open} onClose={() => setOpen(false)} anchorRef={ref} width={260}>
        {children}
      </Popover>
    </>
  );
}

// Reusable menu body w/ title + all/none + checklist
function ChecklistMenu({ title, options, selected, onToggle, onAll, onNone, renderPrefix, extraActions }) {
  const [q, setQ] = React.useState('');
  const filtered = options.filter(o => !q || (o.label + ' ' + (o.sublabel || '')).toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 12px 6px',
      }}>
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
          color: fvStyles.fgSec, textTransform: 'uppercase',
        }}>{title}</span>
        <div style={{ display: 'flex', gap: 8, fontSize: 11, alignItems: 'center' }}>
          {(extraActions || []).map((a, i) => (
            <React.Fragment key={i}>
              <button onClick={a.onClick} style={{ ...menuLinkStyle, color: fvStyles.plum }}>{a.label}</button>
              <span style={{ color: fvStyles.fgMut }}>·</span>
            </React.Fragment>
          ))}
          <button onClick={onAll} style={menuLinkStyle}>All</button>
          <span style={{ color: fvStyles.fgMut }}>·</span>
          <button onClick={onNone} style={menuLinkStyle}>None</button>
        </div>
      </div>
      {options.length > 6 && (
        <div style={{ padding: '0 10px 6px' }}>
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            style={{
              width: '100%', padding: '6px 10px', fontSize: 12,
              border: `1px solid ${fvStyles.borderSub}`, borderRadius: 6,
              fontFamily: 'inherit', outline: 'none', color: fvStyles.plum,
              background: fvStyles.raised,
            }}
          />
        </div>
      )}
      <div style={{ maxHeight: 280, overflowY: 'auto', padding: '2px 4px 8px' }}>
        {filtered.map(opt => (
          <ChecklistRow
            key={opt.id}
            active={selected.has(opt.id)}
            onClick={() => onToggle(opt.id)}
            label={
              renderPrefix ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  {renderPrefix(opt)} <span>{opt.label}</span>
                </span>
              ) : opt.label
            }
            color={opt.color}
            dot={opt.dotStyle || 'square'}
            trailing={opt.sublabel}
          />
        ))}
      </div>
    </div>
  );
}

const menuLinkStyle = {
  fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
  background: 'transparent', border: 'none', padding: 0,
  color: fvStyles.plum, cursor: 'pointer', textDecoration: 'underline',
  textUnderlineOffset: 2,
};











// ============================================================================
// Top-level FilterBar — the chip rail + saved-view tabs + Cmd+K command bar.
// ============================================================================

function FilterBar({
  filters, onToggle, onToggleMany, onReset, setText,
  savedView, onSavedView,
  scope,
}) {
  const [cmdOpen, setCmdOpen] = React.useState(false);
  const onOpenCmd = () => setCmdOpen(true);

  return (
    <>
      <SavedViewTabs savedView={savedView} onSavedView={onSavedView} />

      <div style={{ padding: '0 24px' }}>
        <ChipRailFilterBar
          filters={filters} onToggle={onToggle} onToggleMany={onToggleMany}
          onReset={onReset} scope={scope} onOpenCmd={onOpenCmd}
        />
      </div>

      <CommandBar
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        filters={filters}
        setText={setText}
        toggle={onToggle}
        onJumpToView={onOpenCmd}
      />
    </>
  );
}


function VariantSwitcher({ variant, onChange, position }) {
  const variants = [
    { id: 'rail',  label: 'Rail' },
    { id: 'bar',   label: 'Bar' },
    { id: 'chips', label: 'Chips' },
  ];
  const isInline = position === 'inline';
  const wrap = isInline ? {} : {
    position: 'fixed', bottom: 16, left: 16, zIndex: 90,
    background: '#fff', border: '1px solid #D4CFE2', borderRadius: 999,
    boxShadow: '0 4px 12px rgba(64,55,112,0.12)',
    padding: 3,
  };
  return (
    <div style={{ display: 'inline-flex', gap: 2, ...wrap }}>
      {variants.map(v => {
        const on = v.id === variant;
        return (
          <button key={v.id} onClick={() => onChange(v.id)}
            style={{
              fontFamily: 'inherit', fontSize: 11, fontWeight: 600,
              padding: '5px 10px', borderRadius: 999, border: 'none',
              background: on ? '#403770' : 'transparent',
              color: on ? '#fff' : '#6E6390', cursor: 'pointer',
            }}>{v.label}</button>
        );
      })}
    </div>
  );
}

// VariantFilters = FilterBar under a different name (alias for App)
const VariantFilters = FilterBar;

Object.assign(window, {
  FilterBar, VariantFilters, VariantSwitcher, activeCount,
});
