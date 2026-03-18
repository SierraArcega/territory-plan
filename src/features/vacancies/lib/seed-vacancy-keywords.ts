import prisma from "@/lib/prisma";

/**
 * Seed data for VacancyKeywordConfig table.
 *
 * Relevance rules flag positions that align with Fullmind's service lines.
 * Exclusion rules filter out non-instructional roles during post-processing.
 *
 * Uses Prisma upsert (by type + label) so this script is idempotent.
 */

interface KeywordSeedEntry {
  type: "relevance" | "exclusion";
  label: string;
  keywords: string[];
  serviceLine?: string;
}

const SEED_DATA: KeywordSeedEntry[] = [
  // === Relevance rules ===
  {
    type: "relevance",
    label: "SPED / Special Education",
    serviceLine: "SPED",
    keywords: [
      "special education",
      "sped",
      "resource room",
      "self-contained",
      "inclusion",
    ],
  },
  {
    type: "relevance",
    label: "ELL / Bilingual",
    serviceLine: "ELL",
    keywords: [
      "ell",
      "esl",
      "bilingual",
      "dual language",
      "english learner",
    ],
  },
  {
    type: "relevance",
    label: "Mental Health / SEL",
    serviceLine: "Mental Health",
    keywords: [
      "school psychologist",
      "social worker",
      "counselor",
      "sel",
      "mental health",
    ],
  },
  {
    type: "relevance",
    label: "Tutoring / Intervention",
    serviceLine: "Intervention",
    keywords: [
      "interventionist",
      "tutor",
      "reading specialist",
      "math specialist",
      "title i",
    ],
  },
  {
    type: "relevance",
    label: "Related Services",
    serviceLine: "Related Services",
    keywords: [
      "speech pathologist",
      "slp",
      "occupational therapist",
      "ot",
      "pt",
    ],
  },

  // === Exclusion rules ===
  {
    type: "exclusion",
    label: "Transportation",
    keywords: ["bus driver", "bus monitor", "bus aide", "transportation"],
  },
  {
    type: "exclusion",
    label: "Custodial",
    keywords: ["custodian", "custodial", "maintenance", "groundskeeper"],
  },
  {
    type: "exclusion",
    label: "Food Service",
    keywords: ["food service", "cafeteria", "lunch", "cook", "kitchen"],
  },
  {
    type: "exclusion",
    label: "Health Support",
    keywords: ["nurse", "health aide", "school nurse"],
  },
  {
    type: "exclusion",
    label: "Security",
    keywords: ["security", "safety officer", "school resource officer"],
  },
  {
    type: "exclusion",
    label: "Clerical",
    keywords: ["secretary", "clerical", "receptionist", "office aide"],
  },
  {
    type: "exclusion",
    label: "Paraprofessional",
    keywords: [
      "paraprofessional",
      "para",
      "teaching assistant",
      "teacher aide",
      "instructional aide",
    ],
  },
];

export async function seedVacancyKeywords(): Promise<void> {
  console.log("[seed] Seeding VacancyKeywordConfig...");

  let created = 0;
  let updated = 0;

  for (const entry of SEED_DATA) {
    // Find existing record by type + label for upsert
    const existing = await prisma.vacancyKeywordConfig.findFirst({
      where: { type: entry.type, label: entry.label },
    });

    if (existing) {
      await prisma.vacancyKeywordConfig.update({
        where: { id: existing.id },
        data: {
          keywords: entry.keywords,
          serviceLine: entry.serviceLine ?? null,
        },
      });
      updated++;
    } else {
      await prisma.vacancyKeywordConfig.create({
        data: {
          type: entry.type,
          label: entry.label,
          keywords: entry.keywords,
          serviceLine: entry.serviceLine ?? null,
        },
      });
      created++;
    }
  }

  console.log(
    `[seed] VacancyKeywordConfig complete: ${created} created, ${updated} updated`
  );
}

// Allow running directly: npx tsx src/features/vacancies/lib/seed-vacancy-keywords.ts
if (require.main === module) {
  seedVacancyKeywords()
    .then(() => {
      console.log("[seed] Done.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("[seed] Error:", err);
      process.exit(1);
    });
}
