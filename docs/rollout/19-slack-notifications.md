# Phase 19: Slack Notifications & Alerts

**Milestone:** Production Readiness
**Estimated Effort:** 4-5 hours
**Dependencies:** Phase 5 (Logging)
**Blocks:** None

---

## Overview

Implement Slack webhook client, create notification templates for workflow start/completion/failure, gap analysis reports, and error alerts with deep links to traces.

---

## Tasks

### Task 1: Create Slack Client

**File to create:** `src/lib/slack.ts`

**Content:**
```typescript
import { IncomingWebhook } from '@slack/webhook';
import { secrets } from './secrets';
import { logger } from './logger';

const webhook = new IncomingWebhook(secrets.slackWebhookUrl);

export async function postSlackMessage(message: string, blocks?: any[]): Promise<void> {
  try {
    await webhook.send({
      text: message,
      blocks,
    });

    logger.info('Slack message sent', { message });
  } catch (error) {
    logger.error('Failed to send Slack message', { error });
  }
}

export async function postWorkflowStart(data: { workflow: string; client: string }): Promise<void> {
  await postSlackMessage(
    `🚀 Starting ${data.workflow} for ${data.client}`,
    [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Workflow:* ${data.workflow}\\n*Client:* ${data.client}`,
        },
      },
    ]
  );
}

export async function postWorkflowComplete(data: { workflow: string; client: string; metrics: any }): Promise<void> {
  await postSlackMessage(
    `✅ ${data.workflow} completed for ${data.client}`,
    [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Workflow:* ${data.workflow}\\n*Client:* ${data.client}\\n*Metrics:* ${JSON.stringify(data.metrics)}`,
        },
      },
    ]
  );
}

export async function postWorkflowError(data: { workflow: string; client: string; error: string; traceUrl?: string }): Promise<void> {
  const blocks: any[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Workflow:* ${data.workflow}\\n*Client:* ${data.client}\\n*Error:* ${data.error}`,
      },
    },
  ];

  if (data.traceUrl) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'View Trace' },
          url: data.traceUrl,
        },
      ],
    });
  }

  await postSlackMessage(`❌ ${data.workflow} failed for ${data.client}`, blocks);
}

export async function postGapAnalysis(data: { client: string; month: string; gap: number; suggestions: string[] }): Promise<void> {
  const suggestionText = data.suggestions.map((s, i) => `${i + 1}. ${s}`).join('\\n');

  await postSlackMessage(
    `📊 Gap Analysis: ${data.client} (${data.month})`,
    [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Client:* ${data.client}\\n*Month:* ${data.month}\\n*Gap:* ${data.gap} leads\\n\\n*Suggestions:*\\n${suggestionText}`,
        },
      },
    ]
  );
}
```

**Acceptance:**
- [ ] Slack webhook client created
- [ ] Workflow start/complete/error notifications
- [ ] Gap analysis reports
- [ ] Deep links to traces

---

### Task 2: Integrate Slack into Workflows

**Actions:**
Update PT1-PT5 workflows to call Slack functions:
- Call `postWorkflowStart()` at beginning
- Call `postWorkflowComplete()` on success
- Call `postWorkflowError()` on failure
- Call `postGapAnalysis()` in PT3

**Acceptance:**
- [ ] All workflows send Slack notifications
- [ ] Notifications include relevant data

---

## Definition of Done

- [ ] Slack client created
- [ ] Notification templates implemented
- [ ] Workflows send Slack messages
- [ ] Error alerts include trace URLs
- [ ] Gap analysis posted to Slack

---

## Next Phase

**Phase 20:** Dashboard Enhancements & Documentation
