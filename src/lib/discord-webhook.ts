import 'server-only';

type AdventureNotificationEvent = 'created' | 'started' | 'completed';

interface AdventureNotificationPayload {
  adventureId: string;
  title: string;
  theme: string;
  sessionId?: string;
  baseUrl?: string;
}

function getWebhookUrl(): string | null {
  const webhookUrl = process.env.DISCORD_WEBHOOK?.trim();
  return webhookUrl ? webhookUrl : null;
}

function getBaseUrl(explicitBaseUrl?: string): string | null {
  const candidates = [
    process.env.APP_BASE_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
    explicitBaseUrl,
  ];

  for (const candidate of candidates) {
    const normalized = candidate?.trim().replace(/\/$/, '');
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function getAdventureUrl(baseUrl: string, adventureId: string): string {
  return `${baseUrl}/?adventure=${encodeURIComponent(adventureId)}`;
}

function getDmDashboardUrl(baseUrl: string, adventureId: string): string {
  return `${baseUrl}/?adventure=${encodeURIComponent(adventureId)}&view=dm`;
}

function buildNotificationContent(
  event: AdventureNotificationEvent,
  payload: AdventureNotificationPayload
): string {
  const actionLabel = {
    created: 'Adventure created',
    started: 'Adventure started',
    completed: 'Adventure completed',
  }[event];

  const baseUrl = getBaseUrl(payload.baseUrl);
  const lines = [
    `**${actionLabel}**`,
    '',
    `**Title**: ${payload.title}`,
    `**Adventure ID**: \`${payload.adventureId}\``,
    `**Theme**: \`${payload.theme}\``,
  ];

  if (payload.sessionId) {
    lines.push(`**Session ID**: \`${payload.sessionId}\``);
  }

  if (baseUrl) {
    lines.push('');
    lines.push(`Player Link: ${getAdventureUrl(baseUrl, payload.adventureId)}`);

    if (event === 'started' || event === 'completed') {
      lines.push(`DM Dashboard: ${getDmDashboardUrl(baseUrl, payload.adventureId)}`);
    }
  }

  return lines.join('\n');
}

export async function sendAdventureNotification(
  event: AdventureNotificationEvent,
  payload: AdventureNotificationPayload
): Promise<void> {
  const webhookUrl = getWebhookUrl();
  if (!webhookUrl) {
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: buildNotificationContent(event, payload),
      }),
    });

    if (!response.ok) {
      console.error('Discord webhook notification failed:', response.status, response.statusText);
    }
  } catch (error) {
    console.error('Discord webhook notification failed:', error);
  }
}
