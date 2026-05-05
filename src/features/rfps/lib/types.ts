import { z } from "zod";

const NestedAgency = z.object({
  agency_key: z.number(),
  agency_name: z.string(),
  agency_abbreviation: z.string().nullable(),
  agency_type: z.string().nullable(),
  path: z.string().nullable(),
});

const NestedNaics = z.object({ naics_code: z.string() }).nullable();
const NestedPsc = z.object({ psc_code: z.string() }).nullable();
const NestedOppType = z.object({ description: z.string() }).nullable();

const NestedContact = z
  .object({
    contact_title: z.string().nullable(),
    contact_name: z.string().nullable(),
    contact_first_name: z.string().nullable(),
    contact_last_name: z.string().nullable(),
    contact_email: z.string().nullable(),
    contact_phone: z.string().nullable(),
  })
  .nullable();

export const HigherGovOpportunitySchema = z.object({
  opp_cat: z.string(),
  title: z.string(),
  description_text: z.string().nullable().default(""),
  ai_summary: z.string().nullable().default(""),
  source_id: z.string().nullable().default(""),
  source_id_version: z.string().nullable().default(""),
  captured_date: z.string(),
  posted_date: z.string().nullable(),
  due_date: z.string().nullable(),
  agency: NestedAgency,
  naics_code: NestedNaics,
  psc_code: NestedPsc,
  opp_type: NestedOppType,
  primary_contact_email: NestedContact,
  secondary_contact_email: NestedContact,
  set_aside: z.string().nullable(),
  nsn: z.string().nullable(),
  val_est_low: z.string().nullable().default(""),
  val_est_high: z.string().nullable().default(""),
  pop_country: z.string(),
  pop_state: z.string(),
  pop_city: z.string().nullable().default(""),
  pop_zip: z.string().nullable().default(""),
  opp_key: z.string(),
  version_key: z.string(),
  source_type: z.string(),
  sole_source_flag: z.boolean().nullable(),
  product_service: z.string().nullable().default(""),
  dibbs_status: z.string().nullable(),
  dibbs_quantity: z.unknown().nullable(),
  dibbs_days_to_deliver: z.unknown().nullable(),
  dibbs_fast_award_flag: z.boolean().nullable(),
  dibbs_aidc_flag: z.boolean().nullable(),
  dibbs_tech_docs_flag: z.boolean().nullable(),
  path: z.string().nullable().default(""),
  source_path: z.string().nullable().default(""),
  document_path: z.string().nullable().default(""),
});

export type HigherGovOpportunity = z.infer<typeof HigherGovOpportunitySchema>;

export const HigherGovListResponseSchema = z.object({
  count: z.number().optional(),
  next: z.string().nullable().optional(),
  previous: z.string().nullable().optional(),
  results: z.array(HigherGovOpportunitySchema),
  meta: z
    .object({
      pagination: z
        .object({
          page: z.number(),
          pages: z.number(),
          count: z.number(),
        })
        .optional(),
    })
    .optional(),
  links: z
    .object({
      first: z.string().nullable().optional(),
      last: z.string().nullable().optional(),
      next: z.string().nullable().optional(),
      prev: z.string().nullable().optional(),
    })
    .optional(),
});

export type HigherGovListResponse = z.infer<typeof HigherGovListResponseSchema>;
