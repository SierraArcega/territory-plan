/* global React */
const { useState: useS } = React;

function UnifiedApp({ density = 'compact' }) {
  const {
    HomeIcon, MapIcon, ActivitiesIcon, TasksIcon, LeaderboardIcon,
    SearchIcon, FilterIcon, PlusIcon, PencilIcon,
    ChevronDownIcon, MapPinIcon, UsersIcon,
    CanvasMapView, CanvasTableView, CanvasKanbanView,
    CanvasContactsView, CanvasOppsView, BriefcaseIcon,
    FolkPinIcon: PinIcon, FolkBookmarkIcon: BookmarkIcon,
    FolkTableIcon: TableIcon, FolkKanbanIcon: KanbanIcon, FolkShareIcon: ShareIcon,
  } = window;

  const NAV = [
    { id: 'home', label: 'Home', Icon: HomeIcon },
    { id: 'map', label: 'Map', Icon: MapIcon },
    { id: 'activities', label: 'Activities', Icon: ActivitiesIcon },
    { id: 'tasks', label: 'Tasks', Icon: TasksIcon },
    { id: 'leaderboard', label: 'Leaderboard', Icon: LeaderboardIcon },
  ];

  // Plans = targeted groups (fiscal + revenue target). Lists = filter-based groups.
  const [groups, setGroups] = useS([
    {
      id: 'g1', label: 'Northeast Pod', kind: 'plan',
      fiscal: 'FY26', target: '$1.2M', progress: 62, owner: 'AR', shared: true,
      pipeline: '$340K', accent: '#F37167',
      contactsCount: 38, oppsCount: 12,
      views: [
        { id: 'v1-2', label: 'Territory map',   type: 'map', pinned: true },
        { id: 'v1-1', label: 'Districts',       type: 'table' },
        { id: 'v1-5', label: 'Contacts',        type: 'contacts' },
        { id: 'v1-6', label: 'Opportunities',   type: 'opps' },
        { id: 'v1-3', label: 'Pipeline',        type: 'kanban' },
        { id: 'v1-7', label: 'Vacancies',       type: 'vacancies' },
        { id: 'v1-8', label: 'News',            type: 'news' },
        { id: 'v1-9', label: 'RFPs',            type: 'rfps' },
        { id: 'v1-4', label: 'Renewals · Q2',   type: 'table' },
      ],
    },
    {
      id: 'g2', label: 'Mid-Atlantic Pod', kind: 'plan',
      fiscal: 'FY26', target: '$840K', progress: 45, owner: 'JM', shared: false,
      pipeline: '$210K', accent: '#6EA3BE',
      contactsCount: 24, oppsCount: 7,
      views: [
        { id: 'v2-1', label: 'Territory map', type: 'map' },
        { id: 'v2-2', label: 'Districts',     type: 'table' },
        { id: 'v2-3', label: 'Contacts',      type: 'contacts' },
        { id: 'v2-4', label: 'Opportunities', type: 'opps' },
        { id: 'v2-5', label: 'Vacancies',     type: 'vacancies' },
        { id: 'v2-6', label: 'News',          type: 'news' },
        { id: 'v2-7', label: 'RFPs',          type: 'rfps' },
      ],
    },
    {
      id: 'g3', label: 'Renewals · Q2', kind: 'plan',
      fiscal: 'FY26 Q2', target: '$320K', progress: 78, owner: 'AR', shared: true,
      pipeline: '$72K', accent: '#69B34A',
      contactsCount: 19, oppsCount: 14,
      views: [
        { id: 'v3-1', label: 'At-risk pipeline', type: 'kanban' },
        { id: 'v3-2', label: 'Renewal table',    type: 'table' },
        { id: 'v3-3', label: 'Champions',        type: 'contacts' },
        { id: 'v3-4', label: 'Renewal opps',     type: 'opps' },
        { id: 'v3-5', label: 'Vacancies',        type: 'vacancies' },
        { id: 'v3-6', label: 'News',             type: 'news' },
        { id: 'v3-7', label: 'RFPs',             type: 'rfps' },
      ],
    },
    {
      id: 'g4', label: 'Northeast Pod', kind: 'plan',
      fiscal: 'FY25', target: '$960K', progress: 104, owner: 'AR', shared: true,
      pipeline: '$0', accent: '#A69DC0', archived: true,
      contactsCount: 42, oppsCount: 18,
      views: [
        { id: 'v4-1', label: 'Final wins',    type: 'table' },
        { id: 'v4-2', label: 'Closed-out map',type: 'map' },
      ],
    },
    {
      id: 'g5', label: 'Summer reading initiative', kind: 'plan',
      fiscal: 'FY25 Q3', target: '$140K', progress: 86, owner: 'AR', shared: false,
      pipeline: '$0', accent: '#A69DC0', archived: true,
      contactsCount: 12, oppsCount: 4,
      views: [
        { id: 'v5-1', label: 'Districts', type: 'table' },
      ],
    },
    {
      id: 'l1', label: 'High-priority prospects', kind: 'list',
      filters: ['Tier: A', 'No activity 30d'],
      views: [
        { id: 'l1-1', label: 'Tier A · no contact', type: 'table' },
        { id: 'l1-2', label: 'Heatmap',             type: 'map' },
      ],
    },
    {
      id: 'l2', label: 'Lapsed customers', kind: 'list',
      filters: ['Stage: Lapsed'],
      views: [
        { id: 'l2-1', label: 'All lapsed', type: 'table' },
      ],
    },
  ]);

  const [active, setActive] = useS({ groupId: 'g1', viewId: 'v1-2' });
  const [open, setOpen] = useS({ g1: true, g2: false, g3: false, l1: true, l2: false });
  const [hoverId, setHoverId] = useS(null);
  const [showBuilder, setShowBuilder] = useS(false);
  const [builderSeed, setBuilderSeed] = useS({ filters: [], name: '' });
  const [menuGroupId, setMenuGroupId] = useS(null);
  const [showHidden, setShowHidden]   = useS(false);

  const archiveGroup = (id) => { setGroups(gs => gs.map(g => g.id === id ? { ...g, archived: true } : g)); setMenuGroupId(null); };
  const unarchiveGroup = (id) => setGroups(gs => gs.map(g => g.id === id ? { ...g, archived: false } : g));
  const hideGroup = (id) => { setGroups(gs => gs.map(g => g.id === id ? { ...g, hidden: true } : g)); setMenuGroupId(null); };
  const unhideGroup = (id) => setGroups(gs => gs.map(g => g.id === id ? { ...g, hidden: false } : g));

  const openBuilder = (seed = {}) => {
    setBuilderSeed({ filters: seed.filters || [], name: seed.name || '' });
    setShowBuilder(true);
  };
  const handleCreateList = (data) => {
    const id = 'l' + Date.now();
    const refLabel = data.scopeMode === 'reference' ? groups.find(g => g.id === data.scopeRef)?.label : null;
    const chips = [];
    chips.push(`Source: ${data.source}`);
    if (data.scopeMode === 'reference' && refLabel) chips.push(`Scoped to: ${refLabel}`);
    else if (data.scopeMode === 'rules') chips.push('Custom district rules');
    const defaultViewType = ({ opps: 'opps', contacts: 'contacts', vacancies: 'vacancies', news: 'news', rfps: 'rfps' })[data.source] || 'table';
    const newGroup = {
      id, label: data.name, kind: 'list',
      filters: chips,
      shared: data.shared, count: data.count,
      views: [
        { id: id + '-1', label: data.source.charAt(0).toUpperCase() + data.source.slice(1), type: defaultViewType },
        { id: id + '-2', label: 'Map',  type: 'map' },
      ],
    };
    setGroups(g => [...g, newGroup]);
    setOpen(o => ({ ...o, [id]: true }));
    setActive({ groupId: id, viewId: id + '-1' });
    setShowBuilder(false);
  };

  const isPortfolio = active.groupId === '__portfolio';
  const activeGroup = groups.find(g => g.id === active.groupId);
  const activeView  = activeGroup?.views.find(v => v.id === active.viewId);

  const compact = density === 'compact';
  const navPad   = compact ? '6px 10px' : '9px 12px';
  const groupPad = compact ? '5px 8px'  : '7px 10px';
  const viewPad  = compact ? '4px 10px 4px 30px' : '7px 12px 7px 32px';

  const VTI = ({ type, size = 13, color = '#8A80A8' }) => {
    if (type === 'map')      return <MapPinIcon  size={size} style={{ color }} />;
    if (type === 'table')    return <TableIcon   size={size} style={{ color }} />;
    if (type === 'kanban')   return <KanbanIcon  size={size} style={{ color }} />;
    if (type === 'contacts') return <UsersIcon   size={size} style={{ color }} />;
    if (type === 'opps')     return <BriefcaseIcon size={size} style={{ color }} />;
    if (type === 'vacancies') return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
    );
    if (type === 'news') return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6z"/></svg>
    );
    if (type === 'rfps') return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
    );
    return null;
  };

  const plans = groups.filter(g => g.kind === 'plan');
  const lists = groups.filter(g => g.kind === 'list');
  const visiblePlans = plans.filter(g => !g.archived && !g.hidden);
  const visibleLists = lists.filter(g => !g.archived && !g.hidden);
  const hiddenCount  = groups.filter(g => g.hidden && !g.archived).length;
  const archivedCount = groups.filter(g => g.archived).length;

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: 'inherit', background: '#FFFCFA' }}>
      {/* SIDEBAR */}
      <aside style={{
        width: 252, flexShrink: 0, background: '#fff',
        borderRight: '1px solid #D4CFE2', display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ height: 52, padding: '0 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #EFEDF5', flexShrink: 0 }}>
          <div style={{ width: 26, height: 26, borderRadius: 7, background: '#F37167', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13 }}>F</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#403770', letterSpacing: '-0.01em' }}>Mapomatic</div>
            <div style={{ fontSize: 10, color: '#8A80A8' }}>Fullmind Sales</div>
          </div>
        </div>

        <nav style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 1, flexShrink: 0 }}>
          {NAV.map(({ id, label, Icon }, i) => (
            <button key={id} style={{
              padding: navPad, display: 'flex', alignItems: 'center', gap: 10,
              background: 'transparent', border: 'none', borderRadius: 6,
              color: '#5C5277', fontWeight: 500, fontSize: 13,
              fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
            }}>
              <Icon size={15} style={{ color: '#8A80A8' }} />
              {label}
            </button>
          ))}
        </nav>

        <div style={{ height: 1, background: '#EFEDF5', margin: '4px 12px' }} />

        {/* MY VIEWS */}
        <div style={{ padding: '6px 10px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <BookmarkIcon size={11} style={{ color: '#8A80A8' }} />
            <div style={{ fontSize: 10, fontWeight: 700, color: '#403770', textTransform: 'uppercase', letterSpacing: '0.06em' }}>My views</div>
          </div>
          <button title="New" style={{ background: 'transparent', border: 'none', color: '#8A80A8', cursor: 'pointer', padding: 2, borderRadius: 4, display: 'flex' }}>
            <PlusIcon size={13} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 6px 8px' }} className="fm-scrollbar">
          {/* Portfolio overview */}
          <button
            onClick={() => setActive({ groupId: '__portfolio', viewId: null })}
            style={{
              width: '100%', padding: compact ? '6px 8px' : '8px 10px',
              display: 'flex', alignItems: 'center', gap: 8,
              background: isPortfolio ? '#EFEDF5' : 'transparent',
              border: 'none', borderRadius: 6,
              color: isPortfolio ? '#403770' : '#5C5277',
              fontWeight: isPortfolio ? 600 : 500, fontSize: 13,
              fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
              marginBottom: 4,
            }}>
            <GridIcon size={14} style={{ color: isPortfolio ? '#F37167' : '#8A80A8' }} />
            <span style={{ flex: 1 }}>All plans</span>
            <span style={{ fontSize: 10, color: '#A69DC0', fontVariantNumeric: 'tabular-nums' }}>{plans.length}</span>
          </button>

          {/* Plans header */}
          <div style={{ padding: '6px 8px 2px', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 11 }}>🎯</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: '#8A80A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Plans</span>
            <span style={{ fontSize: 10, color: '#A69DC0', marginLeft: 'auto' }}>FY26</span>
          </div>

          {visiblePlans.map(g => (
            <GroupRow key={g.id} g={g} {...{ open, setOpen, active, setActive, hoverId, setHoverId, compact, groupPad, viewPad, VTI, PinIcon, menuGroupId, setMenuGroupId, archiveGroup, hideGroup }} />
          ))}

          {/* Lists header */}
          <div style={{ padding: '14px 8px 2px', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 11 }}>📋</span>
            <span style={{ fontSize: 10, fontWeight: 600, color: '#8A80A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Lists</span>
            <button onClick={() => openBuilder()} title="New list"
              style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#8A80A8', cursor: 'pointer', padding: 2, borderRadius: 4, display: 'flex' }}>
              <PlusIcon size={11} />
            </button>
          </div>

          {visibleLists.map(g => (
            <GroupRow key={g.id} g={g} {...{ open, setOpen, active, setActive, hoverId, setHoverId, compact, groupPad, viewPad, VTI, PinIcon, menuGroupId, setMenuGroupId, archiveGroup, hideGroup }} />
          ))}

          <button onClick={() => openBuilder()} style={{
            margin: '10px 4px 0', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6,
            background: 'transparent', border: '1px dashed #D4CFE2', borderRadius: 6,
            color: '#8A80A8', fontWeight: 500, fontSize: 12,
            fontFamily: 'inherit', cursor: 'pointer', width: 'calc(100% - 8px)', textAlign: 'left',
          }}>
            <PlusIcon size={11} /> New list
          </button>

          {(hiddenCount > 0 || archivedCount > 0) && (
            <div style={{ margin: '14px 4px 0', padding: '8px 6px', borderTop: '1px solid #EFEDF5', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {hiddenCount > 0 && (
                <button onClick={() => setShowHidden(s => !s)} style={footerLink}>
                  {showHidden ? 'Hide hidden' : `Show hidden (${hiddenCount})`}
                </button>
              )}
              {archivedCount > 0 && (
                <button onClick={() => setActive({ groupId: '__portfolio', viewId: null })} style={footerLink}>
                  Archived plans · {archivedCount}
                </button>
              )}
            </div>
          )}

          {showHidden && groups.filter(g => g.hidden && !g.archived).map(g => (
            <div key={g.id} style={{ margin: '4px 4px 0', padding: '5px 8px', display: 'flex', alignItems: 'center', gap: 6, background: '#FFFCFA', border: '1px dashed #E2DEEC', borderRadius: 6 }}>
              {g.kind === 'plan' ? <span style={{ width: 3, height: 12, borderRadius: 2, background: g.accent, flexShrink: 0 }} /> : <ListIcon size={11} style={{ color: '#A69DC0' }} />}
              <span style={{ flex: 1, fontSize: 12, color: '#8A80A8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.label}</span>
              <button onClick={() => unhideGroup(g.id)} style={{ background: 'transparent', border: 'none', color: '#F37167', cursor: 'pointer', padding: 2, fontSize: 11, fontFamily: 'inherit', fontWeight: 600 }}>Unhide</button>
            </div>
          ))}
        </div>

        <div style={{ padding: 10, borderTop: '1px solid #EFEDF5', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#C4E7E6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#403770' }}>AR</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#403770' }}>Alex Rivera</div>
            <div style={{ fontSize: 10, color: '#8A80A8' }}>Northeast Pod</div>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {isPortfolio
          ? <PortfolioView plans={plans} unarchiveGroup={unarchiveGroup} onOpen={(gid) => { const g = groups.find(x => x.id === gid); setActive({ groupId: gid, viewId: g.views[0].id }); }} />
          : <GroupCanvas group={activeGroup} view={activeView} setActive={setActive} VTI={VTI} openBuilder={openBuilder} {...{ PinIcon, BookmarkIcon, ShareIcon, PencilIcon, FilterIcon, SearchIcon, PlusIcon, UsersIcon, CanvasMapView, CanvasTableView, CanvasKanbanView, CanvasContactsView, CanvasOppsView }} />}
      </div>

      {showBuilder && window.ListBuilder && (
        <window.ListBuilder onClose={() => setShowBuilder(false)} onCreate={handleCreateList}
          prefilledFilters={builderSeed.filters} prefilledName={builderSeed.name}
          groupsForRef={groups.filter(g => !g.archived)} />
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
// Sidebar group row (plan or list)
// ───────────────────────────────────────────────────────────────────
function GroupRow({ g, open, setOpen, active, setActive, hoverId, setHoverId, compact, groupPad, viewPad, VTI, PinIcon, menuGroupId, setMenuGroupId, archiveGroup, hideGroup }) {
  const { ChevronDownIcon } = window;
  const isOpen = open[g.id];
  const isPlan = g.kind === 'plan';
  const rowHover = hoverId === `__row__${g.id}`;
  const menuOpen = menuGroupId === g.id;

  return (
    <div onMouseEnter={() => setHoverId(`__row__${g.id}`)} onMouseLeave={() => setHoverId(null)} style={{ position: 'relative' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <button
          onClick={() => setOpen(o => ({ ...o, [g.id]: !o[g.id] }))}
          style={{
            flex: 1, padding: groupPad, display: 'flex', alignItems: 'center', gap: 6,
            background: 'transparent', border: 'none', borderRadius: 6,
            color: '#403770', fontWeight: 600, fontSize: 13,
            fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left', minWidth: 0,
          }}>
          <span style={{ display: 'flex', width: 11, color: '#8A80A8', transition: 'transform 150ms', transform: isOpen ? 'rotate(0)' : 'rotate(-90deg)' }}>
            <ChevronDownIcon size={11} />
          </span>
          {isPlan
            ? <span style={{ width: 3, height: 14, borderRadius: 2, background: g.accent, flexShrink: 0 }} />
            : <ListIcon size={12} style={{ color: '#8A80A8' }} />}
          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.label}</span>
          {isPlan && !rowHover && !menuOpen && <ProgressDot pct={g.progress} />}
        </button>
        {(rowHover || menuOpen) && (
          <button
            onClick={(e) => { e.stopPropagation(); setMenuGroupId(menuOpen ? null : g.id); }}
            style={{
              position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
              background: '#fff', border: '1px solid #E2DEEC', borderRadius: 4,
              padding: 3, cursor: 'pointer', display: 'flex', color: '#8A80A8',
            }}>
            <DotsHIcon size={11} />
          </button>
        )}
        {menuOpen && (
          <div style={{
            position: 'absolute', right: 4, top: '100%', marginTop: 2, zIndex: 60,
            background: '#fff', border: '1px solid #D4CFE2', borderRadius: 8,
            boxShadow: '0 10px 15px -3px rgba(64,55,112,0.10), 0 4px 6px -4px rgba(64,55,112,0.10)',
            minWidth: 200, padding: 4,
          }}>
            <MenuRowG label="Pin to top" hint="" onClick={() => setMenuGroupId(null)} />
            <MenuRowG label="Rename"      hint="" onClick={() => setMenuGroupId(null)} />
            <MenuRowG label="Share"       hint="" onClick={() => setMenuGroupId(null)} />
            <div style={{ height: 1, background: '#EFEDF5', margin: '4px 0' }} />
            <MenuRowG label="Hide from sidebar" hint="Only affects you" onClick={() => hideGroup(g.id)} />
            {isPlan && <MenuRowG label="Archive plan" hint="Keeps history; removes from sidebar" onClick={() => archiveGroup(g.id)} />}
            {!isPlan && <MenuRowG label="Delete list" danger onClick={() => setMenuGroupId(null)} />}
          </div>
        )}
      </div>

      {/* Plan-only meta line under header */}
      {isPlan && isOpen && (
        <div style={{ padding: '0 10px 4px 30px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: '#8A80A8' }}>
          <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: '#403770' }}>{g.progress}%</span>
          <span>of {g.target}</span>
          <span style={{ color: '#D4CFE2' }}>·</span>
          <span>{g.fiscal}</span>
        </div>
      )}

      {isOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {g.views.map(v => {
            const isActive = active.groupId === g.id && active.viewId === v.id;
            const isHover  = hoverId === `${g.id}-${v.id}`;
            return (
              <button
                key={v.id}
                onMouseEnter={() => setHoverId(`${g.id}-${v.id}`)}
                onMouseLeave={() => setHoverId(null)}
                onClick={() => setActive({ groupId: g.id, viewId: v.id })}
                style={{
                  padding: viewPad, display: 'flex', alignItems: 'center', gap: 8,
                  background: isActive ? '#EFEDF5' : (isHover ? '#F7F5FA' : 'transparent'),
                  border: 'none', borderRadius: 6,
                  color: isActive ? '#403770' : '#5C5277',
                  fontWeight: isActive ? 600 : 500, fontSize: 12.5,
                  fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
                }}>
                <VTI type={v.type} color={isActive ? '#F37167' : '#8A80A8'} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.label}</span>
                {v.pinned && <PinIcon size={9} style={{ color: '#F37167' }} />}
              </button>
            );
          })}
          <button style={{
            padding: viewPad, display: 'flex', alignItems: 'center', gap: 6,
            background: 'transparent', border: 'none', borderRadius: 6,
            color: '#A69DC0', fontWeight: 500, fontSize: 11.5,
            fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
          }}>
            <span style={{ fontSize: 13, lineHeight: 1 }}>+</span> New view
          </button>
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
// Group canvas — plan-aware top bar + view switcher + view body
// ───────────────────────────────────────────────────────────────────
function GroupCanvas({ group, view, setActive, VTI, openBuilder, PinIcon, BookmarkIcon, ShareIcon, PencilIcon, FilterIcon, SearchIcon, PlusIcon, UsersIcon, CanvasMapView, CanvasTableView, CanvasKanbanView, CanvasContactsView, CanvasOppsView }) {
  const isPlan = group?.kind === 'plan';

  return (
    <>
      <div style={{
        padding: '12px 20px 0', borderBottom: '1px solid #D4CFE2',
        background: '#fff', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            {/* Eyebrow: plan vs list flavor */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              {isPlan ? (
                <>
                  <span style={{ width: 4, height: 4, borderRadius: 2, background: group.accent }} />
                  <span style={{ fontSize: 10, color: '#8A80A8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>🎯 Plan · {group.fiscal}</span>
                </>
              ) : (
                <span style={{ fontSize: 10, color: '#8A80A8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>📋 List</span>
              )}
              {group?.shared && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color: '#4d7285', padding: '1px 7px', background: '#e8f1f5', borderRadius: 999, fontWeight: 600 }}>
                  <UsersIcon size={9} /> Shared
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: '#403770', margin: 0, letterSpacing: '-0.01em' }}>
                {group?.label}
              </h1>
              <span style={{ color: '#D4CFE2', fontSize: 16 }}>/</span>
              <VTI type={view?.type} size={14} color="#F37167" />
              <span style={{ fontSize: 16, fontWeight: 600, color: '#544A78' }}>{view?.label}</span>
              <button style={iconBtn3}><PencilIcon size={12} /></button>
              {view?.pinned && <PinIcon size={11} style={{ color: '#F37167' }} />}
            </div>

            {/* Plan rollups */}
            {isPlan && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                columnGap: 16, rowGap: 10, marginTop: 12,
                paddingRight: 8,
              }}>
                <Stat label="Target"        value={group.target} />
                <Stat label="Progress"      value={`${group.progress}%`} />
                <Stat label="Pipeline"      value={group.pipeline} />
                <Stat label="Contacts"      value={group.contactsCount} />
                <Stat label="Open opps"     value={group.oppsCount} />
                <Stat label="Owner" value={
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#C4E7E6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: '#403770' }}>{group.owner}</span>
                  </span>
                } />
              </div>
            )}
            {!isPlan && group?.filters && (
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                {group.filters.map((f, i) => (
                  <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 999, background: '#FFFCFA', border: '1px solid #E2DEEC', color: '#6E6390', fontSize: 11, fontWeight: 500 }}>
                    <FilterIcon size={9} style={{ color: '#A69DC0' }} />
                    {f}
                  </span>
                ))}
                <button style={{ padding: '2px 8px', borderRadius: 999, background: 'transparent', border: '1px dashed #D4CFE2', color: '#8A80A8', fontSize: 11, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>+ Filter</button>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button style={iconBtn3}><FilterIcon size={13} /></button>
            <button style={iconBtn3}><SearchIcon size={13} /></button>
            <div style={{ width: 1, height: 18, background: '#E2DEEC' }} />
            <button style={btnSecondary}><ShareIcon size={12} /> Share</button>
            <button onClick={() => openBuilder && openBuilder()} style={btnPrimary}><BookmarkIcon size={12} /> Save as list</button>
          </div>
        </div>

        {/* Plan progress bar */}
        {isPlan && (
          <div style={{ marginTop: 16, height: 4, background: '#EFEDF5', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${group.progress}%`,
              background: group.progress >= 75 ? '#69B34A' : group.progress >= 50 ? '#6EA3BE' : '#F37167',
              borderRadius: 999, transition: 'width 400ms ease-out',
            }} />
          </div>
        )}

        {/* View tab strip */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginTop: 12 }}>
          {group?.views.map(v => {
            const isActive = v.id === view?.id;
            return (
              <button
                key={v.id}
                onClick={() => setActive({ groupId: group.id, viewId: v.id })}
                style={{
                  padding: '8px 12px', display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'transparent', border: 'none',
                  borderBottom: isActive ? '2px solid #403770' : '2px solid transparent',
                  color: isActive ? '#403770' : '#8A80A8',
                  fontWeight: isActive ? 600 : 500, fontSize: 12,
                  fontFamily: 'inherit', cursor: 'pointer', marginBottom: -1,
                }}>
                <VTI type={v.type} size={12} color={isActive ? '#F37167' : '#A69DC0'} />
                {v.label}
              </button>
            );
          })}
          <button style={{ padding: '8px 10px', background: 'transparent', border: 'none', color: '#A69DC0', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <PlusIcon size={11} /> View
          </button>
        </div>
      </div>

      <CanvasBody view={view} group={group} VTI={VTI} {...{CanvasMapView, CanvasTableView, CanvasKanbanView, CanvasContactsView, CanvasOppsView, CanvasVacanciesView: window.CanvasVacanciesView, CanvasNewsView: window.CanvasNewsView, CanvasRfpsView: window.CanvasRfpsView}} />
    </>
  );
}

// ───────────────────────────────────────────────────────────────────
// Canvas body — wraps view bodies with click-to-open district panel
// ───────────────────────────────────────────────────────────────────
function CanvasBody({ view, group, CanvasMapView, CanvasTableView, CanvasKanbanView, CanvasContactsView, CanvasOppsView, CanvasVacanciesView, CanvasNewsView, CanvasRfpsView }) {
  const [sel, setSel] = React.useState(null); // {kind, id}
  const { DetailPanel, SAMPLE_DISTRICTS = [], FEED_VAC = [], FEED_NEWS = [], FEED_RFPS = [] } = window;

  const KIND_BY_VIEW = { table: 'district', map: 'district', kanban: 'district', contacts: 'contact', opps: 'opp', vacancies: 'vacancy', news: 'news', rfps: 'rfp' };

  const onClick = (e) => {
    const kind = KIND_BY_VIEW[view?.type];
    if (!kind) return;
    // 1) data-row-id wins
    const dataEl = e.target.closest?.('[data-row-id]');
    if (dataEl) { setSel({ kind, id: dataEl.dataset.rowId }); return; }
    // 2) walk up for tr in tbody, take first cell text
    let el = e.target;
    for (let i = 0; i < 10 && el; i++, el = el.parentElement) {
      if (el.tagName === 'TR' && el.parentElement?.tagName === 'TBODY') {
        const head = (el.cells?.[0]?.textContent || '').trim();
        if (head) { setSel({ kind, id: head }); return; }
      }
    }
    // 3) map fallback — open first district
    if (view?.type === 'map' && e.target.closest('[data-canvas-map]') && SAMPLE_DISTRICTS[0]) {
      setSel({ kind: 'district', id: SAMPLE_DISTRICTS[0].name });
    }
  };

  const cursor = view?.type ? 'pointer' : 'default';

  return (
    <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }} onClick={onClick}>
      <div data-canvas-map={view?.type === 'map' ? '' : undefined} style={{ position: 'absolute', inset: 0, cursor }}>
        {view?.type === 'map' && <CanvasMapView title={`${group.label} · ${view.label}`} />}
        {view?.type === 'table' && <CanvasTableView />}
        {view?.type === 'kanban' && <CanvasKanbanView />}
        {view?.type === 'contacts' && <CanvasContactsView />}
        {view?.type === 'opps' && <CanvasOppsView />}
        {view?.type === 'vacancies' && CanvasVacanciesView && <CanvasVacanciesView />}
        {view?.type === 'news' && CanvasNewsView && <CanvasNewsView />}
        {view?.type === 'rfps' && CanvasRfpsView && <CanvasRfpsView />}
      </div>
      {sel && DetailPanel && (
        sel.kind === 'district'
          ? (window.DistrictPanel ? <window.DistrictPanel name={sel.id} onClose={() => setSel(null)} /> : null)
          : <DetailPanel kind={sel.kind} id={sel.id} onClose={() => setSel(null)} />
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
// All plans portfolio
// ───────────────────────────────────────────────────────────────────
function PortfolioView({ plans, unarchiveGroup, onOpen }) {
  const { FolkBookmarkIcon: BookmarkIcon, FolkShareIcon: ShareIcon, PlusIcon } = window;
  const [showArchived, setShowArchived] = React.useState(false);
  const active = plans.filter(p => !p.archived);
  const archived = plans.filter(p => p.archived);
  const shown = showArchived ? archived : active;
  return (
    <>
      <div style={{
        padding: '14px 24px', borderBottom: '1px solid #D4CFE2', background: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 10, color: '#8A80A8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{showArchived ? 'Archived' : 'FY26 Portfolio'}</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#403770', margin: 0, letterSpacing: '-0.01em' }}>{showArchived ? `Archived plans · ${archived.length}` : 'All plans'}</h1>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <PortfolioStat label="Total target"  value="$2.36M" />
          <PortfolioStat label="Booked"        value="$1.47M" tone="up" />
          <PortfolioStat label="Open pipeline" value="$622K"  />
          <PortfolioStat label="To target"     value="62%"    tone="up" />
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: '#FFFCFA' }} className="fm-scrollbar">
        {/* Tab strip: Active / Archived */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 18, borderBottom: '1px solid #E2DEEC' }}>
          {[{id: false, l: `Active · ${active.length}`}, {id: true, l: `Archived · ${archived.length}`}].map(t => (
            <button key={String(t.id)} onClick={() => setShowArchived(t.id)}
              style={{
                padding: '8px 14px', background: 'transparent', border: 'none',
                borderBottom: showArchived === t.id ? '2px solid #403770' : '2px solid transparent',
                color: showArchived === t.id ? '#403770' : '#8A80A8',
                fontWeight: showArchived === t.id ? 600 : 500, fontSize: 13,
                fontFamily: 'inherit', cursor: 'pointer', marginBottom: -1,
              }}>
              {t.l}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          {shown.map(p => (
            <button key={p.id} onClick={() => onOpen(p.id)}
              style={{
                background: '#fff', border: '1px solid #D4CFE2', borderRadius: 8,
                padding: 16, textAlign: 'left', cursor: 'pointer',
                fontFamily: 'inherit', boxShadow: '0 1px 2px rgba(64,55,112,0.05)',
                display: 'flex', flexDirection: 'column', gap: 12, position: 'relative',
              }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: p.accent, borderRadius: '8px 8px 0 0' }} />
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#8A80A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{p.fiscal}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#403770', marginTop: 2, letterSpacing: '-0.01em' }}>{p.label}</div>
                </div>
                <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#C4E7E6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: '#403770', flexShrink: 0 }}>{p.owner}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#8A80A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Target</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#403770', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{p.target}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#8A80A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pipeline</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#544A78', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{p.pipeline}</div>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                  <span style={{ color: '#8A80A8', fontWeight: 500 }}>Revenue to target</span>
                  <span style={{ color: p.progress >= 75 ? '#5f665b' : p.progress >= 50 ? '#4d7285' : '#c25a52', fontWeight: 600 }}>{p.progress}%</span>
                </div>
                <div style={{ height: 5, background: '#EFEDF5', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${p.progress}%`, background: p.progress >= 75 ? '#69B34A' : p.progress >= 50 ? '#6EA3BE' : '#F37167', borderRadius: 999 }} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingTop: 8, borderTop: '1px solid #EFEDF5', fontSize: 11, color: '#8A80A8' }}>
                <BookmarkIcon size={11} /> {p.views.length} views
                {p.shared && <><span style={{ color: '#D4CFE2' }}>·</span><ShareIcon size={11} /> Shared</>}
                {p.archived && unarchiveGroup && (
                  <button onClick={(e) => { e.stopPropagation(); unarchiveGroup(p.id); }}
                    style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#F37167', cursor: 'pointer', padding: 0, fontSize: 11, fontFamily: 'inherit', fontWeight: 600 }}>
                    Unarchive
                  </button>
                )}
              </div>
            </button>
          ))}
          {!showArchived && (
          <button style={{
            background: 'transparent', border: '1px dashed #D4CFE2', borderRadius: 8,
            padding: 16, cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
            color: '#8A80A8', fontSize: 13, fontWeight: 500, minHeight: 200,
          }}>
            <PlusIcon size={20} />
            New plan
          </button>
          )}
        </div>
      </div>
    </>
  );
}

// ───────────────────────────────────────────────────────────────────
// Tiny pieces
// ───────────────────────────────────────────────────────────────────
function Stat({ label, value }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#8A80A8', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: '#403770', marginTop: 2, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  );
}
function PortfolioStat({ label, value, tone }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#8A80A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: tone === 'up' ? '#5f665b' : '#403770', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}
function Divider() {
  return <div style={{ width: 1, height: 22, background: '#E2DEEC' }} />;
}
function ProgressDot({ pct }) {
  const col = pct >= 75 ? '#69B34A' : pct >= 50 ? '#6EA3BE' : '#F37167';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
      <svg width="14" height="14" viewBox="0 0 14 14">
        <circle cx="7" cy="7" r="5.5" fill="none" stroke="#EFEDF5" strokeWidth="2" />
        <circle cx="7" cy="7" r="5.5" fill="none" stroke={col} strokeWidth="2" strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * 34.5} 34.5`} transform="rotate(-90 7 7)" />
      </svg>
    </span>
  );
}
function GridIcon({ size = 14, style }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, ...style }}>
    <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>);
}
function ListIcon({ size = 12, style }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, ...style }}>
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>);
}

const iconBtn3 = {
  padding: 6, background: 'transparent', border: 'none', borderRadius: 6,
  color: '#8A80A8', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};
const btnSecondary = {
  padding: '6px 10px', fontSize: 12, fontFamily: 'inherit',
  background: '#fff', border: '1px solid #D4CFE2', borderRadius: 6,
  color: '#403770', fontWeight: 500, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 6,
};
const btnPrimary = {
  padding: '6px 12px', fontSize: 12, fontFamily: 'inherit',
  background: '#403770', border: 'none', borderRadius: 6,
  color: '#fff', fontWeight: 500, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 6,
};

const footerLink = {
  padding: '5px 8px', background: 'transparent', border: 'none',
  color: '#8A80A8', fontSize: 11, fontWeight: 500, fontFamily: 'inherit',
  cursor: 'pointer', textAlign: 'left', borderRadius: 4,
};

function DotsHIcon({ size = 12, style }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0, ...style }}>
    <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
  </svg>);
}

function MenuRowG({ label, hint, onClick, danger }) {
  const [hov, setHov] = React.useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', padding: '6px 10px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2,
        background: hov ? '#F7F5FA' : 'transparent', border: 'none', borderRadius: 5,
        color: danger ? '#c25a52' : '#403770',
        fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
        cursor: 'pointer', textAlign: 'left',
      }}>
      <span>{label}</span>
      {hint && <span style={{ fontSize: 10, color: '#8A80A8' }}>{hint}</span>}
    </button>
  );
}

// ───────────────────────────────────────────────────────────────────
// Contacts view
// ───────────────────────────────────────────────────────────────────
const SAMPLE_CONTACTS = [
  { name: 'Dr. Maria Chen',     role: 'Superintendent',          district: 'Mapleton ISD',       last: '2d',   tier: 'A', stage: 'Champion' },
  { name: 'James Okafor',       role: 'CTO',                     district: 'Westbrook USD',      last: '5d',   tier: 'A', stage: 'Engaged' },
  { name: 'Sarah Patel',        role: 'Curriculum Director',     district: 'Granite Falls SD',   last: '1w',   tier: 'B', stage: 'Engaged' },
  { name: 'Robert Liang',       role: 'Asst. Superintendent',    district: 'Northshore PSD',     last: '3d',   tier: 'A', stage: 'Champion' },
  { name: 'Tasha Williams',     role: 'Director of Tech',        district: 'Hartford Co. PS',    last: '12d',  tier: 'B', stage: 'Cold' },
  { name: 'Daniel Greene',      role: 'Procurement Lead',        district: 'Mapleton ISD',       last: '4d',   tier: 'A', stage: 'Engaged' },
  { name: 'Priya Raman',        role: 'Principal',               district: 'Lakeside Elementary',last: '3w',   tier: 'C', stage: 'Cold' },
  { name: 'Michael Park',       role: 'Superintendent',          district: 'Riverdale CSD',      last: '6d',   tier: 'A', stage: 'Engaged' },
];

const STAGE_PILL = {
  Champion: { bg: '#EDFFE3', fg: '#5f665b' },
  Engaged:  { bg: '#e8f1f5', fg: '#4d7285' },
  Cold:     { bg: '#FEF2F1', fg: '#c25a52' },
};

function CanvasContactsView() {
  return (
    <div style={{ height: '100%', overflow: 'auto', background: '#FFFCFA' }} className="fm-scrollbar">
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#FFFCFA', borderBottom: '1px solid #E2DEEC' }}>
            {['Contact','Role','District','Stage','Tier','Last touch'].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 10, fontWeight: 700, color: '#8A80A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SAMPLE_CONTACTS.map((c, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #EFEDF5', background: '#fff' }}>
              <td style={{ padding: '10px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#C4E7E6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#403770' }}>
                    {c.name.split(' ').map(p => p[0]).slice(0,2).join('')}
                  </div>
                  <span style={{ fontWeight: 600, color: '#403770' }}>{c.name}</span>
                </div>
              </td>
              <td style={{ padding: '10px 16px', color: '#544A78' }}>{c.role}</td>
              <td style={{ padding: '10px 16px', color: '#544A78' }}>{c.district}</td>
              <td style={{ padding: '10px 16px' }}>
                <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: STAGE_PILL[c.stage].bg, color: STAGE_PILL[c.stage].fg }}>{c.stage}</span>
              </td>
              <td style={{ padding: '10px 16px', color: '#544A78', fontWeight: 600 }}>{c.tier}</td>
              <td style={{ padding: '10px 16px', color: '#8A80A8', fontVariantNumeric: 'tabular-nums' }}>{c.last} ago</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
// Opportunities view
// ───────────────────────────────────────────────────────────────────
const SAMPLE_OPPS = [
  { title: 'Mapleton ISD — Math 6–12 expansion',   district: 'Mapleton ISD',     stage: 'Proposal',     arr: '$92K', close: 'May 30', owner: 'AR' },
  { title: 'Westbrook USD — Pilot → District',     district: 'Westbrook USD',    stage: 'Negotiation',  arr: '$148K', close: 'Jun 14', owner: 'AR' },
  { title: 'Granite Falls — ELA renewal',           district: 'Granite Falls SD', stage: 'Closed Won',   arr: '$58K', close: 'Apr 22', owner: 'AR' },
  { title: 'Northshore PSD — K–5 add-on',           district: 'Northshore PSD',   stage: 'Discovery',    arr: '$34K', close: 'Jul 09', owner: 'JM' },
  { title: 'Hartford Co. — Science pilot',          district: 'Hartford Co. PS',  stage: 'Discovery',    arr: '$22K', close: 'Aug 01', owner: 'AR' },
  { title: 'Riverdale CSD — Multi-year renewal',    district: 'Riverdale CSD',    stage: 'Proposal',     arr: '$210K', close: 'Jun 30', owner: 'AR' },
];

const OPP_STAGE_PILL = {
  'Discovery':   { bg: '#FFFCFA', fg: '#8A80A8', bd: '#E2DEEC' },
  'Proposal':    { bg: '#e8f1f5', fg: '#4d7285', bd: 'transparent' },
  'Negotiation': { bg: '#FEF2F1', fg: '#c25a52', bd: 'transparent' },
  'Closed Won':  { bg: '#EDFFE3', fg: '#5f665b', bd: 'transparent' },
};

function CanvasOppsView() {
  return (
    <div style={{ height: '100%', overflow: 'auto', background: '#FFFCFA' }} className="fm-scrollbar">
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ background: '#FFFCFA', borderBottom: '1px solid #E2DEEC' }}>
            {['Opportunity','District','Stage','ARR','Close date','Owner'].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 10, fontWeight: 700, color: '#8A80A8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {SAMPLE_OPPS.map((o, i) => {
            const p = OPP_STAGE_PILL[o.stage];
            return (
              <tr key={i} style={{ borderBottom: '1px solid #EFEDF5', background: '#fff' }}>
                <td style={{ padding: '10px 16px', fontWeight: 600, color: '#403770' }}>{o.title}</td>
                <td style={{ padding: '10px 16px', color: '#544A78' }}>{o.district}</td>
                <td style={{ padding: '10px 16px' }}>
                  <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: p.bg, color: p.fg, border: `1px solid ${p.bd}` }}>{o.stage}</span>
                </td>
                <td style={{ padding: '10px 16px', color: '#403770', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{o.arr}</td>
                <td style={{ padding: '10px 16px', color: '#544A78', fontVariantNumeric: 'tabular-nums' }}>{o.close}</td>
                <td style={{ padding: '10px 16px' }}>
                  <span style={{ width: 22, height: 22, borderRadius: '50%', background: '#C4E7E6', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: '#403770' }}>{o.owner}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function BriefcaseIcon({ size = 14, style }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, ...style }}>
    <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>);
}

Object.assign(window, { UnifiedApp, CanvasContactsView, CanvasOppsView, BriefcaseIcon });
