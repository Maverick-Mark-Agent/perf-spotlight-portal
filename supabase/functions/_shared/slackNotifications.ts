// Slack notification helpers for the auto-reply pipeline.
//
// Two channels in play:
//   AI_REPLY_ALERTS_SLACK_WEBHOOK_URL    — existing, used by send-reply-via-bison
//                                          for hard send failures.
//   AUTO_REPLY_REVIEW_SLACK_WEBHOOK_URL  — new, fires when a draft is escalated
//                                          to human review (status='review_required').
//
// Both env vars are optional — if unset, helpers log a warning and no-op.
// Slack failures NEVER block the worker (the queue row is the source of
// truth; Slack is just visibility).

interface AutoReplyEscalationInput {
  workspace: string;
  leadName: string;
  leadEmail: string;
  auditScore: number | null;
  auditThreshold: number;
  auditReasoning: string | null;
  auditIssues?: Array<{ type?: string; severity?: string; detail?: string }>;
  queueRowId: string;
  dashboardUrl?: string;          // Optional deep-link to /live-replies?review=<id>
}

const REVIEW_WEBHOOK = Deno.env.get('AUTO_REPLY_REVIEW_SLACK_WEBHOOK_URL');

function truncate(s: string | null, max = 600): string {
  if (!s) return '(no reasoning provided)';
  return s.length > max ? s.slice(0, max) + '…' : s;
}

/**
 * Post an escalation notification when an auto-reply draft is routed
 * to human review. Best-effort: catches its own errors so the worker
 * keeps moving.
 */
export async function sendAutoReplyEscalation(input: AutoReplyEscalationInput): Promise<void> {
  if (!REVIEW_WEBHOOK) {
    console.warn('AUTO_REPLY_REVIEW_SLACK_WEBHOOK_URL not set — skipping escalation notification');
    return;
  }

  const scoreText = input.auditScore == null
    ? 'n/a'
    : `${input.auditScore}/100 (threshold ${input.auditThreshold})`;

  const issuesText = input.auditIssues && input.auditIssues.length > 0
    ? input.auditIssues
        .slice(0, 5)
        .map((i) => `• [${i.severity ?? 'low'}] ${i.type ?? 'issue'}: ${i.detail ?? ''}`)
        .join('\n')
    : '(none)';

  const dashboardLine = input.dashboardUrl
    ? { type: 'section', text: { type: 'mrkdwn', text: `<${input.dashboardUrl}|Open in dashboard →>` } }
    : null;

  const body = {
    text: `:eyes: Auto-reply escalated to review — ${input.workspace}`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '👀 Auto-reply escalated to review' },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Workspace:*\n${input.workspace}` },
          { type: 'mrkdwn', text: `*Lead:*\n${input.leadName}` },
          { type: 'mrkdwn', text: `*Email:*\n${input.leadEmail}` },
          { type: 'mrkdwn', text: `*Audit score:*\n${scoreText}` },
        ],
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Audit reasoning:*\n${truncate(input.auditReasoning)}` },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: `*Issues:*\n${issuesText}` },
      },
      ...(dashboardLine ? [dashboardLine] : []),
      {
        type: 'context',
        elements: [{ type: 'mrkdwn', text: `queue_id: \`${input.queueRowId}\`` }],
      },
    ],
  };

  try {
    const resp = await fetch(REVIEW_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      console.error(`Slack escalation returned ${resp.status}: ${await resp.text()}`);
    } else {
      console.log(`📣 Slack escalation posted for queue row ${input.queueRowId}`);
    }
  } catch (e) {
    console.error('Slack escalation error:', (e as Error).message);
  }
}
