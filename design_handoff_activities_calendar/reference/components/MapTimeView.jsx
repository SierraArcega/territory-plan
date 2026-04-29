/* global React */
// MapTimeView.jsx — geographical view of activities over a time window
// Features: selectable time range + sidebar showing activities with no location

function MapTimeView({ currentDate, activities, onActivityClick, grain, deals = [], onDealClick }) {
  // Prefer app-level grain; fallback to local storage for legacy
  const rangeMode = grain || 'week';

  const range = React.useMemo(() => {
    if (rangeMode === 'day') {
      const s = window.startOfDay(currentDate);
      const e = new Date(s); e.setHours(23, 59, 59, 999);
      return { start: s, end: e };
    }
    if (rangeMode === 'month') {
      return { start: window.startOfMonth(currentDate), end: window.endOfMonth(currentDate) };
    }
    if (rangeMode === 'quarter') {
      const q = Math.floor(currentDate.getMonth() / 3);
      const start = new Date(currentDate.getFullYear(), q * 3, 1);
      const end = new Date(currentDate.getFullYear(), q * 3 + 3, 0, 23, 59, 59, 999);
      return { start, end };
    }
    // week
    const ws = window.startOfWeek(currentDate);
    return { start: ws, end: window.addDays(ws, 6) };
  }, [currentDate, rangeMode]);

  // Collapsible "Not on map" panel
  const [panelCollapsed, setPanelCollapsed] = React.useState(() => localStorage.getItem('cal.map.panel.collapsed') === '1');
  React.useEffect(() => { localStorage.setItem('cal.map.panel.collapsed', panelCollapsed ? '1' : '0'); }, [panelCollapsed]);

  // Fake coords for CT/NY districts — roughly positioned like a northeast map
  const COORDS = {
    'Mapleton ISD':                { x: 0.38, y: 0.55 },
    'Hartford Public Schools':     { x: 0.42, y: 0.48 },
    'Westport Public Schools':     { x: 0.30, y: 0.72 },
    'Ridgefield Public Schools':   { x: 0.26, y: 0.65 },
    'Stamford Public Schools':     { x: 0.22, y: 0.78 },
    'New Haven Public Schools':    { x: 0.35, y: 0.62 },
    'Bridgeport Public Schools':   { x: 0.30, y: 0.68 },
    'Greenwich Public Schools':    { x: 0.20, y: 0.80 },
    'East Hartford Public':        { x: 0.45, y: 0.47 },
    'Fairfield Public Schools':    { x: 0.28, y: 0.70 },
    'Norwalk Public Schools':      { x: 0.24, y: 0.74 },
    'Darien Public Schools':       { x: 0.22, y: 0.76 },
    'Avon Public Schools':         { x: 0.40, y: 0.45 },
    'West Hartford Public':        { x: 0.41, y: 0.48 },
    'Glastonbury Public Schools':  { x: 0.44, y: 0.50 },
    'Shelton Public Schools':      { x: 0.32, y: 0.65 },
    'Scarsdale Public Schools':    { x: 0.18, y: 0.75 },
    'Saratoga Springs, NY':        { x: 0.15, y: 0.15 },
    'Hartford, CT':                { x: 0.42, y: 0.48 },
    'Boston, MA':                  { x: 0.65, y: 0.28 },
    'NYC':                         { x: 0.20, y: 0.82 },
  };

  // All in-range activities
  const inRange = activities.filter(a => a.start >= range.start && a.start <= range.end);

  // Split: mapped (has district + coord), unmapped (district but unknown coord), virtual/no-location
  const mapped = [];
  const offMap = [];    // district set but we have no coord for it — it's off the visible map area
  const virtual = [];   // no district / virtual meetings / internal only

  for (const a of inRange) {
    if (!a.district) { virtual.push(a); continue; }
    const coord = COORDS[a.district] || COORDS[a.district?.split('·')[0]?.trim()];
    if (coord) mapped.push({ ...a, coord });
    else offMap.push(a);
  }

  // Group mapped by coord
  const clusters = new Map();
  for (const e of mapped) {
    const k = `${Math.round(e.coord.x * 100)},${Math.round(e.coord.y * 100)}`;
    if (!clusters.has(k)) clusters.set(k, { coord: e.coord, items: [], deals: [] });
    clusters.get(k).items.push(e);
  }

  // Deals in range — bucketed by district. Attach to an existing activity
  // cluster if we have one at that coord; otherwise create a deal-only cluster.
  const dealsInRange = deals.filter(d => d.date >= range.start && d.date <= range.end);
  for (const deal of dealsInRange) {
    const coord = COORDS[deal.district] || COORDS[deal.district?.split('·')[0]?.trim()];
    if (!coord) continue; // off-map deals handled in panel
    const k = `${Math.round(coord.x * 100)},${Math.round(coord.y * 100)}`;
    if (!clusters.has(k)) clusters.set(k, { coord, items: [], deals: [], dealOnly: true });
    clusters.get(k).deals.push(deal);
  }

  const [hoveredKey, setHoveredKey] = React.useState(null);

  const rangeLabel = React.useMemo(() => {
    if (rangeMode === 'day') return window.fmtDateShort(range.start);
    if (rangeMode === 'month') return window.fmtMonthYear(range.start);
    if (rangeMode === 'quarter') {
      const q = Math.floor(range.start.getMonth() / 3) + 1;
      return `Q${q} ${range.start.getFullYear()}`;
    }
    return `${window.fmtDateShort(range.start)} – ${window.fmtDateShort(range.end)}`;
  }, [rangeMode, range]);

  const notOnMapCount = offMap.length + virtual.length;

  return (
    <div style={{ padding: '0 24px 24px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, gap: 12 }}>
      {/* Header: counts only (grain lives in the page-level date selector now) */}
      <div style={{
        padding: '10px 16px', borderRadius: 10,
        background: '#FFFCFA', border: '1px solid #E2DEEC',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <window.MapPinIcon size={14} style={{ color: '#F37167' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#403770' }}>
              {mapped.length} on map
            </span>
          </div>
          <div style={{ height: 16, width: 1, background: '#E2DEEC' }} />
          <div style={{ fontSize: 12, color: '#6E6390' }}>
            <strong style={{ color: '#403770' }}>{inRange.length}</strong> total in {rangeLabel}
          </div>
          {notOnMapCount > 0 && (
            <>
              <div style={{ height: 16, width: 1, background: '#E2DEEC' }} />
              <div style={{ fontSize: 12, color: '#8A80A8' }}>
                <strong style={{ color: '#544A78' }}>{notOnMapCount}</strong> not on map
              </div>
            </>
          )}
        </div>

        {panelCollapsed && notOnMapCount > 0 && (
          <button onClick={() => setPanelCollapsed(false)}
            style={{
              padding: '5px 10px', fontSize: 11, fontWeight: 600,
              fontFamily: 'inherit', letterSpacing: '0.04em', textTransform: 'uppercase',
              borderRadius: 7, border: '1px solid #D4CFE2', background: '#fff',
              color: '#544A78', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
            <window.ChevronLeftIcon size={12} />
            Show not-on-map
          </button>
        )}
      </div>

      {/* Body: map + side panel */}
      <div style={{ flex: 1, display: 'flex', gap: 12, minHeight: 0 }}>
        {/* Map */}
        <div style={{
          flex: 1, position: 'relative', overflow: 'hidden',
          border: '1px solid #E2DEEC', borderRadius: 12,
          background: 'radial-gradient(circle at 50% 50%, #D8EDEC, #A8D4D3)',
          minWidth: 0,
        }}>
          <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
            <defs>
              <pattern id="mt-grid" width="60" height="60" patternUnits="userSpaceOnUse">
                <path d="M 60 0 L 0 0 0 60" fill="none" stroke="rgba(110,163,190,0.18)" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#mt-grid)" />
            <path d="M 10% 35% Q 30% 30% 50% 40% L 55% 55% Q 40% 65% 15% 55% Z"
                  fill="#fff" fillOpacity="0.35" stroke="#6EA3BE" strokeOpacity="0.5" strokeWidth="1.5" />
            <path d="M 5% 60% L 45% 58% L 48% 85% L 8% 88% Z"
                  fill="#fff" fillOpacity="0.4" stroke="#6EA3BE" strokeOpacity="0.5" strokeWidth="1.5" />
            <path d="M 55% 20% L 85% 18% L 88% 40% L 58% 45% Z"
                  fill="#fff" fillOpacity="0.3" stroke="#6EA3BE" strokeOpacity="0.5" strokeWidth="1.5" />
            <text x="30%" y="50%" fontSize="11" fill="#6EA3BE" opacity="0.6" fontWeight="600">NY</text>
            <text x="28%" y="75%" fontSize="11" fill="#6EA3BE" opacity="0.6" fontWeight="600">CT</text>
            <text x="70%" y="32%" fontSize="11" fill="#6EA3BE" opacity="0.6" fontWeight="600">MA</text>
          </svg>

          {/* Empty state for map */}
          {clusters.size === 0 && (
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              textAlign: 'center', padding: 20,
              background: 'rgba(255,255,255,0.92)', borderRadius: 12,
              border: '1px solid #D4CFE2',
            }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#403770' }}>
                No mappable activities in {rangeLabel}
              </div>
              <div style={{ fontSize: 12, color: '#8A80A8', marginTop: 4 }}>
                Try a longer range, or check the panel to the right
              </div>
            </div>
          )}

          {/* Pins */}
          {Array.from(clusters.entries()).map(([k, c]) => {
            const size = Math.min(52, 24 + c.items.length * 4);
            const primary = c.items[0];
            const cat = window.ACTIVITY_CATEGORY[primary.type] || 'meeting';
            const style = window.CATEGORY_STYLE[cat];
            const hovered = hoveredKey === k;
            return (
              <div key={k}
                onMouseEnter={() => setHoveredKey(k)}
                onMouseLeave={() => setHoveredKey(null)}
                onClick={() => onActivityClick && onActivityClick(c.items[0])}
                style={{
                  position: 'absolute',
                  left: `${c.coord.x * 100}%`,
                  top: `${c.coord.y * 100}%`,
                  transform: 'translate(-50%, -50%)',
                  cursor: 'pointer',
                  zIndex: hovered ? 10 : 1,
                }}>
                <div style={{
                  width: size, height: size, borderRadius: '50%',
                  background: style.dot, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700,
                  border: '3px solid #fff',
                  boxShadow: hovered ? '0 6px 20px rgba(64,55,112,0.3)' : '0 2px 8px rgba(64,55,112,0.2)',
                  transition: 'all 150ms ease-out',
                  fontVariantNumeric: 'tabular-nums',
                }}>{c.items.length}</div>
                {/* Team-owner avatar stack beneath pin */}
                <div style={{
                  position: 'absolute', top: size - 6, left: '50%', transform: 'translateX(-50%)',
                  background: '#fff', borderRadius: 999, padding: '1.5px 3px',
                  boxShadow: '0 1px 3px rgba(64,55,112,0.15)',
                  display: c.items.some(a => !a.mine && a.owner) || c.items.some(a => a.mine) ? 'block' : 'none',
                }}>
                  <window.TeammateAvatarStack
                    owners={[
                      ...(c.items.some(a => a.mine) ? ['You'] : []),
                      ...c.items.filter(a => !a.mine).map(a => a.owner),
                    ]}
                    size={14} max={3} includeYou
                  />
                </div>
                {hovered && (
                  <div style={{
                    position: 'absolute', top: size + 8, left: '50%', transform: 'translateX(-50%)',
                    minWidth: 220, maxWidth: 280, padding: 10,
                    background: '#fff', borderRadius: 10, border: '1px solid #D4CFE2',
                    boxShadow: '0 10px 20px rgba(64,55,112,0.15)',
                    zIndex: 20,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#403770', marginBottom: 6 }}>
                      {primary.district}
                    </div>
                    {c.items.slice(0, 4).map(it => (
                      <div key={it.id} style={{ fontSize: 11, color: '#6E6390', padding: '2px 0' }}>
                        <span style={{ color: '#8A80A8', fontVariantNumeric: 'tabular-nums' }}>
                          {window.fmtDateShort(it.start)}
                        </span>
                        {' · '}{it.title}
                      </div>
                    ))}
                    {c.items.length > 4 && (
                      <div style={{ fontSize: 10, color: '#8A80A8', marginTop: 4 }}>
                        +{c.items.length - 4} more
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Off-map panel */}
        {!panelCollapsed && (
          <OffMapPanel
            offMap={offMap}
            virtual={virtual}
            onActivityClick={onActivityClick}
            onCollapse={() => setPanelCollapsed(true)}
          />
        )}
      </div>
    </div>
  );
}

function RangeToggle({ value, onChange }) {
  const opts = [
    { id: 'day',     label: 'Day' },
    { id: 'week',    label: 'Week' },
    { id: 'month',   label: 'Month' },
    { id: 'quarter', label: 'Quarter' },
  ];
  return (
    <div style={{
      display: 'inline-flex', padding: 3, borderRadius: 8,
      background: '#EFEDF5', border: '1px solid #E2DEEC',
    }}>
      {opts.map(o => {
        const active = value === o.id;
        return (
          <button key={o.id} onClick={() => onChange(o.id)}
            style={{
              padding: '4px 12px', fontSize: 12, fontWeight: active ? 600 : 500,
              fontFamily: 'inherit',
              borderRadius: 6, border: 'none',
              background: active ? '#fff' : 'transparent',
              color: active ? '#403770' : '#6E6390',
              boxShadow: active ? '0 1px 2px rgba(64,55,112,0.08)' : 'none',
              cursor: 'pointer',
              transition: 'all 120ms ease-out',
            }}>{o.label}</button>
        );
      })}
    </div>
  );
}

function OffMapPanel({ offMap, virtual, onActivityClick, onCollapse }) {
  const [tab, setTab] = React.useState('offmap');
  const total = offMap.length + virtual.length;

  return (
    <div style={{
      width: 300, flexShrink: 0,
      display: 'flex', flexDirection: 'column', minHeight: 0,
      background: '#fff', borderRadius: 12, border: '1px solid #E2DEEC',
    }}>
      {/* Header */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid #EFEDF5', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#8A80A8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Not on map
          </div>
          <div style={{ marginTop: 2, fontSize: 13, color: '#403770', fontWeight: 600 }}>
            {total === 0 ? 'Nothing outside map' : `${total} ${total === 1 ? 'activity' : 'activities'}`}
          </div>
        </div>
        {onCollapse && (
          <button onClick={onCollapse}
            title="Collapse panel"
            style={{
              width: 24, height: 24, borderRadius: 6, border: '1px solid #E2DEEC',
              background: '#fff', color: '#8A80A8', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = '#403770'; e.currentTarget.style.borderColor = '#D4CFE2'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#8A80A8'; e.currentTarget.style.borderColor = '#E2DEEC'; }}
          >
            <window.ChevronRightIcon size={14} />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', padding: '6px 10px 0', gap: 4, borderBottom: '1px solid #EFEDF5' }}>
        <TabBtn active={tab==='offmap'} onClick={() => setTab('offmap')}>
          Off-region · {offMap.length}
        </TabBtn>
        <TabBtn active={tab==='virtual'} onClick={() => setTab('virtual')}>
          Virtual · {virtual.length}
        </TabBtn>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }} className="fm-scrollbar">
        {tab === 'offmap' ? (
          offMap.length === 0 ? (
            <Empty text="All activities with locations are within the visible map." />
          ) : (
            offMap.map(a => <OffMapRow key={a.id} a={a} onClick={onActivityClick} showDistrict />)
          )
        ) : (
          virtual.length === 0 ? (
            <Empty text="No virtual or internal activities in this range." />
          ) : (
            virtual.map(a => <OffMapRow key={a.id} a={a} onClick={onActivityClick} />)
          )
        )}
      </div>

      {/* Footer breakdown by type */}
      {total > 0 && <OffMapBreakdown items={tab === 'offmap' ? offMap : virtual} />}
    </div>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      style={{
        padding: '6px 10px', fontSize: 11, fontWeight: active ? 700 : 500,
        fontFamily: 'inherit',
        background: 'transparent', border: 'none',
        color: active ? '#403770' : '#8A80A8',
        borderBottom: `2px solid ${active ? '#403770' : 'transparent'}`,
        marginBottom: -1,
        cursor: 'pointer',
      }}>{children}</button>
  );
}

function Empty({ text }) {
  return (
    <div style={{
      padding: '24px 16px', textAlign: 'center', fontSize: 12, color: '#8A80A8',
    }}>{text}</div>
  );
}

function OffMapRow({ a, onClick, showDistrict }) {
  const cat = window.ACTIVITY_CATEGORY[a.type] || 'meeting';
  const style = window.CATEGORY_STYLE[cat];
  return (
    <div
      onClick={() => onClick && onClick(a)}
      style={{
        padding: '8px 14px', cursor: 'pointer',
        display: 'flex', gap: 10, alignItems: 'flex-start',
        borderBottom: '1px solid #F7F5FA',
        transition: 'background 120ms ease-out',
        opacity: a.mine ? 1 : 0.85,
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = '#FBF9FC'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{
        width: 8, height: 8, borderRadius: 999,
        background: style.dot, flexShrink: 0, marginTop: 5,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: '#403770',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{a.title}</div>
        <div style={{ fontSize: 10.5, color: '#8A80A8', marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>
          {window.fmtDateShort(a.start)} · {window.fmtTime(a.start)}
          {showDistrict && a.district && <> · <span style={{ color: '#6E6390' }}>{a.district}</span></>}
        </div>
      </div>
      {!a.mine && a.owner && (
        <window.TeammateAvatar owner={a.owner} size={18} title={a.owner} />
      )}
    </div>
  );
}

function OffMapBreakdown({ items }) {
  const byCat = {};
  for (const it of items) {
    const c = window.ACTIVITY_CATEGORY[it.type] || 'meeting';
    byCat[c] = (byCat[c] || 0) + 1;
  }
  const entries = Object.entries(byCat).sort((a,b) => b[1] - a[1]);
  return (
    <div style={{
      padding: '8px 14px', borderTop: '1px solid #EFEDF5',
      display: 'flex', gap: 8, flexWrap: 'wrap',
      background: '#FBF9FC', borderRadius: '0 0 12px 12px',
    }}>
      {entries.map(([c, n]) => (
        <span key={c} style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          fontSize: 10, fontWeight: 600, color: '#544A78',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: 999,
            background: window.CATEGORY_STYLE[c].dot,
          }} />
          {window.CATEGORY_STYLE[c].label} · {n}
        </span>
      ))}
    </div>
  );
}

window.MapTimeView = MapTimeView;
