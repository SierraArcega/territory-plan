// Seeds board_of_ed_url and dept_of_ed_url on the `states` table.
// Run: npx tsx scripts/seed-state-ed-urls.ts
//
// Notes on data quality:
// - BOE = State Board of Education homepage (governance body).
// - DOE = State Education Agency / Dept-of-Ed homepage (operational agency,
//   e.g. CDE, NYSED, TEA). This is usually the more useful link for reps.
// - A few states have no separate State Board (MN, WI); BOE left null.
// - Territories + BIE populated with their own agency URLs where available.
// - The "US" rollup row and "IT" (International) are intentionally left null.

import { prisma } from '../src/lib/prisma';

type UrlPair = { boe: string | null; doe: string | null };

const URLS: Record<string, UrlPair> = {
  // ===== 50 states =====
  AL: { boe: 'https://www.alabamaachieves.org/state-board-of-education/', doe: 'https://www.alsde.edu' },
  AK: { boe: 'https://education.alaska.gov/State_Board', doe: 'https://education.alaska.gov' },
  AZ: { boe: 'https://azsbe.az.gov', doe: 'https://www.azed.gov' },
  AR: { boe: 'https://dese.ade.arkansas.gov/stateboard', doe: 'https://dese.ade.arkansas.gov' },
  CA: { boe: 'https://www.cde.ca.gov/be/', doe: 'https://www.cde.ca.gov' },
  CO: { boe: 'https://ed.cde.state.co.us/cdeboard', doe: 'https://www.cde.state.co.us' },
  CT: { boe: 'https://portal.ct.gov/SDE/Board/State-Board-of-Education', doe: 'https://portal.ct.gov/SDE' },
  DE: { boe: 'https://education.delaware.gov/community/governance/state-board-of-education/', doe: 'https://education.delaware.gov' },
  FL: { boe: 'https://www.fldoe.org/policy/state-board-of-edu/', doe: 'https://www.fldoe.org' },
  GA: { boe: 'https://sboe.georgia.gov', doe: 'https://www.gadoe.org' },
  HI: { boe: 'https://boe.hawaii.gov', doe: 'https://www.hawaiipublicschools.org' },
  ID: { boe: 'https://boardofed.idaho.gov', doe: 'https://www.sde.idaho.gov' },
  IL: { boe: 'https://www.isbe.net/Pages/state-board.aspx', doe: 'https://www.isbe.net' },
  IN: { boe: 'https://www.in.gov/sboe/', doe: 'https://www.in.gov/doe/' },
  IA: { boe: 'https://educate.iowa.gov/boards/state-board-education', doe: 'https://educate.iowa.gov' },
  KS: { boe: 'https://www.ksde.gov/Board', doe: 'https://www.ksde.gov' },
  KY: { boe: 'https://www.education.ky.gov/KBE/Pages/default.aspx', doe: 'https://www.education.ky.gov' },
  LA: { boe: 'https://bese.louisiana.gov', doe: 'https://www.louisianabelieves.com' },
  ME: { boe: 'https://www.maine.gov/doe/about/leadership/stateboard', doe: 'https://www.maine.gov/doe' },
  MD: { boe: 'https://marylandpublicschools.org/stateboard/Pages/index.aspx', doe: 'https://marylandpublicschools.org' },
  MA: { boe: 'https://www.doe.mass.edu/bese/', doe: 'https://www.doe.mass.edu' },
  MI: { boe: 'https://www.michigan.gov/mde/about-us/state-board', doe: 'https://www.michigan.gov/mde' },
  MN: { boe: null, doe: 'https://education.mn.gov' }, // No separate state BOE
  MS: { boe: 'https://www.mdek12.org/sbe', doe: 'https://www.mdek12.org' },
  MO: { boe: 'https://dese.mo.gov/state-board-education', doe: 'https://dese.mo.gov' },
  MT: { boe: 'https://bpe.mt.gov/', doe: 'https://opi.mt.gov' }, // Board of Public Education
  NE: { boe: 'https://www.education.ne.gov/stateboard/', doe: 'https://www.education.ne.gov' },
  NV: { boe: 'https://doe.nv.gov/boards-commissions-councils/state-board-of-education', doe: 'https://doe.nv.gov' },
  NH: { boe: 'https://www.education.nh.gov/who-we-are/state-board-of-education', doe: 'https://www.education.nh.gov' },
  NJ: { boe: 'https://www.nj.gov/education/sboe/', doe: 'https://www.nj.gov/education' },
  NM: { boe: 'https://web.ped.nm.gov/bureaus/public-education-commission/', doe: 'https://web.ped.nm.gov' },
  NY: { boe: 'https://www.regents.nysed.gov', doe: 'https://www.nysed.gov' }, // Board of Regents
  NC: { boe: 'https://www.dpi.nc.gov/about-dpi/state-board-education', doe: 'https://www.dpi.nc.gov' },
  ND: { boe: 'https://www.nd.gov/dpi/familiescommunity/community/boards-and-committees/state-board-public-school-education', doe: 'https://www.nd.gov/dpi' },
  OH: { boe: 'https://sboe.ohio.gov/', doe: 'https://education.ohio.gov' }, // Board split off from DEW in 2023
  OK: { boe: 'https://oklahoma.gov/education/state-board-of-education.html', doe: 'https://sde.ok.gov' },
  OR: { boe: 'https://www.oregon.gov/ode/about-us/stateboard/pages/default.aspx', doe: 'https://www.oregon.gov/ode' },
  PA: { boe: 'https://www.pa.gov/en/agencies/stateboard.html', doe: 'https://www.education.pa.gov' },
  RI: { boe: 'https://ride.ri.gov/board-education', doe: 'https://www.ride.ri.gov' },
  SC: { boe: 'https://ed.sc.gov/state-board/state-board-of-education/', doe: 'https://ed.sc.gov' },
  SD: { boe: 'https://boardsandcommissions.sd.gov/Information.aspx?BoardID=32', doe: 'https://doe.sd.gov' }, // Board of Education Standards
  TN: { boe: 'https://www.tn.gov/sbe', doe: 'https://www.tn.gov/education' },
  TX: { boe: 'https://sboe.texas.gov/state-board-of-education/sboe-homepage', doe: 'https://tea.texas.gov' },
  UT: { boe: 'https://www.schools.utah.gov/board', doe: 'https://www.schools.utah.gov' },
  VT: { boe: 'https://education.vermont.gov/state-board', doe: 'https://education.vermont.gov' },
  VA: { boe: 'https://www.doe.virginia.gov/data-policy-funding/virginia-board-of-education', doe: 'https://www.doe.virginia.gov' },
  WA: { boe: 'https://sbe.wa.gov', doe: 'https://ospi.k12.wa.us' },
  WV: { boe: 'https://wvde.us/board-of-education/', doe: 'https://wvde.us' },
  WI: { boe: null, doe: 'https://dpi.wi.gov' }, // No state BOE; elected State Superintendent
  WY: { boe: 'https://wyboardofeducation.org/', doe: 'https://edu.wyoming.gov' },

  // ===== DC =====
  DC: { boe: 'https://sboe.dc.gov', doe: 'https://osse.dc.gov' },

  // ===== US territories =====
  PR: { boe: null, doe: 'https://de.pr.gov' },
  AS: { boe: null, doe: 'https://www.amsamoadoe.com' },
  GU: { boe: null, doe: 'https://www.gdoe.net' },
  MP: { boe: null, doe: 'https://www.cnmipss.org' },
  VI: { boe: null, doe: 'https://www.vide.vi' },

  // ===== Federal =====
  BI: { boe: null, doe: 'https://www.bie.edu' }, // Bureau of Indian Education

  // Intentionally null: US (rollup), IT (International)
};

async function main() {
  // Use raw SQL to avoid Prisma's implicit SELECT after UPDATE, which chokes on
  // unrelated schema drift (a known issue with the `icp_avg_score` column).
  const abbrevs = await prisma.$queryRaw<{ abbrev: string }[]>`
    SELECT abbrev FROM states ORDER BY abbrev ASC
  `;

  let updated = 0;
  let skipped = 0;
  for (const { abbrev } of abbrevs) {
    const entry = URLS[abbrev];
    if (!entry) {
      skipped++;
      continue;
    }
    await prisma.$executeRaw`
      UPDATE states
      SET board_of_ed_url = ${entry.boe},
          dept_of_ed_url  = ${entry.doe}
      WHERE abbrev = ${abbrev}
    `;
    updated++;
  }

  console.log(`Updated ${updated} states, skipped ${skipped}.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
