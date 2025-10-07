# Phase 15: PT5 - Evergreen Campaign Updates

**Milestone:** Workflow Automation
**Estimated Effort:** 5-6 hours
**Dependencies:** Phase 8 (Bison), Phase 14 (PT4)
**Blocks:** Phase 17

---

## Overview

Implement PT5 workflow: find Evergreen campaign by title pattern, determine next renewal window, add contacts, rename campaign, post Slack completion.

---

## Tasks

### Task 1: Create PT5 Workflow

**File to create:** `src/workflows/pt5-evergreen-update.ts`

**Content:**
```typescript
import { BisonConnector } from '@connectors/bison';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@lib/logger';

export interface PT5Config {
  clientId: number;
  clientName: string;
  workspace: string;
}

export async function executePT5(config: PT5Config): Promise<void> {
  logger.info('Starting PT5 - Evergreen Update', { client: config.clientName });

  const bison = new BisonConnector();

  try {
    await bison.connect(config.workspace);

    // Find Evergreen campaign
    const campaign = await bison.findCampaign('Evergreen, Last Upload:');

    if (!campaign) {
      throw new Error('Evergreen campaign not found');
    }

    logger.info('Found campaign', { title: campaign.title });

    // Parse current window from title
    const currentWindow = parseWindowFromTitle(campaign.title);
    const nextWindow = calculateNextWindow(currentWindow);

    // Find matching contact list
    const listName = `${nextWindow.month} (${nextWindow.start} - ${nextWindow.end} renewals)`;

    // Add contacts to campaign
    await bison.addContactsToCampaign(campaign.id, listName);

    // Rename campaign
    const newTitle = `Evergreen, Last Upload: ${nextWindow.month} ${nextWindow.start}-${nextWindow.end}`;
    await bison.renameCampaign(campaign.id, newTitle);

    logger.info('PT5 completed successfully', { newTitle });

    await postCompletionNotification({
      client: config.clientName,
      window: `${nextWindow.start}-${nextWindow.end}`,
    });

    await bison.disconnect();

  } catch (error) {
    logger.error('PT5 failed', { error });
    throw error;
  }
}

function parseWindowFromTitle(title: string): { month: string; start: string; end: string } {
  // Parse "Evergreen, Last Upload: January 1-7"
  const match = title.match(/(\\w+)\\s+(\\d+)-(\\d+)/);
  return {
    month: match?.[1] || '',
    start: match?.[2] || '',
    end: match?.[3] || '',
  };
}

function calculateNextWindow(current: { month: string; start: string; end: string }): { month: string; start: string; end: string } {
  // Calculate next 7-day window
  const startDay = parseInt(current.end) + 1;
  const endDay = startDay + 6;

  return {
    month: current.month,
    start: startDay.toString(),
    end: endDay.toString(),
  };
}

async function postCompletionNotification(data: any): Promise<void> {
  logger.info('Completion notification (placeholder)', data);
}
```

**Acceptance:**
- [ ] PT5 workflow complete
- [ ] Finds Evergreen campaign
- [ ] Adds correct contacts
- [ ] Renames campaign
- [ ] Posts Slack notification

---

## Next Milestone

**Milestone 4: Production Readiness** (Phases 16-20)
