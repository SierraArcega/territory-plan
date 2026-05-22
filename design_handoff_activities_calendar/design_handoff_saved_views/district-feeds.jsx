/* global React */
// Three signal-feed views for districts: Vacancies, News, RFPs

const FEED_VAC = [
  { id: 'va1', district: 'Detroit Public Schools',         role: 'Superintendent',     posted: '4d ago',  status: 'Open',          signal: 'high', note: 'Outgoing supt retiring June' },
  { id: 'va2', district: 'Boston Public Schools',          role: 'Chief Academic Officer', posted: '2w ago', status: 'Search active', signal: 'high' },
  { id: 'va3', district: 'Newark Public Schools',          role: 'Director of Curriculum', posted: '3d ago', status: 'Open',          signal: 'med',  note: 'Replacement after promotion' },
  { id: 'va4', district: 'Hartford Public Schools',        role: 'CTO',                posted: '1w ago',  status: 'Open',          signal: 'high', note: 'Tech budget review likely' },
  { id: 'va5', district: 'Buffalo Public Schools',         role: 'Math Coordinator',   posted: '5d ago',  status: 'Open',          signal: 'low' },
  { id: 'va6', district: 'Worcester Public Schools',       role: 'Director of Teaching & Learning', posted: '6d ago', status: 'Open', signal: 'med' },
  { id: 'va7', district: 'Yonkers Public Schools',         role: 'Asst. Superintendent', posted: '1w ago', status: 'Search active', signal: 'med' },
  { id: 'va8', district: 'Springfield Public Schools',     role: 'CTO',                posted: '2d ago',  status: 'Open',          signal: 'high', note: 'Budget cycle just opened' },
];

const FEED_NEWS = [
  { id: 'n1', district: 'Detroit Public Schools',          headline: '$8.4M bond approved for STEM upgrades',           source: 'Detroit Free Press', date: '2d ago', tag: 'Funding',   tagFg: '#5f665b', tagBg: '#EDFFE3' },
  { id: 'n2', district: 'Boston Public Schools',           headline: 'Board names Dr. Lena Ortiz interim Superintendent', source: 'Boston Globe',      date: '5d ago', tag: 'Leadership',tagFg: '#4d7285', tagBg: '#e8f1f5' },
  { id: 'n3', district: 'Ann Arbor Public Schools',        headline: 'Math curriculum review extended through Q2',      source: 'MLive',             date: '1w ago', tag: 'Curriculum',tagFg: '#6f4c8c', tagBg: '#EFEDF5' },
  { id: 'n4', district: 'Newark Public Schools',           headline: 'State allocates $12M to literacy intervention',   source: 'NJ.com',            date: '4d ago', tag: 'Funding',   tagFg: '#5f665b', tagBg: '#EDFFE3' },
  { id: 'n5', district: 'Hartford Public Schools',         headline: 'Three schools placed under improvement watch',     source: 'Hartford Courant',  date: '1w ago', tag: 'Risk',      tagFg: '#c25a52', tagBg: '#FEF2F1' },
  { id: 'n6', district: 'Yonkers Public Schools',          headline: 'New 5-year strategic plan published',              source: 'Yonkers Times',     date: '2w ago', tag: 'Strategy',  tagFg: '#7d6d3a', tagBg: '#FFF6DD' },
  { id: 'n7', district: 'Providence Public Schools',       headline: 'Tutoring program expands to all middle schools',  source: 'GoLocalProv',       date: '3d ago', tag: 'Program',   tagFg: '#4d7285', tagBg: '#e8f1f5' },
  { id: 'n8', district: 'Buffalo Public Schools',          headline: 'Vendor consolidation initiative announced',        source: 'Buffalo News',      date: '6d ago', tag: 'Procurement', tagFg: '#c25a52', tagBg: '#FEF2F1' },
];

const FEED_RFPS = [
  { id: 'r1', district: 'Detroit Public Schools',         title: 'Math 6–12 supplemental curriculum',           category: 'Curriculum',   posted: 'Apr 22',  due: 'May 30',  value: '$420K',  status: 'Open',      stage: 'Q&A period' },
  { id: 'r2', district: 'Newark Public Schools',          title: 'High-dosage tutoring services FY26–27',       category: 'Tutoring',     posted: 'Apr 14',  due: 'May 24',  value: '$1.2M',  status: 'Open',      stage: 'Submissions open' },
  { id: 'r3', district: 'Boston Public Schools',          title: 'SEL screener and intervention platform',      category: 'SEL',          posted: 'Apr 30',  due: 'Jun 12',  value: '$280K',  status: 'Open',      stage: 'Pre-submission' },
  { id: 'r4', district: 'Worcester Public Schools',       title: 'Math intervention K–5',                       category: 'Curriculum',   posted: 'Mar 18',  due: 'May 15',  value: '$340K',  status: 'Reviewing', stage: 'Vendor selection' },
  { id: 'r5', district: 'Hartford Public Schools',        title: 'Online tutoring — ELA grades 9–12',           category: 'Tutoring',     posted: 'Apr 02',  due: 'May 20',  value: '$190K',  status: 'Open',      stage: 'Submissions open' },
  { id: 'r6', district: 'Buffalo Public Schools',         title: 'Adaptive math platform pilot',                category: 'Curriculum',   posted: 'Apr 28',  due: 'Jun 06',  value: '$160K',  status: 'Open',      stage: 'Q&A period' },
  { id: 'r7', district: 'Springfield Public Schools',     title: 'Summer enrichment programming',               category: 'Program',      posted: 'Mar 25',  due: 'Apr 30',  value: '$95K',   status: 'Awarded',   stage: 'Awarded — not us' },
];

const PILL = (bg, fg) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: bg, color: fg, whiteSpace: 'nowrap' });
const SIGNAL = { high: { bg: '#FEF2F1', fg: '#c25a52', label: 'High' }, med: { bg: '#FFF6DD', fg: '#7d6d3a', label: 'Med' }, low: { bg: '#EFEDF5', fg: '#6f6786', label: 'Low' } };
const STATUS_VAC = { 'Open': { bg: '#EDFFE3', fg: '#5f665b' }, 'Search active': { bg: '#e8f1f5', fg: '#4d7285' }, 'Filled': { bg: '#EFEDF5', fg: '#6f6786' } };
const STATUS_RFP = { 'Open': { bg: '#EDFFE3', fg: '#5f665b' }, 'Reviewing': { bg: '#FFF6DD', fg: '#7d6d3a' }, 'Awarded': { bg: '#EFEDF5', fg: '#6f6786' } };

const headTh = { padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#8A80A8', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #E2DEEC', whiteSpace: 'nowrap' };
const cellTd = { padding: '11px 14px', fontSize: 13, color: '#403770', verticalAlign: 'middle' };

function CanvasVacanciesView() {
  return (
    <div style={{ height: '100%', overflow: 'auto', background: '#FFFCFA' }} className="fm-scrollbar">
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#F7F5FA', position: 'sticky', top: 0, zIndex: 2 }}>
            {['District', 'Role', 'Signal', 'Posted', 'Status', 'Note'].map(h => <th key={h} style={headTh}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {FEED_VAC.map(v => {
            const s = SIGNAL[v.signal]; const st = STATUS_VAC[v.status] || STATUS_VAC.Open;
            return (
              <tr key={v.id} style={{ borderBottom: '1px solid #EFEDF5' }}>
                <td style={{ ...cellTd, fontWeight: 600 }}>{v.district}</td>
                <td style={cellTd}>{v.role}</td>
                <td style={cellTd}><span style={PILL(s.bg, s.fg)}>{s.label}</span></td>
                <td style={{ ...cellTd, color: '#8A80A8' }}>{v.posted}</td>
                <td style={cellTd}><span style={PILL(st.bg, st.fg)}>{v.status}</span></td>
                <td style={{ ...cellTd, color: '#8A80A8', fontSize: 12 }}>{v.note || '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CanvasNewsView() {
  return (
    <div style={{ height: '100%', overflow: 'auto', background: '#FFFCFA', padding: '14px 20px' }} className="fm-scrollbar">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 880 }}>
        {FEED_NEWS.map(n => (
          <div key={n.id} data-row-id={n.id} style={{
            background: '#fff', border: '1px solid #D4CFE2', borderRadius: 10,
            padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 12,
            cursor: 'pointer', transition: 'border-color 120ms, box-shadow 120ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#B8B0D0'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(64,55,112,0.05)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#D4CFE2'; e.currentTarget.style.boxShadow = 'none'; }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: n.tagBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14, fontWeight: 700, color: n.tagFg }}>
              {n.district.split(' ').map(w => w[0]).slice(0, 2).join('')}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#403770' }}>{n.district}</span>
                <span style={PILL(n.tagBg, n.tagFg)}>{n.tag}</span>
              </div>
              <div style={{ fontSize: 14, color: '#2d2750', fontWeight: 500, lineHeight: 1.35, letterSpacing: '-0.005em' }}>{n.headline}</div>
              <div style={{ fontSize: 11, color: '#8A80A8', marginTop: 4 }}>{n.source} · {n.date}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CanvasRfpsView() {
  return (
    <div style={{ height: '100%', overflow: 'auto', background: '#FFFCFA' }} className="fm-scrollbar">
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#F7F5FA', position: 'sticky', top: 0, zIndex: 2 }}>
            {['District', 'RFP', 'Category', 'Posted', 'Due', 'Value', 'Status'].map(h => <th key={h} style={headTh}>{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {FEED_RFPS.map(r => {
            const st = STATUS_RFP[r.status] || STATUS_RFP.Open;
            return (
              <tr key={r.id} style={{ borderBottom: '1px solid #EFEDF5' }}>
                <td style={{ ...cellTd, fontWeight: 600 }}>{r.district}</td>
                <td style={cellTd}>
                  <div style={{ fontSize: 13, color: '#403770', fontWeight: 500 }}>{r.title}</div>
                  <div style={{ fontSize: 11, color: '#8A80A8', marginTop: 1 }}>{r.stage}</div>
                </td>
                <td style={cellTd}><span style={PILL('#EFEDF5', '#6f6786')}>{r.category}</span></td>
                <td style={{ ...cellTd, color: '#8A80A8' }}>{r.posted}</td>
                <td style={{ ...cellTd, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{r.due}</td>
                <td style={{ ...cellTd, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{r.value}</td>
                <td style={cellTd}><span style={PILL(st.bg, st.fg)}>{r.status}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

Object.assign(window, { CanvasVacanciesView, CanvasNewsView, CanvasRfpsView, FEED_VAC, FEED_NEWS, FEED_RFPS });
