/* global React */
// MonthView.jsx — Full month calendar grid, inspired by Brand+Aid reference



function MonthView({ currentDate, activities, onActivityClick, onDayClick, scope, showOpps, dealKinds, deals = [], onDealClick }) {
  const monthStart = window.startOfMonth(currentDate);
  const monthEnd = window.endOfMonth(currentDate);
  const gridStart = window.startOfWeek(monthStart);
  const gridEnd = window.endOfWeek(monthEnd);

  const scopedOpps = React.useMemo(
    () => window.filterOppsByKind(window.filterOppsByScope(window.OPP_EVENTS, scope), dealKinds),
    [scope, dealKinds]
  );

  const oppsByDay = React.useMemo(
    () => window.groupOppsByDay(scopedOpps),
    [scopedOpps]
  );

  // Deals-as-objects: bucket the (already-scope+filter-narrowed) deals by day
  const dealsByDay = React.useMemo(() => window.groupOppsByDay(deals), [deals]);

  // Build 6x7 grid
  const days = [];
  let d = gridStart;
  while (d <= gridEnd) {
    days.push(d);
    d = window.addDays(d, 1);
  }

  // Bucket activities by day
  const byDay = React.useMemo(() => {
    const m = new Map();
    for (const a of activities) {
      const key = window.startOfDay(a.start).toISOString();
      if (!m.has(key)) m.set(key, []);
      m.get(key).push(a);
    }
    return m;
  }, [activities]);

  const today = window.TODAY;
  const dayLabels = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  return (
    <div style={{ padding: '0 24px 24px', background: '#FFFCFA', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, gap: 12 }}>
      {showOpps && (
        <window.OppSummaryStrip
          events={scopedOpps}
          range={{ start: monthStart, end: monthEnd }}
          label={window.fmtMonthYear(currentDate)}
          scope={scope}
        />
      )}
      {/* Day-of-week header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #D4CFE2' }}>
        {dayLabels.map(lbl => (
          <div key={lbl} style={{
            padding: '8px 10px', fontSize: 11, fontWeight: 600,
            color: '#8A80A8', textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>{lbl}</div>
        ))}
      </div>

      {/* Date grid */}
      <div style={{
        flex: 1, display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gridAutoRows: '1fr',
        border: '1px solid #E2DEEC', borderTop: 'none',
        borderRadius: '0 0 12px 12px', overflow: 'hidden',
        background: '#fff',
      }}>
        {days.map((day, i) => {
          const inMonth = window.sameMonth(day, currentDate);
          const isToday = window.sameDay(day, today);
          const key = window.startOfDay(day).toISOString();
          const items = (byDay.get(key) || []).slice().sort((a,b) => a.start - b.start);
          const dealItems = dealsByDay.get(key) || [];
          // Pack deal chips first, then activity chips, up to MAX
          const MAX = 4;
          const dealSlots = Math.min(dealItems.length, MAX);
          const activitySlots = Math.max(0, MAX - dealSlots);
          const visibleDeals = dealItems.slice(0, dealSlots);
          const visibleActivities = items.slice(0, activitySlots);
          const overflow = (items.length - visibleActivities.length) + (dealItems.length - visibleDeals.length);
          const weekend = day.getDay() === 0 || day.getDay() === 6;

          return (
            <div key={i}
              onClick={() => onDayClick && onDayClick(day)}
              style={{
                borderRight: (i % 7 !== 6) ? '1px solid #E2DEEC' : 'none',
                borderBottom: (Math.floor(i / 7) < Math.floor((days.length - 1) / 7)) ? '1px solid #E2DEEC' : 'none',
                background: !inMonth ? '#FBF9FC' : (weekend ? '#FFFCFA' : '#fff'),
                padding: 6, display: 'flex', flexDirection: 'column', gap: 4,
                minHeight: 0, cursor: 'pointer',
                position: 'relative',
                transition: 'background 120ms ease-out',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#F7F5FA'}
              onMouseLeave={(e) => e.currentTarget.style.background = !inMonth ? '#FBF9FC' : (weekend ? '#FFFCFA' : '#fff')}
            >
              {/* Day number — black square per Brand+Aid reference */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{
                  width: 24, height: 24,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: isToday ? '#F37167' : (inMonth ? '#403770' : '#D4CFE2'),
                  color: '#fff',
                  fontSize: 11, fontWeight: 700,
                  borderRadius: 4,
                }}>{day.getDate()}</div>
                {isToday && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
                    color: '#F37167', textTransform: 'uppercase',
                  }}>Today</span>
                )}
              </div>

              {/* Opp signal bar */}
              {showOpps && inMonth && (
                <window.OppDayBar opps={oppsByDay.get(key)} />
              )}

              {/* Event chips — deals first, then activities */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minHeight: 0, overflow: 'hidden' }}>
                {visibleDeals.map((deal, di) => (
                  <window.DealChip key={'d' + di} deal={deal} density="compact" onClick={onDealClick} />
                ))}
                {visibleActivities.map(a => {
                  const cat = window.ACTIVITY_CATEGORY[a.type] || 'meeting';
                  const style = window.CATEGORY_STYLE[cat];
                  const isMine = a.mine;
                  const t = !isMine && scope === 'all' ? window.getTeammate(a.owner) : null;
                  return (
                    <div key={a.id}
                      onClick={(e) => { e.stopPropagation(); onActivityClick && onActivityClick(a); }}
                      style={{
                        background: style.bg, color: style.ink,
                        padding: '3px 6px', borderRadius: 3,
                        fontSize: 10.5, fontWeight: 500,
                        lineHeight: 1.25,
                        display: 'flex', alignItems: 'center', gap: 4,
                        whiteSpace: 'nowrap', overflow: 'hidden',
                        border: isMine ? 'none' : `1px dashed ${style.dot}`,
                        opacity: isMine ? 1 : 0.9,
                        cursor: 'pointer',
                      }}
                      title={`${a.title} — ${window.fmtTime(a.start)}${a.owner ? ' · ' + a.owner : ''}`}
                    >
                      {t ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          width: 14, height: 14, borderRadius: '50%',
                          background: t.color, color: '#fff',
                          fontSize: 8, fontWeight: 700, lineHeight: 1,
                          flexShrink: 0,
                        }}>{t.initials}</span>
                      ) : (
                        <span style={{ fontVariantNumeric: 'tabular-nums', opacity: 0.7, fontWeight: 600 }}>
                          {window.fmtTime(a.start)}
                        </span>
                      )}
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.title}</span>
                    </div>
                  );
                })}
                {overflow > 0 && (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    fontSize: 10, color: '#8A80A8', fontWeight: 600,
                    padding: '2px 6px',
                  }}>
                    <span>+{overflow} more</span>
                    {scope === 'all' && (
                      <window.TeammateAvatarStack
                        owners={items.slice(activitySlots).map(a => a.owner)}
                        size={13} max={3}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend strip — matches Brand+Aid reference aesthetic */}
      <div style={{
        display: 'flex', gap: 16, alignItems: 'center',
        padding: '14px 4px 0', flexWrap: 'wrap',
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#403770', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Key</div>
        {Object.entries(window.CATEGORY_STYLE).filter(([k]) => k !== 'ooo').map(([k, s]) => (
          <div key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 18, height: 12, borderRadius: 2, background: s.bg }} />
            <span style={{ fontSize: 11, color: '#6E6390', fontWeight: 500 }}>{s.label}</span>
          </div>
        ))}
        {scope === 'all' && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
            <span style={{ fontSize: 11, color: '#6E6390', fontWeight: 500 }}>Team this month</span>
            <window.TeammateAvatarStack
              owners={activities.filter(a => !a.mine).map(a => a.owner)}
              size={18} max={6}
            />
          </div>
        )}
      </div>
    </div>
  );
}

window.MonthView = MonthView;
