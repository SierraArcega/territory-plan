import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { resolveMergeFields, type MergeContext } from "@/features/engage/lib/merge-fields";

export const dynamic = "force-dynamic";

interface ExecuteBody {
  contacts: Array<{
    contactId: number;
    customFields?: Record<string, string>;
  }>;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const sequenceId = parseInt(id, 10);
    const body: ExecuteBody = await request.json();
    const { contacts } = body;

    if (!contacts || contacts.length === 0) {
      return NextResponse.json(
        { error: "At least one contact is required" },
        { status: 400 }
      );
    }

    // Load sequence with steps and templates
    const sequence = await prisma.sequence.findUnique({
      where: { id: sequenceId },
      include: {
        steps: {
          orderBy: { position: "asc" },
          include: { template: true },
        },
      },
    });

    if (!sequence || sequence.isArchived) {
      return NextResponse.json(
        { error: "Sequence not found or archived" },
        { status: 404 }
      );
    }

    if (sequence.steps.length === 0) {
      return NextResponse.json(
        { error: "Sequence has no steps" },
        { status: 400 }
      );
    }

    // Load contact + district data for merge field resolution
    const contactIds = contacts.map((c) => c.contactId);
    const contactRecords = await prisma.contact.findMany({
      where: { id: { in: contactIds } },
      include: {
        district: {
          select: {
            name: true,
            stateAbbrev: true,
            cityLocation: true,
            enrollment: true,
            leaid: true,
          },
        },
      },
    });

    // Load user profile for sender fields
    const profile = await prisma.userProfile.findUnique({
      where: { id: user.id },
      select: { fullName: true, email: true, title: true },
    });

    // Build custom fields map keyed by contactId
    const customFieldsMap = new Map(
      contacts.map((c) => [c.contactId, c.customFields || {}])
    );

    // Create execution + all step executions in a transaction
    const execution = await prisma.$transaction(async (tx) => {
      const exec = await tx.sequenceExecution.create({
        data: {
          sequenceId,
          userId: user.id,
          status: "active",
          currentStepPosition: 1,
          currentContactIndex: 0,
          contactCount: contacts.length,
          completedCount: 0,
        },
      });

      // Create StepExecutions for every contact × step combination
      const stepExecData = [];
      for (const step of sequence.steps) {
        for (const contactRecord of contactRecords) {
          const custom = customFieldsMap.get(contactRecord.id) || {};

          // Parse contact name into first/last
          const nameParts = contactRecord.name.split(" ");
          const firstName = nameParts[0] || "";
          const lastName = nameParts.slice(1).join(" ") || "";

          const now = new Date();
          const mergeContext: MergeContext = {
            contact: {
              first_name: firstName,
              last_name: lastName,
              full_name: contactRecord.name,
              title: contactRecord.title || "",
              email: contactRecord.email || "",
              phone: contactRecord.phone || "",
            },
            district: {
              name: contactRecord.district?.name || "",
              state: contactRecord.district?.stateAbbrev || "",
              city: contactRecord.district?.cityLocation || "",
              enrollment: contactRecord.district?.enrollment?.toLocaleString() || "",
              leaid: contactRecord.district?.leaid || "",
              pipeline: "",
              bookings: "",
              invoicing: "",
              sessions_revenue: "",
            },
            sender: {
              name: profile?.fullName || "",
              email: profile?.email || user.email || "",
              title: profile?.title || "",
            },
            date: {
              today: now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
              current_month: now.toLocaleDateString("en-US", { month: "long" }),
              current_year: now.getFullYear().toString(),
            },
            custom,
          };

          // Resolve content from template or inline step
          const rawBody = step.template?.body || step.body || "";
          const rawSubject = step.template?.subject || step.subject || null;

          stepExecData.push({
            executionId: exec.id,
            stepId: step.id,
            contactId: contactRecord.id,
            status: "pending",
            sentBody: resolveMergeFields(rawBody, mergeContext),
            sentSubject: rawSubject ? resolveMergeFields(rawSubject, mergeContext) : null,
          });
        }
      }

      await tx.stepExecution.createMany({ data: stepExecData });

      return exec;
    });

    // Return execution with first step data
    const fullExecution = await prisma.sequenceExecution.findUnique({
      where: { id: execution.id },
      include: {
        sequence: {
          select: {
            name: true,
            steps: {
              orderBy: { position: "asc" },
              include: { template: true },
            },
          },
        },
      },
    });

    return NextResponse.json(fullExecution);
  } catch (error) {
    console.error("Error launching execution:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to launch execution: ${detail}` },
      { status: 500 }
    );
  }
}
