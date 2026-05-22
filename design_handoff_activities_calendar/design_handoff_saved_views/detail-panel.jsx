/* global React */
// Unified detail panel — renders contextually based on entity kind

const { useState: usePS } = React;

const PILL_PS = (bg, fg) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: bg, color: fg, whiteSpace: 'nowrap' });

const SAMPLE_CONTACTS = {
  'Dr. Maria Chen':    { role: 'Superintendent',    district: 'Detroit Public Schools',         email: 'mchen@detroitk12.org',     phone: '(313) 555-0142', tier: 'Champion', last: '2d ago', email_count: 14, mtg_count: 3 },
  'James Okafor':      { role: 'CTO',               district: 'Grand Rapids Public Schools',    email: 'jokafor@grps.org',         phone: '(616) 555-0188', tier: 'Engaged',  last: '6d ago', email_count: 8,  mtg_count: 2 },
  'Sarah Patel':       { role: 'Curr. Director',    district: 'Ann Arbor Public Schools',       email: 'spatel@a2schools.org',     phone: '(734) 555-0166', tier: 'Champion', last: '1w ago', email_count: 22, mtg_count: 5 },
  'Robert Liang':      { role: 'Asst. Superintendent', district: 'Boston Public Schools',       email: 'rliang@bostonpublicschools.org', phone: '(617) 555-0173', tier: 'Engaged', last: '3d ago', email_count: 6, mtg_count: 1 },
};

const SAMPLE_OPPS = {
  'Math 6–12 expansion':           { district: 'Detroit Public Schools',     stage: 'Proposal',    arr: '$148K', close: 'Jun 15', owner: 'AR', conf: 'High',   notes: 'Curriculum committee approved demo; legal review next week.' },
  'SEL screener pilot':            { district: 'Boston Public Schools',      stage: 'Discovery',   arr: '$48K',  close: 'Aug 02', owner: 'AR', conf: 'Medium', notes: 'Awaiting RFP details from district procurement.' },
  'Tutoring renewal':              { district: 'Providence Public Schools',  stage: 'Negotiation', arr: '$92K',  close: 'May 28', owner: 'AR', conf: 'High',   notes: 'Pricing on second-year discount under review.' },
  'Math intervention K–5':         { district: 'Worcester Public Schools',   stage: 'Proposal',    arr: '$58K',  close: 'Jun 30', owner: 'AR', conf: 'Medium', notes: 'Submitted in response to RFP — vendor selection mid-May.' },
};

const STAGE_PILL_PS = {
  'Champion':    { bg: '#EDFFE3', fg: '#5f665b' },
  'Engaged':     { bg: '#e8f1f5', fg: '#4d7285' },
  'Cold':        { bg: '#EFEDF5', fg: '#6f6786' },
  'Discovery':   { bg: '#e8f1f5', fg: '#4d7285' },
  'Proposal':    { bg: '#FFF6DD', fg: '#7d6d3a' },
  'Negotiation': { bg: '#FEF2F1', fg: '#c25a52' },
  'Open':        { bg: '#EDFFE3', fg: '#5f665b' },
};

function DetailPanel({ kind, id, onClose }) {
  const { XIcon, MapPinIcon, UsersIcon, FolkBookmarkIcon: BookmarkIcon, FolkShareIcon: ShareIcon, PencilIcon } = window;

  let header = null, body = null;

  if (kind === 'contact') {
    const c = SAMPLE_CONTACTS[id] || Object.values(SAMPLE_CONTACTS)[0];
    const tierPill = STAGE_PILL_PS[c.tier] || STAGE_PILL_PS.Engaged;
    header = (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <UsersIcon size={11} style={{ color: '#F37167' }} />
          <span style={lblTiny}>Contact</span>
        </div>
        <h2 style={h2Style}>{id}</h2>
        <div style={metaRow}>
          <span style={PILL_PS(tierPill.bg, tierPill.fg)}>{c.tier}</span>
          <span style={{ fontSize: 11, color: '#8A80A8' }}>{c.role} · {c.district}</span>
        </div>
      </>
    );
    body = (
      <>
        <Section label="Contact info">
          <KV k="Email" v={c.email} />
          <KV k="Phone" v={c.phone} />
          <KV k="Last touch" v={c.last} />
        </Section>
        <Section label="Engagement">
          <Grid cols={2}>
            <Stat label="Emails" value={c.email_count} />
            <Stat label="Meetings" value={c.mtg_count} />
          </Grid>
        </Section>
        <Section label="Recent">
          <Item title="Pricing follow-up" sub="Email · 2d ago" />
          <Item title="Discovery call" sub="5d ago · 32 min" />
          <Item title="Onsite walkthrough" sub="2w ago" last />
        </Section>
      </>
    );
  } else if (kind === 'opp') {
    const o = SAMPLE_OPPS[id] || Object.values(SAMPLE_OPPS)[0];
    const sp = STAGE_PILL_PS[o.stage] || STAGE_PILL_PS.Discovery;
    header = (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={lblTiny}>Opportunity</span>
        </div>
        <h2 style={h2Style}>{id}</h2>
        <div style={metaRow}>
          <span style={PILL_PS(sp.bg, sp.fg)}>{o.stage}</span>
          <span style={{ fontSize: 11, color: '#8A80A8' }}>{o.district}</span>
        </div>
      </>
    );
    body = (
      <>
        <Grid cols={2}>
          <Stat label="ARR" value={o.arr} />
          <Stat label="Close" value={o.close} />
          <Stat label="Owner" value={o.owner} />
          <Stat label="Confidence" value={o.conf} />
        </Grid>
        <Section label="Notes">
          <div style={{ fontSize: 12, color: '#544A78', lineHeight: 1.5, padding: 10, background: '#FFFCFA', border: '1px solid #E2DEEC', borderRadius: 8 }}>{o.notes}</div>
        </Section>
        <Section label="Stage history">
          <Item title="Discovery" sub="Apr 02 · 21 days" />
          <Item title="Proposal" sub="Apr 23 · in progress" last />
        </Section>
      </>
    );
  } else if (kind === 'vacancy') {
    const v = (window.FEED_VAC || []).find(x => x.id === id || x.role === id) || (window.FEED_VAC || [])[0];
    const SIG = { high: { bg: '#FEF2F1', fg: '#c25a52', label: 'High signal' }, med: { bg: '#FFF6DD', fg: '#7d6d3a', label: 'Med signal' }, low: { bg: '#EFEDF5', fg: '#6f6786', label: 'Low signal' } };
    const s = SIG[v.signal];
    header = (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <MapPinIcon size={11} style={{ color: '#F37167' }} />
          <span style={lblTiny}>Vacancy · {v.district}</span>
        </div>
        <h2 style={h2Style}>{v.role}</h2>
        <div style={metaRow}>
          <span style={PILL_PS(s.bg, s.fg)}>{s.label}</span>
          <span style={{ fontSize: 11, color: '#8A80A8' }}>Posted {v.posted}</span>
        </div>
      </>
    );
    body = (
      <>
        <Section label="Why it matters">
          <div style={{ fontSize: 12, color: '#544A78', lineHeight: 1.5, padding: 10, background: '#FFFCFA', border: '1px solid #E2DEEC', borderRadius: 8 }}>
            {v.note || 'Leadership transitions often trigger budget reviews and vendor reassessment within 90 days.'}
          </div>
        </Section>
        <Grid cols={2}>
          <Stat label="Status" value={v.status} />
          <Stat label="Posted" value={v.posted} />
        </Grid>
        <Section label="Suggested actions">
          <Item title="Add to Q3 watchlist" sub="Track when filled" />
          <Item title="Brief account owner" sub={`Notify ${v.district} owner`} />
          <Item title="Set follow-up task" sub="Re-engage in 30 days" last />
        </Section>
      </>
    );
  } else if (kind === 'news') {
    const n = (window.FEED_NEWS || []).find(x => x.id === id || x.headline === id) || (window.FEED_NEWS || [])[0];
    header = (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={lblTiny}>News · {n.district}</span>
        </div>
        <h2 style={h2Style}>{n.headline}</h2>
        <div style={metaRow}>
          <span style={PILL_PS(n.tagBg, n.tagFg)}>{n.tag}</span>
          <span style={{ fontSize: 11, color: '#8A80A8' }}>{n.source} · {n.date}</span>
        </div>
      </>
    );
    body = (
      <>
        <Section label="Summary">
          <div style={{ fontSize: 12, color: '#544A78', lineHeight: 1.55, padding: 10, background: '#FFFCFA', border: '1px solid #E2DEEC', borderRadius: 8 }}>
            District leadership announcement triggered an internal review. Watch for follow-on procurement signals over the next 60 days.
          </div>
        </Section>
        <Section label="Related districts in plan">
          <Item title={n.district} sub="Active in FY26 · Northeast Pod" />
        </Section>
        <Section label="Suggested actions">
          <Item title="Add to plan brief" sub="Flag for next territory review" />
          <Item title="Share with team" sub="Send to #partnerships-northeast" last />
        </Section>
      </>
    );
  } else if (kind === 'rfp') {
    const r = (window.FEED_RFPS || []).find(x => x.id === id || x.title === id) || (window.FEED_RFPS || [])[0];
    const sp = STAGE_PILL_PS[r.status] || STAGE_PILL_PS.Open;
    header = (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <span style={lblTiny}>RFP · {r.district}</span>
        </div>
        <h2 style={h2Style}>{r.title}</h2>
        <div style={metaRow}>
          <span style={PILL_PS(sp.bg, sp.fg)}>{r.status}</span>
          <span style={PILL_PS('#EFEDF5', '#6f6786')}>{r.category}</span>
          <span style={{ fontSize: 11, color: '#8A80A8' }}>{r.stage}</span>
        </div>
      </>
    );
    body = (
      <>
        <Grid cols={2}>
          <Stat label="Posted" value={r.posted} />
          <Stat label="Due" value={r.due} />
          <Stat label="Value" value={r.value} />
          <Stat label="Status" value={r.status} />
        </Grid>
        <Section label="Scope">
          <div style={{ fontSize: 12, color: '#544A78', lineHeight: 1.55, padding: 10, background: '#FFFCFA', border: '1px solid #E2DEEC', borderRadius: 8 }}>
            District is soliciting proposals for {r.title.toLowerCase()}. Submission window closes {r.due}.
          </div>
        </Section>
        <Section label="Suggested actions">
          <Item title="Convert to Opportunity" sub={`${r.value} potential ARR`} />
          <Item title="Assign to RFP team" sub="Notify proposals@" />
          <Item title="Calendar reminder" sub={`3 days before ${r.due}`} last />
        </Section>
      </>
    );
  }

  return (
    <div style={panelWrap}>
      <style>{`@keyframes psSlide { from { transform: translateX(20px); opacity: 0 } to { transform: translateX(0); opacity: 1 } }`}</style>
      <div style={{ padding: '14px 18px 12px', borderBottom: '1px solid #E2DEEC' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>{header}</div>
          <button onClick={onClose} style={btnXPS}><XIcon size={16} /></button>
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
          <button style={btnPriPS}><PencilIcon size={11} /> Log activity</button>
          <button style={btnSecPS}><BookmarkIcon size={11} /> Save</button>
          <button style={btnSecPS}><ShareIcon size={11} /></button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 16 }} className="fm-scrollbar">
        {body}
      </div>
    </div>
  );
}

// — Atoms —
function Section({ label, children }) {
  return (
    <div>
      <div style={lblTiny}>{label}</div>
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  );
}
function KV({ k, v }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #EFEDF5' }}>
      <span style={{ fontSize: 11, color: '#8A80A8' }}>{k}</span>
      <span style={{ fontSize: 12, color: '#403770', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{v}</span>
    </div>
  );
}
function Grid({ cols, children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8 }}>{children}</div>;
}
function Stat({ label, value }) {
  return (
    <div style={{ padding: 10, background: '#FFFCFA', border: '1px solid #E2DEEC', borderRadius: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#8A80A8', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#403770', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}
function Item({ title, sub, last }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 0', borderBottom: last ? 'none' : '1px solid #EFEDF5' }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#F37167', marginTop: 6, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, color: '#403770', fontWeight: 500 }}>{title}</div>
        <div style={{ fontSize: 11, color: '#8A80A8', marginTop: 1 }}>{sub}</div>
      </div>
    </div>
  );
}

// — Styles —
const panelWrap = {
  position: 'absolute', top: 0, right: 0, bottom: 0, width: 380, background: '#fff',
  borderLeft: '1px solid #D4CFE2', boxShadow: '-12px 0 32px rgba(64,55,112,0.08)',
  display: 'flex', flexDirection: 'column',
  animation: 'psSlide 250ms cubic-bezier(0.16, 1, 0.3, 1)',
  zIndex: 50,
};
const lblTiny = { fontSize: 10, color: '#8A80A8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' };
const h2Style = { fontSize: 18, fontWeight: 700, color: '#403770', margin: 0, letterSpacing: '-0.01em', lineHeight: 1.25 };
const metaRow = { display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' };
const btnXPS = { padding: 6, background: 'transparent', border: 'none', borderRadius: 6, color: '#8A80A8', cursor: 'pointer' };
const btnPriPS = { flex: 1, padding: '7px 10px', fontSize: 12, fontFamily: 'inherit', background: '#403770', border: 'none', borderRadius: 7, color: '#fff', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 };
const btnSecPS = { padding: '7px 10px', fontSize: 12, fontFamily: 'inherit', background: '#fff', border: '1px solid #D4CFE2', borderRadius: 7, color: '#403770', fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 };

window.DetailPanel = DetailPanel;
