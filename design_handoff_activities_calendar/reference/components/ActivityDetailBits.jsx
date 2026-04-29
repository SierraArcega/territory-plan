/* global React */
// ActivityDetailBits.jsx — shared atoms + sub-panels for the editable drawer


// ────────────────────────────────────────────────────────────────────────────
// Tokens (hard-coded from colors_and_type.css so atoms can be used standalone)
// ────────────────────────────────────────────────────────────────────────────
const T = {
  plum: '#403770', plumDark: '#322a5a',
  ink: '#403770', inkStrong: '#544A78', inkBody: '#6E6390', inkSub: '#8A80A8', inkMuted: '#A69DC0',
  bgWhite: '#FFFFFF', bgSurf: '#FFFCFA', bgRaised: '#F7F5FA', bgHover: '#EFEDF5',
  border: '#E2DEEC', borderMid: '#D4CFE2', borderStrong: '#C2BBD4',
  coral: '#F37167', coralSoft: '#fef1f0',
  mint: '#EDFFE3', mintInk: '#5f665b', mintDot: '#69B34A',
  gold: '#FFCF70', goldSoft: '#fffaf1', goldInk: '#997c43', goldDot: '#FFCF70',
  sky: '#C4E7E6', skyInk: '#4d7285', skyDot: '#6EA3BE',
};

// ────────────────────────────────────────────────────────────────────────────
// Inline field label (matches Field pattern from v1)
// ────────────────────────────────────────────────────────────────────────────
function FieldLabel({ children, optional, hint }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
      marginBottom: 6,
    }}>
      <span style={{
        fontSize: 10, fontWeight: 700, color: T.inkSub,
        letterSpacing: '0.08em', textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}>{children}{optional && <span style={{ color: T.inkMuted, marginLeft: 6, fontWeight: 500, whiteSpace: 'nowrap' }}>optional</span>}</span>
      {hint && <span style={{ fontSize: 10, color: T.inkMuted }}>{hint}</span>}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// EditableText — in-place editable value. Click opens input; blur commits.
// ────────────────────────────────────────────────────────────────────────────
function EditableText({ value, onChange, placeholder, readOnly, multiline, style, weight = 500, size = 14 }) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(value || '');
  const ref = React.useRef(null);

  React.useEffect(() => { setDraft(value || ''); }, [value]);
  React.useEffect(() => { if (editing && ref.current) { ref.current.focus(); ref.current.select?.(); } }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onChange?.(draft);
  };

  if (editing && !readOnly) {
    const Tag = multiline ? 'textarea' : 'input';
    return (
      <Tag
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !multiline) { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { setDraft(value || ''); setEditing(false); }
        }}
        rows={multiline ? 3 : undefined}
        placeholder={placeholder}
        style={{
          width: '100%', fontFamily: 'inherit',
          fontSize: size, fontWeight: weight, color: T.ink,
          padding: multiline ? '8px 10px' : '6px 8px',
          border: `1px solid ${T.borderMid}`, borderRadius: 6,
          background: T.bgWhite, outline: `2px solid ${T.coral}`, outlineOffset: -1,
          resize: multiline ? 'vertical' : 'none',
          lineHeight: multiline ? 1.5 : 1.3,
          boxSizing: 'border-box',
          ...style,
        }}
      />
    );
  }

  const empty = !value;
  return (
    <div
      onClick={() => !readOnly && setEditing(true)}
      style={{
        padding: multiline ? '8px 10px' : '6px 8px',
        margin: '-6px -8px',
        borderRadius: 6,
        cursor: readOnly ? 'default' : 'text',
        fontSize: size, fontWeight: weight,
        color: empty ? T.inkMuted : T.ink,
        fontStyle: empty ? 'italic' : 'normal',
        transition: 'background 120ms',
        lineHeight: multiline ? 1.5 : 1.3,
        whiteSpace: multiline ? 'pre-wrap' : 'nowrap',
        overflow: multiline ? 'visible' : 'hidden',
        textOverflow: 'ellipsis',
        ...style,
      }}
      onMouseEnter={(e) => !readOnly && (e.currentTarget.style.background = T.bgHover)}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {empty ? placeholder : value}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// EditableSelect — click to open dropdown, brand-styled
// ────────────────────────────────────────────────────────────────────────────
function EditableSelect({ value, options, onChange, readOnly, renderValue }) {
  const [open, setOpen] = React.useState(false);
  const current = options.find(o => o.id === value) || options[0];
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => !readOnly && setOpen(o => !o)}
        disabled={readOnly}
        style={{
          fontFamily: 'inherit', fontSize: 13, fontWeight: 500, color: T.ink,
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 10px', borderRadius: 6,
          border: `1px solid ${T.borderMid}`, background: T.bgWhite,
          cursor: readOnly ? 'default' : 'pointer',
        }}
      >
        {renderValue ? renderValue(current) : current?.label}
        {!readOnly && <window.ChevronDownIcon size={12} style={{ color: T.inkSub }} />}
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 61, minWidth: '100%',
            background: T.bgWhite, border: `1px solid ${T.borderMid}`, borderRadius: 8,
            boxShadow: '0 10px 15px -3px rgba(64,55,112,0.10)',
            padding: 4,
          }}>
            {options.map(o => (
              <button key={o.id}
                onClick={() => { onChange?.(o.id); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', textAlign: 'left', fontFamily: 'inherit',
                  fontSize: 13, padding: '7px 10px', borderRadius: 6,
                  border: 'none', background: o.id === value ? T.bgHover : 'transparent',
                  color: T.ink, cursor: 'pointer', whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = T.bgHover}
                onMouseLeave={(e) => e.currentTarget.style.background = o.id === value ? T.bgHover : 'transparent'}
              >
                {o.dot && <span style={{ width: 8, height: 8, borderRadius: 999, background: o.dot }} />}
                {o.label}
                {o.id === value && <window.CheckIcon size={14} style={{ marginLeft: 'auto', color: T.plum }} />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Tab bar
// ────────────────────────────────────────────────────────────────────────────
function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{
      display: 'flex', gap: 0, borderBottom: `1px solid ${T.border}`,
      padding: '0 20px',
    }}>
      {tabs.map(t => {
        const on = t.id === active;
        return (
          <button key={t.id} onClick={() => onChange(t.id)}
            style={{
              fontFamily: 'inherit',
              padding: '10px 2px', marginRight: 18,
              fontSize: 12, fontWeight: 600, letterSpacing: '0.02em',
              color: on ? T.plum : T.inkSub,
              background: 'transparent', border: 'none',
              borderBottom: `2px solid ${on ? T.coral : 'transparent'}`,
              cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              transition: 'color 120ms, border-color 120ms',
            }}>
            {t.label}
            {t.count != null && (
              <span style={{
                fontSize: 10, fontWeight: 700,
                padding: '1px 6px', borderRadius: 999,
                background: on ? T.plum : T.bgHover,
                color: on ? T.bgWhite : T.inkSub,
                minWidth: 16, textAlign: 'center',
              }}>{t.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// OutcomePanel — status pills, follow-up date, decision chips
// ────────────────────────────────────────────────────────────────────────────
const OUTCOME_OPTIONS = [
  { id: 'completed',   label: 'Completed',     dot: '#69B34A', desc: 'Activity happened as planned' },
  { id: 'no_show',     label: 'No-show',       dot: '#FFCF70', desc: 'Attendee missed the meeting' },
  { id: 'rescheduled', label: 'Rescheduled',   dot: '#6EA3BE', desc: 'Moved to another date' },
  { id: 'cancelled',   label: 'Cancelled',     dot: '#F37167', desc: 'Will not happen' },
];
const SENTIMENT_OPTIONS = [
  { id: 'positive',  label: 'Positive',  icon: '👍', tint: T.mint,      ink: T.mintInk },
  { id: 'neutral',   label: 'Neutral',   icon: '—',  tint: T.bgRaised,  ink: T.inkBody },
  { id: 'negative',  label: 'Negative',  icon: '👎', tint: T.coralSoft, ink: '#c25a52' },
];

function OutcomePanel({ value, onChange, readOnly }) {
  const outcome = value?.outcome || 'completed';
  const sentiment = value?.sentiment || 'neutral';
  const patch = (p) => onChange?.({ ...value, ...p });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <FieldLabel>Outcome</FieldLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {OUTCOME_OPTIONS.map(o => {
            const on = o.id === outcome;
            return (
              <button key={o.id}
                onClick={() => !readOnly && patch({ outcome: o.id })}
                disabled={readOnly}
                style={{
                  fontFamily: 'inherit', textAlign: 'left',
                  padding: '10px 12px', borderRadius: 8,
                  border: `1px solid ${on ? T.plum : T.border}`,
                  background: on ? T.bgRaised : T.bgWhite,
                  cursor: readOnly ? 'default' : 'pointer',
                  transition: 'all 120ms',
                  boxShadow: on ? 'inset 0 0 0 1px ' + T.plum : 'none',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 999, background: o.dot }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>{o.label}</span>
                </div>
                <div style={{ fontSize: 11, color: T.inkSub, marginTop: 3, lineHeight: 1.4 }}>{o.desc}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <FieldLabel>How did it go?</FieldLabel>
        <div style={{ display: 'flex', gap: 6 }}>
          {SENTIMENT_OPTIONS.map(s => {
            const on = s.id === sentiment;
            return (
              <button key={s.id}
                onClick={() => !readOnly && patch({ sentiment: s.id })}
                disabled={readOnly}
                style={{
                  flex: 1, fontFamily: 'inherit',
                  padding: '8px 10px', borderRadius: 8,
                  border: `1px solid ${on ? T.plum : T.border}`,
                  background: on ? s.tint : T.bgWhite,
                  color: on ? s.ink : T.inkBody,
                  fontSize: 12, fontWeight: on ? 600 : 500,
                  cursor: readOnly ? 'default' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'all 120ms',
                }}>
                <span style={{ fontSize: 14 }}>{s.icon}</span>
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <FieldLabel optional>Next step</FieldLabel>
        <window.EditableText
          value={value?.nextStep}
          onChange={(v) => patch({ nextStep: v })}
          placeholder="e.g. Send proposal by Friday"
          readOnly={readOnly}
          multiline
          size={13}
          weight={400}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <FieldLabel optional>Follow-up by</FieldLabel>
          <input
            type="date"
            disabled={readOnly}
            value={value?.followUp || ''}
            onChange={(e) => patch({ followUp: e.target.value })}
            style={{
              width: '100%', fontFamily: 'inherit', fontSize: 13,
              padding: '6px 8px', borderRadius: 6,
              border: `1px solid ${T.borderMid}`, background: T.bgWhite, color: T.ink,
              boxSizing: 'border-box',
            }}
          />
        </div>
        <div>
          <FieldLabel optional>Deal impact</FieldLabel>
          <window.EditableSelect
            value={value?.dealImpact || 'none'}
            readOnly={readOnly}
            options={[
              { id: 'none',        label: 'No change',    dot: '#D4CFE2' },
              { id: 'progressed',  label: 'Progressed',   dot: '#6EA3BE' },
              { id: 'created',     label: 'New opp',      dot: '#8AA891' },
              { id: 'won',         label: 'Won',          dot: '#69B34A' },
              { id: 'lost',        label: 'Lost',         dot: '#F37167' },
            ]}
            onChange={(v) => patch({ dealImpact: v })}
          />
        </div>
      </div>
    </div>
  );
}

Object.assign(window, {
  DRAWER_TOKENS: T,
  FieldLabel, EditableText, EditableSelect, TabBar, OutcomePanel,
  OUTCOME_OPTIONS, SENTIMENT_OPTIONS,
});
