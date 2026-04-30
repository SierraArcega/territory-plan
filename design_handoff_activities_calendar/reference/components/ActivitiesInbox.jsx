/* global React */
// ActivitiesInbox.jsx — right-side rail showing "my upcoming" activities list
// Always visible when scope=mine; switches into "team feed" when scope=all

function ActivitiesInbox({ activities, currentDate, onActivityClick, scope, onCollapse }) {
  // Group upcoming (>= today) by day, next 14 days
  const today = window.TODAY;
  const items = activities
    .filter(a => a.start >= today)
    .slice()
    .sort((a,b) => a.start - b.start)
    .slice(0, 30);

  const groups = [];
  const byKey = new Map();
  for (const a of items) {
    const k = window.startOfDay(a.start).toISOString();
    if (!byKey.has(k)) {
      byKey.set(k, { date: window.startOfDay(a.start), items: [] });
      groups.push(byKey.get(k));
    }
    byKey.get(k).items.push(a);
  }

  const totalMine = activities.filter(a => a.mine && a.start >= today).length;
  const totalTeam = activities.filter(a => !a.mine && a.start >= today).length;

  return (
    <aside style={{
      width: 320, flexShrink: 0,
      borderLeft: '1px solid #E2DEEC',
      background: '#FFFCFA',
      display: 'flex', flexDirection: 'column',
      height: '100%',
    }}>
      {/* Header */}
      <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid #E2DEEC' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#403770', letterSpacing: '-0.01em' }}>
            {scope === 'all' ? 'Team feed' : 'Upcoming'}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button style={{
              background: 'transparent', border: 'none', color: '#8A80A8',
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'inherit',
            }}>View all</button>
            {onCollapse && (
              <button onClick={onCollapse} title="Collapse rail"
                style={{
                  width: 24, height: 24, borderRadius: 6, border: '1px solid #E2DEEC',
                  background: '#fff', color: '#8A80A8', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#403770'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#8A80A8'; }}
              >
                <window.ChevronRightIcon size={14} />
              </button>
            )}
          </div>
        </div>
        <div style={{ marginTop: 6, fontSize: 11, color: '#8A80A8' }}>
          {scope === 'all' ? (
            <>
              <span style={{ color: '#403770', fontWeight: 600 }}>{totalMine}</span> yours ·{' '}
              <span style={{ color: '#403770', fontWeight: 600 }}>{totalTeam}</span> team
            </>
          ) : (
            <>Next 30 activities · through {items.length > 0 ? window.fmtDateShort(items[items.length - 1].start) : '—'}</>
          )}
        </div>
        <button style={{
          marginTop: 10, width: '100%',
          padding: '8px 10px', borderRadius: 8, border: 'none',
          background: '#F37167', color: '#fff',
          fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
          cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <window.PlusIcon size={14} />
          Log activity
        </button>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto' }} className="fm-scrollbar">
        {groups.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: '#A69DC0', fontSize: 13 }}>
            No upcoming activities.
          </div>
        ) : groups.map(g => (
          <div key={g.date.toISOString()}>
            <div style={{
              padding: '10px 18px 6px',
              fontSize: 10, fontWeight: 700,
              color: window.sameDay(g.date, today) ? '#F37167' : '#8A80A8',
              textTransform: 'uppercase', letterSpacing: '0.08em',
              background: '#FFFCFA',
              position: 'sticky', top: 0, zIndex: 1,
            }}>
              {window.sameDay(g.date, today) ? 'Today' : window.fmtDay(g.date)} · {window.fmtDateShort(g.date)}
            </div>
            {g.items.map(a => {
              const cat = window.ACTIVITY_CATEGORY[a.type] || 'meeting';
              const style = window.CATEGORY_STYLE[cat];
              return (
                <button key={a.id}
                  onClick={() => onActivityClick && onActivityClick(a)}
                  style={{
                    width: '100%', textAlign: 'left',
                    padding: '10px 18px 10px 14px',
                    background: 'transparent', border: 'none',
                    borderLeft: `3px solid ${style.dot}`,
                    borderBottom: '1px solid #F7F5FA',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    display: 'flex', flexDirection: 'column', gap: 3,
                    transition: 'background 100ms ease-out',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = '#fff'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
                      color: style.ink, textTransform: 'uppercase',
                    }}>{window.ACTIVITY_TYPE_LABELS[a.type]}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 600, color: '#403770',
                      fontVariantNumeric: 'tabular-nums',
                    }}>{window.fmtTime(a.start)}</span>
                  </div>
                  <div style={{
                    fontSize: 13, fontWeight: 600, color: '#403770',
                    lineHeight: 1.3,
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  }}>{a.title}</div>
                  {(a.district || a.owner) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {a.district && (
                        <span style={{ fontSize: 11, color: '#8A80A8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                          {a.district}
                        </span>
                      )}
                      {!a.mine && a.owner && (
                        <>
                          {a.district && <span style={{ color: '#C2BBD4', fontSize: 11 }}>·</span>}
                          <window.TeammateChip owner={a.owner} size={14} />
                        </>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </aside>
  );
}

window.ActivitiesInbox = ActivitiesInbox;

// ============================================================================
// CollapsedRail — narrow vertical tab shown when the Upcoming / Team feed
// rail is collapsed. Clicking expands it back.
// ============================================================================
function CollapsedRail({ onExpand }) {
  return (
    <aside style={{
      width: 36, flexShrink: 0,
      borderLeft: '1px solid #E2DEEC',
      background: '#FFFCFA',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      paddingTop: 14,
    }}>
      <button onClick={onExpand}
        title="Expand rail"
        style={{
          width: 24, height: 24, borderRadius: 6, border: '1px solid #E2DEEC',
          background: '#fff', color: '#544A78', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 12,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = '#403770'; e.currentTarget.style.borderColor = '#D4CFE2'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = '#544A78'; e.currentTarget.style.borderColor = '#E2DEEC'; }}
      >
        <window.ChevronLeftIcon size={14} />
      </button>
      <div style={{
        writingMode: 'vertical-rl',
        transform: 'rotate(180deg)',
        fontSize: 11, fontWeight: 700, color: '#544A78',
        letterSpacing: '0.12em', textTransform: 'uppercase',
        userSelect: 'none',
      }}
        onClick={onExpand}
      >
        Upcoming
      </div>
    </aside>
  );
}
window.CollapsedRail = CollapsedRail;
