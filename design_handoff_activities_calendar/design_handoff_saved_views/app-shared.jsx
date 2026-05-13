/* global React */
// Shared data + sub-views (Map, Table, Kanban) used by both variations

const SAMPLE_DISTRICTS = [
  { id: 'd1', name: 'Detroit Public Schools',          state: 'MI', tier: 'A', students: 49300, arr: '$68K',  pipeline: '$120K', signal: 'growing',   stage: 'Active',    owner: 'AR', renewal: 'Jun 26' },
  { id: 'd2', name: 'Grand Rapids Public Schools',     state: 'MI', tier: 'B', students: 16800, arr: '$22K',  pipeline: '$48K',  signal: 'at_risk',   stage: 'At risk',   owner: 'AR', renewal: 'Aug 26' },
  { id: 'd3', name: 'Ann Arbor Public Schools',        state: 'MI', tier: 'A', students: 17200, arr: '$31K',  pipeline: '—',     signal: 'stable',    stage: 'Active',    owner: 'AR', renewal: 'Sep 26' },
  { id: 'd4', name: 'Boston Public Schools',           state: 'MA', tier: 'A', students: 49000, arr: '—',     pipeline: '$210K', signal: 'declining',stage: 'Prospect',   owner: 'AR', renewal: '—' },
  { id: 'd5', name: 'Newark Public Schools',           state: 'NJ', tier: 'B', students: 38200, arr: '—',     pipeline: '$72K',  signal: 'growing',  stage: 'Prospect',   owner: 'JM', renewal: '—' },
  { id: 'd6', name: 'Yonkers Public Schools',          state: 'NY', tier: 'B', students: 23800, arr: '—',     pipeline: '$54K',  signal: 'stable',   stage: 'Outreach',   owner: 'AR', renewal: '—' },
  { id: 'd7', name: 'Hartford Public Schools',         state: 'CT', tier: 'C', students: 17900, arr: '$14K',  pipeline: '—',     signal: 'at_risk',  stage: 'At risk',    owner: 'AR', renewal: 'May 26' },
  { id: 'd8', name: 'Providence Public Schools',       state: 'RI', tier: 'B', students: 22000, arr: '$26K',  pipeline: '$32K',  signal: 'stable',   stage: 'Active',     owner: 'AR', renewal: 'Jul 26' },
  { id: 'd9', name: 'Buffalo Public Schools',          state: 'NY', tier: 'B', students: 31000, arr: '—',     pipeline: '$96K',  signal: 'growing',  stage: 'Outreach',   owner: 'JM', renewal: '—' },
  { id: 'd10', name: 'Rochester City Schools',         state: 'NY', tier: 'B', students: 25400, arr: '$18K',  pipeline: '—',     signal: 'declining',stage: 'Lapsed',     owner: 'JM', renewal: '—' },
  { id: 'd11', name: 'Worcester Public Schools',       state: 'MA', tier: 'B', students: 24300, arr: '—',     pipeline: '$58K',  signal: 'stable',   stage: 'Outreach',   owner: 'AR', renewal: '—' },
  { id: 'd12', name: 'Springfield Public Schools',     state: 'MA', tier: 'C', students: 24800, arr: '$11K',  pipeline: '—',     signal: 'at_risk',  stage: 'At risk',    owner: 'AR', renewal: 'Apr 26' },
];

const STAGE_ORDER = ['Prospect', 'Outreach', 'Active', 'At risk', 'Lapsed'];
const STAGE_COLOR = {
  'Prospect': '#6EA3BE',
  'Outreach': '#FFCF70',
  'Active':   '#69B34A',
  'At risk':  '#F37167',
  'Lapsed':   '#A69DC0',
};

const SIGNAL_DOT = {
  growing:   '#69B34A',
  stable:    '#6EA3BE',
  at_risk:   '#FFCF70',
  declining: '#F37167',
};

// ============================================================================
// Map view
// ============================================================================
function CanvasMapView({ filterCount = 2, filterChips = ['Tier: A, B', 'Northeast Pod'], title }) {
  const { Card } = window;
  return (
    <div style={{ position: 'relative', height: '100%', background: '#C4E7E6', overflow: 'hidden' }}>
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
        <defs>
          <pattern id="map-grid-2" width="64" height="64" patternUnits="userSpaceOnUse">
            <path d="M 64 0 L 0 0 0 64" fill="none" stroke="rgba(110,163,190,0.18)" strokeWidth="1"/>
          </pattern>
          <radialGradient id="map-bg-2">
            <stop offset="0%" stopColor="#D8EDEC" />
            <stop offset="100%" stopColor="#A8D4D3" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#map-bg-2)" />
        <rect width="100%" height="100%" fill="url(#map-grid-2)" />
        {/* Northeast cluster — fake regions */}
        <path d="M 240 180 Q 360 140 470 200 T 680 280 Q 700 380 600 420 T 360 400 Q 240 360 200 280 Z" fill="#fff" fillOpacity="0.32" stroke="#6EA3BE" strokeOpacity="0.45" strokeWidth="1.5" />
        <path d="M 520 140 Q 680 110 800 180 T 920 320 Q 880 400 780 420 T 600 360 Q 540 280 520 140 Z" fill="#fff" fillOpacity="0.22" stroke="#6EA3BE" strokeOpacity="0.4" strokeWidth="1.5" />
        {/* choropleth blobs */}
        <path d="M 320 240 L 410 230 L 430 290 L 380 330 L 310 320 Z" fill="#F37167" fillOpacity="0.32" stroke="#F37167" strokeWidth="1.2" />
        <path d="M 430 230 L 520 220 L 540 280 L 490 310 L 430 290 Z" fill="#69B34A" fillOpacity="0.28" stroke="#69B34A" strokeWidth="1.2" />
        <path d="M 540 280 L 620 270 L 640 330 L 600 360 L 540 340 Z" fill="#FFCF70" fillOpacity="0.45" stroke="#D4A84B" strokeWidth="1.2" />
        <path d="M 620 200 L 700 190 L 720 240 L 680 270 L 620 260 Z" fill="#6EA3BE" fillOpacity="0.3" stroke="#6EA3BE" strokeWidth="1.2" />
      </svg>

      {/* pins */}
      {[
        { top: 280, left: 360, c: '#F37167' },
        { top: 250, left: 470, c: '#69B34A' },
        { top: 310, left: 580, c: '#FFCF70' },
        { top: 220, left: 660, c: '#6EA3BE' },
        { top: 340, left: 420, c: '#69B34A' },
        { top: 290, left: 520, c: '#FFCF70' },
      ].map((p, i) => (
        <div key={i} style={{
          position: 'absolute', top: p.top, left: p.left, transform: 'translate(-50%, -100%)',
        }}>
          <svg width="22" height="28" viewBox="0 0 28 36">
            <path d="M14 0 C 6 0 0 6 0 14 C 0 22 14 36 14 36 C 14 36 28 22 28 14 C 28 6 22 0 14 0 Z" fill={p.c} stroke="#fff" strokeWidth="2" />
            <circle cx="14" cy="14" r="5" fill="#fff" />
          </svg>
        </div>
      ))}

      {/* filter chips */}
      <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', gap: 6, flexWrap: 'wrap', zIndex: 5 }}>
        {filterChips.map((c, i) => (
          <div key={i} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: '#fff', color: '#403770', padding: '5px 10px',
            borderRadius: 999, fontSize: 12, fontWeight: 500,
            border: '1px solid #D4CFE2',
            boxShadow: '0 2px 4px rgba(64,55,112,0.06)',
          }}>{c}<span style={{ color: '#A69DC0' }}>×</span></div>
        ))}
      </div>

      {/* legend */}
      <Card compact style={{
        position: 'absolute', bottom: 20, left: 16, zIndex: 5, width: 168,
        boxShadow: '0 4px 12px rgba(64,55,112,0.12)',
      }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#8A80A8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Opportunity</div>
        {[['#69B34A','Growing'],['#6EA3BE','Stable'],['#FFCF70','At risk'],['#F37167','Declining']].map(([c, l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0', fontSize: 11, color: '#5C5277' }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, background: c, opacity: 0.85 }} />{l}
          </div>
        ))}
      </Card>

      {title && (
        <div style={{
          position: 'absolute', top: 16, right: 16, padding: '8px 12px',
          background: '#fff', borderRadius: 8, fontSize: 12, color: '#8A80A8',
          boxShadow: '0 4px 12px rgba(64,55,112,0.10)',
          fontFamily: 'inherit',
        }}>
          <span style={{ color: '#403770', fontWeight: 600 }}>{title}</span>
          <span style={{ margin: '0 8px', color: '#D4CFE2' }}>·</span>
          12 districts
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Table view
// ============================================================================
function CanvasTableView({ rows = SAMPLE_DISTRICTS }) {
  return (
    <div style={{ height: '100%', overflow: 'auto', background: '#FFFCFA', fontFamily: 'inherit' }} className="fm-scrollbar">
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#F7F5FA', position: 'sticky', top: 0, zIndex: 2 }}>
            {['District', 'State', 'Tier', 'Students', 'FY26 ARR', 'Pipeline', 'Stage', 'Renewal'].map((h, i) => (
              <th key={h} style={{
                textAlign: i >= 3 && i <= 5 ? 'right' : 'left',
                padding: '10px 14px', fontWeight: 600, fontSize: 11,
                color: '#8A80A8', textTransform: 'uppercase', letterSpacing: '0.06em',
                borderBottom: '1px solid #D4CFE2', whiteSpace: 'nowrap',
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} style={{ borderBottom: '1px solid #EFEDF5' }}>
              <td style={{ padding: '10px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: SIGNAL_DOT[r.signal] }} />
                  <span style={{ fontWeight: 500, color: '#403770' }}>{r.name}</span>
                </div>
              </td>
              <td style={{ padding: '10px 14px', color: '#6E6390' }}>{r.state}</td>
              <td style={{ padding: '10px 14px' }}>
                <span style={{
                  display: 'inline-block', padding: '1px 8px', borderRadius: 999,
                  background: r.tier === 'A' ? '#FEF2F1' : r.tier === 'B' ? '#e8f1f5' : '#F7F5FA',
                  color: r.tier === 'A' ? '#F37167' : r.tier === 'B' ? '#4d7285' : '#8A80A8',
                  fontWeight: 600, fontSize: 11,
                }}>{r.tier}</span>
              </td>
              <td style={{ padding: '10px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#403770' }}>{r.students.toLocaleString()}</td>
              <td style={{ padding: '10px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: r.arr === '—' ? '#A69DC0' : '#403770', fontWeight: 500 }}>{r.arr}</td>
              <td style={{ padding: '10px 14px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: r.pipeline === '—' ? '#A69DC0' : '#403770', fontWeight: 500 }}>{r.pipeline}</td>
              <td style={{ padding: '10px 14px' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '2px 10px', borderRadius: 999,
                  background: STAGE_COLOR[r.stage] + '22',
                  color: STAGE_COLOR[r.stage] === '#FFCF70' ? '#997c43' : STAGE_COLOR[r.stage],
                  fontWeight: 600, fontSize: 11,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: STAGE_COLOR[r.stage] }} />
                  {r.stage}
                </span>
              </td>
              <td style={{ padding: '10px 14px', color: r.renewal === '—' ? '#A69DC0' : '#6E6390', fontVariantNumeric: 'tabular-nums' }}>{r.renewal}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// Kanban view
// ============================================================================
function CanvasKanbanView({ rows = SAMPLE_DISTRICTS }) {
  const cols = STAGE_ORDER.map(s => ({ stage: s, items: rows.filter(r => r.stage === s) }));
  return (
    <div style={{
      height: '100%', overflow: 'auto', background: '#FFFCFA',
      padding: 16, fontFamily: 'inherit',
    }} className="fm-scrollbar">
      <div style={{ display: 'flex', gap: 12, height: '100%', minWidth: 'max-content' }}>
        {cols.map(c => (
          <div key={c.stage} style={{ width: 240, display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '6px 10px', marginBottom: 8,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: STAGE_COLOR[c.stage] }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: '#403770' }}>{c.stage}</span>
                <span style={{ fontSize: 11, color: '#8A80A8' }}>{c.items.length}</span>
              </div>
              <span style={{ fontSize: 14, color: '#A69DC0', cursor: 'pointer' }}>+</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {c.items.map(r => (
                <div key={r.id} style={{
                  background: '#fff', border: '1px solid #D4CFE2', borderRadius: 8,
                  padding: 10, boxShadow: '0 1px 2px rgba(64,55,112,0.05)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: '#403770', marginBottom: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: SIGNAL_DOT[r.signal] }} />
                    {r.name}
                  </div>
                  <div style={{ fontSize: 11, color: '#8A80A8', marginBottom: 8 }}>
                    {r.state} · {r.students.toLocaleString()} students
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {r.arr !== '—' && (
                      <span style={{
                        padding: '2px 8px', borderRadius: 999, background: '#EDFFE3',
                        color: '#5f665b', fontSize: 11, fontWeight: 600,
                      }}>ARR {r.arr}</span>
                    )}
                    {r.pipeline !== '—' && (
                      <span style={{
                        padding: '2px 8px', borderRadius: 999, background: '#e8f1f5',
                        color: '#4d7285', fontSize: 11, fontWeight: 600,
                      }}>{r.pipeline}</span>
                    )}
                  </div>
                </div>
              ))}
              <button style={{
                background: 'transparent', border: '1px dashed #D4CFE2', borderRadius: 8,
                padding: '8px 10px', fontSize: 12, color: '#8A80A8', cursor: 'pointer',
                fontFamily: 'inherit',
              }}>+ Add district</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, {
  SAMPLE_DISTRICTS, STAGE_ORDER, STAGE_COLOR, SIGNAL_DOT,
  CanvasMapView, CanvasTableView, CanvasKanbanView,
});
