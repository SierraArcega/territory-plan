import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { decrypt, encrypt } from "@/features/integrations/lib/encryption";
import { refreshGmailToken, isTokenExpired } from "@/features/integrations/lib/google-gmail";

export const dynamic = "force-dynamic";

interface SendBody {
  stepExecutionId: number;
  subject: string;
  body: string;
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
    const executionId = parseInt(id, 10);
    const { stepExecutionId, subject, body: emailBody }: SendBody = await request.json();

    // Load step execution with contact
    const stepExec = await prisma.stepExecution.findUnique({
      where: { id: stepExecutionId },
      include: {
        contact: { select: { id: true, email: true, name: true, leaid: true } },
        step: { select: { type: true } },
      },
    });

    if (!stepExec || stepExec.executionId !== executionId) {
      return NextResponse.json(
        { error: "Step execution not found" },
        { status: 404 }
      );
    }

    if (stepExec.status === "completed") {
      return NextResponse.json(
        { error: "Step already completed" },
        { status: 400 }
      );
    }

    if (!stepExec.contact.email) {
      return NextResponse.json(
        { error: "Contact has no email address" },
        { status: 400 }
      );
    }

    // Get Gmail integration
    const integration = await prisma.userIntegration.findUnique({
      where: { userId_service: { userId: user.id, service: "gmail" } },
    });

    if (!integration || integration.status !== "connected") {
      return NextResponse.json(
        { error: "Gmail is not connected" },
        { status: 400 }
      );
    }

    // Get valid access token
    let accessToken = decrypt(integration.accessToken);
    if (integration.tokenExpiresAt && isTokenExpired(integration.tokenExpiresAt)) {
      const refreshToken = integration.refreshToken
        ? decrypt(integration.refreshToken)
        : null;
      if (!refreshToken) {
        return NextResponse.json(
          { error: "Gmail token expired and no refresh token available" },
          { status: 400 }
        );
      }

      const refreshed = await refreshGmailToken(refreshToken);
      await prisma.userIntegration.update({
        where: { id: integration.id },
        data: {
          accessToken: encrypt(refreshed.accessToken),
          tokenExpiresAt: refreshed.expiresAt,
          status: "connected",
        },
      });
      accessToken = refreshed.accessToken;
    }

    // Construct and send email
    const fromEmail = integration.accountEmail || user.email || "";
    const messageParts = [
      `From: ${fromEmail}`,
      `To: ${stepExec.contact.email}`,
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      'Content-Type: text/html; charset="UTF-8"',
      "",
      emailBody,
    ];
    const rawMessage = messageParts.join("\r\n");
    const encodedMessage = Buffer.from(rawMessage)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    const sent = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw: encodedMessage },
    });

    // Create Activity record
    const activity = await prisma.activity.create({
      data: {
        type: "email_sent",
        title: subject,
        source: "engage",
        gmailMessageId: sent.data.id || undefined,
        startDate: new Date(),
        status: "completed",
        createdByUserId: user.id,
      },
    });

    // Link activity to contact and district
    await Promise.all([
      prisma.activityContact.create({
        data: { activityId: activity.id, contactId: stepExec.contact.id },
      }),
      stepExec.contact.leaid
        ? prisma.activityDistrict.create({
            data: { activityId: activity.id, districtLeaid: stepExec.contact.leaid },
          })
        : Promise.resolve(),
    ]);

    // Update step execution
    await prisma.stepExecution.update({
      where: { id: stepExecutionId },
      data: {
        status: "completed",
        sentBody: emailBody,
        sentSubject: subject,
        gmailMessageId: sent.data.id || null,
        activityId: activity.id,
        completedAt: new Date(),
      },
    });

    // Advance execution position
    await advanceExecution(executionId);

    return NextResponse.json({ success: true, activityId: activity.id });
  } catch (error) {
    console.error("Engage send error:", error);
    const detail = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Failed to send email: ${detail}` },
      { status: 500 }
    );
  }
}

async function advanceExecution(executionId: number) {
  const execution = await prisma.sequenceExecution.findUnique({
    where: { id: executionId },
    include: {
      sequence: {
        select: {
          steps: { orderBy: { position: "asc" }, select: { id: true, position: true } },
        },
      },
    },
  });

  if (!execution) return;

  const completedCount = await prisma.stepExecution.count({
    where: { executionId, status: { in: ["completed", "skipped"] } },
  });

  // Find next pending step execution
  const nextPending = await prisma.stepExecution.findFirst({
    where: { executionId, status: "pending" },
    include: { step: { select: { position: true } } },
    orderBy: [{ step: { position: "asc" } }, { contactId: "asc" }],
  });

  if (!nextPending) {
    // All done
    await prisma.sequenceExecution.update({
      where: { id: executionId },
      data: {
        status: "completed",
        completedCount,
        completedAt: new Date(),
      },
    });
  } else {
    // Find the contact index within this step
    const pendingForStep = await prisma.stepExecution.findMany({
      where: { executionId, stepId: nextPending.stepId, status: "pending" },
      orderBy: { contactId: "asc" },
      select: { id: true },
    });
    const allForStep = await prisma.stepExecution.findMany({
      where: { executionId, stepId: nextPending.stepId },
      orderBy: { contactId: "asc" },
      select: { id: true, status: true },
    });
    const contactIndex = allForStep.findIndex((se) => se.id === pendingForStep[0]?.id);

    await prisma.sequenceExecution.update({
      where: { id: executionId },
      data: {
        completedCount,
        currentStepPosition: nextPending.step.position,
        currentContactIndex: Math.max(0, contactIndex),
      },
    });
  }
}
