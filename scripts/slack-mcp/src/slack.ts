/**
 * Slack Bolt app with Socket Mode.
 * Handles interactive button clicks for approval workflows.
 */

import { App, LogLevel } from "@slack/bolt";
import { resolveApproval } from "./approvals.js";

let app: App | null = null;

export function createSlackApp(): App {
  const botToken = process.env.SLACK_BOT_TOKEN;
  const appToken = process.env.SLACK_APP_TOKEN;

  if (!botToken || !appToken) {
    throw new Error(
      "Missing SLACK_BOT_TOKEN or SLACK_APP_TOKEN environment variables. " +
        "Set these in your .mcp.json env config.",
    );
  }

  app = new App({
    token: botToken,
    socketMode: true,
    appToken: appToken,
    // CRITICAL: LogLevel.ERROR prevents Bolt from writing to stdout,
    // which would corrupt the MCP stdio JSON-RPC protocol.
    logLevel: LogLevel.ERROR,
  });

  // Handle "Approve" button clicks
  app.action("approve_button", async ({ ack, body, respond, action }) => {
    await ack();
    if (action.type !== "button") return;

    const approvalId = action.value ?? "";
    const resolved = resolveApproval(approvalId, "approved", body.user.id);

    if (!resolved) {
      await respond({
        replace_original: false,
        text: "This approval is no longer pending.",
      });
      return;
    }

    await respond({
      replace_original: true,
      text: `Approved by <@${body.user.id}>`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Approved* by <@${body.user.id}> at ${new Date().toLocaleString()}`,
          },
        },
      ],
    });
  });

  // Handle "Reject" button clicks
  app.action("reject_button", async ({ ack, body, respond, action }) => {
    await ack();
    if (action.type !== "button") return;

    const approvalId = action.value ?? "";
    const resolved = resolveApproval(approvalId, "rejected", body.user.id);

    if (!resolved) {
      await respond({
        replace_original: false,
        text: "This approval is no longer pending.",
      });
      return;
    }

    await respond({
      replace_original: true,
      text: `Rejected by <@${body.user.id}>`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Rejected* by <@${body.user.id}> at ${new Date().toLocaleString()}`,
          },
        },
      ],
    });
  });

  return app;
}

export function getSlackApp(): App {
  if (!app) throw new Error("Slack app not initialized. Call createSlackApp() first.");
  return app;
}
