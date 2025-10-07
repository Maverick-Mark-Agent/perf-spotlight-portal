# Phase 18: Observability (Logging, Traces, Screenshots)

**Milestone:** Production Readiness
**Estimated Effort:** 5-6 hours
**Dependencies:** Phase 5 (Logging), Phase 16 (Orchestrator)
**Blocks:** None

---

## Overview

Enhance logging with step-level tracing, configure Playwright traces on failure, upload screenshots/traces to storage, store URLs in agent_runs and agent_errors tables, create dashboard route to view artifacts.

---

## Tasks

### Task 1: Enhance Logger with Trace IDs

**File to modify:** `src/lib/logger.ts`

**Actions:**
Add trace ID to all logs:
```typescript
export function setTraceId(traceId: string): void {
  process.env.TRACE_ID = traceId;
}

export function getTraceId(): string {
  return process.env.TRACE_ID || 'unknown';
}

// Update formatLog to include traceId
private formatLog(level: LogLevel, message: string, context?: LogContext): string {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    traceId: getTraceId(),
    message,
    ...context,
  };

  return JSON.stringify(logEntry);
}
```

**Acceptance:**
- [ ] Trace IDs included in all logs
- [ ] Can set trace ID per workflow execution

---

### Task 2: Upload Artifacts to Storage

**File to create:** `src/lib/storage.ts`

**Content:**
```typescript
import { supabase } from '@/integrations/supabase/client';
import fs from 'fs/promises';
import { logger } from './logger';

export async function uploadArtifact(filePath: string, bucket: string = 'agent-artifacts'): Promise<string> {
  const fileName = filePath.split('/').pop() || '';
  const fileBuffer = await fs.readFile(filePath);

  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(fileName, fileBuffer, {
      contentType: fileName.endsWith('.png') ? 'image/png' : 'application/zip',
    });

  if (error) {
    logger.error('Failed to upload artifact', { error, filePath });
    throw error;
  }

  const { data: { publicUrl } } = supabase.storage
    .from(bucket)
    .getPublicUrl(fileName);

  logger.info('Artifact uploaded', { url: publicUrl });
  return publicUrl;
}
```

**Acceptance:**
- [ ] Artifacts upload to Supabase Storage
- [ ] Public URLs returned

---

### Task 3: Create Artifacts Dashboard Route

**File to create:** `src/pages/AgentRunHistory.tsx`

**Content:**
```typescript
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export default function AgentRunHistory() {
  const [runs, setRuns] = useState<any[]>([]);

  useEffect(() => {
    loadRuns();
  }, []);

  async function loadRuns() {
    const { data } = await supabase
      .from('agent_runs')
      .select('*, agent_errors(*)')
      .order('started_at', { ascending: false })
      .limit(50);

    setRuns(data || []);
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Agent Run History</h1>

      {runs.map((run) => (
        <div key={run.run_id} className="border rounded p-4 mb-4">
          <h3 className="font-semibold">{run.workflow}</h3>
          <p>Status: {run.status}</p>
          <p>Started: {new Date(run.started_at).toLocaleString()}</p>
          {run.trace_url && (
            <a href={run.trace_url} className="text-blue-500" target="_blank" rel="noopener">
              View Trace
            </a>
          )}

          {run.agent_errors?.map((error: any) => (
            <div key={error.id} className="mt-2 p-2 bg-red-50 rounded">
              <p className="text-sm text-red-800">{error.message}</p>
              {error.screenshot_url && (
                <img src={error.screenshot_url} alt="Error screenshot" className="mt-2 max-w-md" />
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

**Acceptance:**
- [ ] Dashboard shows agent runs
- [ ] Displays screenshots and traces
- [ ] Errors visible with context

---

## Definition of Done

- [ ] Trace IDs in logs
- [ ] Playwright traces captured
- [ ] Artifacts uploaded to storage
- [ ] Dashboard displays runs and errors
- [ ] Screenshots visible in UI

---

## Next Phase

**Phase 19:** Slack Notifications & Alerts
