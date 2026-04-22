/* global React */
// WeekView.jsx — time-grid week view (like Google Calendar / Acuity) AND a week-summary variant
// Two modes:
//   'grid'     — hours down left, days across, events as blocks (classic week calendar)
//   'schedule' — Perplexity-style week strip up top + day-by-day agenda list underneath



// ============================================================================
// WEEK GRID
// ============================================================================

function WeekGridView({ currentDate, activities, onActivityClick, scope, showOpps, dealKinds, deals = [], onDealClick }) {
  const weekStart = window.startOfWeek(currentDate);
  const days = [];
  for (let i = 0; i < 7; i++) days.push(window.addDays(weekStart, i));

  const scopedOpps = React.useMemo(
    () => window.filterOppsByKind(window.filterOppsByScope(window.OPP_EVENTS, scope), dealKinds),
    [scope, dealKinds]
  );

  const oppsByDay = React.useMemo(
    () => window.groupOppsByDay(scopedOpps),
    [scopedOpps]
  );

  // Deals as first-class objects, bucketed by day
  const dealsByDay = React.useMemo(() => window.groupOppsByDay(deals), [deals]);

  const HOUR_START = 7;
  const HOUR_END = 21;
  const PX_PER_HOUR = 52;

  const byDay = React.useMemo(() => {
    const m = new Map();
    for (const a of activities) {
      const k = window.startOfDay(a.start).toISOString();
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(a);
    }
    return m;
  }, [activities]);

  const today = window.TODAY;

  return (
    <div style={{ padding: '0 24px 24px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {showOpps && (
        <div style={{ marginBottom: 10 }}>
          <window.OppSummaryStrip
            events={scopedOpps}
            range={{ start: weekStart, end: window.addDays(weekStart, 6) }}
            label={`Week of ${window.fmtDateShort(weekStart)}`}
            scope={scope}
          />
        </div>
      )}
      {/* Header row: blank + day columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '64px repeat(7, 1fr)', borderBottom: '1px solid #E2DEEC', background: '#fff', borderTopLeftRadius: 12, borderTopRightRadius: 12, border: '1px solid #E2DEEC', borderBottom: 'none' }}>
        <div />
        {days.map(d => {
          const isToday = window.sameDay(d, today);
          const items = byDay.get(window.startOfDay(d).toISOString()) || [];
          return (
            <div key={d.toISOString()} style={{
              padding: '12px 10px', textAlign: 'center', borderLeft: '1px solid #E2DEEC',
            }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#8A80A8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                {window.fmtDay(d)}
              </div>
              <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <div style={{
                  width: 30, height: 30, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '50%',
                  background: isToday ? '#F37167' : 'transparent',
                  color: isToday ? '#fff' : '#403770',
                  fontSize: 16, fontWeight: 700,
                }}>{d.getDate()}</div>
              </div>
              <div style={{ marginTop: 2, fontSize: 10, color: '#8A80A8' }}>
                {items.length === 0 ? 'No activity' : `${items.length} ${items.length === 1 ? 'item' : 'items'}`}
              </div>
            </div>
          );
        })}
      </div>

      {showOpps && (
        <div style={{
          display: 'grid', gridTemplateColumns: '64px repeat(7, 1fr)',
          borderLeft: '1px solid #E2DEEC', borderRight: '1px solid #E2DEEC',
          background: '#FBF9FC',
        }}>
          <div style={{
            padding: '6px 8px', fontSize: 9, fontWeight: 700,
            color: '#8A80A8', letterSpacing: '0.06em', textTransform: 'uppercase',
            display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          }}>Deals</div>
          {days.map(d => {
            const opps = oppsByDay.get(window.startOfDay(d).toISOString()) || [];
            const total = opps.reduce((s, o) => s + o.amount, 0);
            const teamOnly = opps.length > 0 && opps.every(o => !o.mine);
            return (
              <div key={d.toISOString()} style={{
                padding: '6px 8px', borderLeft: '1px solid #E2DEEC',
                minHeight: 28,
                display: 'flex', alignItems: 'center', gap: 4,
                opacity: teamOnly ? 0.75 : 1,
              }}>
                {opps.length === 0 ? (
                  <span style={{ fontSize: 10, color: '#C2BBD4' }}>—</span>
                ) : (
                  <>
                    {opps.slice(0,4).map((o, i) => (
                      <span key={i} title={`${o.owner}: ${o.district} — ${window.OPP_STYLE[o.kind].label} ${window.formatMoney(o.amount)}`}
                        style={{
                          display: 'inline-flex', alignItems: 'center',
                          fontSize: 11, fontWeight: 700,
                          color: window.OPP_STYLE[o.kind].color,
                          opacity: o.mine ? 1 : 0.7,
                        }}>{window.OPP_STYLE[o.kind].icon}</span>
                    ))}
                    <span style={{
                      marginLeft: 'auto', fontSize: 10, fontWeight: 600,
                      color: '#403770', fontVariantNumeric: 'tabular-nums',
                    }}>{window.formatMoney(total)}</span>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Deal-objects strip — pinned row showing each deal as a first-class chip */}
      {deals.length > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: '64px repeat(7, 1fr)',
          borderLeft: '1px solid #E2DEEC', borderRight: '1px solid #E2DEEC',
          borderTop: '1px solid #EFEDF5',
          background: '#fff',
        }}>
          <div style={{
            padding: '8px 8px', fontSize: 9, fontWeight: 700,
            color: '#403770', letterSpacing: '0.06em', textTransform: 'uppercase',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end',
            lineHeight: 1.2,
          }}>Pipeline</div>
          {days.map(d => {
            const dayDeals = dealsByDay.get(window.startOfDay(d).toISOString()) || [];
            return (
              <div key={d.toISOString()} style={{
                padding: 6, borderLeft: '1px solid #E2DEEC',
                display: 'flex', flexDirection: 'column', gap: 3,
                minHeight: 32,
              }}>
                {dayDeals.length === 0 ? null : dayDeals.map((deal, i) => (
                  <window.DealChip key={i} deal={deal} density="compact" onClick={onDealClick} />
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Body: hour column + day columns */}
      <div style={{
        flex: 1, overflowY: 'auto',
        border: '1px solid #E2DEEC', borderTop: 'none',
        borderRadius: '0 0 12px 12px',
        background: '#fff',
      }}
        className="fm-scrollbar"
      >
        <div style={{ display: 'grid', gridTemplateColumns: '64px repeat(7, 1fr)', position: 'relative' }}>
          {/* Hour labels */}
          <div>
            {Array.from({ length: HOUR_END - HOUR_START + 1 }).map((_, i) => {
              const h = HOUR_START + i;
              const h12 = ((h + 11) % 12) + 1;
              const ap = h >= 12 ? 'PM' : 'AM';
              return (
                <div key={h} style={{
                  height: PX_PER_HOUR, padding: '4px 8px', fontSize: 10, color: '#A69DC0',
                  textAlign: 'right', borderTop: i === 0 ? 'none' : '1px solid #EFEDF5',
                }}>{h12} {ap}</div>
              );
            })}
          </div>

          {/* Day columns */}
          {days.map((day, colIdx) => {
            const items = (byDay.get(window.startOfDay(day).toISOString()) || [])
              .filter(a => a.start.getHours() >= HOUR_START - 1)
              .slice()
              .sort((a,b) => a.start - b.start);
            const isToday = window.sameDay(day, today);
            return (
              <div key={colIdx} style={{
                position: 'relative',
                borderLeft: '1px solid #E2DEEC',
                background: isToday ? 'rgba(196, 231, 230, 0.15)' : '#fff',
              }}>
                {/* Hour lines */}
                {Array.from({ length: HOUR_END - HOUR_START + 1 }).map((_, i) => (
                  <div key={i} style={{
                    height: PX_PER_HOUR, borderTop: i === 0 ? 'none' : '1px solid #EFEDF5',
                  }} />
                ))}

                {/* "Now" line for today */}
                {isToday && (() => {
                  const now = new Date();
                  const mins = (now.getHours() + now.getMinutes() / 60 - HOUR_START) * PX_PER_HOUR;
                  if (mins < 0) return null;
                  return (
                    <>
                      <div style={{
                        position: 'absolute', left: -4, right: 0, top: mins, height: 2,
                        background: '#F37167', zIndex: 5,
                      }} />
                      <div style={{
                        position: 'absolute', left: -8, top: mins - 4, width: 10, height: 10,
                        borderRadius: '50%', background: '#F37167', zIndex: 6,
                      }} />
                    </>
                  );
                })()}

                {/* Activity blocks */}
                {items.map(a => {
                  const startH = a.start.getHours() + a.start.getMinutes() / 60;
                  const top = Math.max(0, (startH - HOUR_START) * PX_PER_HOUR);
                  const durH = Math.max(0.5, a.durationMin / 60);
                  const height = Math.max(30, durH * PX_PER_HOUR - 2);
                  const cat = window.ACTIVITY_CATEGORY[a.type] || 'meeting';
                  const style = window.CATEGORY_STYLE[cat];
                  return (
                    <div key={a.id}
                      onClick={(e) => { e.stopPropagation(); onActivityClick && onActivityClick(a); }}
                      style={{
                        position: 'absolute', left: 4, right: 4, top, height,
                        background: style.bg, color: style.ink,
                        borderRadius: 6, padding: '4px 7px',
                        borderLeft: `3px solid ${style.dot}`,
                        fontSize: 11, fontWeight: 500,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        boxShadow: '0 1px 2px rgba(64,55,112,0.06)',
                        opacity: a.mine ? 1 : 0.75,
                        display: 'flex', flexDirection: 'column', gap: 2,
                      }}
                      title={a.title}
                    >
                      {!a.mine && a.owner && (
                        <span style={{ position: 'absolute', top: 4, right: 4 }}>
                          <window.TeammateAvatar owner={a.owner} size={16} />
                        </span>
                      )}
                      <div style={{ fontSize: 10, fontWeight: 700, fontVariantNumeric: 'tabular-nums', opacity: 0.8 }}>
                        {window.fmtTime(a.start)}
                      </div>
                      <div style={{
                        fontSize: 11, fontWeight: 600, lineHeight: 1.25,
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: Math.max(1, Math.floor(height / 16) - 1),
                        WebkitBoxOrient: 'vertical',
                      }}>{a.title}</div>
                      {height > 55 && a.district && (
                        <div style={{ fontSize: 10, opacity: 0.75, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {a.district}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// SCHEDULE VIEW — Perplexity-style week strip + day cards with activity details
// ============================================================================

function ScheduleView({ currentDate, activities, onActivityClick, scope, showOpps, dealKinds, deals = [], onDealClick }) {
  const weekStart = window.startOfWeek(currentDate);
  const days = [];
  for (let i = 0; i < 7; i++) days.push(window.addDays(weekStart, i));

  const scopedOpps = React.useMemo(
    () => window.filterOppsByKind(window.filterOppsByScope(window.OPP_EVENTS, scope), dealKinds),
    [scope, dealKinds]
  );

  const oppsByDay = React.useMemo(
    () => window.groupOppsByDay(scopedOpps),
    [scopedOpps]
  );

  const dealsByDay = React.useMemo(() => window.groupOppsByDay(deals), [deals]);

  const byDay = React.useMemo(() => {
    const m = new Map();
    for (const a of activities) {
      const k = window.startOfDay(a.start).toISOString();
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(a);
    }
    return m;
  }, [activities]);

  const today = window.TODAY;

  const [selectedDay, setSelectedDay] = React.useState(() => {
    // Default: pick today if in range, else first day with events, else weekStart
    if (window.sameDay(today, today) && days.some(d => window.sameDay(d, today))) return today;
    const firstWithEvents = days.find(d => (byDay.get(window.startOfDay(d).toISOString()) || []).length > 0);
    return firstWithEvents || weekStart;
  });

  // Update selection when week changes
  React.useEffect(() => {
    const inRange = days.some(d => window.sameDay(d, selectedDay));
    if (!inRange) {
      const firstWithEvents = days.find(d => (byDay.get(window.startOfDay(d).toISOString()) || []).length > 0);
      setSelectedDay(firstWithEvents || weekStart);
    }
  }, [currentDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedItems = (byDay.get(window.startOfDay(selectedDay).toISOString()) || [])
    .slice().sort((a,b) => a.start - b.start);
  const selectedDeals = dealsByDay.get(window.startOfDay(selectedDay).toISOString()) || [];

  return (
    <div style={{ padding: '0 24px 24px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, gap: 20 }}>
      {showOpps && (
        <window.OppSummaryStrip
          events={scopedOpps}
          range={{ start: weekStart, end: window.addDays(weekStart, 6) }}
          label={`Week of ${window.fmtDateShort(weekStart)}`}
          scope={scope}
        />
      )}
      {/* Week strip — Perplexity-inspired 7 day tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
        {days.map(d => {
          const items = byDay.get(window.startOfDay(d).toISOString()) || [];
          const opps = oppsByDay.get(window.startOfDay(d).toISOString()) || [];
          const dayDeals = dealsByDay.get(window.startOfDay(d).toISOString()) || [];
          const isToday = window.sameDay(d, today);
          const isSelected = window.sameDay(d, selectedDay);
          const cats = new Set(items.map(a => window.ACTIVITY_CATEGORY[a.type] || 'meeting'));
          const oppTotal = opps.reduce((s, o) => s + o.amount, 0);
          const dealKindsPresent = Array.from(new Set(dayDeals.map(d => d.kind)));

          return (
            <button key={d.toISOString()}
              onClick={() => setSelectedDay(d)}
              style={{
                textAlign: 'left',
                padding: '10px 12px',
                borderRadius: 10,
                border: isSelected ? '1.5px solid #403770' : '1px solid #E2DEEC',
                background: isSelected ? '#fff' : (isToday ? '#FFFCFA' : '#fff'),
                boxShadow: isSelected ? '0 2px 6px rgba(64,55,112,0.08)' : 'none',
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column', gap: 6,
                fontFamily: 'inherit',
                transition: 'all 120ms ease-out',
                minHeight: 82,
              }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <div style={{
                  fontSize: 10, fontWeight: 600, color: isToday ? '#F37167' : '#8A80A8',
                  letterSpacing: '0.06em', textTransform: 'uppercase',
                }}>{window.fmtDay(d)}</div>
                <div style={{
                  fontSize: 18, fontWeight: 700, color: '#403770',
                  fontVariantNumeric: 'tabular-nums',
                }}>{d.getDate()}</div>
              </div>

              {/* Category dots + count */}
              {items.length === 0 && dayDeals.length === 0 ? (
                <div style={{ fontSize: 10, color: '#A69DC0', fontWeight: 500 }}>No items</div>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                    {['meeting','event','campaign','fun'].filter(c => cats.has(c)).map(c => (
                      <span key={c} style={{
                        width: 6, height: 6, borderRadius: 999,
                        background: window.CATEGORY_STYLE[c].dot,
                      }} />
                    ))}
                    {dealKindsPresent.length > 0 && cats.size > 0 && (
                      <span style={{ width: 1, height: 8, background: '#E2DEEC', margin: '0 2px' }} />
                    )}
                    {dealKindsPresent.map(k => (
                      <span key={k} style={{
                        width: 6, height: 6, borderRadius: 2,
                        background: window.OPP_STYLE[k].color,
                      }} />
                    ))}
                  </div>
                  <div style={{
                    fontSize: 11, fontWeight: 600, color: '#544A78',
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    {items.length > 0 && `${items.length} ${items.length === 1 ? 'item' : 'items'}`}
                    {items.length > 0 && dayDeals.length > 0 && <span style={{ color: '#C2BBD4' }}> · </span>}
                    {dayDeals.length > 0 && (
                      <span style={{ color: '#403770' }}>
                        {dayDeals.length} deal{dayDeals.length === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                </>
              )}
              {showOpps && opps.length > 0 && (
                <div style={{
                  marginTop: 'auto', paddingTop: 6, borderTop: '1px dashed #E2DEEC',
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: 10, fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {opps.slice(0, 3).map((o, i) => (
                    <span key={i} style={{ color: window.OPP_STYLE[o.kind].color }}>
                      {window.OPP_STYLE[o.kind].icon}
                    </span>
                  ))}
                  <span style={{ marginLeft: 'auto', color: '#403770' }}>
                    {window.formatMoney(oppTotal)}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day detail */}
      <div style={{
        flex: 1, background: '#fff', border: '1px solid #E2DEEC', borderRadius: 12,
        display: 'flex', flexDirection: 'column', minHeight: 0,
      }}>
        {/* Day header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #EFEDF5',
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#8A80A8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {selectedDay.toLocaleDateString('en-US', { weekday: 'long' })}
              {window.sameDay(selectedDay, today) && (
                <span style={{
                  marginLeft: 8, padding: '2px 8px', borderRadius: 999,
                  background: '#F37167', color: '#fff', fontSize: 10, fontWeight: 700,
                  letterSpacing: 0, textTransform: 'none',
                }}>Today</span>
              )}
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#403770', marginTop: 2, letterSpacing: '-0.01em' }}>
              {selectedDay.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
          <div style={{
            fontSize: 13, color: '#6E6390', fontWeight: 500,
          }}>
            {selectedItems.length === 0 && selectedDeals.length === 0 ? 'Nothing scheduled' : (
              <span>
                {selectedItems.length > 0 && `${selectedItems.length} ${selectedItems.length === 1 ? 'activity' : 'activities'}`}
                {selectedItems.length > 0 && selectedDeals.length > 0 && <span style={{ color: '#C2BBD4', margin: '0 6px' }}>·</span>}
                {selectedDeals.length > 0 && (
                  <span style={{ color: '#403770', fontWeight: 600 }}>
                    {selectedDeals.length} deal {selectedDeals.length === 1 ? 'event' : 'events'}
                  </span>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Activity list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }} className="fm-scrollbar">
          {selectedItems.length === 0 && selectedDeals.length === 0 ? (
            <div style={{
              padding: '40px 24px', textAlign: 'center', color: '#A69DC0',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
            }}>
              <window.ActivitiesIcon size={40} style={{ color: '#E2DEEC' }} />
              <div style={{ fontSize: 14, color: '#6E6390' }}>No activities on this day.</div>
              <div style={{ fontSize: 12, color: '#8A80A8' }}>Click a day in the strip above or switch views to browse.</div>
            </div>
          ) : (
            <>
              {selectedDeals.length > 0 && (
                <div style={{ padding: '6px 20px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{
                    fontSize: 10, fontWeight: 700, color: '#8A80A8',
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    marginTop: 4, marginBottom: 2,
                  }}>Pipeline events</div>
                  {selectedDeals.map((deal, i) => (
                    <window.DealChip key={i} deal={deal} density="row" onClick={onDealClick} />
                  ))}
                </div>
              )}
              {selectedItems.length > 0 && selectedDeals.length > 0 && (
                <div style={{
                  padding: '6px 20px 4px',
                  fontSize: 10, fontWeight: 700, color: '#8A80A8',
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  borderTop: '1px solid #EFEDF5', marginTop: 4,
                }}>Activities</div>
              )}
              {selectedItems.map(a => {
              const cat = window.ACTIVITY_CATEGORY[a.type] || 'meeting';
              const style = window.CATEGORY_STYLE[cat];
              const endTime = new Date(a.start.getTime() + a.durationMin * 60000);
              return (
                <div key={a.id}
                  onClick={() => onActivityClick && onActivityClick(a)}
                  style={{
                    padding: '14px 20px', display: 'grid',
                    gridTemplateColumns: '110px 1fr auto', gap: 16,
                    cursor: 'pointer',
                    borderBottom: '1px solid #F7F5FA',
                    transition: 'background 120ms ease-out',
                    alignItems: 'flex-start',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#FBF9FC'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  {/* Time column */}
                  <div style={{
                    fontVariantNumeric: 'tabular-nums',
                    fontSize: 13, fontWeight: 600, color: '#403770',
                    paddingTop: 2,
                  }}>
                    <div>{window.fmtTime(a.start)}</div>
                    <div style={{ fontSize: 11, color: '#8A80A8', fontWeight: 500 }}>
                      → {window.fmtTime(endTime)}
                    </div>
                  </div>

                  {/* Middle — title, district, attendee */}
                  <div style={{ borderLeft: `3px solid ${style.dot}`, paddingLeft: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 999,
                        background: style.bg, color: style.ink,
                        fontSize: 10, fontWeight: 600, letterSpacing: 0,
                      }}>{window.ACTIVITY_TYPE_LABELS[a.type]}</span>
                      {a.status === 'completed' && (
                        <span style={{ fontSize: 10, color: '#5f665b', fontWeight: 600 }}>✓ Completed</span>
                      )}
                      {a.status === 'in_progress' && (
                        <span style={{ fontSize: 10, color: '#997c43', fontWeight: 600 }}>● In progress</span>
                      )}
                      {!a.mine && !a.owner && (
                        <span style={{
                          fontSize: 10, color: '#8A80A8', fontWeight: 600,
                          padding: '1px 6px', border: '1px dashed #C2BBD4', borderRadius: 999,
                        }}>Team</span>
                      )}
                      {!a.mine && a.owner && (
                        <window.TeammateChip owner={a.owner} size={14} />
                      )}
                    </div>
                    <div style={{ marginTop: 4, fontSize: 14, fontWeight: 600, color: '#403770' }}>
                      {a.title}
                    </div>
                    <div style={{ marginTop: 2, fontSize: 12, color: '#6E6390', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {a.district && <span>📍 {a.district}</span>}
                      {a.attendee && <span>👤 {a.attendee}</span>}
                    </div>
                  </div>

                  {/* Right column — duration */}
                  <div style={{
                    fontSize: 11, color: '#8A80A8', fontWeight: 500,
                    paddingTop: 4,
                  }}>
                    {formatDur(a.durationMin)}
                  </div>
                </div>
              );
            })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDur(min) {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h >= 24) {
    const d = Math.round(h / 24);
    return `${d}d`;
  }
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

Object.assign(window, { WeekGridView, ScheduleView });
