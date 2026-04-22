/* global React */
// Sidebar.jsx — collapsible left nav; matches AppSidebar.tsx from territory-plan


const NAV_ITEMS = [
  { id: 'home',        label: 'Home',        Icon: window.HomeIcon },
  { id: 'map',         label: 'Map',         Icon: window.MapIcon },
  { id: 'plans',       label: 'Plans',       Icon: window.PlansIcon },
  { id: 'activities',  label: 'Activities',  Icon: window.ActivitiesIcon },
  { id: 'tasks',       label: 'Tasks',       Icon: window.TasksIcon },
  { id: 'leaderboard', label: 'Leaderboard', Icon: window.LeaderboardIcon },
  { id: 'resources',   label: 'Resources',   Icon: window.ResourcesIcon },
];

function Sidebar({ activeTab, onTabChange, collapsed, onToggleCollapse }) {
  const w = collapsed ? 64 : 240;
  return (
    <aside style={{
      width: w, flexShrink: 0,
      background: '#fff',
      borderRight: '1px solid #D4CFE2',
      display: 'flex', flexDirection: 'column',
      transition: 'width 200ms ease-out',
      height: '100vh',
    }}>
      {/* Header / logo */}
      <div style={{
        height: 64, padding: collapsed ? '0 16px' : '0 20px',
        display: 'flex', alignItems: 'center', gap: 10,
        borderBottom: '1px solid #EFEDF5',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: '#F37167',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontWeight: 700, fontSize: 14,
          flexShrink: 0,
        }}>F</div>
        {!collapsed && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#403770', letterSpacing: '-0.01em' }}>Mapomatic</div>
            <div style={{ fontSize: 10, color: '#8A80A8', marginTop: 1 }}>Fullmind Sales</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map(({ id, label, Icon }) => (
          <NavItem key={id} id={id} label={label} Icon={Icon} collapsed={collapsed}
            active={activeTab === id} onClick={() => onTabChange(id)} />
        ))}
      </nav>

      {/* Footer / profile */}
      <div style={{ padding: 8, borderTop: '1px solid #EFEDF5' }}>
        <NavItem id="profile" label="Alex Rivera" Icon={window.ProfileIcon}
          collapsed={collapsed} active={activeTab === 'profile'}
          onClick={() => onTabChange('profile')}
          subtitle="alex@fullmind.co" />
        <button
          onClick={onToggleCollapse}
          style={{
            marginTop: 4, width: '100%', padding: '8px 12px',
            display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: 10,
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: '#8A80A8', fontSize: 12, fontFamily: 'inherit',
            borderRadius: 6,
          }}>
          {collapsed
            ? <window.ChevronRightIcon size={16} />
            : <><window.ChevronLeftIcon size={16} /><span>Collapse</span></>}
        </button>
      </div>
    </aside>
  );
}

function NavItem({ label, Icon, active, collapsed, onClick, subtitle }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      title={collapsed ? label : undefined}
      style={{
        width: '100%', padding: collapsed ? '10px' : '10px 12px',
        display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: 12,
        background: active ? '#EDFFE3' : (hover ? '#F7F5FA' : 'transparent'),
        border: 'none', borderRadius: 8,
        color: active ? '#403770' : (hover ? '#403770' : '#5C5277'),
        fontWeight: active ? 600 : 500, fontSize: 13,
        fontFamily: 'inherit', cursor: 'pointer',
        position: 'relative', textAlign: 'left',
        transition: 'background 120ms ease-out, color 120ms ease-out',
      }}>
      {active && !collapsed && (
        <div style={{ position: 'absolute', left: 0, top: 6, bottom: 6, width: 3, borderRadius: 2, background: '#F37167' }} />
      )}
      <Icon size={18} style={{ color: active ? '#F37167' : 'currentColor' }} />
      {!collapsed && (
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
          {subtitle && <div style={{ fontSize: 10, fontWeight: 400, color: '#8A80A8', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</div>}
        </div>
      )}
    </button>
  );
}

window.Sidebar = Sidebar;
