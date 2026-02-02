import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Webhook endpoint to receive enriched contact data from Clay.
 *
 * After triggering a Clay lookup via /api/contacts/clay-lookup, Clay processes
 * the request, finds and enriches contacts, then POSTs the results here.
 *
 * This endpoint:
 * 1. Validates the webhook (optional signature verification)
 * 2. Parses the contact data from Clay's response
 * 3. Creates or updates contacts in the database (upsert by email)
 * 4. Returns 200 OK to acknowledge receipt
 *
 * Expected Clay payload format:
 * {
 *   leaid: "1234567",
 *   contacts: [
 *     {
 *       name: "John Smith",
 *       title: "Superintendent",
 *       email: "jsmith@district.edu",
 *       phone: "555-123-4567",
 *       linkedin_url: "https://linkedin.com/in/johnsmith",
 *       seniority_level: "Executive",
 *       persona: "District Leadership"
 *     },
 *     ...
 *   ]
 * }
 */

// Interface for the contact data Clay sends us
interface ClayContact {
  name?: string;
  first_name?: string;
  last_name?: string;
  title?: string;
  job_title?: string;
  email?: string;
  work_email?: string;
  phone?: string;
  work_phone?: string;
  linkedin_url?: string;
  linkedinUrl?: string;
  seniority?: string;
  seniority_level?: string;
  persona?: string;
  department?: string;
}

// Interface for the full Clay webhook payload
interface ClayWebhookPayload {
  leaid: string;
  contacts?: ClayContact[];
  // Alternative: Clay might send a single contact per webhook call
  name?: string;
  first_name?: string;
  last_name?: string;
  title?: string;
  job_title?: string;
  email?: string;
  work_email?: string;
  phone?: string;
  work_phone?: string;
  linkedin_url?: string;
  linkedinUrl?: string;
  seniority?: string;
  seniority_level?: string;
  persona?: string;
  department?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Optional: Validate webhook signature
    // const signature = request.headers.get("x-clay-signature");
    // const secret = process.env.CLAY_WEBHOOK_SECRET;
    // if (secret && !validateSignature(signature, body, secret)) {
    //   return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    // }

    const payload: ClayWebhookPayload = await request.json();
    console.log("Received Clay webhook payload:", JSON.stringify(payload, null, 2));

    // Validate that we have a leaid to associate contacts with
    const leaid = payload.leaid;
    if (!leaid) {
      console.error("Clay webhook missing leaid");
      return NextResponse.json(
        { error: "leaid is required to associate contacts with a district" },
        { status: 400 }
      );
    }

    // Verify the district exists
    const district = await prisma.district.findUnique({
      where: { leaid },
    });

    if (!district) {
      console.error(`District not found for leaid: ${leaid}`);
      return NextResponse.json(
        { error: `District not found: ${leaid}` },
        { status: 404 }
      );
    }

    // Determine if Clay sent an array of contacts or a single contact
    let contacts: ClayContact[] = [];

    if (payload.contacts && Array.isArray(payload.contacts)) {
      // Clay sent an array of contacts
      contacts = payload.contacts;
    } else if (payload.name || payload.first_name || payload.email) {
      // Clay sent a single contact in the root payload
      contacts = [payload as ClayContact];
    }

    if (contacts.length === 0) {
      console.log(`No contacts in Clay webhook for leaid: ${leaid}`);
      return NextResponse.json({
        success: true,
        message: "No contacts to process",
        contactsCreated: 0,
        contactsUpdated: 0,
      });
    }

    let contactsCreated = 0;
    let contactsUpdated = 0;

    // Process each contact
    for (const contact of contacts) {
      // Build the contact name from available fields
      const name = contact.name ||
        (contact.first_name && contact.last_name
          ? `${contact.first_name} ${contact.last_name}`
          : contact.first_name || contact.last_name);

      if (!name) {
        console.log("Skipping contact without name:", contact);
        continue;
      }

      // Normalize field names (Clay may use different naming conventions)
      const email = contact.email || contact.work_email;
      const phone = contact.phone || contact.work_phone;
      const title = contact.title || contact.job_title;
      const linkedinUrl = contact.linkedin_url || contact.linkedinUrl;
      const seniorityLevel = contact.seniority_level || contact.seniority;
      const persona = contact.persona || contact.department;

      // Upsert: update if exists (by email within district), create if not
      if (email) {
        // Try to find existing contact by email in this district
        const existing = await prisma.contact.findFirst({
          where: {
            leaid,
            email,
          },
        });

        if (existing) {
          // Update existing contact with new data from Clay
          await prisma.contact.update({
            where: { id: existing.id },
            data: {
              name,
              title: title || existing.title,
              phone: phone || existing.phone,
              linkedinUrl: linkedinUrl || existing.linkedinUrl,
              seniorityLevel: seniorityLevel || existing.seniorityLevel,
              persona: persona || existing.persona,
              lastEnrichedAt: new Date(),
            },
          });
          contactsUpdated++;
        } else {
          // Create new contact
          await prisma.contact.create({
            data: {
              leaid,
              name,
              title,
              email,
              phone,
              linkedinUrl,
              seniorityLevel,
              persona,
              isPrimary: false,
              lastEnrichedAt: new Date(),
            },
          });
          contactsCreated++;
        }
      } else {
        // No email - check by name within district
        const existing = await prisma.contact.findFirst({
          where: {
            leaid,
            name,
          },
        });

        if (existing) {
          // Update existing contact
          await prisma.contact.update({
            where: { id: existing.id },
            data: {
              title: title || existing.title,
              phone: phone || existing.phone,
              linkedinUrl: linkedinUrl || existing.linkedinUrl,
              seniorityLevel: seniorityLevel || existing.seniorityLevel,
              persona: persona || existing.persona,
              lastEnrichedAt: new Date(),
            },
          });
          contactsUpdated++;
        } else {
          // Create new contact without email
          await prisma.contact.create({
            data: {
              leaid,
              name,
              title,
              phone,
              linkedinUrl,
              seniorityLevel,
              persona,
              isPrimary: false,
              lastEnrichedAt: new Date(),
            },
          });
          contactsCreated++;
        }
      }
    }

    console.log(`Clay webhook processed for ${leaid}: ${contactsCreated} created, ${contactsUpdated} updated`);

    return NextResponse.json({
      success: true,
      message: `Processed ${contacts.length} contacts`,
      contactsCreated,
      contactsUpdated,
    });
  } catch (error) {
    console.error("Error processing Clay webhook:", error);
    return NextResponse.json(
      { error: "Failed to process Clay webhook" },
      { status: 500 }
    );
  }
}
