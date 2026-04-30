/* global React */
// ActivityDetail.jsx — editable right-side drawer for activity details
// Tabs: Overview · Outcome · Notes · Expenses · Attachments


// Seed mock data per-activity so the demo feels real
const SEED_CACHE = {};
function seedFor(activity) {
  if (SEED_CACHE[activity.id]) return SEED_CACHE[activity.id];
  const seeds = {
    notes: activity.id.charCodeAt(0) % 2 === 0 ? [
      { id: 'n_seed1', author: 'Alex Rivera', body: 'Principal Ortiz wants to see the adaptive-math rollout numbers from Riverside before committing. Pulling last-year lift data tonight.', createdAt: new Date(Date.now() - 86400000 * 2).toISOString() },
    ] : [],
    expenses: activity.type === 'lunch' || activity.type === 'dinner' ? [
      { id: 'e_seed1', category: 'meals', amount: 87.40, description: 'Lunch with district team', date: new Date().toISOString().slice(0,10), receipt: 'IMG_2480.jpg' },
    ] : activity.type === 'school_visit' || activity.type === 'campus_visit' ? [
      { id: 'e_seed1', category: 'travel', amount: 42.15, description: 'Mileage + parking', date: new Date().toISOString().slice(0,10), receipt: null },
    ] : [],
    attachments: [],
    outcome: activity.status === 'completed' ? { outcome: 'completed', sentiment: 'positive', nextStep: '', followUp: '', dealImpact: 'progressed' } : null,
  };
  SEED_CACHE[activity.id] = seeds;
  return seeds;
}

function ActivityDetail({ activity, onClose, onSave }) {
  if (!activity) return null;
  const T = window.DRAWER_TOKENS;
  const cat = window.ACTIVITY_CATEGORY[activity.type] || 'meeting';
  const style = window.CATEGORY_STYLE[cat];
  const readOnly = !activity.mine;

  // Draft state — everything the user can edit
  const seed = React.useMemo(() => seedFor(activity), [activity.id]);
  const [draft, setDraft] = React.useState(() => ({
    title: activity.title,
    type: activity.type,
    status: activity.status,
    start: activity.start,
    durationMin: activity.durationMin,
    district: activity.district || '',
    attendee: activity.attendee || '',
    description: activity.description || '',
    outcome: seed.outcome,
    notes: seed.notes,
    expenses: seed.expenses,
    attachments: seed.attachments,
  }));
  const [dirty, setDirty] = React.useState(false);
  const [tab, setTab] = React.useState('overview');
  const [savedFlash, setSavedFlash] = React.useState(false);

  const patch = (p) => { setDraft(d => ({ ...d, ...p })); setDirty(true); };

  const endTime = new Date(new Date(draft.start).getTime() + (draft.durationMin || 0) * 60000);
  // Format date for datetime-local input in local wall-clock time (no UTC drift)
  const toLocalISO = (d) => {
    const dt = new Date(d);
    const pad = (n) => String(n).padStart(2, '0');
    return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  };

  const statusOptions = [
    { id: 'planned',     label: 'Planned',     dot: '#C2BBD4' },
    { id: 'tentative',   label: 'Tentative',   dot: '#FFCF70' },
    { id: 'in_progress', label: 'In progress', dot: '#6EA3BE' },
    { id: 'completed',   label: 'Completed',   dot: '#69B34A' },
    { id: 'cancelled',   label: 'Cancelled',   dot: '#F37167' },
  ];

  const typeOptions = Object.keys(window.ACTIVITY_TYPE_LABELS || {}).map(k => ({
    id: k,
    label: window.ACTIVITY_TYPE_LABELS[k],
    dot: window.CATEGORY_STYLE[window.ACTIVITY_CATEGORY[k] || 'meeting']?.ink || '#6E6390',
  }));

  const handleSave = () => {
    onSave?.(activity.id, draft);
    setDirty(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1400);
  };
  const handleSaveAndLog = () => {
    patch({ status: draft.outcome?.outcome === 'completed' ? 'completed' :
            draft.outcome?.outcome === 'cancelled' ? 'cancelled' : draft.status });
    handleSave();
    setTab('overview');
  };

  // Tabs with counts
  const tabs = [
    { id: 'overview',    label: 'Overview' },
    { id: 'outcome',     label: 'Outcome' },
    { id: 'notes',       label: 'Notes',       count: draft.notes.length || null },
    { id: 'expenses',    label: 'Expenses',    count: draft.expenses.length || null },
    { id: 'attachments', label: 'Files',       count: draft.attachments.length || null },
  ];

  return (
    <>
      <div onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(64,55,112,0.35)',
          zIndex: 50, animation: 'fadeIn 200ms ease-out',
        }} />
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 520,
        background: T.bgWhite, zIndex: 51,
        boxShadow: '-10px 0 30px rgba(64,55,112,0.15)',
        display: 'flex', flexDirection: 'column',
        animation: 'slideIn 250ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        <style>{`
          @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
          @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
          @keyframes flashIn { 0% { opacity: 0; transform: translateY(-4px); } 20% { opacity: 1; transform: translateY(0);} 80% { opacity: 1; } 100% { opacity: 0; } }
        `}</style>

        {/* Header */}
        <div style={{
          position: 'relative',
          padding: '16px 20px 14px',
          background: T.bgSurf,
          borderBottom: `1px solid ${T.border}`,
        }}>
          {/* Color strip for category */}
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
            background: style.ink,
          }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <window.EditableSelect
                  value={draft.type}
                  options={typeOptions}
                  onChange={(v) => patch({ type: v })}
                  readOnly={readOnly}
                  renderValue={(o) => (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '2px 2px',
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.06em',
                      textTransform: 'uppercase', color: style.ink,
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: 999, background: style.ink }} />
                      {o?.label}
                    </span>
                  )}
                />
                {readOnly && (
                  <span style={{
                    fontSize: 10, fontWeight: 600, color: T.inkSub,
                    padding: '2px 8px', borderRadius: 999,
                    background: T.bgHover, marginLeft: 'auto',
                  }}>Read-only · team activity</span>
                )}
              </div>
              <window.EditableText
                value={draft.title}
                onChange={(v) => patch({ title: v })}
                placeholder="Add a title"
                readOnly={readOnly}
                size={20} weight={700}
                style={{ color: T.plum, letterSpacing: '-0.01em', lineHeight: 1.2, whiteSpace: 'normal', overflow: 'visible' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button title="More"
                style={iconBtn(T)}>
                <window.MoreIcon size={16} />
              </button>
              <button onClick={onClose} title="Close"
                style={iconBtn(T)}>
                <window.XIcon size={16} />
              </button>
            </div>
          </div>

          {/* When + Where summary inline */}
          <div style={{
            marginTop: 12, display: 'flex', alignItems: 'center', flexWrap: 'wrap',
            gap: 14, fontSize: 12, color: T.inkBody,
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <window.ClockIcon size={12} style={{ color: T.inkSub }} />
              <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                {new Date(draft.start).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} ·
                {' '}{window.fmtTime(new Date(draft.start))}–{window.fmtTime(endTime)}
              </span>
            </span>
            {draft.district && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <window.MapPinIcon size={12} style={{ color: T.inkSub }} />
                <span style={{ fontWeight: 500 }}>{draft.district}</span>
              </span>
            )}
            {activity.owner && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                {window.getTeammate(activity.owner) && !window.getTeammate(activity.owner).group ? (
                  <>
                    <window.TeammateAvatar owner={activity.owner} size={16} />
                    <span style={{ fontWeight: 500 }}>{window.getTeammate(activity.owner).name}</span>
                  </>
                ) : <span style={{ fontWeight: 500 }}>{activity.owner}</span>}
              </span>
            )}
          </div>
        </div>

        {/* Tabs */}
        <window.TabBar tabs={tabs} active={tab} onChange={setTab} />

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px 24px' }} className="fm-scrollbar">
          {tab === 'overview' && (
            <OverviewTab draft={draft} patch={patch} readOnly={readOnly} statusOptions={statusOptions} activity={activity} />
          )}
          {tab === 'outcome' && (
            <window.OutcomePanel
              value={draft.outcome || { outcome: 'completed', sentiment: 'neutral' }}
              onChange={(v) => patch({ outcome: v })}
              readOnly={readOnly}
            />
          )}
          {tab === 'notes' && (
            <window.NotesPanel
              notes={draft.notes}
              onAdd={(n) => patch({ notes: [n, ...draft.notes] })}
              onDelete={(id) => patch({ notes: draft.notes.filter(x => x.id !== id) })}
              readOnly={readOnly}
            />
          )}
          {tab === 'expenses' && (
            <window.ExpensesPanel
              expenses={draft.expenses}
              onChange={(v) => patch({ expenses: v })}
              readOnly={readOnly}
            />
          )}
          {tab === 'attachments' && (
            <window.AttachmentsPanel
              attachments={draft.attachments}
              onChange={(v) => patch({ attachments: v })}
              readOnly={readOnly}
            />
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px', borderTop: `1px solid ${T.border}`,
          display: 'flex', alignItems: 'center', gap: 8,
          background: T.bgWhite,
        }}>
          {!readOnly && (
            <button onClick={() => {/* delete flow */}}
              style={{
                fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
                padding: '7px 10px', borderRadius: 6,
                border: 'none', background: 'transparent', color: T.inkSub,
                cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = T.coralSoft; e.currentTarget.style.color = T.coral; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = T.inkSub; }}
            >
              <window.TrashIcon size={13} /> Delete
            </button>
          )}

          {/* Status indicator in footer */}
          {savedFlash && (
            <span style={{
              fontSize: 11, color: T.mintInk, fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 4,
              animation: 'flashIn 1400ms ease-out',
            }}>
              <window.CheckCircleIcon size={12} style={{ color: T.mintDot }} /> Saved
            </span>
          )}
          {dirty && !savedFlash && (
            <span style={{
              fontSize: 11, color: T.goldInk, fontWeight: 600,
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: 999, background: T.goldDot }} />
              Unsaved changes
            </span>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={btnGhostFoot(T)}>Close</button>
            {!readOnly && (
              <>
                <button onClick={handleSave} disabled={!dirty}
                  style={{ ...btnSecondaryFoot(T), opacity: dirty ? 1 : 0.5, cursor: dirty ? 'pointer' : 'not-allowed' }}>
                  Save
                </button>
                <button onClick={handleSaveAndLog} style={btnPrimaryFoot(T)}>
                  <window.CheckIcon size={13} /> Save & log outcome
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// OverviewTab — the editable details form
// ────────────────────────────────────────────────────────────────────────────
function OverviewTab({ draft, patch, readOnly, statusOptions, activity }) {
  const T = window.DRAWER_TOKENS;
  const pad = (n) => String(n).padStart(2, '0');
  const d0 = new Date(draft.start);
  const dateISO = `${d0.getFullYear()}-${pad(d0.getMonth()+1)}-${pad(d0.getDate())}T${pad(d0.getHours())}:${pad(d0.getMinutes())}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Status pill row */}
      <div>
        <window.FieldLabel>Status</window.FieldLabel>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {statusOptions.map(s => {
            const on = s.id === draft.status;
            return (
              <button key={s.id}
                onClick={() => !readOnly && patch({ status: s.id })}
                disabled={readOnly}
                style={{
                  fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
                  padding: '5px 10px 5px 8px', borderRadius: 999,
                  border: `1px solid ${on ? T.plum : T.border}`,
                  background: on ? T.plum : T.bgWhite,
                  color: on ? T.bgWhite : T.inkBody,
                  cursor: readOnly ? 'default' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  transition: 'all 120ms',
                }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: on ? T.bgWhite : s.dot }} />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* When — date + duration */}
      <div>
        <window.FieldLabel>When</window.FieldLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 8 }}>
          <input
            type="datetime-local"
            disabled={readOnly}
            value={dateISO}
            onChange={(e) => patch({ start: new Date(e.target.value) })}
            style={{
              fontFamily: 'inherit', fontSize: 13,
              padding: '7px 10px', borderRadius: 6,
              border: `1px solid ${T.borderMid}`, background: T.bgWhite, color: T.ink,
              boxSizing: 'border-box',
            }}
          />
          <div style={{ position: 'relative' }}>
            <input
              type="number"
              disabled={readOnly}
              value={draft.durationMin}
              min="15" step="15"
              onChange={(e) => patch({ durationMin: Number(e.target.value) })}
              style={{
                width: '100%', fontFamily: 'inherit', fontSize: 13,
                padding: '7px 30px 7px 10px', borderRadius: 6,
                border: `1px solid ${T.borderMid}`, background: T.bgWhite, color: T.ink,
                fontVariantNumeric: 'tabular-nums', boxSizing: 'border-box',
              }}
            />
            <span style={{
              position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              fontSize: 11, color: T.inkMuted, pointerEvents: 'none',
            }}>min</span>
          </div>
        </div>
      </div>

      {/* Where */}
      <div>
        <window.FieldLabel>Where</window.FieldLabel>
        <window.EditableText
          value={draft.district}
          onChange={(v) => patch({ district: v })}
          placeholder="Add district, school, or address"
          readOnly={readOnly}
          size={13} weight={500}
        />
      </div>

      {/* Attendees */}
      <div>
        <window.FieldLabel>Attendees</window.FieldLabel>
        <window.EditableText
          value={draft.attendee}
          onChange={(v) => patch({ attendee: v })}
          placeholder="Add names, titles"
          readOnly={readOnly}
          size={13} weight={500}
        />
      </div>

      {/* Description — multiline */}
      <div>
        <window.FieldLabel optional>Description</window.FieldLabel>
        <window.EditableText
          value={draft.description}
          onChange={(v) => patch({ description: v })}
          placeholder="Add agenda, context, meeting goals…"
          readOnly={readOnly}
          multiline
          size={13} weight={400}
        />
      </div>

      {/* Quick-link preview strip */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
        padding: 12, borderRadius: 10,
        background: T.bgSurf, border: `1px solid ${T.border}`,
      }}>
        <Mini label="Notes" value={draft.notes.length} icon={<window.FileEditIcon size={14} />} />
        <Mini label="Expenses" value={`$${draft.expenses.reduce((s,e) => s + Number(e.amount||0), 0).toFixed(0)}`} icon={<window.DollarIcon size={14} />} />
        <Mini label="Files" value={draft.attachments.length} icon={<window.PaperclipIcon size={14} />} />
      </div>

      {/* Source footnote */}
      <div style={{ fontSize: 11, color: T.inkMuted, display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
        {activity.mine ? 'Your activity · changes sync to Google Calendar' : 'Team activity · read-only'}
      </div>
    </div>
  );
}

function Mini({ label, value, icon }) {
  const T = window.DRAWER_TOKENS;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        width: 28, height: 28, borderRadius: 6, flexShrink: 0,
        background: T.bgWhite, color: T.plum, border: `1px solid ${T.border}`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 10, fontWeight: 700, color: T.inkSub, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.ink, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Button / icon-btn factories
// ────────────────────────────────────────────────────────────────────────────
const iconBtn = (T) => ({
  width: 30, height: 30, borderRadius: 6,
  border: `1px solid ${T.border}`, background: T.bgWhite,
  color: T.inkBody, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  transition: 'background 120ms',
});
const btnGhostFoot = (T) => ({
  fontFamily: 'inherit', fontSize: 13, fontWeight: 500,
  padding: '7px 14px', borderRadius: 6,
  border: `1px solid ${T.border}`, background: T.bgWhite, color: T.inkBody, cursor: 'pointer',
});
const btnSecondaryFoot = (T) => ({
  fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
  padding: '7px 14px', borderRadius: 6,
  border: `1px solid ${T.borderMid}`, background: T.bgWhite, color: T.plum, cursor: 'pointer',
});
const btnPrimaryFoot = (T) => ({
  fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
  padding: '7px 14px', borderRadius: 6,
  border: 'none', background: T.plum, color: T.bgWhite, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 6,
});

window.ActivityDetail = ActivityDetail;
