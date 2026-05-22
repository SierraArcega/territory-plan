/* global React */
// Folk-faithful: groups → views in a sidebar section, indented like folk's "My groups"
const { useState } = React;

function FolkApp({ density = 'comfortable', useEmojiIcons = false }) {
  const {
    HomeIcon, MapIcon, PlansIcon, ActivitiesIcon, TasksIcon, LeaderboardIcon,
    ResourcesIcon, ProfileIcon, SearchIcon, FilterIcon, LayersIcon, PlusIcon,
    XIcon, PencilIcon, ChevronDownIcon, ChevronRightIcon, MapPinIcon, SchoolIcon, UsersIcon,
    CanvasMapView, CanvasTableView, CanvasKanbanView,
  } = window;

  // currently active group + view
  const [active, setActive] = useState({ groupId: 'g1', viewId: 'v1-2' });
  const [openGroups, setOpenGroups] = useState({ g1: true, g2: true, g3: false });
  const [hoverViewId, setHoverViewId] = useState(null);
  const [menuViewId, setMenuViewId] = useState(null);
  const [showNewView, setShowNewView] = useState(null); // groupId
  const [newViewName, setNewViewName] = useState('');

  const NAV_ITEMS = [
    { id: 'home', label: 'Home', Icon: HomeIcon },
    { id: 'map', label: 'Map', Icon: MapIcon },
    { id: 'plans', label: 'Plans', Icon: PlansIcon },
    { id: 'activities', label: 'Activities', Icon: ActivitiesIcon },
    { id: 'tasks', label: 'Tasks', Icon: TasksIcon },
    { id: 'leaderboard', label: 'Leaderboard', Icon: LeaderboardIcon },
  ];

  const [groups, setGroups] = useState([
    {
      id: 'g1', emoji: '🗺️', label: 'Northeast Pod (FY26)', shared: true,
      views: [
        { id: 'v1-1', label: 'All districts', type: 'table' },
        { id: 'v1-2', label: 'Territory map', type: 'map', pinned: true },
        { id: 'v1-3', label: 'Pipeline by stage', type: 'kanban' },
        { id: 'v1-4', label: 'Renewals Q2', type: 'table' },
      ],
    },
    {
      id: 'g2', emoji: '🎯', label: 'High-priority prospects',
      views: [
        { id: 'v2-1', label: 'Tier A · no contact', type: 'table' },
        { id: 'v2-2', label: 'Heatmap', type: 'map' },
      ],
    },
    {
      id: 'g3', emoji: '⚠️', label: 'At risk · this quarter',
      views: [
        { id: 'v3-1', label: 'Renewal at risk', type: 'kanban' },
        { id: 'v3-2', label: 'Lapsed customers', type: 'table' },
      ],
    },
  ]);

  const activeGroup = groups.find(g => g.id === active.groupId);
  const activeView = activeGroup?.views.find(v => v.id === active.viewId);

  const compact = density === 'compact';
  const navPad = compact ? '7px 10px' : '9px 12px';
  const viewPad = compact ? '5px 10px 5px 32px' : '7px 12px 7px 32px';
  const groupPad = compact ? '5px 8px' : '7px 10px';

  const ViewTypeIcon = ({ type, size = 14, color = '#8A80A8' }) => {
    if (type === 'map')    return <MapPinIcon size={size} style={{ color }} />;
    if (type === 'table')  return <TableIcon  size={size} style={{ color }} />;
    if (type === 'kanban') return <KanbanIcon size={size} style={{ color }} />;
    return null;
  };

  function addView(groupId, type) {
    const name = newViewName.trim() || `New ${type} view`;
    const newId = `nv-${Date.now()}`;
    setGroups(gs => gs.map(g => g.id === groupId
      ? { ...g, views: [...g.views, { id: newId, label: name, type }] }
      : g));
    setActive({ groupId, viewId: newId });
    setShowNewView(null);
    setNewViewName('');
    setOpenGroups(o => ({ ...o, [groupId]: true }));
  }

  function togglePin(gid, vid) {
    setGroups(gs => gs.map(g => g.id !== gid ? g : {
      ...g, views: g.views.map(v => v.id === vid ? { ...v, pinned: !v.pinned } : v)
    }));
    setMenuViewId(null);
  }
  function deleteView(gid, vid) {
    setGroups(gs => gs.map(g => g.id !== gid ? g : { ...g, views: g.views.filter(v => v.id !== vid) }));
    setMenuViewId(null);
  }

  return (
    <div style={{ display: 'flex', height: '100%', fontFamily: 'inherit', background: '#FFFCFA' }}>
      {/* SIDEBAR */}
      <aside style={{
        width: 248, flexShrink: 0, background: '#fff',
        borderRight: '1px solid #D4CFE2', display: 'flex', flexDirection: 'column',
      }}>
        {/* Logo */}
        <div style={{ height: 56, padding: '0 16px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #EFEDF5' }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: '#F37167', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 13 }}>F</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#403770', letterSpacing: '-0.01em' }}>Mapomatic</div>
            <div style={{ fontSize: 10, color: '#8A80A8' }}>Fullmind Sales</div>
          </div>
        </div>

        {/* Top nav */}
        <nav style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {NAV_ITEMS.map(({ id, label, Icon }, i) => (
            <button key={id} style={{
              padding: navPad, display: 'flex', alignItems: 'center', gap: 10,
              background: i === 1 ? '#FEF2F1' : 'transparent',
              border: 'none', borderRadius: 6,
              color: i === 1 ? '#F37167' : '#5C5277',
              fontWeight: i === 1 ? 600 : 500, fontSize: 13,
              fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left', position: 'relative',
            }}>
              {i === 1 && <div style={{ position: 'absolute', left: -8, top: 6, bottom: 6, width: 3, borderRadius: 2, background: '#F37167' }} />}
              <Icon size={16} style={{ color: i === 1 ? '#F37167' : '#8A80A8' }} />
              {label}
            </button>
          ))}
        </nav>

        <div style={{ height: 1, background: '#EFEDF5', margin: '4px 12px' }} />

        {/* MY VIEWS */}
        <div style={{ padding: '8px 8px 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#8A80A8', textTransform: 'uppercase', letterSpacing: '0.08em', paddingLeft: 4 }}>My views</div>
          <button title="New group" style={{
            background: 'transparent', border: 'none', color: '#8A80A8', cursor: 'pointer',
            padding: 2, borderRadius: 4, display: 'flex',
          }}><PlusIcon size={14} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 12px', display: 'flex', flexDirection: 'column', gap: 1 }} className="fm-scrollbar">
          {groups.map(g => {
            const isOpen = openGroups[g.id];
            return (
              <div key={g.id}>
                {/* Group header */}
                <button
                  onClick={() => setOpenGroups(o => ({ ...o, [g.id]: !o[g.id] }))}
                  style={{
                    width: '100%', padding: groupPad, display: 'flex', alignItems: 'center', gap: 6,
                    background: 'transparent', border: 'none', borderRadius: 6,
                    color: '#403770', fontWeight: 600, fontSize: 13,
                    fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
                  }}>
                  <span style={{ display: 'flex', width: 12, color: '#8A80A8', transition: 'transform 150ms', transform: isOpen ? 'rotate(0)' : 'rotate(-90deg)' }}>
                    <ChevronDownIcon size={12} />
                  </span>
                  {useEmojiIcons
                    ? <span style={{ fontSize: 14 }}>{g.emoji}</span>
                    : <FolderIcon size={14} style={{ color: '#8A80A8' }} />}
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.label}</span>
                  {g.shared && <UsersIcon size={11} style={{ color: '#A69DC0' }} />}
                </button>

                {/* views */}
                {isOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginTop: 1 }}>
                    {g.views.map(v => {
                      const isActive = active.groupId === g.id && active.viewId === v.id;
                      const isHover = hoverViewId === `${g.id}-${v.id}`;
                      return (
                        <div
                          key={v.id}
                          onMouseEnter={() => setHoverViewId(`${g.id}-${v.id}`)}
                          onMouseLeave={() => setHoverViewId(null)}
                          style={{ position: 'relative' }}>
                          <button
                            onClick={() => setActive({ groupId: g.id, viewId: v.id })}
                            style={{
                              width: '100%', padding: viewPad, display: 'flex', alignItems: 'center', gap: 8,
                              background: isActive ? '#EFEDF5' : (isHover ? '#F7F5FA' : 'transparent'),
                              border: 'none', borderRadius: 6,
                              color: isActive ? '#403770' : '#5C5277',
                              fontWeight: isActive ? 600 : 500, fontSize: 13,
                              fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
                            }}>
                            <ViewTypeIcon type={v.type} color={isActive ? '#F37167' : '#8A80A8'} />
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.label}</span>
                            {v.pinned && <PinIcon size={10} style={{ color: '#F37167' }} />}
                          </button>
                          {(isHover || menuViewId === v.id) && (
                            <button onClick={(e) => { e.stopPropagation(); setMenuViewId(menuViewId === v.id ? null : v.id); }}
                              style={{
                                position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)',
                                background: '#fff', border: '1px solid #E2DEEC', borderRadius: 4,
                                padding: 2, cursor: 'pointer', display: 'flex',
                                color: '#8A80A8',
                              }}>
                              <DotsIcon size={12} />
                            </button>
                          )}
                          {menuViewId === v.id && (
                            <div style={{
                              position: 'absolute', right: 0, top: '100%', marginTop: 2, zIndex: 50,
                              background: '#fff', border: '1px solid #D4CFE2', borderRadius: 8,
                              boxShadow: '0 10px 15px -3px rgba(64,55,112,0.10), 0 4px 6px -4px rgba(64,55,112,0.10)',
                              minWidth: 180, padding: 4,
                            }}>
                              <MenuRow Icon={PinIcon} label={v.pinned ? 'Unpin view' : 'Pin to top'} onClick={() => togglePin(g.id, v.id)} />
                              <MenuRow Icon={PencilIcon} label="Rename" onClick={() => setMenuViewId(null)} />
                              <MenuRow Icon={CopyIcon} label="Duplicate" onClick={() => setMenuViewId(null)} />
                              <MenuRow Icon={ShareIcon} label="Share with team" onClick={() => setMenuViewId(null)} />
                              <div style={{ height: 1, background: '#EFEDF5', margin: '4px 0' }} />
                              <MenuRow Icon={TrashIcon} label="Delete" danger onClick={() => deleteView(g.id, v.id)} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {/* + new view */}
                    {showNewView === g.id ? (
                      <div style={{ padding: '4px 4px 4px 32px' }}>
                        <input
                          autoFocus value={newViewName}
                          onChange={e => setNewViewName(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') addView(g.id, 'table');
                            if (e.key === 'Escape') { setShowNewView(null); setNewViewName(''); }
                          }}
                          placeholder="View name…"
                          style={{
                            width: '100%', padding: '5px 8px', fontSize: 12,
                            border: '1px solid #F37167', borderRadius: 5,
                            outline: 'none', fontFamily: 'inherit', color: '#403770',
                            boxSizing: 'border-box',
                          }}/>
                        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                          {['map', 'table', 'kanban'].map(t => (
                            <button key={t} onClick={() => addView(g.id, t)}
                              style={{
                                flex: 1, padding: '4px 6px', fontSize: 11,
                                background: '#F7F5FA', border: '1px solid #D4CFE2',
                                borderRadius: 5, color: '#403770', cursor: 'pointer',
                                fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                              }}>
                              <ViewTypeIcon type={t} size={11} />
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowNewView(g.id)}
                        style={{
                          padding: viewPad, display: 'flex', alignItems: 'center', gap: 8,
                          background: 'transparent', border: 'none', borderRadius: 6,
                          color: '#A69DC0', fontWeight: 500, fontSize: 12,
                          fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left',
                        }}>
                        <PlusIcon size={12} /> New view
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* New group */}
          <button style={{
            padding: groupPad, display: 'flex', alignItems: 'center', gap: 6,
            background: 'transparent', border: 'none', borderRadius: 6,
            color: '#A69DC0', fontWeight: 500, fontSize: 12,
            fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left', marginTop: 2,
          }}>
            <PlusIcon size={12} /> New group
          </button>
        </div>

        {/* Profile */}
        <div style={{ padding: 10, borderTop: '1px solid #EFEDF5', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#C4E7E6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#403770' }}>AR</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#403770' }}>Alex Rivera</div>
            <div style={{ fontSize: 10, color: '#8A80A8' }}>Northeast Pod</div>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top bar */}
        <div style={{
          height: 56, padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid #D4CFE2', background: '#fff', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <span style={{ fontSize: 13, color: '#8A80A8', display: 'flex', alignItems: 'center', gap: 6 }}>
              {useEmojiIcons ? activeGroup?.emoji : <FolderIcon size={13} />} {activeGroup?.label}
            </span>
            <span style={{ color: '#D4CFE2' }}>/</span>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#403770', margin: 0, letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 8 }}>
              <ViewTypeIcon type={activeView?.type} size={16} color="#F37167" />
              {activeView?.label}
            </h1>
            <button style={iconBtn}><PencilIcon size={13} /></button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button style={iconBtn} title="Filters"><FilterIcon size={14} /></button>
            <button style={iconBtn} title="Search"><SearchIcon size={14} /></button>
            <div style={{ width: 1, height: 20, background: '#E2DEEC', margin: '0 2px' }} />
            <button style={{
              padding: '6px 10px', fontSize: 12, fontFamily: 'inherit',
              background: '#fff', border: '1px solid #D4CFE2', borderRadius: 6,
              color: '#403770', fontWeight: 500, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}><ShareIcon size={13} /> Share</button>
            <button style={{
              padding: '6px 12px', fontSize: 12, fontFamily: 'inherit',
              background: '#403770', border: 'none', borderRadius: 6,
              color: '#fff', fontWeight: 500, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}><BookmarkIcon size={13} /> Save current view</button>
          </div>
        </div>

        {/* Sub-tab strip — view-type switcher within group */}
        <div style={{
          height: 40, padding: '0 20px', display: 'flex', alignItems: 'center', gap: 4,
          borderBottom: '1px solid #EFEDF5', background: '#FFFCFA', flexShrink: 0,
        }}>
          {activeGroup?.views.map(v => {
            const isActive = v.id === active.viewId;
            return (
              <button
                key={v.id}
                onClick={() => setActive({ groupId: activeGroup.id, viewId: v.id })}
                style={{
                  padding: '8px 12px', display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'transparent', border: 'none',
                  borderBottom: isActive ? '2px solid #403770' : '2px solid transparent',
                  color: isActive ? '#403770' : '#8A80A8',
                  fontWeight: isActive ? 600 : 500, fontSize: 12,
                  fontFamily: 'inherit', cursor: 'pointer',
                  marginBottom: -1,
                }}>
                <ViewTypeIcon type={v.type} size={12} color={isActive ? '#F37167' : '#A69DC0'} />
                {v.label}
              </button>
            );
          })}
          <button style={{
            padding: '8px 10px', background: 'transparent', border: 'none',
            color: '#A69DC0', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}><PlusIcon size={11} /> View</button>
        </div>

        {/* View canvas */}
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          {activeView?.type === 'map' && <CanvasMapView title={activeView.label} />}
          {activeView?.type === 'table' && <CanvasTableView />}
          {activeView?.type === 'kanban' && <CanvasKanbanView />}
        </div>
      </div>
    </div>
  );
}

const iconBtn = {
  padding: 6, background: 'transparent', border: 'none', borderRadius: 6,
  color: '#8A80A8', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};

function MenuRow({ Icon, label, onClick, danger }) {
  const [hov, setHov] = React.useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 8,
        background: hov ? '#F7F5FA' : 'transparent', border: 'none', borderRadius: 5,
        color: danger ? '#c25a52' : '#403770',
        fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
        cursor: 'pointer', textAlign: 'left',
      }}>
      <Icon size={12} style={{ color: danger ? '#c25a52' : '#8A80A8' }} />
      {label}
    </button>
  );
}

// Inline icons specific to this view
function FolderIcon({ size = 14, style }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, ...style }}>
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>);
}
function TableIcon({ size = 14, style }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, ...style }}>
    <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18" />
  </svg>);
}
function KanbanIcon({ size = 14, style }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, ...style }}>
    <rect x="3" y="3" width="6" height="14" rx="1.5" /><rect x="11" y="3" width="6" height="10" rx="1.5" /><rect x="19" y="3" width="2" height="6" rx="1" />
  </svg>);
}
function PinIcon({ size = 12, style }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, ...style }}>
    <path d="M12 17v5M9 10.76V6l-2-1V3h10v2l-2 1v4.76a6 6 0 0 1 3 5.24H6a6 6 0 0 1 3-5.24z" />
  </svg>);
}
function DotsIcon({ size = 12, style }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0, ...style }}>
    <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
  </svg>);
}
function CopyIcon({ size = 12, style }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, ...style }}>
    <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>);
}
function ShareIcon({ size = 12, style }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, ...style }}>
    <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>);
}
function TrashIcon({ size = 12, style }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, ...style }}>
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>);
}
function BookmarkIcon({ size = 13, style }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, ...style }}>
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
  </svg>);
}

Object.assign(window, { FolkApp, FolkPinIcon: PinIcon, FolkBookmarkIcon: BookmarkIcon, FolkTableIcon: TableIcon, FolkKanbanIcon: KanbanIcon, FolkShareIcon: ShareIcon });
