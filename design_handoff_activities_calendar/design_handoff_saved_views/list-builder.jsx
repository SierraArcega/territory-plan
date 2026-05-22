/* global React */
const { useState: useLBS, useMemo: useLBM } = React;

// ─────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────
const SOURCES = [
  { id: 'districts',  label: 'Districts',  icon: '🗺️', countBase: 12847 },
  { id: 'contacts',   label: 'Contacts',   icon: '👥', countBase: 4392 },
  { id: 'opps',       label: 'Opps',       icon: '💼', countBase: 218 },
  { id: 'vacancies',  label: 'Vacancies',  icon: '👤', countBase: 982 },
  { id: 'news',       label: 'News',       icon: '📰', countBase: 6140 },
  { id: 'rfps',       label: 'RFPs',       icon: '📄', countBase: 318 },
];

const FIELDS = {
  districts: [
    { id: 'state',     label: 'State',          ops: ['is', 'is not', 'is any of'], values: ['NY','NJ','CT','MA','PA','VT','NH','ME','RI','IA','MI'] },
    { id: 'tier',      label: 'Tier',           ops: ['is', 'is not'],          values: ['A','B','C'] },
    { id: 'enrollment',label: 'Enrollment',     ops: ['>', '<'],                values: ['1,000','5,000','10,000','25,000'] },
    { id: 'stage',     label: 'Stage',          ops: ['is', 'is not'],          values: ['Customer','Prospect','Lapsed','Churned'] },
    { id: 'lastact',   label: 'Last activity',  ops: ['within', 'before'],      values: ['7 days','30 days','90 days','6 months'] },
    { id: 'arr',       label: 'ARR',            ops: ['>', '<'],                values: ['$10K','$50K','$100K','$250K'] },
    { id: 'title1',    label: 'Title I',        ops: ['is'],                    values: ['Yes','No'] },
  ],
  contacts: [
    { id: 'role',      label: 'Role',           ops: ['is', 'is not'],          values: ['Superintendent','CTO','Curriculum Director','Principal','Procurement'] },
    { id: 'cstage',    label: 'Stage',          ops: ['is'],                    values: ['Champion','Engaged','Cold'] },
    { id: 'lasttouch', label: 'Last touch',     ops: ['within','before'],       values: ['7 days','14 days','30 days','60 days'] },
  ],
  opps: [
    { id: 'ostage',    label: 'Stage',          ops: ['is','is not'],           values: ['Discovery','Proposal','Negotiation','Closed Won','Closed Lost'] },
    { id: 'oarr',      label: 'ARR',            ops: ['>','<'],                 values: ['$10K','$50K','$100K','$250K'] },
    { id: 'oclose',    label: 'Close date',     ops: ['within','before'],       values: ['this quarter','next 30 days','next 60 days'] },
  ],
  vacancies: [
    { id: 'vrole',     label: 'Role',           ops: ['is','is not'],           values: ['Superintendent','CTO','Curriculum Director','Asst. Superintendent','Procurement Lead'] },
    { id: 'vposted',   label: 'Posted',         ops: ['within'],                values: ['7 days','14 days','30 days','60 days'] },
    { id: 'vsignal',   label: 'Signal',         ops: ['is'],                    values: ['High','Med','Low'] },
  ],
  news: [
    { id: 'ntag',      label: 'Category',       ops: ['is','is not'],           values: ['Funding','Leadership','Curriculum','Risk','Procurement','Strategy','Program'] },
    { id: 'npub',      label: 'Published',      ops: ['within'],                values: ['7 days','14 days','30 days'] },
  ],
  rfps: [
    { id: 'rstatus',   label: 'Status',         ops: ['is','is not'],           values: ['Open','Reviewing','Awarded'] },
    { id: 'rcategory', label: 'Category',       ops: ['is'],                    values: ['Curriculum','Tutoring','SEL','Program'] },
    { id: 'rvalue',    label: 'Value',          ops: ['>','<'],                 values: ['$50K','$100K','$250K','$500K'] },
    { id: 'rdue',      label: 'Due',            ops: ['within','before'],       values: ['14 days','30 days','60 days'] },
  ],
};

const PREVIEW_DATA = {
  districts: [
    { primary: 'Mapleton ISD',     secondary: 'NY · Tier A · 18,400 students',  meta: '$92K pipeline' },
    { primary: 'Westbrook USD',    secondary: 'NJ · Tier A · 24,100 students',  meta: '$148K pipeline' },
    { primary: 'Granite Falls SD', secondary: 'NY · Tier B · 9,800 students',   meta: '$58K pipeline' },
  ],
  contacts: [
    { primary: 'Dr. Maria Chen',   secondary: 'Superintendent · Mapleton ISD',  meta: 'Champion · 2d ago' },
    { primary: 'James Okafor',     secondary: 'CTO · Westbrook USD',            meta: 'Engaged · 5d ago' },
  ],
  opps: [
    { primary: 'Mapleton ISD — Math 6–12 expansion', secondary: 'Proposal · Close May 30', meta: '$92K' },
  ],
  vacancies: [
    { primary: 'Superintendent', secondary: 'Detroit Public Schools · MI',  meta: 'High · Posted 4d ago' },
    { primary: 'CTO',            secondary: 'Hartford Public Schools · CT', meta: 'High · Posted 1w ago' },
  ],
  news: [
    { primary: '$8.4M bond approved for STEM upgrades', secondary: 'Detroit PS · Funding',  meta: 'Detroit Free Press · 2d ago' },
    { primary: 'Board names interim Superintendent',    secondary: 'Boston PS · Leadership', meta: 'Boston Globe · 5d ago' },
  ],
  rfps: [
    { primary: 'Math 6–12 supplemental curriculum',  secondary: 'Detroit PS · Curriculum', meta: '$420K · Due May 30' },
  ],
};

// ─────────────────────────────────────────────────────────────────
// Condition model — flat list of AND'd rules
//   { kind: 'rule', fieldId, op, value }
//   { kind: 'any',  fieldId, op: 'is any of', values: [...] }  (rendered as one chip; emitted by AI)
// ─────────────────────────────────────────────────────────────────
const defaultRule = (sourceId) => { const f = FIELDS[sourceId][0]; return { kind: 'rule', fieldId: f.id, op: f.ops[0], value: f.values[0] }; };

function flattenAiTree(node, sourceId) {
  // Convert AI's nested tree into our flat-AND-with-any-of model.
  // - top-level AND group: pass through children
  // - OR group of rules with same fieldId: collapse to { any, values }
  // - anything else: try to flatten conservatively, else mark unsupported
  if (!node) return { rules: [], unsupported: false };
  if (node.kind === 'rule') return { rules: [node], unsupported: false };
  if (node.kind !== 'group') return { rules: [], unsupported: true };

  const rules = []; let unsupported = false;
  if (node.op === 'AND') {
    for (const c of node.children || []) {
      const r = flattenAiTree(c, sourceId);
      rules.push(...r.rules);
      if (r.unsupported) unsupported = true;
    }
    return { rules, unsupported };
  }
  // OR group — collapse if all are same-field rules
  const kids = node.children || [];
  const allSameField = kids.length && kids.every(k => k.kind === 'rule' && k.fieldId === kids[0].fieldId);
  if (allSameField) {
    return { rules: [{ kind: 'any', fieldId: kids[0].fieldId, op: 'is any of', values: kids.map(k => k.value) }], unsupported: false };
  }
  return { rules: [], unsupported: true };
}

// ─────────────────────────────────────────────────────────────────
// Main modal
// ─────────────────────────────────────────────────────────────────
function ListBuilder({ onClose, onCreate, prefilledName = '', groupsForRef = [] }) {
  const { XIcon, FolkBookmarkIcon: BookmarkIcon, UsersIcon } = window;

  const [source, setSource]     = useLBS('districts');
  const [name, setName]         = useLBS(prefilledName);
  const [shared, setShared]     = useLBS(false);
  const [rules, setRules]       = useLBS([defaultRule('districts')]);
  const [scopeMode, setScopeMode] = useLBS('none');
  const [scopeRules, setScopeRules] = useLBS([{ kind: 'rule', fieldId: 'state', op: 'is', value: 'NY' }]);
  const [scopeRef, setScopeRef] = useLBS(groupsForRef[0]?.id || '');
  const [aiPrompt, setAiPrompt] = useLBS('');
  const [aiBusy, setAiBusy]     = useLBS(false);
  const [aiError, setAiError]   = useLBS('');
  const [aiNotice, setAiNotice] = useLBS('');

  const switchSource = (s) => {
    setSource(s);
    setRules([defaultRule(s)]);
    setScopeMode('none');
  };

  const updateRule = (i, patch) => setRules(rs => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const removeRule = (i) => setRules(rs => rs.filter((_, idx) => idx !== i));
  const addRule = () => setRules(rs => [...rs, defaultRule(source)]);
  const replaceRule = (i, newRule) => setRules(rs => rs.map((r, idx) => idx === i ? newRule : r));

  const updateScopeRule = (i, patch) => setScopeRules(rs => rs.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  const removeScopeRule = (i) => setScopeRules(rs => rs.filter((_, idx) => idx !== i));
  const addScopeRule = () => { const f = FIELDS.districts[0]; setScopeRules(rs => [...rs, { kind: 'rule', fieldId: f.id, op: f.ops[0], value: f.values[0] }]); };
  const replaceScopeRule = (i, newRule) => setScopeRules(rs => rs.map((r, idx) => idx === i ? newRule : r));

  const leafCount = rules.length + (scopeMode === 'rules' ? scopeRules.length : scopeMode === 'reference' ? 1 : 0);
  const matchCount = useLBM(() => {
    const base = SOURCES.find(s => s.id === source).countBase;
    return Math.max(1, Math.round(base / Math.pow(1.7, Math.max(leafCount, 1))));
  }, [source, leafCount]);

  const runAi = async () => {
    if (!aiPrompt.trim() || aiBusy) return;
    setAiBusy(true); setAiError(''); setAiNotice('');
    try {
      const schema = JSON.stringify(Object.fromEntries(Object.entries(FIELDS).map(([k, fs]) => [k, fs.map(f => ({ id: f.id, ops: f.ops, values: f.values }))])));
      const refOptions = groupsForRef.map(g => ({ id: g.id, label: g.label, kind: g.kind }));
      const res = await window.claude.complete({
        messages: [{ role: 'user', content:
`You translate an EdTech sales rep's natural-language list request into a saved-list spec.

Sources & fields (with allowed ops + values):
${schema}

Existing plans/lists the user can reference for scope:
${JSON.stringify(refOptions)}

User request: """${aiPrompt}"""

Return ONLY valid JSON, no prose, no code fences:
{
  "source": "districts|contacts|opps|vacancies|news|rfps",
  "name": "<short name, <40 chars>",
  "sourceFilter": {"kind":"group","op":"AND|OR","children":[<rule or group>, …]},
  "scopeMode": "none|rules|reference",
  "scopeFilter": {"kind":"group","op":"AND","children":[<rule on districts fields>]},
  "scopeRef": "<id of plan/list>"
}
A rule is {"kind":"rule","fieldId":"...","op":"...","value":"..."}.
Prefer the simplest tree. Top-level should be AND. Use OR groups only when alternatives share the same field (e.g. State is NY OR State is NJ).
If source is "districts", scopeMode MUST be "none".
If user names an existing plan/list, use scopeMode="reference".
States: NY/NJ/CT/MA/PA/VT/NH/ME/RI/IA/MI.`
        }],
      });
      const json = res.match(/\{[\s\S]*\}/)?.[0];
      if (!json) throw new Error('no json');
      const p = JSON.parse(json);
      if (p.source && FIELDS[p.source]) setSource(p.source);
      if (p.sourceFilter) {
        const flat = flattenAiTree(p.sourceFilter, p.source || source);
        if (flat.rules.length) setRules(flat.rules);
        if (flat.unsupported) setAiNotice('Some advanced logic was simplified — review the conditions.');
      }
      if (p.scopeMode) setScopeMode(p.scopeMode);
      if (p.scopeMode === 'rules' && p.scopeFilter) {
        const flat = flattenAiTree(p.scopeFilter, 'districts');
        if (flat.rules.length) setScopeRules(flat.rules);
      }
      if (p.scopeRef) setScopeRef(p.scopeRef);
      if (p.name && !name) setName(p.name);
    } catch (e) {
      setAiError("Couldn't parse — try rephrasing.");
    } finally {
      setAiBusy(false);
    }
  };

  const previewItems = PREVIEW_DATA[source] || [];
  const refOption = groupsForRef.find(g => g.id === scopeRef);

  return (
    <div style={modalOverlay}>
      <style>{`@keyframes lbFade { from { opacity: 0 } to { opacity: 1 } }
                @keyframes lbSlide { from { transform: translateY(8px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }`}</style>
      <div style={modalBox}>
        <div style={modalHeader}>
          <div>
            <div style={{ fontSize: 10, color: '#8A80A8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>📋 New list</div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#403770', margin: '2px 0 0', letterSpacing: '-0.01em' }}>Build a saved list</h2>
          </div>
          <button onClick={onClose} style={iconBtnLB}><XIcon size={16} /></button>
        </div>

        <div style={modalBody} className="fm-scrollbar">
          <div style={leftCol}>

            {/* AI — promoted to primary */}
            <div style={aiBox}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 14 }}>✨</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#403770' }}>Describe what you want</span>
                <span style={{ fontSize: 10, color: '#8A80A8', marginLeft: 'auto' }}>AI handles complex logic</span>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') runAi(); }} disabled={aiBusy}
                  placeholder="e.g. Vacancies at Tier A districts in NY or NJ, posted in the last 14 days"
                  style={aiInput} />
                <button onClick={runAi} disabled={aiBusy || !aiPrompt.trim()} style={aiBtn(aiBusy || !aiPrompt.trim())}>
                  {aiBusy ? 'Building…' : 'Build'}
                </button>
              </div>
              {aiError &&  <div style={{ fontSize: 11, color: '#c25a52', marginTop: 6 }}>{aiError}</div>}
              {aiNotice && <div style={{ fontSize: 11, color: '#7d6d3a', marginTop: 6, padding: '4px 8px', background: '#FFF6DD', borderRadius: 4 }}>{aiNotice}</div>}
              <div style={{ display: 'flex', gap: 4, marginTop: 8, flexWrap: 'wrap' }}>
                {[
                  'News at Northeast Pod districts',
                  'Vacancies in Iowa districts',
                  'Open RFPs > $100K closing this quarter',
                  'Champions I haven\'t talked to in 30d',
                ].map(s => (
                  <button key={s} onClick={() => setAiPrompt(s)} disabled={aiBusy} style={chipBtn}>{s}</button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, height: 1, background: '#E2DEEC' }} />
              <span style={{ fontSize: 10, color: '#A69DC0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Or edit manually</span>
              <div style={{ flex: 1, height: 1, background: '#E2DEEC' }} />
            </div>

            {/* Source */}
            <SectionH title="Source" hint="What kind of records belong in this list?">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                {SOURCES.map(s => {
                  const on = source === s.id;
                  return (
                    <button key={s.id} onClick={() => switchSource(s.id)} style={sourceCard(on)}>
                      <span style={{ fontSize: 16 }}>{s.icon}</span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 600 }}>{s.label}</div>
                        <div style={{ fontSize: 10, color: '#8A80A8', marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>{s.countBase.toLocaleString()}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </SectionH>

            {/* Conditions (flat AND) */}
            <SectionH title="Conditions" hint={`Records must match all of these.`}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {rules.map((r, i) => (
                  <RuleRow key={i} idx={i} rule={r} sourceId={source}
                    onUpdate={(patch) => updateRule(i, patch)}
                    onReplace={(nr) => replaceRule(i, nr)}
                    onDelete={() => removeRule(i)} />
                ))}
                <button onClick={addRule} style={addBtn}><PlusIconLB size={11} /> Add condition</button>
              </div>
            </SectionH>

            {/* Scope */}
            {source !== 'districts' && (
              <SectionH title="Scope" hint="Limit to records attached to specific districts.">
                <div style={scopeTabs}>
                  {[
                    { id: 'none',      l: 'Any district' },
                    { id: 'rules',     l: 'Matching rules' },
                    { id: 'reference', l: 'In a plan or list' },
                  ].map(t => (
                    <button key={t.id} onClick={() => setScopeMode(t.id)} style={scopeTabBtn(scopeMode === t.id)}>
                      {t.l}
                    </button>
                  ))}
                </div>
                {scopeMode === 'rules' && (
                  <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {scopeRules.map((r, i) => (
                      <RuleRow key={i} idx={i} rule={r} sourceId="districts"
                        onUpdate={(patch) => updateScopeRule(i, patch)}
                        onReplace={(nr) => replaceScopeRule(i, nr)}
                        onDelete={() => removeScopeRule(i)} />
                    ))}
                    <button onClick={addScopeRule} style={addBtn}><PlusIconLB size={11} /> Add condition</button>
                  </div>
                )}
                {scopeMode === 'reference' && (
                  <div style={{ marginTop: 8, padding: 10, background: '#fff', border: '1px solid #E2DEEC', borderRadius: 8 }}>
                    <select value={scopeRef} onChange={e => setScopeRef(e.target.value)}
                      style={{ width: '100%', padding: '7px 10px', fontSize: 13, fontFamily: 'inherit', border: '1px solid #C2BBD4', borderRadius: 6, color: '#403770', background: '#fff', outline: 'none' }}>
                      {groupsForRef.map(g => <option key={g.id} value={g.id}>{g.kind === 'plan' ? '🎯' : '📋'} {g.label}</option>)}
                    </select>
                    {refOption && (
                      <div style={{ fontSize: 11, color: '#8A80A8', marginTop: 6 }}>
                        Updates automatically as <strong style={{ color: '#403770' }}>{refOption.label}</strong> changes.
                      </div>
                    )}
                  </div>
                )}
              </SectionH>
            )}

            {/* Save as */}
            <SectionH title="Save as">
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder={namePlaceholder(source)} style={nameInput} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#544A78' }}>
                <input type="checkbox" checked={shared} onChange={e => setShared(e.target.checked)} style={{ accentColor: '#F37167' }} />
                <UsersIcon size={13} style={{ color: '#8A80A8' }} />
                Share with my team
              </label>
            </SectionH>
          </div>

          {/* Preview */}
          <div style={previewPane}>
            <div>
              <div style={previewLbl}>Live preview</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 28, fontWeight: 700, color: '#403770', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{matchCount.toLocaleString()}</span>
                <span style={{ fontSize: 12, color: '#8A80A8', fontWeight: 500 }}>{source} match</span>
              </div>
              {scopeMode === 'reference' && refOption && (
                <div style={{ fontSize: 11, color: '#8A80A8', marginTop: 6, padding: 8, background: '#fff', border: '1px solid #E2DEEC', borderRadius: 6 }}>
                  Scoped to <strong style={{ color: '#403770' }}>{refOption.label}</strong>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, overflow: 'auto' }} className="fm-scrollbar">
              {previewItems.map((it, i) => (
                <div key={i} style={previewItem}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#403770' }}>{it.primary}</div>
                  <div style={{ fontSize: 11, color: '#8A80A8', marginTop: 2 }}>{it.secondary}</div>
                  <div style={{ fontSize: 11, color: '#544A78', marginTop: 2, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{it.meta}</div>
                </div>
              ))}
              <div style={{ fontSize: 11, color: '#A69DC0', textAlign: 'center', padding: 8 }}>
                + {Math.max(0, matchCount - previewItems.length).toLocaleString()} more
              </div>
            </div>
          </div>
        </div>

        <div style={modalFooter}>
          <div style={{ fontSize: 12, color: '#8A80A8' }}>
            <span style={{ fontVariantNumeric: 'tabular-nums', color: '#544A78', fontWeight: 600 }}>{leafCount}</span> conditions · <span style={{ fontVariantNumeric: 'tabular-nums', color: '#544A78', fontWeight: 600 }}>{matchCount.toLocaleString()}</span> {source}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={btnSecondaryLB}>Cancel</button>
            <button onClick={() => onCreate({ name: name || 'Untitled list', source, rules, scopeMode, scopeRules, scopeRef, shared, count: matchCount })}
              style={btnPrimaryLB}>
              <BookmarkIcon size={12} /> Create list
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// RuleRow — single condition. Supports `rule` and `any` (AI-generated OR collapse).
// ─────────────────────────────────────────────────────────────────
function RuleRow({ idx, rule, sourceId, onUpdate, onReplace, onDelete }) {
  const fields = FIELDS[sourceId];
  const f = fields.find(x => x.id === rule.fieldId) || fields[0];
  const isAny = rule.kind === 'any';

  const onFieldChange = (fid) => {
    const nf = fields.find(x => x.id === fid);
    onReplace({ kind: 'rule', fieldId: fid, op: nf.ops[0], value: nf.values[0] });
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: '#FFFCFA', border: '1px solid #E2DEEC', borderRadius: 8 }}>
      <span style={{ fontSize: 10, color: '#8A80A8', fontWeight: 700, width: 32, textTransform: 'uppercase', letterSpacing: '0.04em', flexShrink: 0 }}>
        {idx === 0 ? 'WHERE' : 'AND'}
      </span>
      <RuleSelect value={rule.fieldId} options={fields.map(f => ({ v: f.id, l: f.label }))} onChange={onFieldChange} />
      {isAny ? (
        <>
          <span style={{ fontSize: 11, fontWeight: 500, color: '#544A78', padding: '5px 8px', background: '#fff', border: '1px solid #D4CFE2', borderRadius: 5 }}>is any of</span>
          <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 4, padding: '4px 6px', background: '#fff', border: '1px solid #D4CFE2', borderRadius: 5, minHeight: 28 }}>
            {(rule.values || []).map((v, vi) => (
              <span key={vi} style={{ fontSize: 11, fontWeight: 600, color: '#4d7285', background: '#e8f1f5', padding: '2px 8px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                {v}
                <button onClick={() => onUpdate({ values: (rule.values || []).filter((_, i) => i !== vi) })}
                  style={{ background: 'transparent', border: 'none', color: '#4d7285', cursor: 'pointer', padding: 0, fontSize: 13, lineHeight: 1 }}>×</button>
              </span>
            ))}
          </div>
        </>
      ) : (
        <>
          <RuleSelect value={rule.op} options={f.ops.map(o => ({ v: o, l: o }))} onChange={(v) => onUpdate({ op: v })} />
          <RuleSelect value={rule.value} options={f.values.map(v => ({ v, l: v }))} onChange={(v) => onUpdate({ value: v })} grow />
        </>
      )}
      <button onClick={onDelete} style={{ background: 'transparent', border: 'none', color: '#A69DC0', cursor: 'pointer', padding: 4, display: 'flex', borderRadius: 4 }}>
        <TrashIconLB size={12} />
      </button>
    </div>
  );
}

function RuleSelect({ value, options, onChange, grow }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{
        padding: '5px 8px', border: '1px solid #D4CFE2', borderRadius: 5,
        background: '#fff', color: '#403770', fontSize: 12, fontWeight: 500,
        fontFamily: 'inherit', cursor: 'pointer', outline: 'none',
        flex: grow ? 1 : 'none', minWidth: 0,
      }}>
      {options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  );
}

const namePlaceholder = (s) => ({
  districts: 'e.g. Tier A · NY/NJ prospects',
  contacts:  'e.g. Champions in Northeast',
  opps:      'e.g. Q3 close pipeline',
  vacancies: 'e.g. Leadership vacancies · my plans',
  news:      'e.g. Funding news · target districts',
  rfps:      'e.g. Curriculum RFPs > $100K',
}[s] || 'List name');

function SectionH({ title, hint, children }) {
  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#403770' }}>{title}</div>
        {hint && <div style={{ fontSize: 11, color: '#8A80A8', marginTop: 2 }}>{hint}</div>}
      </div>
      {children}
    </div>
  );
}

function TrashIconLB({ size = 12, style }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, ...style }}>
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>);
}
function PlusIconLB({ size = 10, style }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, ...style }}>
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>);
}

// styles
const modalOverlay = { position: 'fixed', inset: 0, background: 'rgba(64,55,112,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 32, animation: 'lbFade 150ms ease-out' };
const modalBox     = { background: '#fff', borderRadius: 16, width: '100%', maxWidth: 880, maxHeight: '88vh', boxShadow: '0 24px 48px rgba(64,55,112,0.25)', display: 'flex', flexDirection: 'column', overflow: 'hidden', animation: 'lbSlide 200ms cubic-bezier(0.16, 1, 0.3, 1)' };
const modalHeader  = { padding: '18px 24px', borderBottom: '1px solid #E2DEEC', display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
const modalBody    = { flex: 1, overflow: 'auto', display: 'grid', gridTemplateColumns: '1fr 280px', minHeight: 0 };
const modalFooter  = { padding: '14px 24px', borderTop: '1px solid #E2DEEC', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fff' };
const leftCol      = { padding: '20px 24px', borderRight: '1px solid #E2DEEC', display: 'flex', flexDirection: 'column', gap: 18 };
const aiBox        = { padding: '14px', borderRadius: 12, background: 'linear-gradient(135deg, #FEF2F1 0%, #F7F0FA 100%)', border: '1px solid #F0D9D6' };
const aiInput      = { flex: 1, padding: '9px 11px', fontSize: 13, fontFamily: 'inherit', border: '1px solid #E0CFCC', borderRadius: 7, background: '#fff', color: '#403770', outline: 'none' };
const aiBtn        = (disabled) => ({ padding: '9px 16px', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', background: '#403770', border: 'none', borderRadius: 7, color: '#fff', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap' });
const chipBtn      = { padding: '3px 8px', fontSize: 11, background: '#fff', border: '1px solid #E2DEEC', borderRadius: 999, color: '#544A78', cursor: 'pointer', fontFamily: 'inherit' };
const sourceCard   = (on) => ({ padding: '10px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', background: on ? '#FEF2F1' : '#FFFCFA', border: on ? '1.5px solid #F37167' : '1px solid #E2DEEC', color: on ? '#403770' : '#544A78', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8 });
const scopeTabs    = { display: 'flex', gap: 2, padding: 2, background: '#F7F5FA', borderRadius: 8 };
const scopeTabBtn  = (on) => ({ flex: 1, padding: '6px 8px', fontSize: 11, fontWeight: on ? 600 : 500, fontFamily: 'inherit', background: on ? '#fff' : 'transparent', color: on ? '#403770' : '#8A80A8', border: 'none', borderRadius: 6, cursor: 'pointer', boxShadow: on ? '0 1px 2px rgba(64,55,112,0.08)' : 'none' });
const nameInput    = { width: '100%', padding: '9px 12px', fontSize: 14, fontFamily: 'inherit', border: '1px solid #C2BBD4', borderRadius: 8, background: '#fff', color: '#403770', outline: 'none', marginBottom: 10, boxSizing: 'border-box' };
const previewPane  = { padding: '20px 20px', background: '#FFFCFA', display: 'flex', flexDirection: 'column', gap: 12 };
const previewLbl   = { fontSize: 10, fontWeight: 700, color: '#8A80A8', textTransform: 'uppercase', letterSpacing: '0.06em' };
const previewItem  = { padding: '8px 10px', background: '#fff', border: '1px solid #E2DEEC', borderRadius: 6 };
const iconBtnLB    = { padding: 6, background: 'transparent', border: 'none', borderRadius: 6, color: '#8A80A8', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' };
const btnSecondaryLB = { padding: '8px 14px', fontSize: 13, fontFamily: 'inherit', background: '#fff', border: '1px solid #D4CFE2', borderRadius: 8, color: '#403770', fontWeight: 500, cursor: 'pointer' };
const btnPrimaryLB   = { padding: '8px 14px', fontSize: 13, fontFamily: 'inherit', background: '#403770', border: 'none', borderRadius: 8, color: '#fff', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 };
const addBtn       = { padding: '6px 10px', display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 6, marginTop: 2, background: 'transparent', border: '1px dashed #D4CFE2', borderRadius: 8, color: '#544A78', fontWeight: 500, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' };

window.ListBuilder = ListBuilder;
