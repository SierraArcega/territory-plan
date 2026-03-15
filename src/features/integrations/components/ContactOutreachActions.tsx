"use client";

// ContactOutreachActions — Horizontal row of outreach action buttons (Email, Slack, Mixmax)
// Checks integration connection status and disables buttons accordingly

import { useState } from "react";
import { useIntegrations } from "../lib/queries";
import ComposeEmailPanel from "./ComposeEmailPanel";
import ComposeSlackPanel from "./ComposeSlackPanel";
import MixmaxCampaignModal from "./MixmaxCampaignModal";

interface ContactOutreachActionsProps {
  contactEmail: string | null;
  contactName: string | null;
  contactId: number;
  districtLeaid: string;
}

type ActivePanel = "email" | "slack" | "mixmax" | null;

export default function ContactOutreachActions({
  contactEmail,
  contactName,
  contactId,
  districtLeaid,
}: ContactOutreachActionsProps) {
  const { data: integrations } = useIntegrations();
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);

  const gmailConnected = integrations?.some(
    (i) => i.service === "gmail" && i.status === "connected"
  );
  const slackConnected = integrations?.some(
    (i) => i.service === "slack" && i.status === "connected"
  );
  const mixmaxConnected = integrations?.some(
    (i) => i.service === "mixmax" && i.status === "connected"
  );

  const closePanel = () => setActivePanel(null);

  return (
    <>
      <div className="flex items-center gap-1.5">
        {/* Email button */}
        <ActionButton
          label="Email"
          disabled={!gmailConnected || !contactEmail}
          tooltip={
            !gmailConnected
              ? "Connect Gmail in Settings"
              : !contactEmail
                ? "No email address"
                : "Send email"
          }
          onClick={() => setActivePanel("email")}
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </ActionButton>

        {/* Slack button */}
        <ActionButton
          label="Slack"
          disabled={!slackConnected}
          tooltip={!slackConnected ? "Connect Slack in Settings" : "Send Slack message"}
          onClick={() => setActivePanel("slack")}
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M5.042 15.165a2.528 2.528 0 01-2.52 2.523A2.528 2.528 0 010 15.165a2.527 2.527 0 012.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 012.521-2.52 2.527 2.527 0 012.521 2.52v6.313A2.528 2.528 0 018.834 24a2.528 2.528 0 01-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 01-2.521-2.52A2.528 2.528 0 018.834 0a2.528 2.528 0 012.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 012.521 2.521 2.528 2.528 0 01-2.521 2.521H2.522A2.528 2.528 0 010 8.834a2.528 2.528 0 012.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 012.522-2.521A2.528 2.528 0 0124 8.834a2.528 2.528 0 01-2.522 2.521h-2.522V8.834zm-1.27 0a2.528 2.528 0 01-2.523 2.521 2.527 2.527 0 01-2.52-2.521V2.522A2.527 2.527 0 0115.163 0a2.528 2.528 0 012.523 2.522v6.312zM15.163 18.956a2.528 2.528 0 012.523 2.522A2.528 2.528 0 0115.163 24a2.527 2.527 0 01-2.52-2.522v-2.522h2.52zm0-1.27a2.527 2.527 0 01-2.52-2.523 2.527 2.527 0 012.52-2.52h6.315A2.528 2.528 0 0124 15.163a2.528 2.528 0 01-2.522 2.523h-6.315z" />
          </svg>
        </ActionButton>

        {/* Mixmax button */}
        <ActionButton
          label="Mixmax"
          disabled={!mixmaxConnected || !contactEmail}
          tooltip={
            !mixmaxConnected
              ? "Connect Mixmax in Settings"
              : !contactEmail
                ? "No email address"
                : "Add to sequence"
          }
          onClick={() => setActivePanel("mixmax")}
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        </ActionButton>
      </div>

      {/* Panels / Modals */}
      {activePanel === "email" && contactEmail && (
        <ComposeEmailPanel
          to={contactEmail}
          contactName={contactName}
          contactId={contactId}
          districtLeaid={districtLeaid}
          onClose={closePanel}
        />
      )}

      {activePanel === "slack" && (
        <ComposeSlackPanel
          contactName={contactName}
          districtLeaid={districtLeaid}
          onClose={closePanel}
        />
      )}

      {activePanel === "mixmax" && contactEmail && (
        <MixmaxCampaignModal
          contactEmail={contactEmail}
          contactName={contactName}
          onClose={closePanel}
        />
      )}
    </>
  );
}

// ===== ActionButton =====

function ActionButton({
  label,
  disabled,
  tooltip,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  tooltip: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      aria-label={label}
      className="p-1.5 rounded-md text-gray-500 hover:text-[#403770] hover:bg-[#403770]/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-500"
    >
      {children}
    </button>
  );
}
