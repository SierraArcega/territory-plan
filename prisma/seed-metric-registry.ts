// prisma/seed-metric-registry.ts
import prisma from "../src/lib/prisma";

const METRICS = [
  // Plans
  { action: "plan_created", label: "Plan Created", description: "A new territory plan is created", category: "Plans" },
  { action: "plan_updated", label: "Plan Updated", description: "An existing territory plan is modified", category: "Plans" },
  { action: "district_added", label: "District Added to Plan", description: "A district is added to a territory plan", category: "Plans" },
  { action: "district_removed", label: "District Removed from Plan", description: "A district is removed from a territory plan", category: "Plans" },

  // Activities
  { action: "activity_logged", label: "Activity Logged", description: "A sales activity is recorded (call, email, meeting, etc.)", category: "Activities" },
  { action: "activity_completed", label: "Activity Completed", description: "A sales activity is marked as completed", category: "Activities" },
  { action: "meeting_scheduled", label: "Meeting Scheduled", description: "A meeting activity is scheduled", category: "Activities" },
  { action: "email_sent", label: "Email Sent", description: "An email activity is logged", category: "Activities" },
  { action: "call_made", label: "Call Made", description: "A phone call activity is logged", category: "Activities" },

  // Tasks
  { action: "task_created", label: "Task Created", description: "A follow-up task is created", category: "Tasks" },
  { action: "task_completed", label: "Task Completed", description: "A follow-up task is marked as done", category: "Tasks" },

  // Opportunities
  { action: "opportunity_created", label: "Opportunity Created", description: "A new sales opportunity is created", category: "Opportunities" },
  { action: "opportunity_won", label: "Opportunity Won", description: "An opportunity is marked as closed-won", category: "Opportunities" },
  { action: "opportunity_advanced", label: "Opportunity Advanced", description: "An opportunity moves to a later stage", category: "Opportunities" },

  // Revenue
  { action: "revenue_targeted", label: "Revenue Targeted", description: "Revenue targets are set for a district (points per $10K)", category: "Revenue" },
  { action: "revenue_booked", label: "Revenue Booked", description: "Revenue is booked from a closed deal", category: "Revenue" },
  { action: "pipeline_added", label: "Pipeline Added", description: "New pipeline value is created from an opportunity", category: "Revenue" },

  // Engagement
  { action: "contact_enriched", label: "Contact Enriched", description: "A contact record is enriched with additional data", category: "Engagement" },
  { action: "vacancy_reviewed", label: "Vacancy Reviewed", description: "A vacancy posting is reviewed for a district", category: "Engagement" },
  { action: "signal_acted_on", label: "Signal Acted On", description: "A district signal is acknowledged with a follow-up action", category: "Engagement" },
] as const;

async function main() {
  console.log("Seeding MetricRegistry...");

  for (const metric of METRICS) {
    await prisma.metricRegistry.upsert({
      where: { action: metric.action },
      update: { label: metric.label, description: metric.description, category: metric.category },
      create: metric,
    });
  }

  console.log(`Seeded ${METRICS.length} metrics into MetricRegistry.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
