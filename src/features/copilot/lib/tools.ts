import type Anthropic from "@anthropic-ai/sdk";
import { AGENT_TOOLS } from "@/features/reports/lib/agent/tool-definitions";

export const PROPOSE_ACTIONS_TOOL_NAME = "propose_actions" as const;

const proposeActions: Anthropic.Tool = {
  name: PROPOSE_ACTIONS_TOOL_NAME,
  description:
    "TERMINAL. Propose one or more create/update actions for the rep to confirm. NOTHING is written until the rep clicks Confirm — never claim you already did it. Use this whenever the rep asks to create, log, add, schedule, or change a task/activity/contact/plan/note. Look up real ids (district leaid, contact id, task id) with the read tools FIRST — never invent ids. Call this at most once per turn; the turn ends after.",
  input_schema: {
    type: "object" as const,
    properties: {
      actions: {
        type: "array",
        description: "The proposed actions, in the order to show them to the rep.",
        items: {
          type: "object",
          properties: {
            objectType: {
              type: "string",
              enum: ["task", "activity", "contact", "plan", "district_note", "map_view"],
              description: "Which object the action targets.",
            },
            operation: {
              type: "string",
              enum: ["create", "update", "add_districts", "apply"],
            },
            targetId: {
              type: "string",
              description:
                "Required for update (the id of the record to change — task id, contact id as a string, plan id, etc.) and for add_districts (the plan id). Omit for create.",
            },
            summary: {
              type: "string",
              description:
                "One-line, rep-friendly description shown on the confirm card, e.g. 'Follow-up call with Austin ISD next Tuesday'.",
            },
            fields: {
              type: "object",
              description:
                "Field values for the action. See the action catalog in the system prompt for the allowed fields per objectType.",
            },
          },
          required: ["objectType", "operation", "fields"],
        },
      },
    },
    required: ["actions"],
  },
};

/**
 * Copilot tool set: the reports read tools (schema introspection + run_sql for
 * answering questions / looking up ids) plus the write-proposal terminal. Both
 * `run_sql` and `propose_actions` are terminal for the copilot variant — the
 * agent loop picks the path by which one the model calls.
 */
export const COPILOT_TOOLS: Anthropic.Tool[] = [...AGENT_TOOLS, proposeActions];
