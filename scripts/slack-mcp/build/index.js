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
import { createApproval, getApproval, waitForApproval, } from "./approvals.js";
// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------
const mcp = new McpServer({
    name: "slack-approval",
    version: "1.0.0",
});
// Tool: Send a plain message
mcp.tool("slack_send_message", "Send a message to a Slack channel", {
    channel: z.string().describe("Slack channel ID (e.g., C01ABCDEF)"),
    text: z.string().describe("Message text (supports Slack mrkdwn formatting)"),
}, async ({ channel, text }) => {
    try {
        const app = getSlackApp();
        const result = await app.client.chat.postMessage({
            token: process.env.SLACK_BOT_TOKEN,
            channel,
            text,
        });
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({ ok: true, ts: result.ts, channel }),
                },
            ],
        };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            content: [{ type: "text", text: `Error: ${message}` }],
            isError: true,
        };
    }
});
// Tool: Send an approval request with buttons
const approvalSectionSchema = z.object({
    heading: z.string().describe("Bold heading for this section (e.g., 'Problem')"),
    text: z.string().optional().describe("Mrkdwn body text for this section"),
    fields: z
        .array(z.string())
        .optional()
        .describe("Short field strings rendered in a 2-column grid (e.g., ['Data model: no', 'API changes: yes'])"),
});
mcp.tool("slack_send_approval", "Post an approval request with Approve/Reject buttons to a Slack channel. Returns an approval ID for polling.", {
    channel: z.string().describe("Slack channel ID"),
    title: z.string().describe("Short title for the approval (e.g., 'PRD Ready for Review')"),
    summary: z
        .string()
        .describe("Plain-text fallback summary (shown in notifications and non-block contexts)"),
    sections: z
        .array(approvalSectionSchema)
        .optional()
        .describe("Structured content sections. Each section gets a bold heading and optional body text or 2-column fields. " +
        "If omitted, the summary is used as a single block."),
}, async ({ channel, title, summary, sections }) => {
    try {
        const app = getSlackApp();
        const approval = createApproval(channel, title);
        // Build Block Kit blocks
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const blocks = [
            {
                type: "header",
                text: { type: "plain_text", text: title },
            },
        ];
        if (sections && sections.length > 0) {
            for (const section of sections) {
                // Section heading as its own context block for a subtle label look
                blocks.push({
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `*${section.heading}*${section.text ? `\n${section.text}` : ""}`,
                    },
                });
                // 2-column fields grid
                if (section.fields && section.fields.length > 0) {
                    blocks.push({
                        type: "section",
                        fields: section.fields.map((f) => ({
                            type: "mrkdwn",
                            text: f,
                        })),
                    });
                }
                blocks.push({ type: "divider" });
            }
        }
        else {
            // Fallback: single summary block
            blocks.push({
                type: "section",
                text: { type: "mrkdwn", text: summary },
            }, { type: "divider" });
        }
        // Approve / Reject buttons
        blocks.push({
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
        });
        const result = await app.client.chat.postMessage({
            token: process.env.SLACK_BOT_TOKEN,
            channel,
            text: `${title}: ${summary}`,
            blocks,
        });
        approval.messageTs = result.ts;
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        approvalId: approval.id,
                        status: "pending",
                        channel,
                        messageTs: result.ts,
                    }),
                },
            ],
        };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            content: [{ type: "text", text: `Error: ${message}` }],
            isError: true,
        };
    }
});
// Tool: Check approval status (non-blocking poll)
mcp.tool("slack_check_approval", "Check the current status of a pending approval request. Non-blocking — returns immediately.", {
    approvalId: z
        .string()
        .describe("The approval ID returned by slack_send_approval"),
}, async ({ approvalId }) => {
    const approval = getApproval(approvalId);
    if (!approval) {
        return {
            content: [
                { type: "text", text: `No approval found with ID: ${approvalId}` },
            ],
            isError: true,
        };
    }
    return {
        content: [
            {
                type: "text",
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
});
// Tool: Wait for approval (blocking with timeout)
mcp.tool("slack_wait_for_approval", "Block until a pending approval is resolved (button clicked) or timeout is reached. Use this instead of polling slack_check_approval in a loop.", {
    approvalId: z.string().describe("The approval ID"),
    timeoutSeconds: z
        .number()
        .min(1)
        .max(300)
        .default(120)
        .describe("Max seconds to wait (default: 120, max: 300)"),
}, async ({ approvalId, timeoutSeconds }) => {
    try {
        const result = await waitForApproval(approvalId, timeoutSeconds * 1000);
        return {
            content: [{ type: "text", text: JSON.stringify(result) }],
        };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            content: [{ type: "text", text: `Error: ${message}` }],
            isError: true,
        };
    }
});
// Tool: List channels the bot can access
mcp.tool("slack_list_channels", "List Slack channels the bot has access to. Use this to find the channel ID for sending messages.", {}, async () => {
    try {
        const app = getSlackApp();
        const result = await app.client.conversations.list({
            token: process.env.SLACK_BOT_TOKEN,
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
            content: [{ type: "text", text: JSON.stringify(channels, null, 2) }],
        };
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
            content: [{ type: "text", text: `Error: ${message}` }],
            isError: true,
        };
    }
});
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
