/* global React */
// CalendarData.jsx — mock activities + shared calendar utilities

// ============================================================================
// Activity type mappings (faithful to territory-plan/src/features/activities/types.ts)
// ============================================================================

const ACTIVITY_TYPE_LABELS = {
  conference: 'Conference',
  road_trip: 'Road Trip',
  dinner: 'Dinner',
  happy_hour: 'Happy Hour',
  school_site_visit: 'School Site Visit',
  fun_and_games: 'Fun + Games',
  mixmax_campaign: 'Mixmax Campaign',
  discovery_call: 'Discovery Call',
  program_check_in: 'Program Check-In',
  proposal_review: 'Proposal Review',
  renewal_conversation: 'Renewal',
  gift_drop: 'Gift Drop',
  booth_exhibit: 'Booth',
  conference_sponsor: 'Sponsor',
  meal_reception: 'Reception',
  charity_event: 'Charity',
  webinar: 'Webinar',
  speaking_engagement: 'Speaking',
  professional_development: 'PD Session',
  course: 'Course',
};

// Categorize into three buckets so we can color-code like Brand+Aid reference
// (a) Meetings + calls  → Steel Blue
// (b) Events (conferences, dinners, travel, sponsorships) → Coral
// (c) Thought leadership / campaigns → Plum
// (d) Gift drops / fun → Golden
const ACTIVITY_CATEGORY = {
  conference: 'event',
  road_trip: 'event',
  dinner: 'event',
  happy_hour: 'event',
  school_site_visit: 'event',
  fun_and_games: 'fun',
  mixmax_campaign: 'campaign',
  discovery_call: 'meeting',
  program_check_in: 'meeting',
  proposal_review: 'meeting',
  renewal_conversation: 'meeting',
  gift_drop: 'fun',
  booth_exhibit: 'event',
  conference_sponsor: 'event',
  meal_reception: 'event',
  charity_event: 'event',
  webinar: 'campaign',
  speaking_engagement: 'campaign',
  professional_development: 'campaign',
  course: 'campaign',
};

// Category palette — flat fills with plum ink, like reference images
const CATEGORY_STYLE = {
  meeting:  { bg: '#C4E7E6', ink: '#1F4B4A', dot: '#6EA3BE', label: 'Meeting' },   // Robin's egg
  event:    { bg: '#FFD1CC', ink: '#6B2A24', dot: '#F37167', label: 'Event' },     // Coral tint
  campaign: { bg: '#DDD6EE', ink: '#322a5a', dot: '#403770', label: 'Campaign' },  // Plum tint
  fun:      { bg: '#FFE6A8', ink: '#6B4F16', dot: '#FFCF70', label: 'Moment' },    // Golden
  ooo:      { bg: '#EFEDF5', ink: '#544A78', dot: '#A69DC0', label: 'OOO' },       // Neutral
};

// ============================================================================
// Mock data generation — 6-week span centered on "today" (2026-04-18)
// ============================================================================

const TODAY = new Date(2026, 3, 18); // April 18, 2026 (Saturday) — current_date
TODAY.setHours(0, 0, 0, 0);

function dayOffset(days, hours = 9, mins = 0) {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + days);
  d.setHours(hours, mins, 0, 0);
  return d;
}

// "Mine" = Alex Rivera's activities. "Team" = other reps' activities (for calendar-of-all toggle).
const ACTIVITIES = [
  // === Past week (for historical context) ===
  { id: 'a01', mine: true,  type: 'discovery_call', title: 'Intro call — Mapleton ISD',
    start: dayOffset(-5, 10, 0), durationMin: 45, status: 'completed',
    district: 'Mapleton ISD', attendee: 'Dr. Sarah Chen, Superintendent' },
  { id: 'a02', mine: true,  type: 'program_check_in', title: 'Q3 check-in — Hartford Public',
    start: dayOffset(-5, 14, 0), durationMin: 30, status: 'completed',
    district: 'Hartford Public Schools' },
  { id: 'a03', mine: true,  type: 'gift_drop', title: 'Welcome kits → 4 new champions',
    start: dayOffset(-4, 11, 0), durationMin: 60, status: 'completed',
    district: '4 districts' },
  { id: 'a04', mine: true,  type: 'dinner', title: 'Board dinner — Westport',
    start: dayOffset(-3, 19, 0), durationMin: 120, status: 'completed',
    district: 'Westport Public Schools', attendee: '3 attendees' },
  { id: 'a05', mine: false, type: 'webinar', title: 'SEL Summit (Marketing)',
    start: dayOffset(-2, 13, 0), durationMin: 60, status: 'completed',
    owner: 'Priya Shah' },

  // === This week — Mon Apr 13 to Sun Apr 19, today is Sat Apr 18 ===
  { id: 'b01', mine: true, type: 'discovery_call', title: 'Discovery — Ridgefield Public',
    start: dayOffset(-5, 9, 30), durationMin: 45, status: 'completed',
    district: 'Ridgefield Public Schools', attendee: 'Michael Torres, Asst. Super.' },
  { id: 'b02', mine: true, type: 'proposal_review', title: 'Proposal walk-through',
    start: dayOffset(-5, 11, 0), durationMin: 60, status: 'completed',
    district: 'Stamford Public Schools' },
  { id: 'b03', mine: true, type: 'happy_hour', title: 'NYCSA happy hour',
    start: dayOffset(-4, 17, 30), durationMin: 90, status: 'completed',
    district: '12 districts · NY', attendee: '18 attendees' },
  { id: 'b04', mine: true, type: 'renewal_conversation', title: 'FY27 renewal — New Haven',
    start: dayOffset(-3, 10, 0), durationMin: 45, status: 'completed',
    district: 'New Haven Public Schools' },
  { id: 'b05', mine: true, type: 'school_site_visit', title: 'Bridgeport middle-school tour',
    start: dayOffset(-3, 13, 30), durationMin: 120, status: 'completed',
    district: 'Bridgeport Public Schools' },
  { id: 'b06', mine: true, type: 'program_check_in', title: 'Program check-in',
    start: dayOffset(-2, 9, 0), durationMin: 30, status: 'completed',
    district: 'Greenwich Public Schools' },
  { id: 'b07', mine: true, type: 'discovery_call', title: 'Intro — East Hartford',
    start: dayOffset(-2, 14, 0), durationMin: 45, status: 'completed',
    district: 'East Hartford Public' },
  { id: 'b08', mine: true, type: 'conference', title: 'CT CASE Spring Conference',
    start: dayOffset(-1, 8, 0), durationMin: 8 * 60, status: 'in_progress',
    district: 'Hartford, CT', attendee: '42 attendees' },
  { id: 'b09', mine: true, type: 'booth_exhibit', title: 'Booth — CT CASE',
    start: dayOffset(-1, 10, 0), durationMin: 6 * 60, status: 'in_progress',
    district: 'Hartford, CT' },

  // Today (Sat Apr 18)
  { id: 'c01', mine: true, type: 'conference', title: 'CT CASE Spring Conference · Day 2',
    start: dayOffset(0, 8, 0), durationMin: 8 * 60, status: 'in_progress',
    district: 'Hartford, CT' },
  { id: 'c02', mine: true, type: 'dinner', title: 'Champion dinner at Max Downtown',
    start: dayOffset(0, 19, 30), durationMin: 150, status: 'planned',
    district: 'Hartford, CT', attendee: '6 attendees' },

  // Sun Apr 19
  { id: 'c03', mine: true, type: 'road_trip', title: 'Drive home + prep next week',
    start: dayOffset(1, 14, 0), durationMin: 180, status: 'planned' },

  // === Next week — starts Mon Apr 20 ===
  { id: 'd01', mine: true, type: 'discovery_call', title: 'Discovery — Fairfield',
    start: dayOffset(2, 9, 0), durationMin: 45, status: 'planned',
    district: 'Fairfield Public Schools' },
  { id: 'd02', mine: true, type: 'discovery_call', title: 'Discovery — Norwalk',
    start: dayOffset(2, 10, 30), durationMin: 45, status: 'tentative',
    district: 'Norwalk Public Schools' },
  { id: 'd03', mine: true, type: 'proposal_review', title: 'Proposal — Darien',
    start: dayOffset(2, 13, 0), durationMin: 60, status: 'planned',
    district: 'Darien Public Schools' },
  { id: 'd04', mine: true, type: 'gift_drop', title: 'Champion shirts → Top 6',
    start: dayOffset(2, 16, 0), durationMin: 30, status: 'planned',
    district: '6 districts' },
  { id: 'd05', mine: true, type: 'program_check_in', title: 'Mapleton check-in',
    start: dayOffset(3, 9, 30), durationMin: 30, status: 'planned',
    district: 'Mapleton ISD' },
  { id: 'd06', mine: true, type: 'renewal_conversation', title: 'FY27 renewal — Avon',
    start: dayOffset(3, 11, 0), durationMin: 45, status: 'planned',
    district: 'Avon Public Schools' },
  { id: 'd07', mine: true, type: 'school_site_visit', title: 'High-school tour',
    start: dayOffset(3, 14, 0), durationMin: 120, status: 'planned',
    district: 'West Hartford Public' },
  { id: 'd08', mine: true, type: 'speaking_engagement', title: 'Panel: AI in K-12',
    start: dayOffset(4, 10, 0), durationMin: 90, status: 'planned',
    district: 'EdTech Northeast Summit' },
  { id: 'd09', mine: true, type: 'discovery_call', title: 'Discovery — Glastonbury',
    start: dayOffset(4, 13, 0), durationMin: 45, status: 'cancelled',
    district: 'Glastonbury Public Schools' },
  { id: 'd10', mine: true, type: 'happy_hour', title: 'EdTech NE mixer',
    start: dayOffset(4, 17, 30), durationMin: 120, status: 'planned',
    district: 'Boston, MA', attendee: '24 attendees' },
  { id: 'd11', mine: true, type: 'program_check_in', title: 'Pod retro — Northeast',
    start: dayOffset(5, 9, 0), durationMin: 60, status: 'planned',
    attendee: '5 attendees' },
  { id: 'd12', mine: true, type: 'proposal_review', title: 'Proposal — Shelton',
    start: dayOffset(5, 14, 0), durationMin: 45, status: 'tentative',
    district: 'Shelton Public Schools' },

  // === Virtual / no-location activities (off-map panel "Virtual" tab) ===
  { id: 'v01', mine: true, type: 'discovery_call', title: 'Zoom discovery — Albany CSD',
    start: dayOffset(-4, 15, 0), durationMin: 30, status: 'completed' },
  { id: 'v02', mine: true, type: 'program_check_in', title: 'Virtual check-in — 4 champions',
    start: dayOffset(-1, 16, 30), durationMin: 30, status: 'completed' },
  { id: 'v03', mine: true, type: 'mixmax_campaign', title: 'Spring PD outreach — 120 schools',
    start: dayOffset(1, 9, 0), durationMin: 30, status: 'planned' },
  { id: 'v04', mine: true, type: 'webinar', title: 'FY27 renewals webinar',
    start: dayOffset(3, 13, 0), durationMin: 60, status: 'planned', attendee: '31 registered' },
  { id: 'v05', mine: true, type: 'professional_development', title: 'Internal — new-hire training',
    start: dayOffset(6, 10, 0), durationMin: 120, status: 'planned' },
  { id: 'v06', mine: true, type: 'renewal_conversation', title: 'Phone — Stratford follow-up',
    start: dayOffset(0, 11, 30), durationMin: 20, status: 'planned' },
  { id: 'v07', mine: false, type: 'webinar', title: 'Product webinar (Marketing)',
    start: dayOffset(2, 14, 0), durationMin: 45, status: 'planned', owner: 'Priya S.' },

  // === Team calendar (mine=false) — shows up only when "All team" toggled ===
  { id: 't01', mine: false, type: 'webinar', title: 'FY27 Product Roadmap webinar',
    start: dayOffset(3, 13, 0), durationMin: 60, status: 'planned',
    owner: 'Marketing · Priya Shah' },
  { id: 't02', mine: false, type: 'conference', title: 'ISTE West — Scout',
    start: dayOffset(9, 9, 0), durationMin: 3 * 24 * 60, status: 'planned',
    owner: 'West Pod · Jordan Kim' },
  { id: 't03', mine: false, type: 'mixmax_campaign', title: 'Q4 renewal sequence launch',
    start: dayOffset(6, 8, 0), durationMin: 15, status: 'planned',
    owner: 'RevOps · Amina Bello' },
  { id: 't04', mine: false, type: 'dinner', title: 'West Coast champion dinner',
    start: dayOffset(10, 19, 0), durationMin: 120, status: 'planned',
    owner: 'West Pod · Jordan Kim' },
  { id: 't05', mine: false, type: 'professional_development', title: 'PD Session — Boston',
    start: dayOffset(7, 10, 0), durationMin: 240, status: 'planned',
    owner: 'Northeast Pod · Maya Reyes' },
  { id: 't06', mine: false, type: 'course', title: 'Course launch — AI Literacy',
    start: dayOffset(11, 0, 0), durationMin: 24 * 60, status: 'planned',
    owner: 'Content · Devon Lee' },
  { id: 't07', mine: false, type: 'booth_exhibit', title: 'ISTE booth setup',
    start: dayOffset(8, 14, 0), durationMin: 180, status: 'planned',
    owner: 'West Pod · Jordan Kim' },
  { id: 't08', mine: false, type: 'happy_hour', title: 'All-hands happy hour',
    start: dayOffset(12, 17, 0), durationMin: 120, status: 'planned',
    owner: 'All Fullmind' },

  // === Further-out highlights (for month view) ===
  { id: 'e01', mine: true, type: 'conference', title: 'NY CASE Summer Summit',
    start: dayOffset(14, 8, 0), durationMin: 2 * 24 * 60, status: 'planned',
    district: 'Saratoga Springs, NY' },
  { id: 'e02', mine: true, type: 'road_trip', title: 'NY road trip — 8 districts',
    start: dayOffset(17, 7, 0), durationMin: 3 * 24 * 60, status: 'planned',
    district: '8 districts · NY' },
  { id: 'e03', mine: true, type: 'renewal_conversation', title: 'FY27 renewal block',
    start: dayOffset(21, 10, 0), durationMin: 60, status: 'planned',
    district: 'Stamford Public Schools' },
  { id: 'e04', mine: true, type: 'discovery_call', title: 'Discovery — Scarsdale',
    start: dayOffset(22, 11, 0), durationMin: 45, status: 'planned',
    district: 'Scarsdale Public Schools' },
  { id: 'e05', mine: true, type: 'gift_drop', title: 'End-of-year champion gifts',
    start: dayOffset(25, 13, 0), durationMin: 30, status: 'planned',
    district: '14 districts' },
  { id: 'e06', mine: true, type: 'dinner', title: 'FY27 kick-off dinner',
    start: dayOffset(28, 19, 0), durationMin: 150, status: 'planned',
    district: 'NYC', attendee: '8 attendees' },
];

// ============================================================================
// Date utilities (no date-fns; light-weight)
// ============================================================================

function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function sameDay(a, b) { return startOfDay(a).getTime() === startOfDay(b).getTime(); }
function sameMonth(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth(); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function startOfWeek(d) {
  const x = startOfDay(d);
  // Sunday start
  x.setDate(x.getDate() - x.getDay());
  return x;
}
function endOfWeek(d) { return addDays(startOfWeek(d), 6); }
function startOfMonth(d) { const x = new Date(d.getFullYear(), d.getMonth(), 1); x.setHours(0,0,0,0); return x; }
function endOfMonth(d) { const x = new Date(d.getFullYear(), d.getMonth() + 1, 0); x.setHours(0,0,0,0); return x; }
function fmtTime(d) {
  const h = d.getHours();
  const m = d.getMinutes();
  const ap = h >= 12 ? 'p' : 'a';
  const h12 = ((h + 11) % 12) + 1;
  return m === 0 ? `${h12}${ap}` : `${h12}:${String(m).padStart(2, '0')}${ap}`;
}
function fmtDay(d) { return d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(); }
function fmtDateShort(d) { return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }); }
function fmtMonthYear(d) { return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }); }

// ============================================================================
// Teammates registry — stable colors + initials for "who's doing what" visibility
// Colors intentionally distinct from the category palette so owner identity
// reads separately from activity type.
// ============================================================================
const TEAMMATES = {
  'You':          { name: 'Alex Rivera',  short: 'Alex',   initials: 'AR', color: '#403770', you: true },
  'Alex Rivera':  { name: 'Alex Rivera',  short: 'Alex',   initials: 'AR', color: '#403770', you: true },
  'Priya Shah':   { name: 'Priya Shah',   short: 'Priya',  initials: 'PS', color: '#D97757' },
  'Priya S.':     { name: 'Priya Shah',   short: 'Priya',  initials: 'PS', color: '#D97757' },
  'Marcus T.':    { name: 'Marcus Tan',   short: 'Marcus', initials: 'MT', color: '#2B7A78' },
  'Marcus Tan':   { name: 'Marcus Tan',   short: 'Marcus', initials: 'MT', color: '#2B7A78' },
  'Jin R.':       { name: 'Jin Rahman',   short: 'Jin',    initials: 'JR', color: '#8B5FBF' },
  'Jin Rahman':   { name: 'Jin Rahman',   short: 'Jin',    initials: 'JR', color: '#8B5FBF' },
  'Jordan Kim':   { name: 'Jordan Kim',   short: 'Jordan', initials: 'JK', color: '#C79A3E' },
  'Amina Bello':  { name: 'Amina Bello',  short: 'Amina',  initials: 'AB', color: '#B84D6A' },
  'Maya Reyes':   { name: 'Maya Reyes',   short: 'Maya',   initials: 'MR', color: '#3F7BC7' },
  'Devon Lee':    { name: 'Devon Lee',    short: 'Devon',  initials: 'DL', color: '#6B9E3F' },
};

function initialsOf(name) {
  if (!name) return '?';
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

// Parse owner strings like "West Pod · Jordan Kim", "Marketing · Priya Shah",
// "Priya S.", "All Fullmind" → return a teammate record (or synthesized group record).
function getTeammate(owner) {
  if (!owner) return null;
  if (TEAMMATES[owner]) return TEAMMATES[owner];
  const parts = owner.split(/\s*[·•]\s*/);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i].trim();
    if (TEAMMATES[p]) return TEAMMATES[p];
  }
  const first = parts[0].trim();
  return { name: first, short: first, initials: initialsOf(first), color: '#8A80A8', group: true };
}

// ============================================================================
// Geographic + territory enrichment — state, region, tags
// Derived from existing district strings so we don't have to hand-tag every row.
// ============================================================================

const DISTRICT_META = {
  // CT districts (default state)
  'Mapleton ISD':                { state: 'CT', region: 'Northeast', territory: 'CT Central' },
  'Hartford Public Schools':     { state: 'CT', region: 'Northeast', territory: 'CT Central' },
  'Westport Public Schools':     { state: 'CT', region: 'Northeast', territory: 'CT Fairfield' },
  'Ridgefield Public Schools':   { state: 'CT', region: 'Northeast', territory: 'CT Fairfield' },
  'Stamford Public Schools':     { state: 'CT', region: 'Northeast', territory: 'CT Fairfield' },
  'New Haven Public Schools':    { state: 'CT', region: 'Northeast', territory: 'CT Shoreline' },
  'Bridgeport Public Schools':   { state: 'CT', region: 'Northeast', territory: 'CT Shoreline' },
  'Greenwich Public Schools':    { state: 'CT', region: 'Northeast', territory: 'CT Fairfield' },
  'East Hartford Public':        { state: 'CT', region: 'Northeast', territory: 'CT Central' },
  'Fairfield Public Schools':    { state: 'CT', region: 'Northeast', territory: 'CT Fairfield' },
  'Norwalk Public Schools':      { state: 'CT', region: 'Northeast', territory: 'CT Fairfield' },
  'Darien Public Schools':       { state: 'CT', region: 'Northeast', territory: 'CT Fairfield' },
  'Avon Public Schools':         { state: 'CT', region: 'Northeast', territory: 'CT Central' },
  'West Hartford Public':        { state: 'CT', region: 'Northeast', territory: 'CT Central' },
  'Glastonbury Public Schools':  { state: 'CT', region: 'Northeast', territory: 'CT Central' },
  'Shelton Public Schools':      { state: 'CT', region: 'Northeast', territory: 'CT Shoreline' },
  'Stratford':                   { state: 'CT', region: 'Northeast', territory: 'CT Shoreline' },
  // NY
  'Scarsdale Public Schools':    { state: 'NY', region: 'Northeast', territory: 'NY Westchester' },
  'Saratoga Springs, NY':        { state: 'NY', region: 'Northeast', territory: 'NY Upstate' },
  'Albany CSD':                  { state: 'NY', region: 'Northeast', territory: 'NY Upstate' },
  // MA
  'Boston, MA':                  { state: 'MA', region: 'Northeast', territory: 'MA East' },
  // Cities / event locations
  'Hartford, CT':                { state: 'CT', region: 'Northeast', territory: 'CT Central' },
  'NYC':                         { state: 'NY', region: 'Northeast', territory: 'NY Metro' },
  'EdTech Northeast Summit':     { state: 'MA', region: 'Northeast', territory: 'MA East' },
};

function deriveLocation(district) {
  if (!district) return { state: null, region: null, territory: null };
  // Direct match
  if (DISTRICT_META[district]) return DISTRICT_META[district];
  // Try first segment
  const head = district.split(/\s*[·•,]\s*/)[0].trim();
  if (DISTRICT_META[head]) return DISTRICT_META[head];
  // Try state suffix like "…, NY" / "…, MA"
  const stateMatch = district.match(/\b(CT|NY|MA|NJ|NH|VT|RI|ME)\b/);
  if (stateMatch) {
    return { state: stateMatch[1], region: 'Northeast', territory: null };
  }
  // Multi-district counts like "12 districts · NY"
  const multiState = district.match(/·\s*(CT|NY|MA|NJ|NH|VT|RI|ME)/);
  if (multiState) return { state: multiState[1], region: 'Northeast', territory: null };
  return { state: null, region: null, territory: null };
}

// Tag vocabulary — derived from title keywords + activity type
function deriveTags(a) {
  const tags = new Set();
  const t = (a.title || '').toLowerCase();
  if (/renewal|fy27|fy28/.test(t)) tags.add('Renewal');
  if (/discovery|intro/.test(t)) tags.add('New logo');
  if (/proposal/.test(t)) tags.add('Pipeline');
  if (/champion|gift|kit/.test(t)) tags.add('Champion');
  if (/board|superintendent|super\./i.test((a.attendee || '') + ' ' + (a.title || ''))) tags.add('Executive');
  if (a.type === 'conference' || a.type === 'booth_exhibit' || a.type === 'conference_sponsor') tags.add('Conference');
  if (a.type === 'webinar' || a.type === 'mixmax_campaign') tags.add('Marketing');
  if (a.type === 'happy_hour' || a.type === 'dinner' || a.type === 'meal_reception') tags.add('Hospitality');
  if (a.type === 'speaking_engagement' || a.type === 'professional_development') tags.add('Thought leadership');
  if (a.type === 'road_trip') tags.add('Travel');
  if (a.type === 'school_site_visit') tags.add('Site visit');
  return Array.from(tags);
}

// Enrich ACTIVITIES in place (attach ._loc + ._tags)
for (const a of ACTIVITIES) {
  a._loc = deriveLocation(a.district);
  a._tags = deriveTags(a);
}

// All values actually present in the dataset — drives filter option lists.
const ALL_STATES     = Array.from(new Set(ACTIVITIES.map(a => a._loc.state).filter(Boolean))).sort();
const ALL_REGIONS    = Array.from(new Set(ACTIVITIES.map(a => a._loc.region).filter(Boolean))).sort();
const ALL_TERRITORIES = Array.from(new Set(ACTIVITIES.map(a => a._loc.territory).filter(Boolean))).sort();
const ALL_TAGS       = Array.from(new Set(ACTIVITIES.flatMap(a => a._tags))).sort();

// State display (name + coral-less brand color per state for map highlighting)
const STATE_META = {
  CT: { name: 'Connecticut', color: '#6EA3BE' },
  NY: { name: 'New York',    color: '#403770' },
  MA: { name: 'Massachusetts', color: '#F37167' },
  NJ: { name: 'New Jersey',  color: '#8AA891' },
  RI: { name: 'Rhode Island', color: '#FFCF70' },
  VT: { name: 'Vermont',     color: '#C4E7E6' },
  NH: { name: 'New Hampshire', color: '#D97757' },
  ME: { name: 'Maine',       color: '#8B5FBF' },
};

// ============================================================================
// Saved views (presets) — stored in localStorage, seeded with a few defaults
// ============================================================================
const DEFAULT_SAVED_VIEWS = [
  { id: 'all',         label: 'All activities', icon: '◷', builtin: true, filters: null },
  { id: 'my-week',     label: 'My week',        icon: '◉', builtin: true,
    filters: { scope: 'mine' } },
  { id: 'ct-meetings', label: 'CT · Meetings',  icon: '◧', builtin: true,
    filters: { categories: ['meeting'], states: ['CT'] } },
  { id: 'renewals',    label: 'Renewals',       icon: '↻', builtin: true,
    filters: { tags: ['Renewal'] } },
  { id: 'conferences', label: 'Conferences',    icon: '✦', builtin: true,
    filters: { tags: ['Conference'] } },
];

Object.assign(window, {
  ACTIVITIES, ACTIVITY_TYPE_LABELS, ACTIVITY_CATEGORY, CATEGORY_STYLE, TODAY,
  startOfDay, sameDay, sameMonth, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  fmtTime, fmtDay, fmtDateShort, fmtMonthYear,
  TEAMMATES, getTeammate, initialsOf,
  DISTRICT_META, deriveLocation, deriveTags,
  ALL_STATES, ALL_REGIONS, ALL_TERRITORIES, ALL_TAGS, STATE_META,
  DEFAULT_SAVED_VIEWS,
});

