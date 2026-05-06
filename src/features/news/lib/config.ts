export interface EduFeed {
  id: string;
  url: string;
  source: string;
}

export const EDU_FEEDS: EduFeed[] = [
  {
    id: "chalkbeat",
    url: "https://www.chalkbeat.org/arc/outboundfeeds/rss/?outputType=xml",
    source: "chalkbeat.org",
  },
  {
    id: "k12dive",
    url: "https://www.k12dive.com/feeds/news/",
    source: "k12dive.com",
  },
  {
    id: "the74",
    url: "https://www.the74million.org/feed/",
    source: "the74million.org",
  },
  {
    id: "edsurge",
    url: "https://www.edsurge.com/articles_rss",
    source: "edsurge.com",
  },
];

export const BROAD_QUERIES: string[] = [
  '"school district" budget',
  '"school district" lawsuit',
  '"school board" election',
  '"superintendent" (resigned OR appointed OR fired)',
  '"public schools" (strike OR walkout OR vote)',
  '"curriculum adoption" schools',
  '"referendum" schools',
  '"school district" bond',
  '"charter school" expansion',
  '"teacher union" contract',
];

export const US_STATES: Array<{ abbrev: string; name: string }> = [
  { abbrev: "AL", name: "Alabama" }, { abbrev: "AK", name: "Alaska" },
  { abbrev: "AZ", name: "Arizona" }, { abbrev: "AR", name: "Arkansas" },
  { abbrev: "CA", name: "California" }, { abbrev: "CO", name: "Colorado" },
  { abbrev: "CT", name: "Connecticut" }, { abbrev: "DE", name: "Delaware" },
  { abbrev: "FL", name: "Florida" }, { abbrev: "GA", name: "Georgia" },
  { abbrev: "HI", name: "Hawaii" }, { abbrev: "ID", name: "Idaho" },
  { abbrev: "IL", name: "Illinois" }, { abbrev: "IN", name: "Indiana" },
  { abbrev: "IA", name: "Iowa" }, { abbrev: "KS", name: "Kansas" },
  { abbrev: "KY", name: "Kentucky" }, { abbrev: "LA", name: "Louisiana" },
  { abbrev: "ME", name: "Maine" }, { abbrev: "MD", name: "Maryland" },
  { abbrev: "MA", name: "Massachusetts" }, { abbrev: "MI", name: "Michigan" },
  { abbrev: "MN", name: "Minnesota" }, { abbrev: "MS", name: "Mississippi" },
  { abbrev: "MO", name: "Missouri" }, { abbrev: "MT", name: "Montana" },
  { abbrev: "NE", name: "Nebraska" }, { abbrev: "NV", name: "Nevada" },
  { abbrev: "NH", name: "New Hampshire" }, { abbrev: "NJ", name: "New Jersey" },
  { abbrev: "NM", name: "New Mexico" }, { abbrev: "NY", name: "New York" },
  { abbrev: "NC", name: "North Carolina" }, { abbrev: "ND", name: "North Dakota" },
  { abbrev: "OH", name: "Ohio" }, { abbrev: "OK", name: "Oklahoma" },
  { abbrev: "OR", name: "Oregon" }, { abbrev: "PA", name: "Pennsylvania" },
  { abbrev: "RI", name: "Rhode Island" }, { abbrev: "SC", name: "South Carolina" },
  { abbrev: "SD", name: "South Dakota" }, { abbrev: "TN", name: "Tennessee" },
  { abbrev: "TX", name: "Texas" }, { abbrev: "UT", name: "Utah" },
  { abbrev: "VT", name: "Vermont" }, { abbrev: "VA", name: "Virginia" },
  { abbrev: "WA", name: "Washington" }, { abbrev: "WV", name: "West Virginia" },
  { abbrev: "WI", name: "Wisconsin" }, { abbrev: "WY", name: "Wyoming" },
  { abbrev: "DC", name: "District of Columbia" },
];

export function perStateQuery(stateName: string): string {
  return `"school district" ${stateName}`;
}

export const EXCLUDED_DOMAINS = new Set<string>([
  "maxpreps.com",
  "ihsa.org",
  "varsity.com",
  "hudl.com",
  "athletic.net",
  "prepbaseballreport.com",
]);

export const ROLE_KEYWORDS: string[] = [
  "superintendent",
  "chancellor",
  "chief",
  "principal",
  "assistant superintendent",
  "deputy superintendent",
  "cfo",
  "cio",
  "ceo",
  "director",
  "board member",
];

export const TRACKING_PARAMS = new Set<string>([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "ref",
  "mc_cid",
  "mc_eid",
  "_ga",
  "igshid",
]);

export const ROLLING_BATCH_SIZE = 40;
export const GOOGLE_NEWS_RSS_URL = "https://news.google.com/rss/search";

/** Articles published more than this many days ago are dropped at ingest.
 *  Keeps the table aligned with the recency window reps actually care about
 *  and matches the one-off purge policy. */
export const MAX_ARTICLE_AGE_DAYS = 180;
