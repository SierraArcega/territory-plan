"use client";

import { useIntegrations, useDisconnectIntegration } from "../lib/queries";
import { INTEGRATION_SERVICES, type IntegrationService, type IntegrationConnection } from "../types";

/** Maps service keys to their OAuth connect URL */
const CONNECT_URLS: Partial<Record<IntegrationService, string>> = {
  gmail: "/api/integrations/gmail/connect",
  google_calendar: "/api/calendar/connect",
  slack: "/api/integrations/slack/connect",
};

const SERVICE_ORDER: IntegrationService[] = ["gmail", "google_calendar", "slack"];

export default function ConnectedAccountsSection() {
  const { data: connections, isLoading } = useIntegrations();
  const disconnectMutation = useDisconnectIntegration();

  const connectionMap = new Map<IntegrationService, IntegrationConnection>();
  if (connections) {
    for (const conn of connections) {
      if (conn.status === "connected") {
        connectionMap.set(conn.service, conn);
      }
    }
  }

  const handleDisconnect = async (service: IntegrationService) => {
    const meta = INTEGRATION_SERVICES[service];
    const confirmed = window.confirm(`Disconnect ${meta.label}? You can reconnect at any time.`);
    if (!confirmed) return;

    try {
      await disconnectMutation.mutateAsync(service);
    } catch (error) {
      console.error(`Failed to disconnect ${service}:`, error);
    }
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h3 className="text-lg font-semibold text-[#403770] mb-4">Connected Accounts</h3>

        {isLoading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-32" />
                  <div className="h-3 bg-gray-100 rounded w-48" />
                </div>
                <div className="h-8 bg-gray-200 rounded w-20" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {SERVICE_ORDER.map((service) => {
              const meta = INTEGRATION_SERVICES[service];
              const connection = connectionMap.get(service);
              const isConnected = !!connection;

              return (
                <div key={service} className="flex items-center gap-4">
                  {/* Service Icon */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                    style={{
                      backgroundColor: isConnected ? meta.color : "#9CA3AF",
                    }}
                  >
                    {meta.icon}
                  </div>

                  {/* Service Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-[#403770]">{meta.label}</p>
                    </div>
                    {isConnected ? (
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                        <p className="text-sm text-gray-500 truncate">
                          Connected{connection.accountEmail ? ` \u00b7 ${connection.accountEmail}` : ""}
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">Not connected</p>
                    )}
                  </div>

                  {/* Action Button */}
                  <div className="flex-shrink-0">
                    {isConnected ? (
                      <button
                        onClick={() => handleDisconnect(service)}
                        disabled={disconnectMutation.isPending}
                        className="px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors disabled:opacity-50"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <a
                        href={CONNECT_URLS[service]}
                        className="inline-block px-3 py-1.5 text-sm font-medium text-white bg-[#403770] hover:bg-[#322a5a] rounded-lg transition-colors"
                      >
                        Connect
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </>
  );
}
