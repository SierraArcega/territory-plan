/* global React */
// OppSignals.jsx — Overlay layer showing deal progression data per day
// Integrates with the calendar: pills on month days, ribbon on week/schedule views

// Mock opp events — tied to date offsets from TODAY (2026-04-18)
// `mine: true` = rep's own deals; others are teammates' for scope=all
const OPP_EVENTS = [
  // Rep's own deals
  { date: offset(-5), kind: 'won',       district: 'Hartford Public Schools', amount: 82000, stage: 'Closed Won',  mine: true, owner: 'You' },
  { date: offset(-4), kind: 'created',   district: 'Ridgefield Public',       amount: 34000, stage: 'Discovery',  mine: true, owner: 'You' },
  { date: offset(-4), kind: 'progressed',district: 'Mapleton ISD',            amount: 120000, stage: 'Proposal',   fromStage: 'Discovery',  mine: true, owner: 'You' },
  { date: offset(-3), kind: 'lost',      district: 'Greenwich Public',        amount: 45000, stage: 'Closed Lost',mine: true, owner: 'You' },
  { date: offset(-2), kind: 'won',       district: 'Westport Public',         amount: 52000, stage: 'Closed Won', mine: true, owner: 'You' },
  { date: offset(-1), kind: 'progressed',district: 'Stamford Public',         amount: 95000, stage: 'Proposal',   fromStage: 'Qualify',    mine: true, owner: 'You' },
  { date: offset(0),  kind: 'won',       district: 'Bridgeport Public',       amount: 110000, stage: 'Closed Won',mine: true, owner: 'You' },
  { date: offset(3),  kind: 'progressed',district: 'Avon Public',             amount: 48000, stage: 'Negotiation', fromStage: 'Proposal',   mine: true, owner: 'You' },
  { date: offset(5),  kind: 'won',       district: 'Shelton Public',          amount: 72000, stage: 'Closed Won', mine: true, owner: 'You' },
  { date: offset(11), kind: 'lost',      district: 'Norwalk Public',          amount: 38000, stage: 'Closed Lost',mine: true, owner: 'You' },
  { date: offset(17), kind: 'progressed',district: 'Scarsdale Public',        amount: 78000, stage: 'Negotiation', fromStage: 'Proposal',   mine: true, owner: 'You' },

  // Teammates' deals — only shown in scope=all
  { date: offset(-3), kind: 'progressed',district: 'New Haven Public',        amount: 68000, stage: 'Negotiation', fromStage: 'Proposal',   mine: false, owner: 'Priya S.' },
  { date: offset(-2), kind: 'created',   district: 'East Hartford',           amount: 28000, stage: 'Discovery',  mine: false, owner: 'Marcus T.' },
  { date: offset(0),  kind: 'created',   district: 'Hartford (expansion)',    amount: 42000, stage: 'Discovery',  mine: false, owner: 'Priya S.' },
  { date: offset(2),  kind: 'progressed',district: 'Fairfield Public',        amount: 56000, stage: 'Qualify',     fromStage: 'Discovery',  mine: false, owner: 'Marcus T.' },
  { date: offset(4),  kind: 'created',   district: 'Glastonbury Public',      amount: 31000, stage: 'Discovery',  mine: false, owner: 'Jin R.' },
  { date: offset(8),  kind: 'progressed',district: 'Darien Public',           amount: 61000, stage: 'Proposal',    fromStage: 'Qualify',    mine: false, owner: 'Priya S.' },
  { date: offset(14), kind: 'created',   district: 'Saratoga Springs CSD',    amount: 44000, stage: 'Discovery',  mine: false, owner: 'Marcus T.' },
  { date: offset(22), kind: 'won',       district: 'Yonkers City SD',         amount: 135000, stage: 'Closed Won',mine: false, owner: 'Jin R.' },
  { date: offset(-4), kind: 'lost',      district: 'Stratford Public',        amount: 27000, stage: 'Closed Lost',mine: false, owner: 'Jin R.' },
  { date: offset(1),  kind: 'won',       district: 'Milford Public',          amount: 58000, stage: 'Closed Won', mine: false, owner: 'Priya S.' },
  { date: offset(6),  kind: 'progressed',district: 'Manchester Public',       amount: 41000, stage: 'Negotiation', fromStage: 'Proposal',   mine: false, owner: 'Marcus T.' },
];

// Open deals — deals in flight with a scheduled close date. Some have close
// dates in the past, which means they should be advanced or the date updated.
// These are separate from OPP_EVENTS (which are point-in-time transitions).
const OPEN_DEALS = [
  // Rep's own deals
  { district: 'Mapleton ISD',           amount: 120000, stage: 'Proposal',    closeDate: offset(-8),  daysInStage: 21, mine: true,  owner: 'You' },
  { district: 'Stamford Public',        amount: 95000,  stage: 'Proposal',    closeDate: offset(-3),  daysInStage: 12, mine: true,  owner: 'You' },
  { district: 'Ridgefield Public',      amount: 34000,  stage: 'Discovery',   closeDate: offset(12),  daysInStage: 4,  mine: true,  owner: 'You' },
  { district: 'Avon Public',            amount: 48000,  stage: 'Negotiation', closeDate: offset(9),   daysInStage: 6,  mine: true,  owner: 'You' },
  { district: 'Scarsdale Public',       amount: 78000,  stage: 'Negotiation', closeDate: offset(-14), daysInStage: 38, mine: true,  owner: 'You' },
  { district: 'Trumbull Public',        amount: 42000,  stage: 'Qualify',     closeDate: offset(21),  daysInStage: 9,  mine: true,  owner: 'You' },

  // Teammates' deals — only shown in scope=all
  { district: 'New Haven Public',       amount: 68000,  stage: 'Negotiation', closeDate: offset(-5),  daysInStage: 18, mine: false, owner: 'Priya S.' },
  { district: 'East Hartford',          amount: 28000,  stage: 'Discovery',   closeDate: offset(30),  daysInStage: 5,  mine: false, owner: 'Marcus T.' },
  { district: 'Darien Public',          amount: 61000,  stage: 'Proposal',    closeDate: offset(-11), daysInStage: 26, mine: false, owner: 'Priya S.' },
  { district: 'Fairfield Public',       amount: 56000,  stage: 'Qualify',     closeDate: offset(18),  daysInStage: 7,  mine: false, owner: 'Marcus T.' },
  { district: 'Saratoga Springs CSD',   amount: 44000,  stage: 'Discovery',   closeDate: offset(-2),  daysInStage: 14, mine: false, owner: 'Marcus T.' },
  { district: 'Manchester Public',      amount: 41000,  stage: 'Negotiation', closeDate: offset(15),  daysInStage: 3,  mine: false, owner: 'Marcus T.' },
];

function filterOpenDealsByScope(deals, scope) {
  return scope === 'mine' ? deals.filter(d => d.mine) : deals;
}
function pastDueDeals(deals) {
  const today = new Date(2026, 3, 18); today.setHours(0,0,0,0);
  return deals.filter(d => d.closeDate < today);
}
function daysOverdue(d) {
  const today = new Date(2026, 3, 18); today.setHours(0,0,0,0);
  return Math.floor((today - d.closeDate) / (1000*60*60*24));
}

// Top districts by pipeline value / relationship importance. Each carries the
// date of the last logged activity (call, email, meeting, visit) so we can
// flag ones going cold. Mix of active customers and open-deal prospects.
const TOP_DISTRICTS = [
  // Rep's own book of business
  { district: 'Hartford Public Schools', arr: 240000, type: 'customer',  lastActivity: offset(-2),  mine: true,  owner: 'You' },
  { district: 'Mapleton ISD',            arr: 120000, type: 'open-deal', lastActivity: offset(-34), mine: true,  owner: 'You' },
  { district: 'Scarsdale Public',        arr: 78000,  type: 'open-deal', lastActivity: offset(-41), mine: true,  owner: 'You' },
  { district: 'Stamford Public',         arr: 95000,  type: 'open-deal', lastActivity: offset(-3),  mine: true,  owner: 'You' },
  { district: 'Ridgefield Public',       arr: 34000,  type: 'open-deal', lastActivity: offset(-1),  mine: true,  owner: 'You' },
  { district: 'Avon Public',             arr: 48000,  type: 'open-deal', lastActivity: offset(-28), mine: true,  owner: 'You' },
  { district: 'Westport Public',         arr: 52000,  type: 'customer',  lastActivity: offset(-52), mine: true,  owner: 'You' },
  { district: 'Bridgeport Public',       arr: 110000, type: 'customer',  lastActivity: offset(-5),  mine: true,  owner: 'You' },
  { district: 'Trumbull Public',         arr: 42000,  type: 'open-deal', lastActivity: offset(-11), mine: true,  owner: 'You' },
  { district: 'Shelton Public',          arr: 72000,  type: 'customer',  lastActivity: offset(-38), mine: true,  owner: 'You' },
  { district: 'Greenwich Public',        arr: 45000,  type: 'past',      lastActivity: offset(-60), mine: true,  owner: 'You' },

  // Teammates' accounts — shown in scope=all
  { district: 'New Haven Public',        arr: 68000,  type: 'open-deal', lastActivity: offset(-4),  mine: false, owner: 'Priya S.' },
  { district: 'Yonkers City SD',         arr: 180000, type: 'customer',  lastActivity: offset(-45), mine: false, owner: 'Jin R.' },
  { district: 'Darien Public',           arr: 61000,  type: 'open-deal', lastActivity: offset(-31), mine: false, owner: 'Priya S.' },
  { district: 'Saratoga Springs CSD',    arr: 44000,  type: 'open-deal', lastActivity: offset(-2),  mine: false, owner: 'Marcus T.' },
  { district: 'Milford Public',          arr: 58000,  type: 'customer',  lastActivity: offset(-8),  mine: false, owner: 'Priya S.' },
];

function filterDistrictsByScope(districts, scope) {
  return scope === 'mine' ? districts.filter(d => d.mine) : districts;
}
function daysSinceActivity(d) {
  const today = new Date(2026, 3, 18); today.setHours(0,0,0,0);
  return Math.floor((today - d.lastActivity) / (1000*60*60*24));
}
// Cold = no logged activity in 21+ days, and it's either an open-deal or active customer.
function coldDistricts(districts) {
  return districts
    .filter(d => d.type !== 'past') // ignore churned/past customers
    .filter(d => daysSinceActivity(d) >= 21)
    .sort((a, b) => b.arr - a.arr); // top by ARR first
}

function offset(days) {
  const d = new Date(2026, 3, 18);
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}

const OPP_STYLE = {
  won:        { color: '#69B34A', bg: '#EDFFE3', icon: '↗', label: 'Won' },
  lost:       { color: '#c25a52', bg: '#FEF1F0', icon: '↘', label: 'Lost' },
  created:    { color: '#6EA3BE', bg: '#E8F1F5', icon: '+',  label: 'New' },
  progressed: { color: '#FFCF70', bg: '#FFFAF1', icon: '→',  label: 'Moved' },
};

function formatMoney(n) {
  if (n >= 1_000_000) return '$' + (n/1_000_000).toFixed(1) + 'M';
  if (n >= 1000) return '$' + Math.round(n/1000) + 'K';
  return '$' + n;
}

function groupOppsByDay(events) {
  const m = new Map();
  for (const e of events) {
    const k = window.startOfDay(e.date).toISOString();
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(e);
  }
  return m;
}

// Filter opps by scope: 'mine' returns only rep's own; 'all' returns everything
function filterOppsByScope(events, scope) {
  return scope === 'mine' ? events.filter(e => e.mine) : events;
}

// Filter opp events by selected deal kinds (Set of 'won'|'lost'|'created'|'progressed').
// If dealKinds is null/undefined, all kinds pass through.
function filterOppsByKind(events, dealKinds) {
  if (!dealKinds) return events;
  return events.filter(e => dealKinds.has(e.kind));
}

// Combined opp filter pipeline: kind + stage + amount range + district.
// All args optional — missing ones pass through.
function filterOpps(events, { dealKinds, dealStages, dealMin, dealMax, territories } = {}) {
  return events.filter(e => {
    if (dealKinds && !dealKinds.has(e.kind)) return false;
    if (dealStages && dealStages.size > 0 && !dealStages.has(e.stage)) return false;
    if (typeof dealMin === 'number' && e.amount < dealMin) return false;
    if (typeof dealMax === 'number' && e.amount > dealMax) return false;
    if (territories && !territories.has(e.district)) return false;
    return true;
  });
}

// Canonical stage vocab — used by filters
const DEAL_STAGES = ['Discovery', 'Qualify', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost'];

// Every unique district referenced by any deal — feeds filter account chooser.
function allDealDistricts() {
  const set = new Set();
  for (const e of OPP_EVENTS) set.add(e.district);
  for (const d of OPEN_DEALS) set.add(d.district);
  return Array.from(set).sort();
}

// ============================================================================
// DealChip — a deal event rendered as a first-class calendar object
// ============================================================================
function DealChip({ deal, density = 'compact', onClick }) {
  const sty = OPP_STYLE[deal.kind];
  const t = !deal.mine && window.getTeammate ? window.getTeammate(deal.owner) : null;

  if (density === 'pip') {
    // Smallest variant — for dense map clusters or tight cells
    return (
      <span
        title={`${OPP_STYLE[deal.kind].label}: ${deal.district} — ${formatMoney(deal.amount)}`}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 14, height: 14, borderRadius: 3,
          background: sty.color, color: '#fff',
          fontSize: 9, fontWeight: 800, lineHeight: 1,
        }}>
        {sty.icon}
      </span>
    );
  }

  if (density === 'row') {
    // Full-width row for schedule view
    return (
      <div
        onClick={(e) => { e.stopPropagation(); onClick && onClick(deal); }}
        title={`${sty.label}: ${deal.district} — ${formatMoney(deal.amount)} · ${deal.stage}`}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '10px 12px',
          background: '#fff',
          border: `1px solid ${sty.color}55`,
          borderLeft: `3px solid ${sty.color}`,
          borderRadius: 8,
          cursor: onClick ? 'pointer' : 'default',
          opacity: deal.mine ? 1 : 0.92,
        }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 26, height: 26, borderRadius: 6, flexShrink: 0,
          background: sty.bg, color: sty.color,
          fontSize: 14, fontWeight: 800, lineHeight: 1,
        }}>{sty.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', gap: 8,
            fontSize: 13, fontWeight: 600, color: '#403770',
          }}>
            <span style={{
              padding: '1px 6px', borderRadius: 999,
              background: sty.bg, color: sty.color,
              fontSize: 10, fontWeight: 700, letterSpacing: '0.02em',
            }}>{sty.label}</span>
            <span style={{
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{deal.district}</span>
          </div>
          <div style={{ marginTop: 2, fontSize: 11, color: '#6E6390', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {deal.kind === 'progressed' && deal.fromStage ? (
              <span>
                <span style={{ color: '#8A80A8' }}>{deal.fromStage}</span>
                <span style={{ color: sty.color, fontWeight: 700, margin: '0 4px' }}>→</span>
                <span style={{ color: '#403770', fontWeight: 600 }}>{deal.stage}</span>
              </span>
            ) : (
              <span>{deal.stage}</span>
            )}
            {t && (
              <>
                <span style={{ color: '#C2BBD4' }}>·</span>
                <window.TeammateChip owner={deal.owner} size={14} />
              </>
            )}
          </div>
        </div>
        <div style={{
          fontSize: 14, fontWeight: 700, color: sty.color,
          fontVariantNumeric: 'tabular-nums', flexShrink: 0,
        }}>{formatMoney(deal.amount)}</div>
      </div>
    );
  }

  // default 'compact' — month-cell chip, inline with activity chips
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClick && onClick(deal); }}
      title={`${sty.label}: ${deal.district} — ${formatMoney(deal.amount)} · ${deal.stage}`}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '2.5px 5px 2.5px 4px',
        background: '#fff',
        border: `1px solid ${sty.color}`,
        borderLeft: `3px solid ${sty.color}`,
        borderRadius: 3,
        fontSize: 10, fontWeight: 600,
        color: '#403770',
        cursor: onClick ? 'pointer' : 'default',
        overflow: 'hidden',
        opacity: deal.mine ? 1 : 0.85,
        lineHeight: 1.25,
      }}>
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 12, height: 12, borderRadius: 2,
        background: sty.color, color: '#fff',
        fontSize: 9, fontWeight: 800, lineHeight: 1, flexShrink: 0,
      }}>{sty.icon}</span>
      <span style={{
        flex: 1, minWidth: 0,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}>{deal.district}</span>
      <span style={{
        fontVariantNumeric: 'tabular-nums', fontWeight: 700, color: sty.color,
        fontSize: 10, flexShrink: 0,
      }}>{formatMoney(deal.amount)}</span>
    </div>
  );
}

// Ring of outcome colors for a map pin — one segment per deal outcome present.
// Rendered as an SVG conic around the pin.
function DealOutcomeRing({ deals, size = 60 }) {
  if (!deals || deals.length === 0) return null;
  const kinds = ['won', 'lost', 'progressed', 'created'];
  const present = kinds.filter(k => deals.some(d => d.kind === k));
  if (present.length === 0) return null;
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const seg = circumference / present.length;
  return (
    <svg width={size} height={size} style={{
      position: 'absolute', top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'none',
      zIndex: 2,
    }}>
      <g transform={`rotate(-90 ${c} ${c})`}>
        {present.map((k, i) => (
          <circle key={k}
            cx={c} cy={c} r={r} fill="none"
            stroke={OPP_STYLE[k].color}
            strokeWidth={stroke}
            strokeDasharray={`${seg - 2} ${circumference}`}
            strokeDashoffset={-(i * seg)}
            strokeLinecap="butt"
          />
        ))}
      </g>
    </svg>
  );
}

// Small inline summary for month-view day cells
function OppDayBar({ opps }) {
  if (!opps || opps.length === 0) return null;
  const byKind = { won: 0, lost: 0, created: 0, progressed: 0 };
  let total = 0;
  let hasTeam = false;
  let hasMine = false;
  for (const o of opps) {
    byKind[o.kind]++;
    total += o.amount;
    if (o.mine) hasMine = true; else hasTeam = true;
  }
  const teamOnly = hasTeam && !hasMine;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 4,
      padding: '2px 4px',
      background: '#FBF9FC',
      borderRadius: 3,
      fontSize: 9, fontWeight: 600,
      fontVariantNumeric: 'tabular-nums',
      border: teamOnly ? '1px dashed #C2BBD4' : 'none',
      opacity: teamOnly ? 0.85 : 1,
    }}
      title={opps.map(o => `${o.owner}: ${o.district} — ${OPP_STYLE[o.kind].label} ${formatMoney(o.amount)}`).join('\n')}
    >
      {Object.entries(byKind).filter(([,n]) => n > 0).map(([k, n]) => (
        <span key={k} style={{
          display: 'inline-flex', alignItems: 'center', gap: 2,
          color: OPP_STYLE[k].color,
        }}>
          <span style={{ fontSize: 10 }}>{OPP_STYLE[k].icon}</span>{n}
        </span>
      ))}
      <span style={{ marginLeft: 'auto', color: '#544A78', fontSize: 9 }}>{formatMoney(total)}</span>
    </div>
  );
}

// Ribbon for week/schedule views — one column per day
function OppRibbon({ days, oppsByDay }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: `repeat(${days.length}, 1fr)`,
      gap: 6, padding: '8px 0',
    }}>
      {days.map(d => {
        const opps = oppsByDay.get(window.startOfDay(d).toISOString()) || [];
        if (opps.length === 0) {
          return <div key={d.toISOString()} style={{ minHeight: 28 }} />;
        }
        const total = opps.reduce((s, o) => s + o.amount, 0);
        return (
          <div key={d.toISOString()}
            title={opps.map(o => `${o.district}: ${OPP_STYLE[o.kind].label} ${formatMoney(o.amount)}`).join('\n')}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '4px 8px', borderRadius: 6,
              background: '#fff', border: '1px solid #E2DEEC',
              fontSize: 10, fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
              minHeight: 28,
            }}>
            {opps.slice(0, 3).map((o, i) => (
              <span key={i} style={{
                display: 'inline-flex', alignItems: 'center',
                color: OPP_STYLE[o.kind].color,
              }}>
                {OPP_STYLE[o.kind].icon}
              </span>
            ))}
            <span style={{ marginLeft: 'auto', color: '#403770' }}>{formatMoney(total)}</span>
          </div>
        );
      })}
    </div>
  );
}

// Summary card for the header: week or month totals
function OppSummaryStrip({ events, range, label, scope }) {
  const filtered = events.filter(e => e.date >= range.start && e.date <= range.end);
  const won = filtered.filter(e => e.kind === 'won');
  const lost = filtered.filter(e => e.kind === 'lost');
  const created = filtered.filter(e => e.kind === 'created');
  const progressed = filtered.filter(e => e.kind === 'progressed');
  const wonAmt = won.reduce((s,o) => s + o.amount, 0);
  const lostAmt = lost.reduce((s,o) => s + o.amount, 0);
  const createdAmt = created.reduce((s,o) => s + o.amount, 0);

  const [drawer, setDrawer] = React.useState(null); // { kind, list }

  // Past-due open deals — independent of `events` range; these are deals with
  // scheduled close dates that have already slipped. Attention-needing for the rep.
  const scopedOpenDeals = filterOpenDealsByScope(window.OPEN_DEALS, scope);
  const overdueDeals = pastDueDeals(scopedOpenDeals);
  const overdueAmt = overdueDeals.reduce((s, d) => s + d.amount, 0);

  // Cold districts — top accounts with no logged activity in 21+ days.
  const scopedDistricts = filterDistrictsByScope(window.TOP_DISTRICTS, scope);
  const coldList = coldDistricts(scopedDistricts);
  const coldArr = coldList.reduce((s, d) => s + d.arr, 0);

  const stats = [
    { k: 'won', label: 'Closed won', n: won.length, amt: wonAmt, list: won },
    { k: 'lost', label: 'Closed lost', n: lost.length, amt: lostAmt, list: lost },
    { k: 'created', label: 'New deals', n: created.length, amt: createdAmt, list: created },
    { k: 'progressed', label: 'Progressed', n: progressed.length, amt: progressed.reduce((s,o)=>s+o.amount,0), list: progressed },
  ];

  return (
    <>
      <div style={{
        display: 'flex', gap: 0, padding: '10px 16px',
        background: '#FBF9FC', border: '1px solid #E2DEEC',
        borderRadius: 10, alignItems: 'center',
      }}>
        <button
          onClick={() => setDrawer({ kind: 'all', list: filtered, label: 'All deal activity' })}
          style={{
            fontSize: 10, fontWeight: 700, color: '#8A80A8',
            letterSpacing: '0.08em', textTransform: 'uppercase', marginRight: 16,
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'transparent', border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', padding: '4px 6px', borderRadius: 6,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#F2EFF7'; e.currentTarget.style.color = '#403770'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#8A80A8'; }}
          title="See all deal activity in range"
        >
          <span style={{
            width: 6, height: 6, borderRadius: 999,
            background: scope === 'all' ? '#FFCF70' : '#F37167',
          }} />
          {scope === 'all' ? 'Team pipeline' : 'Your pipeline'} · {label}
        </button>
        {stats.map((s, i) => {
          const sty = OPP_STYLE[s.k];
          const disabled = s.n === 0;
          return (
            <button key={s.k}
              disabled={disabled}
              onClick={() => setDrawer({ kind: s.k, list: s.list, label: s.label })}
              style={{
                display: 'flex', alignItems: 'baseline', gap: 6,
                padding: '6px 16px',
                borderLeft: i === 0 ? 'none' : '1px solid #E2DEEC',
                borderTop: 'none', borderRight: 'none', borderBottom: 'none',
                minWidth: 120,
                background: 'transparent',
                cursor: disabled ? 'default' : 'pointer',
                fontFamily: 'inherit',
                borderRadius: 0,
                transition: 'background 120ms ease-out',
                opacity: disabled ? 0.55 : 1,
              }}
              onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = '#F2EFF7'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              title={disabled ? 'None in range' : `See ${s.n} ${s.label.toLowerCase()}`}
            >
              <span style={{
                fontSize: 14, fontWeight: 700, color: sty.color,
                fontVariantNumeric: 'tabular-nums',
              }}>{s.n}</span>
              <span style={{
                fontSize: 11, color: '#8A80A8', fontWeight: 500,
              }}>{s.label}</span>
              <span style={{
                marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: '#403770',
                fontVariantNumeric: 'tabular-nums',
              }}>{formatMoney(s.amt)}</span>
            </button>
          );
        })}

        {(overdueDeals.length > 0 || coldList.length > 0) && (
          <div style={{
            marginLeft: 'auto',
            display: 'flex', alignItems: 'center', gap: 8,
            paddingLeft: 12,
          }}>
            {overdueDeals.length > 0 && (
              <button
                onClick={() => setDrawer({
                  kind: 'overdue',
                  list: overdueDeals,
                  label: 'Past-due open deals',
                  isOpenDeals: true,
                })}
                title={`${overdueDeals.length} open ${overdueDeals.length === 1 ? 'deal has' : 'deals have'} a close date in the past — needs attention`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 12px',
                  background: '#FFF4E6',
                  border: '1px solid #F3B26A',
                  borderRadius: 999,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 120ms ease-out',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#FFE9CC';
                  e.currentTarget.style.borderColor = '#E09545';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#FFF4E6';
                  e.currentTarget.style.borderColor = '#F3B26A';
                }}
              >
                <span style={{
                  position: 'relative',
                  width: 8, height: 8, borderRadius: 999,
                  background: '#E09545',
                  flexShrink: 0,
                }}>
                  <span style={{
                    position: 'absolute', inset: -3,
                    borderRadius: 999,
                    background: '#E09545',
                    opacity: 0.35,
                    animation: 'fmOverduePulse 1.8s ease-in-out infinite',
                  }} />
                </span>
                <span style={{
                  fontSize: 13, fontWeight: 700, color: '#8F5218',
                  fontVariantNumeric: 'tabular-nums',
                }}>{overdueDeals.length}</span>
                <span style={{
                  fontSize: 11, color: '#8F5218', fontWeight: 600,
                  letterSpacing: '0.01em',
                }}>past-due close</span>
                <span style={{
                  fontSize: 11, fontWeight: 600, color: '#8F5218',
                  fontVariantNumeric: 'tabular-nums',
                  opacity: 0.7,
                  paddingLeft: 4, borderLeft: '1px solid rgba(143,82,24,0.25)',
                }}>{formatMoney(overdueAmt)}</span>
              </button>
            )}

            {coldList.length > 0 && (
              <button
                onClick={() => setDrawer({
                  kind: 'cold',
                  list: coldList,
                  label: 'Districts going cold',
                  isDistricts: true,
                })}
                title={`${coldList.length} top ${coldList.length === 1 ? 'district has' : 'districts have'} had no logged activity in 21+ days`}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 12px',
                  background: '#EEF3F7',
                  border: '1px solid #A9BFD0',
                  borderRadius: 999,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 120ms ease-out',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#DCE6EF';
                  e.currentTarget.style.borderColor = '#8AA4BB';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#EEF3F7';
                  e.currentTarget.style.borderColor = '#A9BFD0';
                }}
              >
                {/* Snowflake glyph signals "going cold" */}
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M6 1v10M1 6h10M2.5 2.5l7 7M9.5 2.5l-7 7" stroke="#4C6B85" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                <span style={{
                  fontSize: 13, fontWeight: 700, color: '#3F5A72',
                  fontVariantNumeric: 'tabular-nums',
                }}>{coldList.length}</span>
                <span style={{
                  fontSize: 11, color: '#4C6B85', fontWeight: 600,
                  letterSpacing: '0.01em',
                }}>going cold</span>
                <span style={{
                  fontSize: 11, fontWeight: 600, color: '#4C6B85',
                  fontVariantNumeric: 'tabular-nums',
                  opacity: 0.7,
                  paddingLeft: 4, borderLeft: '1px solid rgba(76,107,133,0.25)',
                }}>{formatMoney(coldArr)}</span>
              </button>
            )}

            <style>{`
              @keyframes fmOverduePulse {
                0%, 100% { transform: scale(1); opacity: 0.35; }
                50% { transform: scale(1.8); opacity: 0; }
              }
            `}</style>
          </div>
        )}
      </div>
      {drawer && (
        <OppDrawer
          kind={drawer.kind}
          deals={drawer.list}
          heading={drawer.label}
          rangeLabel={label}
          scope={scope}
          onClose={() => setDrawer(null)}
        />
      )}
    </>
  );
}

// ============================================================================
// OppDrawer — slide-over list of deal events, filtered by kind, grouped by date
// ============================================================================
function OppDrawer({ kind, deals, heading, rangeLabel, scope, onClose }) {
  const KIND_META = {
    won:        { accent: '#2D6B4D', bg: '#DDEFE3' },
    lost:       { accent: '#9B3A2E', bg: '#F5D4CF' },
    created:    { accent: '#403770', bg: '#E8E4F1' },
    progressed: { accent: '#C79A3E', bg: '#FCEFC7' },
    all:        { accent: '#403770', bg: '#EFEDF5' },
    overdue:    { accent: '#8F5218', bg: '#FFE9CC' },
    cold:       { accent: '#3F5A72', bg: '#DCE6EF' },
  };
  const meta = KIND_META[kind] || KIND_META.all;
  const isOverdue = kind === 'overdue';
  const isCold = kind === 'cold';

  // ESC to close
  React.useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  // For event-based deals, group by date (desc). For overdue open deals,
  // list them sorted by most overdue first. For cold districts, sort by ARR.
  const groups = [];
  if (isOverdue) {
    const sorted = deals.slice().sort((a, b) => a.closeDate - b.closeDate);
    groups.push({ flat: true, items: sorted });
  } else if (isCold) {
    const sorted = deals.slice().sort((a, b) => b.arr - a.arr);
    groups.push({ flat: true, items: sorted });
  } else {
    const sorted = deals.slice().sort((a, b) => b.date - a.date);
    const seen = new Map();
    for (const d of sorted) {
      const k = window.startOfDay(d.date).toISOString();
      if (!seen.has(k)) { seen.set(k, { date: window.startOfDay(d.date), items: [] }); groups.push(seen.get(k)); }
      seen.get(k).items.push(d);
    }
  }

  const totalAmt = deals.reduce((s, d) => s + (isCold ? d.arr : d.amount), 0);
  const itemNoun = isCold ? 'district' : 'deal';

  return (
    <div onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(47,41,75,0.35)',
        display: 'flex', justifyContent: 'flex-end',
        animation: 'fmFadeIn 160ms ease-out',
      }}>
      <style>{`
        @keyframes fmFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fmSlideIn { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      `}</style>
      <div onClick={(e) => e.stopPropagation()}
        style={{
          width: 440, maxWidth: '90vw', height: '100%',
          background: '#fff', borderLeft: '1px solid #D4CFE2',
          display: 'flex', flexDirection: 'column',
          animation: 'fmSlideIn 200ms ease-out',
          boxShadow: '-20px 0 40px rgba(64,55,112,0.15)',
        }}>
        {/* Header */}
        <div style={{
          padding: '18px 20px 14px',
          borderBottom: '1px solid #E2DEEC',
          background: meta.bg,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, color: meta.accent, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {scope === 'all' ? 'Team' : 'You'} · {rangeLabel}
              </div>
              <h2 style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 700, color: '#403770', letterSpacing: '-0.01em' }}>
                {heading}
              </h2>
              <div style={{ marginTop: 6, fontSize: 12, color: '#544A78' }}>
                <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{deals.length}</strong>
                {' '}{deals.length === 1 ? itemNoun : itemNoun + 's'}
                {' · '}
                <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{formatMoney(totalAmt)}</strong>
                {isCold && <span style={{ color: '#8A80A8', fontWeight: 500 }}> at risk</span>}
              </div>
              {isOverdue && (
                <div style={{
                  marginTop: 8, fontSize: 11, color: '#8F5218',
                  lineHeight: 1.5,
                }}>
                  Open deals whose <strong>close date has passed</strong>. Advance the stage, update the date, or mark as lost.
                </div>
              )}
              {isCold && (
                <div style={{
                  marginTop: 8, fontSize: 11, color: '#3F5A72',
                  lineHeight: 1.5,
                }}>
                  Top districts with <strong>no logged activity in 21+ days</strong>. Send a check-in, book a meeting, or update the account.
                </div>
              )}
            </div>
            <button onClick={onClose}
              aria-label="Close"
              style={{
                width: 28, height: 28, borderRadius: 8, border: '1px solid #D4CFE2',
                background: '#fff', color: '#544A78', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, lineHeight: 1, fontFamily: 'inherit',
              }}>×</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto' }} className="fm-scrollbar">
          {deals.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#8A80A8', fontSize: 13 }}>
              {isCold ? 'No cold districts — everything has recent activity.' : 'No deals in this range.'}
            </div>
          ) : (
            groups.map((g, gi) => (
              <div key={g.flat ? 'flat' : g.date.toISOString()}>
                {!g.flat && (
                  <div style={{
                    padding: '10px 20px 4px',
                    fontSize: 10, fontWeight: 700, color: '#8A80A8',
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    background: '#FBF9FC',
                    borderBottom: '1px solid #EFEDF5',
                    display: 'flex', justifyContent: 'space-between',
                  }}>
                    <span>{window.fmtDateShort(g.date)}</span>
                    <span style={{ color: '#A69DC0', fontWeight: 500 }}>
                      {g.date.toLocaleDateString('en-US', { weekday: 'long' })}
                    </span>
                  </div>
                )}
                {g.items.map((d, i) => (
                  isOverdue
                    ? <OverdueDealRow key={i} deal={d} />
                    : isCold
                    ? <ColdDistrictRow key={i} district={d} />
                    : <OppDrawerRow key={i} deal={d} />
                ))}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid #E2DEEC',
          background: '#FBF9FC',
          fontSize: 11, color: '#8A80A8',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>Press <kbd style={{
            padding: '1px 5px', fontSize: 10, fontFamily: 'inherit',
            background: '#fff', border: '1px solid #D4CFE2', borderRadius: 4,
            color: '#544A78', fontWeight: 600,
          }}>Esc</kbd> to close</span>
          <a href="#" onClick={(e) => e.preventDefault()} style={{
            fontSize: 11, fontWeight: 600, color: '#403770', textDecoration: 'none',
          }}>Open in LMS →</a>
        </div>
      </div>
    </div>
  );
}

function OppDrawerRow({ deal }) {
  const sty = OPP_STYLE[deal.kind];
  const t = window.getTeammate(deal.owner);
  const [hover, setHover] = React.useState(false);
  const handleOpen = (e) => {
    e.preventDefault();
    // In production, link to the LMS deal record. For now, log for demo.
    console.log('Opening deal in LMS:', deal.district);
  };
  return (
    <a href="#" onClick={handleOpen}
      style={{
        padding: '12px 20px',
        display: 'flex', alignItems: 'flex-start', gap: 12,
        borderBottom: '1px solid #F7F5FA',
        cursor: 'pointer',
        transition: 'background 120ms ease-out',
        background: hover ? '#FBF9FC' : '#fff',
        textDecoration: 'none',
        color: 'inherit',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div style={{
        width: 28, height: 28, borderRadius: 6, flexShrink: 0,
        background: sty.bg, color: sty.color,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 700, lineHeight: 1,
      }}>{sty.icon || sty.label[0]}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 8, justifyContent: 'space-between',
        }}>
          <div style={{
            fontSize: 13, fontWeight: 600, color: '#403770',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            display: 'flex', alignItems: 'baseline', gap: 6,
          }}>
            <span>{deal.district}</span>
            <span style={{
              fontSize: 11, color: '#8A80A8',
              opacity: hover ? 1 : 0,
              transition: 'opacity 120ms ease-out',
              flexShrink: 0,
            }}>↗</span>
          </div>
          <div style={{
            fontSize: 13, fontWeight: 700, color: sty.color,
            fontVariantNumeric: 'tabular-nums', flexShrink: 0,
          }}>{formatMoney(deal.amount)}</div>
        </div>
        <div style={{
          marginTop: 3, fontSize: 11, color: '#6E6390',
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        }}>
          <span>{sty.label}</span>
          <span style={{ color: '#C2BBD4' }}>·</span>
          {deal.kind === 'progressed' && deal.fromStage ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: '#8A80A8' }}>{deal.fromStage}</span>
              <span style={{ color: sty.color, fontWeight: 700 }}>→</span>
              <span style={{ color: '#403770', fontWeight: 600 }}>{deal.stage}</span>
            </span>
          ) : (
            <span>{deal.stage}</span>
          )}
          {t && (
            <>
              <span style={{ color: '#C2BBD4' }}>·</span>
              <window.TeammateChip owner={deal.owner} size={14} />
            </>
          )}
        </div>
      </div>
    </a>
  );
}

// Open-deal row with past-due emphasis: shows "X days overdue" badge + close date.
function OverdueDealRow({ deal }) {
  const t = window.getTeammate(deal.owner);
  const overdue = daysOverdue(deal);
  const severity = overdue > 21 ? 'high' : overdue > 7 ? 'med' : 'low';
  const sevColors = {
    high: { bg: '#F5D4CF', fg: '#9B3A2E', border: '#E0A39B' },
    med:  { bg: '#FFE9CC', fg: '#8F5218', border: '#F3B26A' },
    low:  { bg: '#FDF3DC', fg: '#A17820', border: '#E8C77A' },
  }[severity];
  const [hover, setHover] = React.useState(false);
  const handleOpen = (e) => {
    e.preventDefault();
    console.log('Opening deal in LMS:', deal.district);
  };

  return (
    <a href="#" onClick={handleOpen}
      style={{
        padding: '12px 20px',
        display: 'flex', alignItems: 'flex-start', gap: 12,
        borderBottom: '1px solid #F7F5FA',
        cursor: 'pointer',
        transition: 'background 120ms ease-out',
        position: 'relative',
        background: hover ? '#FBF9FC' : '#fff',
        textDecoration: 'none',
        color: 'inherit',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Severity rail */}
      <div style={{
        position: 'absolute', left: 0, top: 8, bottom: 8,
        width: 3, borderRadius: 2,
        background: sevColors.fg,
      }} />
      <div style={{
        width: 28, height: 28, borderRadius: 6, flexShrink: 0,
        background: sevColors.bg, color: sevColors.fg,
        border: '1px solid ' + sevColors.border,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 700, lineHeight: 1,
      }}>!</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 8, justifyContent: 'space-between',
        }}>
          <div style={{
            fontSize: 13, fontWeight: 600, color: '#403770',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            display: 'flex', alignItems: 'baseline', gap: 6,
          }}>
            <span>{deal.district}</span>
            <span style={{
              fontSize: 11, color: '#8A80A8',
              opacity: hover ? 1 : 0,
              transition: 'opacity 120ms ease-out',
              flexShrink: 0,
            }}>↗</span>
          </div>
          <div style={{
            fontSize: 13, fontWeight: 700, color: '#403770',
            fontVariantNumeric: 'tabular-nums', flexShrink: 0,
          }}>{formatMoney(deal.amount)}</div>
        </div>
        <div style={{
          marginTop: 4, fontSize: 11, color: '#6E6390',
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 7px',
            background: sevColors.bg,
            color: sevColors.fg,
            border: '1px solid ' + sevColors.border,
            borderRadius: 999,
            fontSize: 10, fontWeight: 700,
            letterSpacing: '0.01em',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {overdue} {overdue === 1 ? 'day' : 'days'} overdue
          </span>
          <span style={{ color: '#8A80A8' }}>{deal.stage}</span>
          <span style={{ color: '#C2BBD4' }}>·</span>
          <span style={{ color: '#8A80A8' }}>
            Close {window.fmtDateShort(deal.closeDate)}
          </span>
          {t && (
            <>
              <span style={{ color: '#C2BBD4' }}>·</span>
              <window.TeammateChip owner={deal.owner} size={14} />
            </>
          )}
        </div>
      </div>
    </a>
  );
}

// Row for a "going cold" district — shows last-touch date, ARR, and owner.
function ColdDistrictRow({ district }) {
  const t = window.getTeammate(district.owner);
  const days = daysSinceActivity(district);
  const severity = days > 45 ? 'high' : days > 28 ? 'med' : 'low';
  const sevColors = {
    high: { bg: '#D9E6F1', fg: '#2B4A66', border: '#8AA4BB' },
    med:  { bg: '#E3ECF3', fg: '#3F5A72', border: '#A9BFD0' },
    low:  { bg: '#EEF3F7', fg: '#4C6B85', border: '#C5D2DE' },
  }[severity];
  const [hover, setHover] = React.useState(false);
  const handleOpen = (e) => {
    e.preventDefault();
    console.log('Opening district in LMS:', district.district);
  };
  const typeLabel = district.type === 'customer' ? 'Customer' : 'Open deal';
  const valueLabel = district.type === 'customer' ? 'ARR' : 'Pipeline';

  return (
    <a href="#" onClick={handleOpen}
      style={{
        padding: '12px 20px',
        display: 'flex', alignItems: 'flex-start', gap: 12,
        borderBottom: '1px solid #F7F5FA',
        cursor: 'pointer',
        transition: 'background 120ms ease-out',
        position: 'relative',
        background: hover ? '#FBF9FC' : '#fff',
        textDecoration: 'none',
        color: 'inherit',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {/* Severity rail */}
      <div style={{
        position: 'absolute', left: 0, top: 8, bottom: 8,
        width: 3, borderRadius: 2,
        background: sevColors.fg,
      }} />
      {/* Snowflake glyph */}
      <div style={{
        width: 28, height: 28, borderRadius: 6, flexShrink: 0,
        background: sevColors.bg, color: sevColors.fg,
        border: '1px solid ' + sevColors.border,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
          <path d="M6 1v10M1 6h10M2.5 2.5l7 7M9.5 2.5l-7 7" stroke={sevColors.fg} strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'baseline', gap: 8, justifyContent: 'space-between',
        }}>
          <div style={{
            fontSize: 13, fontWeight: 600, color: '#403770',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            display: 'flex', alignItems: 'baseline', gap: 6,
          }}>
            <span>{district.district}</span>
            <span style={{
              fontSize: 11, color: '#8A80A8',
              opacity: hover ? 1 : 0,
              transition: 'opacity 120ms ease-out',
              flexShrink: 0,
            }}>↗</span>
          </div>
          <div style={{
            fontSize: 13, fontWeight: 700, color: '#403770',
            fontVariantNumeric: 'tabular-nums', flexShrink: 0,
          }}>{formatMoney(district.arr)}</div>
        </div>
        <div style={{
          marginTop: 4, fontSize: 11, color: '#6E6390',
          display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 7px',
            background: sevColors.bg,
            color: sevColors.fg,
            border: '1px solid ' + sevColors.border,
            borderRadius: 999,
            fontSize: 10, fontWeight: 700,
            letterSpacing: '0.01em',
            fontVariantNumeric: 'tabular-nums',
          }}>
            {days} days no touch
          </span>
          <span style={{ color: '#8A80A8' }}>{typeLabel}</span>
          <span style={{ color: '#C2BBD4' }}>·</span>
          <span style={{ color: '#8A80A8' }}>
            Last: {window.fmtDateShort(district.lastActivity)}
          </span>
          {t && (
            <>
              <span style={{ color: '#C2BBD4' }}>·</span>
              <window.TeammateChip owner={district.owner} size={14} />
            </>
          )}
        </div>
      </div>
    </a>
  );
}

Object.assign(window, {
  OPP_EVENTS, OPP_STYLE, OPEN_DEALS, TOP_DISTRICTS, DEAL_STAGES, allDealDistricts,
  groupOppsByDay, filterOppsByScope, filterOppsByKind, filterOpps,
  filterOpenDealsByScope, filterDistrictsByScope,
  pastDueDeals, daysOverdue, coldDistricts, daysSinceActivity,
  formatMoney, OppDayBar, OppRibbon, OppSummaryStrip,
  DealChip, DealOutcomeRing,
});
