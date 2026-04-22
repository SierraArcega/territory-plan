import PQueue from "p-queue";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { extractStates } from "./extract-states";
import {
  matchArticleKeyword,
  type DistrictCandidate,
  type SchoolCandidate,
  type ContactCandidate,
} from "./matcher-keyword";
import { matchArticleLLM, type LlmCandidates } from "./matcher-llm";

export interface MatchStats {
  articlesProcessed: number;
  districtMatches: number;
  schoolMatches: number;
  contactMatches: number;
  queuedForLlm: number;
  llmCalls: number;
  errors: string[];
}

function emptyStats(): MatchStats {
  return {
    articlesProcessed: 0,
    districtMatches: 0,
    schoolMatches: 0,
    contactMatches: 0,
    queuedForLlm: 0,
    llmCalls: 0,
    errors: [],
  };
}

/**
 * Build state-scoped candidate maps for a set of articles.
 * Only loads districts/schools/contacts in states that at least one article mentions,
 * to avoid hydrating the entire 13k districts table for every ingest.
 */
async function loadCandidates(states: Set<string>): Promise<{
  districtsByState: Map<string, DistrictCandidate[]>;
  schoolsByLeaid: Map<string, SchoolCandidate[]>;
  contactsByLeaid: Map<string, ContactCandidate[]>;
}> {
  const districtsByState = new Map<string, DistrictCandidate[]>();
  const schoolsByLeaid = new Map<string, SchoolCandidate[]>();
  const contactsByLeaid = new Map<string, ContactCandidate[]>();

  if (states.size === 0) {
    return { districtsByState, schoolsByLeaid, contactsByLeaid };
  }

  const stateList = [...states];
  const districts = await prisma.district.findMany({
    where: { stateAbbrev: { in: stateList } },
    select: {
      leaid: true,
      name: true,
      stateAbbrev: true,
      cityLocation: true,
      countyName: true,
      accountName: true,
    },
  });
  for (const d of districts) {
    const s = d.stateAbbrev;
    if (!s) continue;
    const arr = districtsByState.get(s) ?? [];
    arr.push({
      leaid: d.leaid,
      name: d.name,
      stateAbbrev: s,
      cityLocation: d.cityLocation,
      countyName: d.countyName,
      accountName: d.accountName,
    });
    districtsByState.set(s, arr);
  }

  const leaidsInScope = districts.map((d) => d.leaid);
  if (leaidsInScope.length > 0) {
    // Chunk large IN lists — Supabase pgbouncer drops connections on queries
    // with huge parameter counts, and the combined schools/contacts query is
    // the most common offender.
    const CHUNK = 500;
    for (let i = 0; i < leaidsInScope.length; i += CHUNK) {
      const slice = leaidsInScope.slice(i, i + CHUNK);
      const schools = await prisma.school.findMany({
        where: { leaid: { in: slice } },
        select: { ncessch: true, leaid: true, schoolName: true },
      });
      for (const s of schools) {
        const arr = schoolsByLeaid.get(s.leaid) ?? [];
        arr.push({ ncessch: s.ncessch, leaid: s.leaid, schoolName: s.schoolName });
        schoolsByLeaid.set(s.leaid, arr);
      }

      const contacts = await prisma.contact.findMany({
        where: { leaid: { in: slice } },
        select: { id: true, leaid: true, name: true, title: true },
      });
      for (const c of contacts) {
        const arr = contactsByLeaid.get(c.leaid) ?? [];
        arr.push({ id: c.id, leaid: c.leaid, name: c.name, title: c.title });
        contactsByLeaid.set(c.leaid, arr);
      }
    }
  }

  return { districtsByState, schoolsByLeaid, contactsByLeaid };
}

/**
 * Pass 1: keyword matcher on every article. Ambiguous articles get queued
 * for LLM disambiguation in Pass 2.
 */
export async function matchArticles(articleIds: string[]): Promise<MatchStats> {
  const stats = emptyStats();
  if (articleIds.length === 0) return stats;

  const articles = await prisma.newsArticle.findMany({
    where: { id: { in: articleIds } },
  });

  // First pass: extract states per article, collect global state set
  const articleStates = new Map<string, string[]>();
  const allStates = new Set<string>();
  for (const a of articles) {
    const text = [a.title, a.description ?? ""].join(" ");
    const states = extractStates(text);
    articleStates.set(a.id, states);
    for (const s of states) allStates.add(s);
    if (states.length > 0) {
      await prisma.newsArticle.update({
        where: { id: a.id },
        data: { stateAbbrevs: states },
      });
    }
  }

  const candidates = await loadCandidates(allStates);

  for (const article of articles) {
    stats.articlesProcessed++;
    const states = articleStates.get(article.id) ?? [];
    const articleText = [article.title, article.description ?? ""].join(" ");

    const keywordResult = matchArticleKeyword({
      articleText,
      stateAbbrevs: states,
      districtsByState: candidates.districtsByState,
      schoolsByLeaid: candidates.schoolsByLeaid,
      contactsByLeaid: candidates.contactsByLeaid,
    });

    // Persist high-confidence matches
    for (const m of keywordResult.confirmedDistricts) {
      try {
        await prisma.newsArticleDistrict.upsert({
          where: { articleId_leaid: { articleId: article.id, leaid: m.leaid } },
          create: { articleId: article.id, leaid: m.leaid, confidence: m.confidence },
          update: { confidence: m.confidence },
        });
        stats.districtMatches++;
      } catch (err) {
        stats.errors.push(`district match ${m.leaid}: ${String(err)}`);
      }
    }
    for (const m of keywordResult.confirmedSchools) {
      try {
        await prisma.newsArticleSchool.upsert({
          where: { articleId_ncessch: { articleId: article.id, ncessch: m.ncessch } },
          create: { articleId: article.id, ncessch: m.ncessch, confidence: m.confidence },
          update: { confidence: m.confidence },
        });
        stats.schoolMatches++;
      } catch (err) {
        stats.errors.push(`school match ${m.ncessch}: ${String(err)}`);
      }
    }
    for (const m of keywordResult.confirmedContacts) {
      try {
        await prisma.newsArticleContact.upsert({
          where: { articleId_contactId: { articleId: article.id, contactId: m.contactId } },
          create: { articleId: article.id, contactId: m.contactId, confidence: m.confidence },
          update: { confidence: m.confidence },
        });
        stats.contactMatches++;
      } catch (err) {
        stats.errors.push(`contact match ${m.contactId}: ${String(err)}`);
      }
    }

    // Queue ambiguous entities for LLM pass
    if (keywordResult.ambiguous.length > 0) {
      const flatCandidates: LlmCandidates = {
        districts: keywordResult.ambiguous.flatMap((a) => a.districtCandidates ?? []),
        schools: keywordResult.ambiguous.flatMap((a) => a.schoolCandidates ?? []),
        contacts: keywordResult.ambiguous.flatMap((a) => a.contactCandidates ?? []),
      };
      try {
        const json = JSON.parse(JSON.stringify(flatCandidates)) as Prisma.InputJsonValue;
        await prisma.newsMatchQueue.upsert({
          where: { articleId: article.id },
          create: { articleId: article.id, candidates: json },
          update: { candidates: json, processedAt: null },
        });
        stats.queuedForLlm++;
      } catch (err) {
        stats.errors.push(`queue for LLM ${article.id}: ${String(err)}`);
      }
    }
  }

  return stats;
}

/**
 * Pass 2: LLM disambiguation of queued ambiguous articles.
 * Short-circuits when NEWS_LLM_ENABLED=false.
 */
export async function processMatchQueue(limit = 20, concurrency = 5): Promise<MatchStats> {
  const stats = emptyStats();
  if (process.env.NEWS_LLM_ENABLED === "false") return stats;

  const queued = await prisma.newsMatchQueue.findMany({
    where: { processedAt: null },
    take: limit,
    orderBy: { createdAt: "asc" },
    include: { article: true },
  });

  // LLM calls are I/O-bound — parallelize under a concurrency cap. Prisma's
  // connection pool size (default 3 in dev) constrains DB writes already.
  const queue = new PQueue({ concurrency });
  for (const q of queued) {
    queue.add(async () => {
      stats.articlesProcessed++;
      const candidates = q.candidates as unknown as LlmCandidates;
      try {
        const result = await matchArticleLLM(
          { title: q.article.title, description: q.article.description },
          candidates
        );
        stats.llmCalls += result.llmCalls;

        for (const m of result.confirmedDistricts) {
          await prisma.newsArticleDistrict.upsert({
            where: { articleId_leaid: { articleId: q.articleId, leaid: m.leaid } },
            create: { articleId: q.articleId, leaid: m.leaid, confidence: m.confidence },
            update: { confidence: m.confidence },
          });
          stats.districtMatches++;
        }
        for (const m of result.confirmedSchools) {
          await prisma.newsArticleSchool.upsert({
            where: { articleId_ncessch: { articleId: q.articleId, ncessch: m.ncessch } },
            create: { articleId: q.articleId, ncessch: m.ncessch, confidence: m.confidence },
            update: { confidence: m.confidence },
          });
          stats.schoolMatches++;
        }
        for (const m of result.confirmedContacts) {
          await prisma.newsArticleContact.upsert({
            where: { articleId_contactId: { articleId: q.articleId, contactId: m.contactId } },
            create: { articleId: q.articleId, contactId: m.contactId, confidence: m.confidence },
            update: { confidence: m.confidence },
          });
          stats.contactMatches++;
        }

        await prisma.newsMatchQueue.update({
          where: { articleId: q.articleId },
          data: { processedAt: new Date() },
        });
      } catch (err) {
        stats.errors.push(`LLM match ${q.articleId}: ${String(err)}`);
      }
    });
  }
  await queue.onIdle();

  return stats;
}
