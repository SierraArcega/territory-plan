#!/usr/bin/env node

/**
 * Slack Approval MCP Server
 *
 * An MCP server that wraps Slack Bolt (Socket Mode) to provide
 * approval workflow tools for Claude Code. Runs both an MCP stdio
 * server and a Slack WebSocket connection in the same process.
 *
 * Tools:
 *   slack_send_message      - Send a plain message to a channel
 *   slack_send_approval     - Post approval request with Approve/Reject buttons
 *   slack_check_approval    - Poll for approval status (non-blocking)
 *   slack_wait_for_approval - Block until resolved or timeout
 *   slack_list_channels     - List channels the bot can post to
 */

import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { createSlackApp, getSlackApp } from "./slack.js";
import {
  createApproval,
  getApproval,
  waitForApproval,
} from "./approvals.js";

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------

const mcp = new McpServer({
  name: "slack-approval",
  version: "1.0.0",
});

// Tool: Send a plain message
mcp.tool(
  "slack_send_message",
  "Send a message to a Slack channel",
  {
    channel: z.string().describe("Slack channel ID (e.g., C01ABCDEF)"),
    text: z.string().describe("Message text (supports Slack mrkdwn formatting)"),
  },
  async ({ channel, text }) => {
    try {
      const app = getSlackApp();
      const result = await app.client.chat.postMessage({
        token: process.env.SLACK_BOT_TOKEN!,
        channel,
        text,
      });
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({ ok: true, ts: result.ts, channel }),
          },
        ],
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  },
);

// Tool: Send an approval request with buttons
mcp.tool(
  "slack_send_approval",
  "Post an approval request with Approve/Reject buttons to a Slack channel. Returns an approval ID for polling.",
  {
    channel: z.string().describe("Slack channel ID"),
    title: z.string().describe("Short title for the approval (e.g., 'PRD Ready for Review')"),
    summary: z
      .string()
      .describe("Detailed summary shown in the message body (supports mrkdwn)"),
  },
  async ({ channel, title, summary }) => {
    try {
      const app = getSlackApp();
      const approval = createApproval(channel, title);

      const result = await app.client.chat.postMessage({
        token: process.env.SLACK_BOT_TOKEN!,
        channel,
        text: `${title}: ${summary}`,
        blocks: [
          {
            type: "header",
            text: { type: "plain_text", text: title },
          },
          {
            type: "section",
            text: { type: "mrkdwn", text: summary },
          },
          { type: "divider" },
          {
            type: "actions",
            block_id: `approval_${approval.id}`,
            elements: [
              {
                type: "button",
                text: { type: "plain_text", text: "Approve" },
                style: "primary",
                action_id: "approve_button",
                value: approval.id,
              },
              {
                type: "button",
                text: { type: "plain_text", text: "Reject" },
                style: "danger",
                action_id: "reject_button",
                value: approval.id,
              },
            ],
          },
        ],
      });

      approval.messageTs = result.ts;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify({
              approvalId: approval.id,
              status: "pending",
              channel,
              messageTs: result.ts,
            }),
          },
        ],
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  },
);

// Tool: Check approval status (non-blocking poll)
mcp.tool(
  "slack_check_approval",
  "Check the current status of a pending approval request. Non-blocking — returns immediately.",
  {
    approvalId: z
      .string()
      .describe("The approval ID returned by slack_send_approval"),
  },
  async ({ approvalId }) => {
    const approval = getApproval(approvalId);
    if (!approval) {
      return {
        content: [
          { type: "text" as const, text: `No approval found with ID: ${approvalId}` },
        ],
        isError: true,
      };
    }
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({
            approvalId: approval.id,
            status: approval.status,
            resolvedBy: approval.resolvedBy || null,
            resolvedAt: approval.resolvedAt?.toISOString() || null,
            feedback: approval.feedback || null,
          }),
        },
      ],
    };
  },
);

// Tool: Wait for approval (blocking with timeout)
mcp.tool(
  "slack_wait_for_approval",
  "Block until a pending approval is resolved (button clicked) or timeout is reached. Use this instead of polling slack_check_approval in a loop.",
  {
    approvalId: z.string().describe("The approval ID"),
    timeoutSeconds: z
      .number()
      .min(1)
      .max(300)
      .default(120)
      .describe("Max seconds to wait (default: 120, max: 300)"),
  },
  async ({ approvalId, timeoutSeconds }) => {
    try {
      const result = await waitForApproval(approvalId, timeoutSeconds * 1000);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(result) }],
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  },
);

// Tool: List channels the bot can access
mcp.tool(
  "slack_list_channels",
  "List Slack channels the bot has access to. Use this to find the channel ID for sending messages.",
  {},
  async () => {
    try {
      const app = getSlackApp();
      const result = await app.client.conversations.list({
        token: process.env.SLACK_BOT_TOKEN!,
        types: "public_channel,private_channel",
        limit: 100,
        exclude_archived: true,
      });

      const channels = (result.channels || []).map((ch) => ({
        id: ch.id,
        name: ch.name,
        is_private: ch.is_private,
      }));

      return {
        content: [{ type: "text" as const, text: JSON.stringify(channels, null, 2) }],
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        content: [{ type: "text" as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  },
);

// ---------------------------------------------------------------------------
// Startup: Bolt first (WebSocket), then MCP (stdio)
// ---------------------------------------------------------------------------

async function main() {
  // Start Slack Bolt in Socket Mode
  const slackApp = createSlackApp();
  await slackApp.start();
  console.error("[slack-mcp] Slack Bolt started in Socket Mode");

  // Connect MCP server to stdio transport
  const transport = new StdioServerTransport();
  await mcp.connect(transport);
  console.error("[slack-mcp] MCP server connected on stdio");
}

main().catch((error) => {
  console.error("[slack-mcp] Fatal error:", error);
  process.exit(1);
});
