/* global React */
const { useState: useDPS } = React;

const PRIMARY_BY_NAME = {
  'Detroit Public Schools':       { primary: 'Dr. Maria Chen',  primaryRole: 'Superintendent', lastTouch: '2d ago' },
  'Grand Rapids Public Schools':  { primary: 'James Okafor',    primaryRole: 'CTO',            lastTouch: '6d ago' },
  'Ann Arbor Public Schools':     { primary: 'Sarah Patel',     primaryRole: 'Curr. Director', lastTouch: '1w ago' },
  'Boston Public Schools':        { primary: 'Robert Liang',    primaryRole: 'Asst. Supt.',    lastTouch: '3d ago' },
};
function buildDetails() {
  const out = {};
  const src = window.SAMPLE_DISTRICTS || [];
  for (const r of src) {
    const p = PRIMARY_BY_NAME[r.name] || { primary: 'District Office', primaryRole: 'Main contact', lastTouch: '2w ago' };
    out[r.name] = {
      state: r.state, tier: r.tier, enrollment: r.students, schools: Math.max(8, Math.round(r.students / 850)),
      stage: r.stage === 'Active' ? 'Customer' : r.stage === 'At risk' ? 'Lapsed' : r.stage,
      arr: r.arr, pipeline: r.pipeline, renewal: r.renewal === '—' ? '—' : r.renewal,
      ...p,
    };
  }
  return out;
}
const DISTRICT_DETAILS = new Proxy({}, { get: (_, k) => buildDetails()[k] });

const STAGE_PILL_DP = {
  Customer: { bg: '#EDFFE3', fg: '#5f665b' },
  Prospect: { bg: '#e8f1f5', fg: '#4d7285' },
  Lapsed:   { bg: '#FEF2F1', fg: '#c25a52' },
  Churned:  { bg: '#FEF2F1', fg: '#c25a52' },
};

function DistrictPanel({ name, onClose }) {
  const { XIcon, MapPinIcon, UsersIcon, FolkBookmarkIcon: BookmarkIcon, FolkShareIcon: ShareIcon, PencilIcon } = window;
  const d = DISTRICT_DETAILS[name] || DISTRICT_DETAILS['Mapleton ISD'];
  const [tab, setTab] = useDPS('overview');
  const sp = STAGE_PILL_DP[d.stage] || STAGE_PILL_DP.Prospect;

  return (
    <div style={{
      position: 'absolute', top: 0, right: 0, bottom: 0,
      width: 380, background: '#fff',
      borderLeft: '1px solid #D4CFE2',
      boxShadow: '-12px 0 32px rgba(64,55,112,0.08)',
      display: 'flex', flexDirection: 'column',
      animation: 'dpSlide 250ms cubic-bezier(0.16, 1, 0.3, 1)',
      zIndex: 50,
    }}>
      <style>{`@keyframes dpSlide { from { transform: translateX(20px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }`}</style>

      {/* Header */}
      <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid #E2DEEC' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <MapPinIcon size={11} style={{ color: '#F37167' }} />
              <span style={{ fontSize: 10, color: '#8A80A8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{d.state} · District</span>
            </div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#403770', margin: 0, letterSpacing: '-0.01em' }}>{name}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: sp.bg, color: sp.fg }}>{d.stage}</span>
              <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: '#FFFCFA', border: '1px solid #E2DEEC', color: '#544A78' }}>Tier {d.tier}</span>
              <span style={{ fontSize: 11, color: '#8A80A8' }}>· {d.enrollment.toLocaleString()} students</span>
            </div>
          </div>
          <button onClick={onClose} style={{ padding: 6, background: 'transparent', border: 'none', borderRadius: 6, color: '#8A80A8', cursor: 'pointer' }}><XIcon size={16} /></button>
        </div>

        <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
          <button style={btnPriDP}><PencilIcon size={11} /> Log activity</button>
          <button style={btnSecDP}><BookmarkIcon size={11} /> Add to list</button>
          <button style={btnSecDP}><ShareIcon size={11} /></button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, padding: '0 18px', borderBottom: '1px solid #E2DEEC' }}>
        {['overview', 'contacts', 'pipeline', 'activity'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              padding: '10px 4px', marginRight: 14, background: 'transparent', border: 'none',
              borderBottom: tab === t ? '2px solid #403770' : '2px solid transparent',
              color: tab === t ? '#403770' : '#8A80A8',
              fontWeight: tab === t ? 600 : 500, fontSize: 12, fontFamily: 'inherit',
              cursor: 'pointer', textTransform: 'capitalize', marginBottom: -1,
            }}>
            {t}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '14px 18px' }} className="fm-scrollbar">
        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Stat2 label="ARR"        value={d.arr} />
              <Stat2 label="Pipeline"   value={d.pipeline} />
              <Stat2 label="Schools"    value={d.schools} />
              <Stat2 label="Renewal"    value={d.renewal} />
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#8A80A8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Primary contact</div>
              <div style={{ padding: 10, background: '#FFFCFA', border: '1px solid #E2DEEC', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#C4E7E6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#403770' }}>{d.primary.split(' ').map(p => p[0]).slice(0,2).join('')}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#403770' }}>{d.primary}</div>
                  <div style={{ fontSize: 11, color: '#8A80A8' }}>{d.primaryRole} · Last touch {d.lastTouch}</div>
                </div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#8A80A8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>Recent activity</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { t: 'Email · Pricing follow-up',    when: '2d ago' },
                  { t: 'Call · Discovery with CTO',     when: '5d ago' },
                  { t: 'Meeting · Onsite walkthrough',  when: '2w ago' },
                ].map((a, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: i < 2 ? '1px solid #EFEDF5' : 'none' }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#F37167', marginTop: 6, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: '#403770', fontWeight: 500 }}>{a.t}</div>
                      <div style={{ fontSize: 11, color: '#8A80A8', marginTop: 1 }}>{a.when}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {tab === 'contacts' && (
          <div style={{ fontSize: 12, color: '#8A80A8' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0', borderBottom: '1px solid #EFEDF5' }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#C4E7E6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#403770' }}>{d.primary.split(' ').map(p => p[0]).slice(0,2).join('')}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#403770' }}>{d.primary}</div>
                <div style={{ fontSize: 11, color: '#8A80A8' }}>{d.primaryRole}</div>
              </div>
            </div>
            <div style={{ padding: '14px 0', textAlign: 'center', color: '#A69DC0' }}>+ Add contact</div>
          </div>
        )}
        {tab === 'pipeline' && (
          <div style={{ padding: 14, background: '#FFFCFA', border: '1px solid #E2DEEC', borderRadius: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#403770' }}>{name} — {d.pipeline} open</div>
            <div style={{ fontSize: 11, color: '#8A80A8', marginTop: 4 }}>Math 6–12 expansion · Proposal · close May 30</div>
          </div>
        )}
        {tab === 'activity' && (
          <div style={{ fontSize: 11, color: '#A69DC0', textAlign: 'center', padding: 20 }}>Full activity timeline</div>
        )}
      </div>
    </div>
  );
}

function Stat2({ label, value }) {
  return (
    <div style={{ padding: 10, background: '#FFFCFA', border: '1px solid #E2DEEC', borderRadius: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#8A80A8', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#403770', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

const btnPriDP = {
  flex: 1, padding: '7px 10px', fontSize: 12, fontFamily: 'inherit',
  background: '#403770', border: 'none', borderRadius: 7, color: '#fff',
  fontWeight: 600, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
};
const btnSecDP = {
  padding: '7px 10px', fontSize: 12, fontFamily: 'inherit',
  background: '#fff', border: '1px solid #D4CFE2', borderRadius: 7, color: '#403770',
  fontWeight: 500, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
};

window.DistrictPanel = DistrictPanel;
window.DISTRICT_DETAILS = DISTRICT_DETAILS;
