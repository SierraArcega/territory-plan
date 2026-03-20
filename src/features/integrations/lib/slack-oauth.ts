const SLACK_SCOPES = [
  "channels:read",
  "channels:history",
  "chat:write",
  "users:read",
  "users:read.email",
].join(",");

export function getSlackAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.SLACK_CLIENT_ID || "",
    scope: SLACK_SCOPES,
    redirect_uri: redirectUri,
    state,
  });
  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

export async function exchangeSlackCode(
  code: string,
  redirectUri: string
): Promise<{
  accessToken: string;
  teamId: string;
  teamName: string;
  botUserId: string;
  authedUserEmail: string;
}> {
  const response = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.SLACK_CLIENT_ID || "",
      client_secret: process.env.SLACK_CLIENT_SECRET || "",
      code,
      redirect_uri: redirectUri,
    }),
  });

  const data = await response.json();
  if (!data.ok) {
    throw new Error(`Slack OAuth error: ${data.error}`);
  }

  // Fetch authed user's email
  let authedUserEmail = "";
  try {
    const userRes = await fetch("https://slack.com/api/users.info", {
      headers: { Authorization: `Bearer ${data.access_token}` },
      method: "POST",
      body: new URLSearchParams({ user: data.authed_user?.id || "" }),
    });
    const userData = await userRes.json();
    authedUserEmail = userData.user?.profile?.email || "";
  } catch {
    console.warn("Could not fetch Slack user email");
  }

  return {
    accessToken: data.access_token,
    teamId: data.team?.id || "",
    teamName: data.team?.name || "",
    botUserId: data.bot_user_id || "",
    authedUserEmail,
  };
}
