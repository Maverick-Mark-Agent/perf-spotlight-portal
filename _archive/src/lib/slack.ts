import { IncomingWebhook } from '@slack/webhook';
import { secrets } from './secrets';
import { logger } from './logger';

const webhook = new IncomingWebhook(secrets.slackWebhookUrl);

export async function sendSlackNotification(message: string, data?: Record<string, any>): Promise<void> {
  try {
    await webhook.send({
      text: message,
      blocks: data ? [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: message,
          },
        },
        {
          type: 'section',
          fields: Object.entries(data).map(([key, value]) => ({
            type: 'mrkdwn',
            text: `*${key}:*\n${value}`,
          })),
        },
      ] : undefined,
    });

    logger.info('Slack notification sent', { message });
  } catch (error) {
    logger.error('Failed to send Slack notification', { error });
  }
}

export async function notifyWorkflowComplete(workflow: string, client: string, metrics: Record<string, any>): Promise<void> {
  await sendSlackNotification(
    `✅ ${workflow} completed for ${client}`,
    metrics
  );
}

export async function notifyWorkflowFailed(workflow: string, client: string, error: string): Promise<void> {
  await sendSlackNotification(
    `❌ ${workflow} failed for ${client}\n\`\`\`${error}\`\`\``
  );
}
