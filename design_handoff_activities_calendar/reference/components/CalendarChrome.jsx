/* global React */
// CalendarChrome.jsx — top chrome: segmented view toggle, scope filter, chip filters



function ViewToggle({ view, onChange }) {
  const views = [
    { id: 'month', label: 'Month' },
    { id: 'week', label: 'Week' },
    { id: 'schedule', label: 'Schedule' },
    { id: 'map', label: 'Map' },
  ];
  return (
    <div style={{
      display: 'inline-flex', padding: 3, borderRadius: 10,
      background: '#EFEDF5', border: '1px solid #E2DEEC',
    }}>
      {views.map(v => {
        const active = view === v.id;
        return (
          <button key={v.id} onClick={() => onChange(v.id)}
            style={{
              padding: '6px 14px', fontSize: 13, fontWeight: active ? 600 : 500,
              fontFamily: 'inherit',
              borderRadius: 7, border: 'none',
              background: active ? '#fff' : 'transparent',
              color: active ? '#403770' : '#6E6390',
              boxShadow: active ? '0 1px 2px rgba(64,55,112,0.08)' : 'none',
              cursor: 'pointer',
              transition: 'all 120ms ease-out',
            }}>{v.label}</button>
        );
      })}
    </div>
  );
}

function ScopeToggle({ scope, onChange }) {
  const opts = [
    { id: 'mine', label: 'My activities' },
    { id: 'all',  label: 'All of Fullmind' },
  ];
  return (
    <div style={{
      display: 'inline-flex', padding: 3, borderRadius: 10,
      background: '#FFFCFA', border: '1px solid #D4CFE2',
    }}>
      {opts.map(o => {
        const active = scope === o.id;
        return (
          <button key={o.id} onClick={() => onChange(o.id)}
            style={{
              padding: '6px 12px', fontSize: 12, fontWeight: active ? 600 : 500,
              fontFamily: 'inherit',
              borderRadius: 7, border: 'none',
              background: active ? '#403770' : 'transparent',
              color: active ? '#fff' : '#544A78',
              cursor: 'pointer',
              transition: 'all 120ms ease-out',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
            <span style={{
              width: 6, height: 6, borderRadius: 999,
              background: active ? (o.id === 'all' ? '#FFCF70' : '#F37167') : '#A69DC0',
            }} />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function CategoryLegend({ filters, onToggle }) {
  const items = [
    { id: 'meeting',  label: 'Meetings', color: '#6EA3BE' },
    { id: 'event',    label: 'Events', color: '#F37167' },
    { id: 'campaign', label: 'Campaigns', color: '#403770' },
    { id: 'fun',      label: 'Moments', color: '#FFCF70' },
  ];
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {items.map(it => {
        const active = filters.has(it.id);
        return (
          <button key={it.id} onClick={() => onToggle(it.id)}
            style={{
              padding: '4px 10px', fontSize: 12, fontWeight: 500,
              fontFamily: 'inherit',
              borderRadius: 999, border: `1px solid ${active ? it.color : '#D4CFE2'}`,
              background: active ? '#fff' : '#F7F5FA',
              color: active ? '#403770' : '#8A80A8',
              cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
              transition: 'all 120ms ease-out',
              opacity: active ? 1 : 0.6,
            }}>
            <span style={{
              width: 8, height: 8, borderRadius: 2,
              background: it.color,
            }} />
            {it.label}
          </button>
        );
      })}
    </div>
  );
}

function DateNav({ currentDate, onPrev, onNext, onToday, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button onClick={onToday}
        style={{
          padding: '6px 12px', fontSize: 12, fontWeight: 600,
          fontFamily: 'inherit', letterSpacing: '0.04em', textTransform: 'uppercase',
          borderRadius: 8, border: '1px solid #D4CFE2', background: '#fff',
          color: '#403770', cursor: 'pointer',
        }}>Today</button>
      <div style={{ display: 'inline-flex', gap: 2 }}>
        <button onClick={onPrev}
          style={{
            width: 32, height: 32, borderRadius: 8, border: '1px solid #D4CFE2',
            background: '#fff', color: '#544A78', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <window.ChevronLeftIcon size={16} />
        </button>
        <button onClick={onNext}
          style={{
            width: 32, height: 32, borderRadius: 8, border: '1px solid #D4CFE2',
            background: '#fff', color: '#544A78', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>
          <window.ChevronRightIcon size={16} />
        </button>
      </div>
      <h2 style={{
        margin: 0, fontSize: 22, fontWeight: 700, color: '#403770',
        letterSpacing: '-0.01em',
      }}>{label}</h2>
    </div>
  );
}

// ============================================================================
// Unified date range selector — replaces DateNav + separate granularity toggle
// Grain = day | week | month | quarter
// ============================================================================
function DateRangeSelector({ grain, onGrainChange, label, onPrev, onNext, onToday }) {
  const grains = [
    { id: 'day',     label: 'Day' },
    { id: 'week',    label: 'Week' },
    { id: 'month',   label: 'Month' },
    { id: 'quarter', label: 'Quarter' },
  ];
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 0,
      borderRadius: 10, border: '1px solid #D4CFE2', background: '#fff',
      padding: 3,
    }}>
      {/* Today */}
      <button onClick={onToday}
        style={{
          padding: '4px 10px', fontSize: 11, fontWeight: 700,
          fontFamily: 'inherit', letterSpacing: '0.06em', textTransform: 'uppercase',
          borderRadius: 7, border: 'none', background: 'transparent',
          color: '#403770', cursor: 'pointer',
        }}>Today</button>

      <span style={{ width: 1, height: 20, background: '#E2DEEC' }} />

      {/* Nav */}
      <button onClick={onPrev}
        style={{
          width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent',
          color: '#544A78', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = '#EFEDF5'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <window.ChevronLeftIcon size={16} />
      </button>

      {/* Label */}
      <div style={{
        minWidth: 200, maxWidth: 320,
        padding: '0 10px', fontSize: 14, fontWeight: 700, color: '#403770',
        letterSpacing: '-0.005em', textAlign: 'center',
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{label}</div>

      <button onClick={onNext}
        style={{
          width: 28, height: 28, borderRadius: 6, border: 'none', background: 'transparent',
          color: '#544A78', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = '#EFEDF5'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <window.ChevronRightIcon size={16} />
      </button>

      <span style={{ width: 1, height: 20, background: '#E2DEEC' }} />

      {/* Granularity segmented */}
      <div style={{
        display: 'inline-flex', padding: 2, borderRadius: 7,
        background: '#F7F5FA', marginLeft: 3,
      }}>
        {grains.map(g => {
          const active = grain === g.id;
          return (
            <button key={g.id} onClick={() => onGrainChange(g.id)}
              style={{
                padding: '4px 10px', fontSize: 11, fontWeight: active ? 700 : 500,
                fontFamily: 'inherit',
                borderRadius: 5, border: 'none',
                background: active ? '#fff' : 'transparent',
                color: active ? '#403770' : '#6E6390',
                boxShadow: active ? '0 1px 2px rgba(64,55,112,0.08)' : 'none',
                cursor: 'pointer',
                transition: 'all 120ms ease-out',
              }}>{g.label}</button>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { ViewToggle, ScopeToggle, CategoryLegend, DateNav, DateRangeSelector, FilterBar, TeammateAvatar, TeammateAvatarStack, TeammateChip });

// ============================================================================
// FilterBar — unified multi-select filter across categories / deals / status / owners
// Props: filters { categories, dealKinds, statuses, owners }
//        onToggle(group, id), onReset(), scope, teammates (from window.TEAMMATES)
// ============================================================================

const FILTER_CATEGORIES = [
  { id: 'meeting',  label: 'Meetings',  color: '#6EA3BE' },
  { id: 'event',    label: 'Events',    color: '#F37167' },
  { id: 'campaign', label: 'Campaigns', color: '#403770' },
  { id: 'fun',      label: 'Moments',   color: '#FFCF70' },
];

const FILTER_DEAL_KINDS = [
  { id: 'won',        label: 'Won',        color: '#69B34A', glyph: '\u2197' },
  { id: 'lost',       label: 'Lost',       color: '#F37167', glyph: '\u2198' },
  { id: 'created',    label: 'New',        color: '#6EA3BE', glyph: '+' },
  { id: 'progressed', label: 'Progressed', color: '#403770', glyph: '\u2192' },
];

const FILTER_STATUSES = [
  { id: 'planned',     label: 'Planned',      color: '#8A80A8' },
  { id: 'in_progress', label: 'In progress',  color: '#6EA3BE' },
  { id: 'completed',   label: 'Completed',    color: '#69B34A' },
  { id: 'tentative',   label: 'Tentative',    color: '#FFCF70' },
  { id: 'cancelled',   label: 'Cancelled',    color: '#BFB8D4' },
];

function FilterChip({ active, color, onClick, children, dashed = false, dim = false, accent = 'dot', glyph }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '4px 10px', fontSize: 12, fontWeight: active ? 600 : 500,
        fontFamily: 'inherit', lineHeight: 1.3,
        borderRadius: 999,
        border: `1px ${dashed ? 'dashed' : 'solid'} ${active ? color : '#D4CFE2'}`,
        background: active ? '#fff' : '#F7F5FA',
        color: active ? '#403770' : '#8A80A8',
        cursor: 'pointer',
        transition: 'all 120ms ease-out',
        opacity: dim ? 0.55 : (active ? 1 : 0.72),
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = '#fff'; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = '#F7F5FA'; }}
    >
      {accent === 'dot' && (
        <span style={{
          width: 8, height: 8, borderRadius: 2, background: color,
          opacity: active ? 1 : 0.6,
        }} />
      )}
      {accent === 'glyph' && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 14, height: 14, borderRadius: 4,
          background: active ? color : '#E2DEEC',
          color: active ? '#fff' : '#8A80A8',
          fontSize: 10, fontWeight: 800, lineHeight: 1,
        }}>{glyph}</span>
      )}
      {accent === 'bar' && (
        <span style={{
          width: 3, height: 10, borderRadius: 1, background: color,
          opacity: active ? 1 : 0.55,
        }} />
      )}
      {children}
    </button>
  );
}

function FilterGroup({ label, count, total, children, collapsible = false, storageKey }) {
  const [collapsed, setCollapsed] = React.useState(() => {
    if (!collapsible || !storageKey) return false;
    return localStorage.getItem(storageKey) === '1';
  });
  React.useEffect(() => {
    if (collapsible && storageKey) localStorage.setItem(storageKey, collapsed ? '1' : '0');
  }, [collapsed]);

  const partial = count < total;
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
      <button
        onClick={() => collapsible && setCollapsed(c => !c)}
        disabled={!collapsible}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '3px 6px 3px 0',
          fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
          color: partial ? '#403770' : '#8A80A8',
          fontFamily: 'inherit',
          background: 'transparent', border: 'none',
          cursor: collapsible ? 'pointer' : 'default',
        }}
      >
        {collapsible && (
          <span style={{
            display: 'inline-block', width: 10, height: 10,
            transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            transition: 'transform 120ms ease-out',
          }}>
            <svg width="10" height="10" viewBox="0 0 10 10" style={{ display: 'block' }}>
              <path d="M2 3.5 L5 7 L8 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        )}
        <span>{label}</span>
        {partial && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            minWidth: 16, height: 14, padding: '0 4px',
            marginLeft: 2,
            fontSize: 9, fontWeight: 800,
            borderRadius: 999, background: '#403770', color: '#fff',
            letterSpacing: 0,
            fontVariantNumeric: 'tabular-nums',
          }}>{count}/{total}</span>
        )}
      </button>
      {!collapsed && (
        <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4 }}>
          {children}
        </div>
      )}
    </div>
  );
}

function FilterBar({ filters, onToggle, onReset, scope }) {
  const teammates = window.TEAMMATES || {};
  // Owner chips — build list: You first, then teammates (non-you).
  const ownerList = React.useMemo(() => {
    const list = [];
    const seen = new Set();
    for (const key of Object.keys(teammates)) {
      const t = teammates[key];
      if (!t || seen.has(t.name)) continue;
      seen.add(t.name);
      list.push({ id: t.name, label: t.short || t.name, color: t.color, you: !!t.you, initials: t.initials });
    }
    // You first, then alphabetical
    return list.sort((a, b) => {
      if (a.you && !b.you) return -1;
      if (!a.you && b.you) return 1;
      return a.label.localeCompare(b.label);
    });
  }, [scope]);

  const catTotal = FILTER_CATEGORIES.length;
  const dealTotal = FILTER_DEAL_KINDS.length;
  const statusTotal = FILTER_STATUSES.length;
  const ownerTotal = ownerList.length;

  const catCount = FILTER_CATEGORIES.filter(c => filters.categories.has(c.id)).length;
  const dealCount = FILTER_DEAL_KINDS.filter(d => filters.dealKinds.has(d.id)).length;
  const statusCount = FILTER_STATUSES.filter(s => filters.statuses.has(s.id)).length;
  const ownerCount = ownerList.filter(o => filters.owners.has(o.id)).length;

  const anyPartial = (catCount < catTotal) || (dealCount < dealTotal) || (statusCount < statusTotal) || (scope === 'all' && ownerCount < ownerTotal);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 18,
      padding: '8px 0 4px',
      flexWrap: 'wrap',
    }}>
      <FilterGroup label="Activities" count={catCount} total={catTotal}>
        {FILTER_CATEGORIES.map(c => (
          <FilterChip key={c.id}
            active={filters.categories.has(c.id)}
            color={c.color}
            onClick={() => onToggle('categories', c.id)}
          >{c.label}</FilterChip>
        ))}
      </FilterGroup>

      <span style={{ width: 1, height: 20, background: '#E2DEEC' }} />

      <FilterGroup label="Deals" count={dealCount} total={dealTotal}>
        {FILTER_DEAL_KINDS.map(d => (
          <FilterChip key={d.id}
            active={filters.dealKinds.has(d.id)}
            color={d.color}
            accent="glyph"
            glyph={d.glyph}
            onClick={() => onToggle('dealKinds', d.id)}
          >{d.label}</FilterChip>
        ))}
      </FilterGroup>

      <span style={{ width: 1, height: 20, background: '#E2DEEC' }} />

      <FilterGroup label="Status" count={statusCount} total={statusTotal} collapsible storageKey="cal.filter.status.collapsed">
        {FILTER_STATUSES.map(s => (
          <FilterChip key={s.id}
            active={filters.statuses.has(s.id)}
            color={s.color}
            accent="bar"
            onClick={() => onToggle('statuses', s.id)}
          >{s.label}</FilterChip>
        ))}
      </FilterGroup>

      {scope === 'all' && (
        <>
          <span style={{ width: 1, height: 20, background: '#E2DEEC' }} />
          <FilterGroup label="Owners" count={ownerCount} total={ownerTotal} collapsible storageKey="cal.filter.owners.collapsed">
            {ownerList.map(o => {
              const active = filters.owners.has(o.id);
              return (
                <button
                  key={o.id}
                  onClick={() => onToggle('owners', o.id)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '3px 10px 3px 3px', fontSize: 12, fontWeight: active ? 600 : 500,
                    fontFamily: 'inherit',
                    borderRadius: 999,
                    border: `1px solid ${active ? o.color : '#D4CFE2'}`,
                    background: active ? '#fff' : '#F7F5FA',
                    color: active ? '#403770' : '#8A80A8',
                    cursor: 'pointer',
                    transition: 'all 120ms ease-out',
                    opacity: active ? 1 : 0.65,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 18, height: 18, borderRadius: '50%',
                    background: o.color, color: '#fff',
                    fontSize: 9, fontWeight: 700,
                    letterSpacing: 0, lineHeight: 1,
                    filter: active ? 'none' : 'saturate(0.4)',
                  }}>{o.initials}</span>
                  {o.you ? 'Me' : o.label}
                </button>
              );
            })}
          </FilterGroup>
        </>
      )}

      <div style={{ flex: 1 }} />

      {anyPartial && (
        <button onClick={onReset}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '5px 10px', fontSize: 11, fontWeight: 700,
            fontFamily: 'inherit', letterSpacing: '0.04em',
            borderRadius: 7, border: '1px solid #D4CFE2', background: '#fff',
            color: '#544A78', cursor: 'pointer',
          }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M10 4A4 4 0 1 0 10 8" />
            <path d="M10 2.5V4.5H8" />
          </svg>
          Reset filters
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Team overlap visibility — colored avatars for teammates
// ============================================================================

// Single round avatar w/ initials on colored background. Resolves owner string via getTeammate.
function TeammateAvatar({ owner, size = 20, ring = false, title }) {
  const t = window.getTeammate(owner);
  if (!t) return null;
  const fs = Math.max(8, Math.round(size * 0.44));
  return (
    <span
      title={title || t.name}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: size, height: size, borderRadius: '50%',
        background: t.color, color: '#fff',
        fontSize: fs, fontWeight: 700,
        lineHeight: 1, letterSpacing: 0,
        fontFamily: 'inherit',
        flexShrink: 0,
        boxShadow: ring ? `0 0 0 1.5px #fff, 0 0 0 2.5px ${t.color}33` : 'none',
        border: ring ? '1.5px solid #fff' : 'none',
        userSelect: 'none',
      }}>
      {t.initials}
    </span>
  );
}

// Overlapping avatar row. Items = owner strings (duplicates are de-duped by resolved name).
// Caps at `max`; overflow shows "+N" chip.
function TeammateAvatarStack({ owners, size = 18, max = 4, includeYou = false }) {
  const seen = new Map();
  for (const o of owners || []) {
    const t = window.getTeammate(o);
    if (!t) continue;
    if (!includeYou && t.you) continue;
    if (!seen.has(t.name)) seen.set(t.name, t);
  }
  const list = Array.from(seen.values());
  if (list.length === 0) return null;
  const visible = list.slice(0, max);
  const overflow = list.length - visible.length;
  const overlap = Math.round(size * 0.33);
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center' }}>
      {visible.map((t, i) => (
        <span
          key={t.name}
          title={t.name}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: size, height: size, borderRadius: '50%',
            background: t.color, color: '#fff',
            fontSize: Math.max(8, Math.round(size * 0.44)), fontWeight: 700,
            lineHeight: 1,
            fontFamily: 'inherit',
            marginLeft: i === 0 ? 0 : -overlap,
            border: '1.5px solid #fff',
            boxShadow: '0 1px 2px rgba(64,55,112,0.12)',
            zIndex: max - i,
            userSelect: 'none',
          }}>
          {t.initials}
        </span>
      ))}
      {overflow > 0 && (
        <span
          title={`${overflow} more`}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            minWidth: size, height: size, borderRadius: size / 2,
            padding: overflow >= 10 ? '0 4px' : 0,
            background: '#fff', color: '#544A78',
            fontSize: Math.max(8, Math.round(size * 0.42)), fontWeight: 700,
            lineHeight: 1,
            fontFamily: 'inherit',
            marginLeft: -overlap,
            border: '1.5px solid #D4CFE2',
            zIndex: 0,
            userSelect: 'none',
          }}>
          +{overflow}
        </span>
      )}
    </div>
  );
}

// Compact "avatar + name" chip — used in lists and detail panels.
function TeammateChip({ owner, size = 16 }) {
  const t = window.getTeammate(owner);
  if (!t) return null;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      fontSize: 11, color: '#544A78', fontWeight: 500,
    }}>
      <TeammateAvatar owner={owner} size={size} />
      <span>{t.short || t.name}</span>
    </span>
  );
}
